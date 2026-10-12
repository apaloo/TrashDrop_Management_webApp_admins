import {
  canonicalStatus, statusGroup, statusColor, rawValuesForGroup, canTransition, canCancel, normalizePriority,
} from '../../constants/pickupStatus';
import {
  normalizeViewRow, shortAddress, bagsLabel, relativeAge, isOverdue, findDuplicates, isOutsideServiceArea,
  collectorsByDistance, feeBreakdown, applyFilters, sortRows, toCsv, computeStats, collectorJobCounts, matchesSearch,
} from '../pickupRequestUtils';
import { parsePoint } from '../mapCoordinates';
import { STATUS_GROUPS as LIVE_GROUPS, statusGroupOf } from '../liveMapUtils';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const view = (over = {}) => normalizeViewRow({
  id: '22ef6777-b929-4f62-98f6-f1cad141de4b', source: 'pickup_requests', status: 'pending', created_at: '2026-10-14T09:00:00Z',
  user_id: 'u1', customer_name: 'Ama Mensah', address: 'Vitin Estate, Tamale, Northern Region, Ghana', lat: 9.4, lng: -0.85,
  bag_count: 2, fee: 25, priority: 'medium', ...over,
});

describe('status model', () => {
  it('maps every status in use to one canonical status and group', () => {
    expect(canonicalStatus('available')).toBe('pending');
    expect(canonicalStatus('assigned')).toBe('accepted');
    expect(canonicalStatus('picked_up')).toBe('collecting');
    expect(canonicalStatus('completed')).toBe('disposed');
    expect(canonicalStatus('canceled')).toBe('cancelled');
    expect(['accepted', 'en_route', 'arrived', 'collecting'].map(statusGroup)).toEqual(['in_progress', 'in_progress', 'in_progress', 'in_progress']);
    expect(rawValuesForGroup('done')).toEqual(expect.arrayContaining(['disposed', 'completed']));
  });

  it('uses the same colours as the Live Map', () => {
    expect(statusColor('pending')).toBe(statusGroupOf('pending').color);
    expect(statusColor('accepted')).toBe(LIVE_GROUPS.find(g => g.key === 'assigned').color);
    expect(statusColor('arrived')).toBe(statusGroupOf('arrived').color);
    expect(statusColor('disposed')).toBe(statusGroupOf('completed').color);
  });

  it('only allows the next step, cancel before collecting, complete from arrived/collecting', () => {
    expect(canTransition('pending', 'accepted')).toBe(true);
    expect(canTransition('pending', 'en_route')).toBe(false);
    expect(canTransition('accepted', 'en_route')).toBe(true);
    expect(canTransition('arrived', 'disposed')).toBe(true);
    expect(canTransition('en_route', 'disposed')).toBe(false);
    expect(canCancel('arrived')).toBe(true);
    expect(canCancel('collecting')).toBe(false);
    expect(canCancel('disposed')).toBe(false);
  });

  it('treats Normal as Medium and urgent as High', () => {
    expect(normalizePriority('normal')).toBe('medium');
    expect(normalizePriority(null)).toBe('medium');
    expect(normalizePriority('High')).toBe('high');
    expect(normalizePriority('urgent')).toBe('high');
    expect(normalizePriority(null, true)).toBe('high');
    expect(normalizePriority('low')).toBe('low');
  });
});

describe('coordinates', () => {
  it('reads the reported request the right way round', () => {
    const p = parsePoint('POINT(-0.1732 5.6336)');
    expect(p).toEqual({ lat: 5.6336, lng: -0.1732 });
    const row = view({ lat: p.lat, lng: p.lng });
    expect([row.lat, row.lng]).toEqual([5.6336, -0.1732]);
  });
});

describe('display', () => {
  it('shortens addresses to "Area, City"', () => {
    expect(shortAddress('Vitin Estate, Tamale, Northern Region, Ghana')).toBe('Vitin Estate, Tamale');
    expect(shortAddress('12 Oxford St, Osu, Accra Metropolitan, Accra, Greater Accra Region, 00233, Ghana')).toBe('12 Oxford St, Accra');
    expect(shortAddress('Spintex Rd')).toBe('Spintex Rd');
    expect(shortAddress(null)).toBeNull();
  });

  it('pluralises bags and formats relative ages', () => {
    expect(bagsLabel(1)).toBe('1 bag');
    expect(bagsLabel(3)).toBe('3 bags');
    expect(bagsLabel(null)).toBe('—');
    expect(relativeAge('2026-10-11T12:00:00Z', NOW)).toBe('3 days ago');
    expect(relativeAge('2026-10-14T11:00:00Z', NOW)).toBe('1 hour ago');
  });

  it('flags pending requests older than 24 hours as overdue', () => {
    expect(isOverdue(view({ created_at: '2026-10-13T10:00:00Z' }), NOW)).toBe(true);
    expect(isOverdue(view({ created_at: '2026-10-14T10:00:00Z' }), NOW)).toBe(false);
    expect(isOverdue(view({ created_at: '2026-10-01T10:00:00Z', status: 'arrived' }), NOW)).toBe(false);
  });
});

