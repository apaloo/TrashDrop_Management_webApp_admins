// The Alerts page's data layer: what staff actions write, and that every
// failure is reported as one (never "saved" when it wasn't), and logged.
// The database records each change in alert_activity and notifies people
// (20261017_alerts_rules.sql); run_alert_rules decides the automatic alerts.
import {
  isMissingSchema, fetchAlerts, setAlertStatus, bulkSetStatus, assignAlert, createAlert, fetchActivity,
  addComment, logAlertAction, fetchStaff, sendNotification, setRequestLocation, fetchRuleSettings,
  saveRuleSetting, runRules, subscribeToAlerts,
} from '../alertAdminService';

let mockCalls = [];
let mockAnswer = () => ({ data: [{ id: 'a1', status: 'open', title: 'T' }], error: null });
let mockChannel = null;
jest.mock('../../utils/supabase', () => {
  const builder = (own) => {
    const b = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve) => resolve(mockAnswer(own));
        return (...args) => {
          own.push([method, ...args]);
          mockCalls.push([method, ...args]);
          return ['single', 'maybeSingle'].includes(method) ? Promise.resolve(mockAnswer(own)) : b;
        };
      },
    });
    return b;
  };
  return {
    supabase: {
      from: (table) => { mockCalls.push(['from', table]); return builder([['from', table]]); },
      rpc: (fn, args) => { mockCalls.push(['rpc', fn, args]); return Promise.resolve(mockAnswer([['rpc', fn, args]])); },
      channel: (name) => {
        mockCalls.push(['channel', name]);
        if (mockChannel instanceof Error) throw mockChannel;
        const c = { on: (...args) => { mockCalls.push(['on', ...args]); return c; }, subscribe: () => c };
        return c;
      },
      removeChannel: (c) => { mockCalls.push(['removeChannel', c]); },
    },
  };
});
let mockFailures = [];
jest.mock('../auditLogService', () => ({ logFailure: (...args) => { mockFailures.push(args); } }));

const called = (m) => mockCalls.filter(([x]) => x === m).map(([, ...a]) => a);
const ALERT = { id: 'a1', status: 'open' };

