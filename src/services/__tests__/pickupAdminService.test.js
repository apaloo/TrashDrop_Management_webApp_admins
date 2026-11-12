// Staff actions on pickup requests (critical workflow): what the Pickup
// Requests page writes. Checked against production on 2026-11-12: every
// column these actions write exists on pickup_requests and digital_bins;
// scheduled_pickups has no collector_id (and no rows), so assigning one is
// refused before it reaches the database.
import {
  assignCollector, setCollectorOnActiveRequest, changeStatus, cancelRequest, notifyCollector, fetchRequestPhotos,
} from '../pickupAdminService';

// Every query call is recorded as [method, ...args]; mockAnswer decides the result.
// Plain functions, not jest.fn: CRA's resetMocks would wipe implementations.
let mockCalls = [];
let mockAnswer = () => ({ data: [{ id: 'r1', status: 'accepted' }], error: null });
jest.mock('../../utils/supabase', () => {
  const builder = () => {
    const b = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve) => resolve(mockAnswer(mockCalls));
        return (...args) => {
          mockCalls.push([method, ...args]);
          return ['single', 'maybeSingle'].includes(method) ? Promise.resolve(mockAnswer(mockCalls)) : b;
        };
      },
    });
    return b;
  };
  return {
    supabase: {
      from: (table) => { mockCalls.push(['from', table]); return builder(); },
      rpc: (fn, args) => { mockCalls.push(['rpc', fn, args]); return Promise.resolve(mockAnswer(mockCalls)); },
    },
  };
});
let mockFailures = [];
jest.mock('../auditLogService', () => ({ logFailure: (...args) => { mockFailures.push(args); } }));
jest.mock('../../utils/pickupService', () => ({ fetchPickupRequests: () => Promise.resolve([]) }));

const collector = { id: 'cp1', userId: 'u-col' };
const pending = { id: 'r1', source: 'pickup_requests', status: 'pending', address: 'Spintex Road' };
const updates = () => mockCalls.filter(([m]) => m === 'update').map(([, payload]) => payload);
const tables = () => mockCalls.filter(([m]) => m === 'from').map(([, t]) => t);

beforeEach(() => {
  mockCalls = [];
  mockFailures = [];
  mockAnswer = () => ({ data: [{ id: 'r1', status: 'accepted' }], error: null });
});

describe('assignCollector', () => {
  it('accepts the request for the collector and tells them', async () => {
    await assignCollector(pending, collector);

    const [payload] = updates();
    expect(payload).toMatchObject({ status: 'accepted', collector_id: 'u-col' });
    expect(payload.accepted_at).toBe(payload.updated_at);
    expect(mockCalls).toContainEqual(['eq', 'id', 'r1']);
    expect(tables()).toEqual(['pickup_requests', 'notifications']);
    const note = mockCalls.find(([m]) => m === 'insert')[1];
    expect(note).toMatchObject({ user_id: 'u-col', type: 'pickup_assigned', read: false });
    expect(note.message).toContain('Spintex Road');
  });

  it('writes no accepted_at on a digital bin', async () => {
    await assignCollector({ ...pending, source: 'digital_bins' }, collector);
    expect(tables()[0]).toBe('digital_bins');
    expect(updates()[0]).not.toHaveProperty('accepted_at');
  });

  it('refuses a request that is not pending, without writing', async () => {
    await expect(assignCollector({ ...pending, status: 'en_route' }, collector)).rejects.toThrow(/Only pending requests/);
    expect(updates()).toHaveLength(0);
  });

  it('refuses a collector without a user account', async () => {
    await expect(assignCollector(pending, { id: 'cp2' })).rejects.toThrow(/no linked user account/);
    expect(updates()).toHaveLength(0);
  });

  it('refuses a scheduled pickup (that table has no collector column)', async () => {
    await expect(assignCollector({ ...pending, source: 'scheduled_pickups' }, collector)).rejects.toThrow(/Scheduled pickups/);
    await expect(setCollectorOnActiveRequest({ ...pending, source: 'scheduled_pickups', status: 'en_route' }, collector)).rejects.toThrow(/Scheduled pickups/);
    expect(mockCalls).toHaveLength(0);
  });

  it('never reports a refused update as saved, and logs it', async () => {
    mockAnswer = () => ({ data: [], error: null }); // row-level security hides the row
    await expect(assignCollector(pending, collector)).rejects.toThrow(/not found, or you do not have permission/);
    expect(mockFailures[0][0]).toBe('request.update_failed');
    expect(tables()).not.toContain('notifications');
  });

  it('keeps the assignment when the notification fails', async () => {
    mockAnswer = (calls) => (calls.some(([m]) => m === 'insert') ? { error: { message: 'denied' } } : { data: [{ id: 'r1', status: 'accepted' }], error: null });
    await expect(assignCollector(pending, collector)).resolves.toEqual({ id: 'r1', status: 'accepted' });
    expect(mockFailures[0][0]).toBe('notification.failed');
  });
});

