// The Live Map's request loader: one read of the admin_pickup_requests view,
// plus sign-in emails for customers the view can't name.
import { fetchPickupRequests, toMapRequest } from '../pickupService';

// Every call is recorded as [method, ...args]; mockAnswer decides results.
let mockCalls = [];
let mockRows = [];
let mockRpc = () => ({ data: [], error: null });
jest.mock('../supabase', () => {
  const builder = () => {
    const b = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve) => resolve({ data: mockRows, error: null });
        return (...args) => { mockCalls.push([method, ...args]); return b; };
      },
    });
    return b;
  };
  return {
    supabase: {
      from: (table) => { mockCalls.push(['from', table]); return builder(); },
      rpc: (fn, args) => { mockCalls.push(['rpc', fn, args]); return Promise.resolve(mockRpc(args)); },
    },
  };
});

const bin = {
  id: 'b1', source: 'digital_bins', status: 'accepted', created_at: '2026-11-13T08:00:00Z', user_id: 'u1',
  customer_name: 'Ama Owusu', customer_email: 'ama@example.org', customer_phone: '+233200000001',
  address: 'Spintex Road', lat: '5.64', lng: '-0.11', waste_type: 'recycling', bag_count: 2, bin_size_liters: 240,
  fee: '31.00', is_urgent: false, priority: 'medium', notes: 'Gate 3', scheduled_date: null,
  collector_ref: 'cu1', collector_profile_id: 'cp1', collector_name: 'Kofi Mensah', collector_total_payout: '24.80',
  accepted_at: '2026-11-13T08:05:00Z', picked_up_at: null,
};
const guest = { ...bin, id: 'b2', user_id: 'u-guest', customer_name: null, customer_email: null, customer_phone: null, collector_ref: null, collector_profile_id: null, collector_name: null };

beforeEach(() => { mockCalls = []; mockRows = []; mockRpc = () => ({ data: [], error: null }); });

describe('fetchPickupRequests', () => {
  test('one read of the view, newest first, limited across both sources', async () => {
    mockRows = [bin];
    await fetchPickupRequests({ limit: 500 });
    expect(mockCalls.filter(([m]) => m === 'from')).toEqual([['from', 'admin_pickup_requests']]);
    expect(mockCalls).toContainEqual(['order', 'created_at', { ascending: false }]);
    expect(mockCalls).toContainEqual(['limit', 500]);
    expect(mockCalls.some(([m]) => m === 'rpc')).toBe(false); // everyone is named: no email lookup
  });

  test('status and collector filters', async () => {
    await fetchPickupRequests({ status: 'Pending', collectorId: 'cp1' });
    expect(mockCalls).toContainEqual(['eq', 'status', 'pending']);
    expect(mockCalls).toContainEqual(['eq', 'collector_profile_id', 'cp1']);
  });

  test('customers without name, email or phone get their sign-in email, once per user', async () => {
    mockRows = [bin, guest, { ...guest, id: 'b3' }];
    mockRpc = () => ({ data: [{ id: 'u-guest', email: 'guest123@gmail.com' }], error: null });
    const rows = await fetchPickupRequests();
    expect(mockCalls.filter(([m]) => m === 'rpc')).toEqual([['rpc', 'get_user_emails', { user_ids: ['u-guest'] }]]);
    expect(rows[1].requestedBy).toEqual({ id: 'u-guest', name: 'guest123', email: 'guest123@gmail.com', phone: null });
  });

  test('when the email lookup is refused or fails, those customers stay unnamed (never made up)', async () => {
    mockRows = [guest];
    mockRpc = () => ({ data: null, error: { message: 'permission denied' } });
    expect((await fetchPickupRequests())[0].requestedBy).toEqual({ id: 'u-guest', name: null, email: null, phone: null });
  });
});

describe('toMapRequest', () => {
  test('maps a view row to what the Live Map shows', () => {
    expect(toMapRequest(bin)).toMatchObject({
      id: 'b1', source: 'digital_bins', status: 'accepted',
      requestedBy: { id: 'u1', name: 'Ama Owusu', email: 'ama@example.org', phone: '+233200000001' },
      location: { address: 'Spintex Road', lat: 5.64, lng: -0.11 },
      requestTime: '2026-11-13T08:00:00Z', wasteType: 'recycling', bags: 2,
      collectorId: 'cp1', collectorName: 'Kofi Mensah', assignedTo: { id: 'cp1', name: 'Kofi Mensah' },
      fee: 31, collectorPayout: 24.8, binSizeLiters: 240, priority: 'Normal', isUrgent: false,
    });
    expect(toMapRequest({ ...bin, is_urgent: true }).priority).toBe('High');
  });

  test('unassigned and unplaced requests stay empty, not invented', () => {
    const r = toMapRequest({ id: 7, status: null, lat: null, lng: null });
    expect(r).toMatchObject({ id: '7', status: 'pending', collectorId: null, assignedTo: null, location: { address: null, lat: null, lng: null } });
  });
});