describe('duplicates and service area', () => {
  it('finds open requests from the same customer at the same place within 48 h', () => {
    const a = view({ id: 'a' });
    const near = view({ id: 'b', address: 'other text', lat: 9.4002, lng: -0.85, created_at: '2026-10-14T10:00:00Z' }); // ~22 m
    const far = view({ id: 'c', address: 'other text', lat: 9.5, lng: -0.85 });
    const otherCustomer = view({ id: 'd', user_id: 'u2' });
    const done = view({ id: 'e', status: 'disposed' });
    const old = view({ id: 'f', created_at: '2026-10-10T09:00:00Z' });
    expect(findDuplicates(a, [a, near, far, otherCustomer, done, old]).map(r => r.id)).toEqual(['b']);
  });

  it('marks requests with no collector within 25 km as outside the service area', () => {
    const tamale = view();
    expect(isOutsideServiceArea(tamale, [{ position: [5.6, -0.2] }])).toBe(true);
    expect(isOutsideServiceArea(tamale, [{ position: [9.41, -0.84] }])).toBe(false);
    expect(isOutsideServiceArea(tamale, [{ position: null }])).toBe(false);
  });

  it('sorts collectors by distance, unknown last', () => {
    const list = collectorsByDistance(view(), [{ id: 'x', name: 'X', position: null }, { id: 'acc', name: 'Acc', position: [5.6, -0.2] }, { id: 'tam', name: 'Tam', position: [9.41, -0.84] }]);
    expect(list.map(c => c.id)).toEqual(['tam', 'acc', 'x']);
    expect(list[0].distanceKm).toBeLessThan(2);
  });
});

describe('fees', () => {
  it('recomputes digital bin prices and flags mismatches', () => {
    const bin = view({ source: 'digital_bins', bag_count: 2, bin_size_liters: 120, is_urgent: true, fee: 79 });
    const b = feeBreakdown(bin);
    expect(b.expected).toBe(79); // 30×2 + 30% + 1
    expect(b.mismatch).toBe(false);
    expect(feeBreakdown({ ...bin, fee: 50 }).mismatch).toBe(true);
  });

  it('compares pickup request fees with the batch price', () => {
    expect(feeBreakdown(view({ fee: 25 }), { batchPrice: 25 }).mismatch).toBe(false);
    expect(feeBreakdown(view({ fee: 50 }), { batchPrice: 25 }).mismatch).toBe(true);
    expect(feeBreakdown(view({ fee: 50 })).mismatch).toBe(false); // unknown batch: no warning
  });
});

describe('filters, sort, stats', () => {
  const rows = [
    view({ id: 'p1', status: 'pending', priority: 'normal' }),
    view({ id: 'a1', status: 'arrived', collector_profile_id: 'jack' }),
    view({ id: 'c1', status: 'collecting', collector_profile_id: 'jack' }),
    view({ id: 'd1', status: 'disposed', collector_profile_id: 'jack', fee: 90 }),
    view({ id: 'x1', status: 'cancelled', fee: null }),
  ];

  it('counts arrived and collecting as in progress', () => {
    expect(computeStats(rows)).toEqual({ total: 5, pending: 1, inProgress: 2, done: 1, cancelled: 1 });
  });

  it('filters groups to their real database values and maps Normal to Medium', () => {
    expect(applyFilters(rows, { status: 'group:in_progress' }).map(r => r.id)).toEqual(['a1', 'c1']);
    expect(applyFilters(rows, { status: 'group:done' }).map(r => r.id)).toEqual(['d1']);
    expect(applyFilters(rows, { status: 'status:arrived' }).map(r => r.id)).toEqual(['a1']);
    expect(applyFilters(rows, { priority: 'medium' }).length).toBe(5);
    expect(applyFilters(rows, { collector: 'jack' }).length).toBe(3);
  });

  it('matches full and partial request IDs', () => {
    expect(matchesSearch(view(), '22ef6777-b929-4f62-98f6-f1cad141de4b')).toBe(true);
    expect(matchesSearch(view(), ' 22EF67 ')).toBe(true);
    expect(matchesSearch(view(), 'zzz')).toBe(false);
  });

  it('sorts by status lifecycle and fee', () => {
    expect(sortRows(rows, 'status', 'asc').map(r => r.id)).toEqual(['p1', 'a1', 'c1', 'd1', 'x1']);
    expect(sortRows(rows, 'fee', 'desc')[0].id).toBe('d1');
  });

  it("counts each collector's jobs from the requests", () => {
    const many = [...rows, ...Array.from({ length: 11 }, (_, i) => view({ id: `d${i + 2}`, status: 'disposed', collector_profile_id: 'jack' }))];
    expect(collectorJobCounts(many).jack).toMatchObject({ active: 2, completed: 12 });
  });

  it('adds earnings (payout, else fee) and the average customer rating', () => {
    const jobs = [
      view({ id: 'e1', status: 'disposed', collector_profile_id: 'ama', fee: 20, collector_total_payout: 15, customer_rating: 5 }),
      view({ id: 'e2', status: 'completed', collector_profile_id: 'ama', fee: 12, customer_rating: 4 }),
      view({ id: 'e3', status: 'en_route', collector_profile_id: 'ama', fee: 50, customer_rating: null }),
      view({ id: 'e4', status: 'disposed', collector_profile_id: 'kofi', fee: 10 }),
    ];
    const counts = collectorJobCounts(jobs);
    expect(counts.ama).toEqual({ active: 1, completed: 2, earnings: 27, ratingCount: 2, rating: 4.5 });
    expect(counts.kofi.rating).toBeNull();
  });

  it('exports CSV with quoting', () => {
    const csv = toCsv([view({ address: 'Vitin Estate, Tamale' })]);
    expect(csv.split('\n')[0]).toMatch(/^ID,Source,Status/);
    expect(csv).toContain('"Vitin Estate, Tamale"');
  });
});