describe('setCollectorOnActiveRequest', () => {
  it('puts a collector on a job under way without changing its status', async () => {
    await setCollectorOnActiveRequest({ ...pending, status: 'en_route' }, collector);
    expect(updates()[0]).toMatchObject({ collector_id: 'u-col' });
    expect(updates()[0]).not.toHaveProperty('status');
  });

  it('assigns a pending request the normal way', async () => {
    await setCollectorOnActiveRequest(pending, collector);
    expect(updates()[0].status).toBe('accepted');
  });

  it('refuses a finished request', async () => {
    await expect(setCollectorOnActiveRequest({ ...pending, status: 'completed' }, collector)).rejects.toThrow(/can't be given a collector/);
  });
});

describe('changeStatus', () => {
  const accepted = { ...pending, status: 'accepted', collectorRef: 'cp1' };

  it('moves along the status flow', async () => {
    await changeStatus(accepted, 'en_route');
    expect(updates()[0].status).toBe('en_route');
  });

  it('writes completed for Done', async () => {
    await changeStatus({ ...accepted, status: 'arrived' }, 'disposed');
    expect(updates()[0].status).toBe('completed');
  });

  it('refuses a skipped or backward step', async () => {
    await expect(changeStatus(accepted, 'collecting')).rejects.toThrow(/Can't change from/);
    await expect(changeStatus({ ...accepted, status: 'en_route' }, 'accepted')).rejects.toThrow(/Can't change from/);
    expect(updates()).toHaveLength(0);
  });

  it('needs a collector first', async () => {
    await expect(changeStatus({ ...accepted, collectorRef: null }, 'en_route')).rejects.toThrow(/Assign a collector first/);
  });
});

describe('cancelRequest', () => {
  it('records who cancelled, when and why', async () => {
    await cancelRequest(pending, { reason: 'Duplicate request', note: 'booked twice', userId: 'staff1' });
    const [payload] = updates();
    expect(payload).toMatchObject({ status: 'cancelled', cancelled_by: 'staff1', cancellation_reason: 'Duplicate request: booked twice' });
    expect(payload.cancelled_at).toBe(payload.updated_at);
  });

  it('needs a reason', async () => {
    await expect(cancelRequest(pending, { reason: '' })).rejects.toThrow(/cancellation reason/);
  });

  it('refuses once collecting has started', async () => {
    await expect(cancelRequest({ ...pending, status: 'collecting' }, { reason: 'Duplicate request' })).rejects.toThrow(/can't be cancelled/);
    expect(updates()).toHaveLength(0);
  });
});

describe('notifyCollector and photos', () => {
  it('sends nothing to a collector without an account', async () => {
    expect(await notifyCollector({ id: 'cp2' }, { title: 't', message: 'm', type: 'x' })).toBe(false);
    expect(mockCalls).toHaveLength(0);
  });

  it('reads photos only for digital bins, and accepts JSON text', async () => {
    expect(await fetchRequestPhotos(pending)).toEqual([]);
    mockAnswer = () => ({ data: { photo_urls: '["https://a/1.jpg", ""]' }, error: null });
    expect(await fetchRequestPhotos({ id: 'b1', source: 'digital_bins' })).toEqual(['https://a/1.jpg']);
  });
});