beforeEach(() => {
  mockCalls = [];
  mockFailures = [];
  mockChannel = null;
  mockAnswer = () => ({ data: [{ id: 'a1', status: 'open', title: 'T' }], error: null });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('isMissingSchema', () => {
  it('knows a migration that has not been run from a real failure', () => {
    for (const e of [{ code: '42P01' }, { code: 'PGRST204' }, { message: 'column "status" does not exist' }, { message: 'Could not find the table' }]) {
      expect(isMissingSchema(e)).toBe(true);
    }
    expect(isMissingSchema({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingSchema(null)).toBe(false);
  });
});

describe('fetchAlerts', () => {
  it('reads all alerts newest first, 1,000 at a time', async () => {
    mockAnswer = (own) => {
      const [, from] = own.find(([m]) => m === 'range');
      return { data: from === 0 ? Array.from({ length: 1000 }, (_, i) => ({ id: i, status: 'open' })) : [{ id: 'x', status: 'open' }], error: null };
    };
    const { alerts, needsMigration } = await fetchAlerts();
    expect(alerts).toHaveLength(1001);
    expect(called('range')).toEqual([[0, 999], [1000, 1999]]);
    expect(called('order')[0]).toEqual(['created_at', { ascending: false }]);
    expect(needsMigration).toBe(false);
  });

  it('says when the status column is missing (migration not run); a failure throws', async () => {
    mockAnswer = () => ({ data: [{ id: 'a1', title: 'old' }], error: null });
    expect((await fetchAlerts()).needsMigration).toBe(true);
    mockAnswer = () => ({ data: [], error: null });
    expect(await fetchAlerts()).toEqual({ alerts: [], needsMigration: false });
    mockAnswer = () => ({ data: null, error: { message: 'permission denied' } });
    await expect(fetchAlerts()).rejects.toThrow('permission denied');
  });
});

describe('setAlertStatus and bulkSetStatus', () => {
  it('resolving needs a note, and records who resolved it and how', async () => {
    await expect(setAlertStatus(ALERT, 'resolved', { note: '  ' })).rejects.toThrow('Add a note saying how it was resolved');
    expect(called('update')).toEqual([]);
    await setAlertStatus(ALERT, 'resolved', { note: ' Collector re-assigned ', userId: 'staff-1' });
    expect(called('update')[0][0]).toEqual({ status: 'resolved', resolution_note: 'Collector re-assigned', resolved_by: 'staff-1' });
    expect(called('eq')).toContainEqual(['id', 'a1']);
  });

  it('closing keeps an optional note; reopening or acknowledging clears the old resolution', async () => {
    await setAlertStatus(ALERT, 'closed');
    expect(called('update')[0][0]).toEqual({ status: 'closed', resolution_note: null });
    mockCalls = [];
    await setAlertStatus(ALERT, 'open');
    expect(called('update')[0][0]).toEqual({ status: 'open', resolution_note: null });
    mockCalls = [];
    await setAlertStatus(ALERT, 'acknowledged');
    expect(called('update')[0][0]).toEqual({ status: 'acknowledged', resolution_note: null });
  });

  it('a refused update (nothing changed) is an error, never "saved", and is logged', async () => {
    mockAnswer = () => ({ data: [], error: null });
    await expect(setAlertStatus(ALERT, 'closed')).rejects.toThrow('Alert not found, or you do not have permission to change it');
    expect(mockFailures[0][0]).toBe('alert.update_failed');
    expect(mockFailures[0][1]).toMatchObject({ entityId: 'a1', context: { attempted: { status: 'closed' } } });
    mockAnswer = () => ({ data: null, error: { message: 'row-level security' } });
    await expect(assignAlert(ALERT, 'u1')).rejects.toThrow('row-level security');
  });

  it('bulk: counts what changed and lists what did not, with the reason', async () => {
    let n = 0;
    mockAnswer = () => (++n === 2 ? { data: [], error: null } : { data: [{ id: 'x', status: 'closed' }], error: null });
    const r = await bulkSetStatus([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'closed');
    expect(r.ok).toBe(2);
    expect(r.failed).toEqual([{ alert: { id: 'b' }, message: 'Alert not found, or you do not have permission to change it' }]);
  });

  it('assigning or unassigning sets assigned_to only', async () => {
    await assignAlert(ALERT, 'staff-2');
    await assignAlert(ALERT, '');
    expect(called('update').map(([p]) => p)).toEqual([{ assigned_to: 'staff-2' }, { assigned_to: null }]);
  });
});

describe('createAlert', () => {
  it('sends exactly the form, opened, by the signed-in member of staff', async () => {
    mockAnswer = () => ({ data: { id: 'n1', status: 'open', title: 'Bins overflowing' }, error: null });
    await createAlert({
      title: ' Bins overflowing ', description: ' ', type: 'manual', priority: 'high',
      entity: { type: 'pickup_request', source: 'digital_bins', ref: 'b1', label: 'Bin b1' },
      assignedTo: 'staff-2', location: { lat: 5.6, lng: -0.19, address: 'Madina' },
    }, 'staff-1');
    expect(called('insert')[0][0]).toEqual({
      title: 'Bins overflowing', description: null, type: 'manual', severity: 'high', status: 'open',
      entity_type: 'pickup_request', entity_source: 'digital_bins', entity_ref: 'b1', assigned_to: 'staff-2',
      location_lat: 5.6, location_lng: -0.19, location_address: 'Madina', metadata: { label: 'Bin b1' }, created_by: 'staff-1',
    });
  });

  it('a system alert with nothing attached; a refusal throws and is logged', async () => {
    mockAnswer = () => ({ data: { id: 'n2', status: 'open' }, error: null });
    await createAlert({ title: 'T', description: 'D', type: 'manual', priority: 'low' });
    expect(called('insert')[0][0]).toMatchObject({ entity_type: 'system', entity_ref: null, assigned_to: null, location_lat: null, metadata: {}, created_by: null });
    mockAnswer = () => ({ data: null, error: { message: 'Only staff can create alerts' } });
    await expect(createAlert({ title: 'T', description: '', type: 'manual', priority: 'low' })).rejects.toThrow('Only staff can create alerts');
    expect(mockFailures.at(-1)[1]).toMatchObject({ context: { operation: 'create', title: 'T' } });
  });
});

describe('timeline: activity, comments and actions', () => {
  it('reads the timeline in order; null when the migration is not run; other failures throw', async () => {
    mockAnswer = () => ({ data: [{ id: 1 }], error: null });
    await expect(fetchActivity('a1')).resolves.toEqual([{ id: 1 }]);
    expect(called('order')).toEqual([['created_at', { ascending: true }], ['id', { ascending: true }]]);
    mockAnswer = () => ({ data: null, error: { code: '42P01' } });
    await expect(fetchActivity('a1')).resolves.toBeNull();
    mockAnswer = () => ({ data: null, error: { message: 'timeout' } });
    await expect(fetchActivity('a1')).rejects.toThrow('timeout');
  });

  it('a comment needs text, and is saved trimmed', async () => {
    await expect(addComment(ALERT, '  ')).rejects.toThrow('Write a comment first');
    mockAnswer = () => ({ error: null });
    await addComment(ALERT, ' Called the household ');
    expect(called('insert')[0][0]).toEqual({ alert_id: 'a1', kind: 'comment', to_value: null, note: 'Called the household', data: {} });
  });

  it('an action is logged with its outcome; logging it never throws', async () => {
    mockAnswer = () => ({ error: null });
    await logAlertAction(ALERT, 'notify_customer', { ok: false, note: 'no phone' });
    expect(called('insert')[0][0]).toEqual({ alert_id: 'a1', kind: 'action', to_value: 'notify_customer', note: 'Failed: no phone', data: { ok: false } });
    mockAnswer = () => ({ error: { message: 'denied' } });
    await expect(logAlertAction(ALERT, 'x')).resolves.toBeUndefined();
  });
});

describe('people, notifications and locations', () => {
  it('staff for "Assign to" come from the database, or none at all (never made up)', async () => {
    mockAnswer = () => ({ data: [{ id: 's1', email: 'ops@example.org', name: null }], error: null });
    await expect(fetchStaff()).resolves.toEqual({ staff: [{ id: 's1', email: 'ops@example.org', name: 'ops@example.org' }], fromDatabase: true });
    for (const answer of [{ data: [], error: null }, { data: null, error: { message: 'x' } }]) {
      mockAnswer = () => answer;
      await expect(fetchStaff()).resolves.toEqual({ staff: [], fromDatabase: false });
    }
  });

  it('a notification needs an account; a refusal throws and is logged', async () => {
    await expect(sendNotification(null, { title: 'T', message: 'M' })).rejects.toThrow('No user account to notify');
    mockAnswer = () => ({ error: null });
    await sendNotification('u1', { title: 'T', message: 'M' });
    expect(called('insert')[0][0]).toEqual({ user_id: 'u1', title: 'T', message: 'M', type: 'info', read: false });
    mockAnswer = () => ({ error: { message: 'denied' } });
    await expect(sendNotification('u1', { title: 'T', message: 'M' })).rejects.toThrow('denied');
    expect(mockFailures.at(-1)[0]).toBe('notification.failed');
  });

  it('fixing a request\'s location goes through the database function; a refusal throws', async () => {
    mockAnswer = () => ({ error: null });
    await setRequestLocation('digital_bins', 42, 5.6, -0.19);
    expect(called('rpc')).toEqual([['admin_set_request_location', { p_source: 'digital_bins', p_id: '42', p_lat: 5.6, p_lng: -0.19 }]]);
    mockAnswer = () => ({ error: { message: 'Location is outside Ghana and Liberia' } });
    await expect(setRequestLocation('digital_bins', 42, 0, 0)).rejects.toThrow('Location is outside Ghana and Liberia');
  });
});

describe('alert rules', () => {
  it('settings by rule key; null when the migration is not run', async () => {
    mockAnswer = () => ({ data: [{ rule_key: 'low_rating', enabled: true, params: { max_stars: 2 }, updated_at: 't' }], error: null });
    await expect(fetchRuleSettings()).resolves.toEqual({ low_rating: { enabled: true, params: { max_stars: 2 }, updatedAt: 't' } });
    mockAnswer = () => ({ data: null, error: { code: '42P01' } });
    await expect(fetchRuleSettings()).resolves.toBeNull();
    mockAnswer = () => ({ data: null, error: { message: 'x' } });
    await expect(fetchRuleSettings()).rejects.toThrow('x');
  });

  it('saving a rule: a refusal or an unknown rule is an error', async () => {
    mockAnswer = () => ({ data: [{ rule_key: 'low_rating' }], error: null });
    await saveRuleSetting('low_rating', { enabled: false, params: {} }, 'staff-1');
    expect(called('update')[0][0]).toMatchObject({ enabled: false, params: {}, updated_by: 'staff-1' });
    expect(called('eq')).toContainEqual(['rule_key', 'low_rating']);
    mockAnswer = () => ({ data: [], error: null });
    await expect(saveRuleSetting('nope', { enabled: true, params: {} })).rejects.toThrow('Rule not found, or you do not have permission to change it');
    mockAnswer = () => ({ data: null, error: { message: 'denied' } });
    await expect(saveRuleSetting('low_rating', { enabled: true, params: {} })).rejects.toThrow('denied');
  });

  it('running the rules is a dry run unless asked; a failure throws', async () => {
    mockAnswer = () => ({ data: [{ rule: 'low_rating', created: 1 }], error: null });
    await expect(runRules()).resolves.toEqual([{ rule: 'low_rating', created: 1 }]);
    await runRules(false);
    expect(called('rpc')).toEqual([['run_alert_rules', { p_dry_run: true }], ['run_alert_rules', { p_dry_run: false }]]);
    mockAnswer = () => ({ data: null, error: { message: 'boom' } });
    await expect(runRules()).rejects.toThrow('boom');
  });
});

describe('subscribeToAlerts', () => {
  it('listens to every change to alerts, and the returned function stops it', () => {
    const onChange = () => {};
    const stop = subscribeToAlerts(onChange);
    expect(called('on')[0]).toEqual(['postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, onChange]);
    stop();
    expect(called('removeChannel')).toHaveLength(1);
  });

  it('when live updates are unavailable, the page still works (a no-op stop)', () => {
    mockChannel = new Error('realtime unavailable');
    const stop = subscribeToAlerts(() => {});
    expect(() => stop()).not.toThrow();
  });
});
