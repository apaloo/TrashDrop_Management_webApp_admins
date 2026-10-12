import {
  normalizeAlert, filterAlerts, sortAlerts, alertStats, relatedRecord, DEFAULT_ALERT_FILTERS, exportRows, toAlertsCsv, ageLabel,
} from '../alertUtils';
import { alertStatus, alertPriority, alertType } from '../../constants/alerts';
import { actionsFor } from '../../components/alerts/alertActions';
import { normalizeViewRow } from '../pickupRequestUtils';

const NOW = new Date('2026-10-17T12:00:00Z');
const ago = (h) => new Date(NOW.getTime() - h * 3600e3).toISOString();
const F = (over = {}) => ({ ...DEFAULT_ALERT_FILTERS, ...over });

describe('one definition of status / priority / type', () => {
  it('maps every stored spelling to one key', () => {
    expect(alertStatus('Closed').key).toBe('closed');
    expect(alertStatus('In Progress').key).toBe('in_progress');
    expect(alertStatus('active').key).toBe('open');
    expect(alertStatus('auto_resolved').key).toBe('resolved');
    expect(alertStatus(undefined).key).toBe('open'); // rows from before the status column
    expect(alertPriority('Medium').key).toBe('medium');
    expect(alertPriority('URGENT').key).toBe('critical');
    expect(alertType('info').key).toBe('system');
    expect(alertType(null).label).toBe('System');
  });
});

// The seed row as it is stored today: no status column, lower-case severity, type 'info'
const seed = normalizeAlert({ id: 's1', title: 'System Alert', description: 'Sample alert for dashboard display', type: 'info', severity: 'medium', entity_type: 'system', entity_id: null, created_at: ago(400) });
const rows = [
  seed,
  normalizeAlert({ id: 'a1', title: 'Request #10000001 not assigned', status: 'open', severity: 'critical', type: 'request_delay', rule_key: 'pending_unassigned', entity_type: 'pickup_request', entity_source: 'pickup_requests', entity_ref: '10000001-aaaa', created_at: ago(1), metadata: { customer: 'Abena' } }),
  normalizeAlert({ id: 'a2', title: 'Old fee', status: 'Closed', severity: 'Low', type: 'fee_mismatch', entity_source: 'digital_bins', entity_ref: '20000001-bbbb', created_at: ago(30) }),
  normalizeAlert({ id: 'a3', title: 'Jack silent', status: 'resolved', severity: 'medium', type: 'collector_offline', entity_source: 'collector_profiles', entity_ref: 'c1', created_at: ago(5), auto_resolved: true }),
  normalizeAlert({ id: 'a4', title: 'High one', status: 'in_progress', severity: 'high', type: 'stalled_job', entity_source: 'pickup_requests', entity_ref: '10000004', created_at: ago(2), assigned_to: 'u1' }),
];

describe('normalizeAlert', () => {
  it('turns the seed row into an open, medium, System alert with no linked record', () => {
    expect(seed).toMatchObject({ status: 'open', priority: 'medium', type: 'system', entity: null, hasStatusColumn: false });
  });
  it('links the related record from entity_source/entity_ref', () => {
    expect(rows[2].entity).toEqual({ type: 'pickup_request', ref: '20000001-bbbb', source: 'digital_bins' });
    expect(rows[3].entity.type).toBe('collector');
  });
});

describe('filters (Closed, Resolved, Medium, System used to return nothing)', () => {
  it.each([
    [{ status: 'closed' }, ['a2']],
    [{ status: 'resolved' }, ['a3']],
    [{ priority: 'medium' }, ['s1', 'a3']],
    [{ type: 'system' }, ['s1']],
    [{ status: 'active' }, ['s1', 'a1', 'a4']],
    [{ assignee: 'none' }, ['s1', 'a1', 'a2', 'a3']],
    [{ range: 'last24h' }, ['a1', 'a3', 'a4']],
    [{ q: 'abena' }, ['a1']],
  ])('%j', (f, ids) => {
    expect(filterAlerts(rows, F(f), {}, NOW).map(a => a.id)).toEqual(ids);
  });
});

describe('sorting', () => {
  it('open first, then priority, then newest', () => {
    expect(sortAlerts(rows).map(a => a.id)).toEqual(['a1', 'a4', 's1', 'a3', 'a2']);
  });
});

describe('stats', () => {
  it('counts every status and every type including closed', () => {
    const s = alertStats(rows);
    expect(s.total).toBe(5);
    expect(s.byStatus).toEqual({ open: 2, acknowledged: 0, in_progress: 1, resolved: 1, closed: 1 });
    expect(s.active).toBe(3);
    expect(s.openByPriority).toEqual({ critical: 1, high: 1, medium: 1, low: 0 });
    expect(s.types.reduce((n, t) => n + t.total, 0)).toBe(5);
    expect(s.types.find(t => t.key === 'fee_mismatch')).toMatchObject({ total: 1, open: 0 });
  });
});

describe('related record and actions', () => {
  const req = normalizeViewRow({ id: '10000001-aaaa', source: 'pickup_requests', status: 'pending', created_at: ago(1), user_id: 'cust-1', customer_name: 'Abena Darko', address: 'Vitin Estate, Tamale, Northern Region, Ghana', lat: 9.4, lng: -0.85 });
  const collectors = [{ id: 'c1', name: 'Jack Bhone', presence: { lastSeen: new Date(Date.now() - 3 * 3600e3).toISOString() } }];

  it('shows customer, area and status for requests; name and last seen for collectors; System otherwise', () => {
    expect(relatedRecord(rows[1], { requests: [req] })).toMatchObject({ short: '#10000001', name: 'Abena Darko', detail: 'Vitin Estate, Tamale · Pending' });
    expect(relatedRecord(rows[3], { collectors })).toMatchObject({ name: 'Jack Bhone', detail: 'Last seen 3h ago' });
    expect(relatedRecord(seed)).toBeNull();
  });

  it('offers actions that fit the alert', () => {
    expect(actionsFor(rows[1], relatedRecord(rows[1], { requests: [req] }))).toEqual(['assign_collector', 'open_request', 'notify_customer']);
    const dup = normalizeAlert({ id: 'd', title: 'dup', type: 'duplicate_request', entity_source: 'pickup_requests', entity_ref: req.id, metadata: { duplicate_of: 'x' } });
    expect(actionsFor(dup, relatedRecord(dup, { requests: [req] }))).toContain('merge_duplicates');
    const loc = normalizeAlert({ id: 'l', title: 'loc', type: 'invalid_location', entity_source: 'pickup_requests', entity_ref: req.id });
    expect(actionsFor(loc, relatedRecord(loc, { requests: [req] }))).toContain('fix_location');
    expect(actionsFor(rows[3], relatedRecord(rows[3], { collectors }))).toEqual(['contact_collector', 'open_collector']);
    expect(actionsFor(seed, null)).toEqual([]);
  });
});

describe('export and age', () => {
  it('exports the shown alerts as CSV', () => {
    const csv = toAlertsCsv(exportRows(rows.slice(0, 2), {}, () => 'Otis'));
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('System');
    expect(csv).toContain('Critical');
  });
  it('formats age as 2h ago', () => {
    expect(ageLabel(ago(2), NOW.getTime())).toBe('2h ago');
    expect(ageLabel(ago(0.1), NOW.getTime())).toBe('6m ago');
    expect(ageLabel(ago(50), NOW.getTime())).toBe('2d ago');
  });
});
