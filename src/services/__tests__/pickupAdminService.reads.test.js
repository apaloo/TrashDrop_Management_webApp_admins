// The Pickup Requests page's reads: filters and search sent to the
// admin_pickup_requests view, paging, the CSV export and summary loops, and
// the fee lookups the request details use (batch price, zone price,
// promotion). The database applies row-level security and the fee rules;
// these tests pin what the page asks for and how it reads the answers.
import {
  fetchRequestPage, fetchAllMatching, fetchSummaryRows, fetchUnassignedPending,
  fetchBatchPrice, fetchZoneBinPrice, fetchBinPromotion,
} from '../pickupAdminService';
import { PAGE_SIZE } from '../../utils/pickupRequestUtils';

// Every query call is recorded as [method, ...args]; mockAnswer decides the result.
let mockCalls = [];
let mockAnswer = () => ({ data: [], error: null, count: 0 });
jest.mock('../../utils/supabase', () => {
  const builder = (own) => {
    const b = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve) => resolve(mockAnswer(own));
        return (...args) => {
          mockCalls.push([method, ...args]);
          own.push([method, ...args]);
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
    },
  };
});
jest.mock('../auditLogService', () => ({ logFailure: () => {} }));
jest.mock('../../utils/pickupService', () => ({ fetchPickupRequests: () => Promise.resolve([]) }));

const called = (method) => mockCalls.filter(([m]) => m === method).map(([, ...args]) => args);
const viewRow = (id, extra = {}) => ({ id, source: 'pickup_requests', status: 'pending', created_at: `2026-11-${String(10 + (id % 3)).padStart(2, '0')}T08:00:00Z`, ...extra });

beforeEach(() => {
  mockCalls = [];
  mockAnswer = () => ({ data: [], error: null, count: 0 });
});

describe('fetchRequestPage', () => {
  it('one page of the view, newest first by default, with the exact total', async () => {
    mockAnswer = () => ({ data: [viewRow(1), viewRow(2)], error: null, count: 42 });
    const r = await fetchRequestPage({ page: 3 });
    expect(called('from')).toEqual([['admin_pickup_requests']]);
    expect(called('select')).toEqual([['*', { count: 'exact' }]]);
    expect(called('order')).toEqual([['created_at', { ascending: false, nullsFirst: false }], ['created_at', { ascending: false }]]);
    expect(called('range')).toEqual([[2 * PAGE_SIZE, 3 * PAGE_SIZE - 1]]);
    expect(r.total).toBe(42);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ source: 'pickup_requests', status: 'pending' }); // normalised view rows
  });

  it('a bad page number is page 1; a known sort column and direction are used, an unknown one falls back', async () => {
    await fetchRequestPage({ page: 'x', sort: 'fee', dir: 'asc' });
    expect(called('range')[0]).toEqual([0, PAGE_SIZE - 1]);
    expect(called('order')[0]).toEqual(['fee', { ascending: true, nullsFirst: false }]);
    mockCalls = [];
    await fetchRequestPage({ page: 1, sort: 'status' });
    expect(called('order')[0][0]).toBe('status_rank');
    mockCalls = [];
    await fetchRequestPage({ page: 1, sort: 'customer_email; drop' });
    expect(called('order')[0][0]).toBe('created_at');
  });

  it('applies every filter the page offers', async () => {
    await fetchRequestPage({ page: 1, status: 'status:pending', priority: 'high', collector: 'cp1', source: 'digital_bins', unassigned: true, from: '2026-11-01', to: '2026-11-13' });
    expect(called('in')[0][0]).toBe('status');
    expect(called('in')[0][1]).toEqual(expect.arrayContaining(['pending']));
    expect(called('eq')).toEqual(expect.arrayContaining([['priority', 'high'], ['collector_profile_id', 'cp1'], ['source', 'digital_bins']]));
    expect(called('is')).toEqual([['collector_ref', null]]);
    expect(called('gte')).toEqual([['created_at', '2026-11-01T00:00:00Z']]);
    expect(called('lt')).toEqual([['created_at', '2026-11-14T00:00:00.000Z']]);
  });

  it('no filters means no filter calls', async () => {
    await fetchRequestPage({ page: 1 });
    for (const m of ['in', 'eq', 'is', 'gte', 'lt', 'or']) expect(called(m)).toEqual([]);
  });

  it('search covers the request, customer and collector, with filter syntax taken out of the text', async () => {
    await fetchRequestPage({ page: 1, q: '  Ama, (owusu)*% \\ ' });
    const [or] = called('or')[0];
    const parts = or.split(',');
    expect(parts.map((p) => p.split('.')[0])).toEqual(['id', 'customer_name', 'customer_email', 'customer_phone', 'address', 'collector_name']);
    // the text can't add conditions or wildcards of its own
    parts.forEach((p) => expect(p).toMatch(/^\w+\.ilike\.\*Ama\s+owusu\*$/));
  });

  it('search that is only filter syntax searches nothing', async () => {
    await fetchRequestPage({ page: 1, q: ' ,()*% ' });
    expect(called('or')).toEqual([]);
  });

  it('a failed read throws (never an empty page shown as real)', async () => {
    mockAnswer = () => ({ data: null, error: { message: 'permission denied for view admin_pickup_requests' } });
    await expect(fetchRequestPage({ page: 1 })).rejects.toMatchObject({ message: 'permission denied for view admin_pickup_requests' });
  });

  it('no rows and no count is an empty page, total 0', async () => {
    mockAnswer = () => ({ data: null, error: null, count: null });
    await expect(fetchRequestPage({ page: 1 })).resolves.toEqual({ rows: [], total: 0 });
  });
});

describe('fetchAllMatching (CSV export)', () => {
  it('reads 1,000 rows at a time until a short page, with the same filters each time', async () => {
    mockAnswer = (own) => {
      const [, from] = own.find(([m]) => m === 'range');
      return { data: from < 2000 ? Array.from({ length: 1000 }, (_, i) => viewRow(from + i)) : [viewRow(2000)], error: null };
    };
    const rows = await fetchAllMatching({ source: 'digital_bins' });
    expect(called('range')).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(called('eq').filter(([c]) => c === 'source')).toHaveLength(3);
    expect(rows).toHaveLength(2001);
  });

  it('a failed page throws, never a partial export', async () => {
    mockAnswer = (own) => (own.find(([m]) => m === 'range')[1] === 0
      ? { data: Array.from({ length: 1000 }, (_, i) => viewRow(i)), error: null }
      : { data: null, error: { message: 'timeout' } });
    await expect(fetchAllMatching({})).rejects.toMatchObject({ message: 'timeout' });
  });
});

describe('fetchSummaryRows and fetchUnassignedPending', () => {
  it('summary rows read only the light columns, all pages', async () => {
    mockAnswer = (own) => ({ data: own.find(([m]) => m === 'range')[1] === 0 ? Array.from({ length: 1000 }, (_, i) => viewRow(i)) : [], error: null });
    const rows = await fetchSummaryRows();
    expect(rows).toHaveLength(1000);
    const [columns] = called('select')[0];
    expect(columns).toMatch(/^id, source, status/);
    expect(columns).not.toMatch(/customer_email|customer_phone|\*/);
    expect(called('range')).toEqual([[0, 999], [1000, 1999]]);
  });

  it('a failed summary read throws', async () => {
    mockAnswer = () => ({ data: null, error: { message: 'down' } });
    await expect(fetchSummaryRows()).rejects.toMatchObject({ message: 'down' });
  });

  it('unassigned means pending with no collector', async () => {
    mockAnswer = () => ({
      data: [
        viewRow(1), viewRow(2, { collector_ref: 'c1' }), viewRow(3, { status: 'accepted' }), viewRow(4, { status: 'available' }),
      ],
      error: null,
    });
    const rows = await fetchUnassignedPending();
    expect(rows.map((r) => r.collectorRef ?? null)).toEqual(rows.map(() => null));
    expect(rows.every((r) => ['pending', 'available'].includes(r.status))).toBe(true);
    expect(rows.find((r) => r.status === 'accepted')).toBeUndefined();
  });
});

describe('fee lookups for the request details', () => {
  it('batch price: the unit price, or null when there is no batch, no row or an error', async () => {
    mockAnswer = () => ({ data: { unit_price: 2.5 }, error: null });
    await expect(fetchBatchPrice('b1')).resolves.toBe(2.5);
    expect(called('eq')).toEqual([['id', 'b1']]);
    await expect(fetchBatchPrice(null)).resolves.toBeNull();
    mockAnswer = () => ({ data: null, error: null });
    await expect(fetchBatchPrice('b2')).resolves.toBeNull();
    mockAnswer = () => ({ data: null, error: { message: 'x' } });
    await expect(fetchBatchPrice('b3')).resolves.toBeNull();
    mockAnswer = () => ({ data: { unit_price: null }, error: null });
    await expect(fetchBatchPrice('b4')).resolves.toBeNull();
  });

  it('zone price: the covering zone\'s price for the bin size, as the household app reads it', async () => {
    mockAnswer = () => ({ data: [{ price_240l: '35.00', price_120l: '20', suburb: 'Madina' }], error: null });
    await expect(fetchZoneBinPrice(5.68, -0.16, 240)).resolves.toEqual({ price: 35, name: 'Madina' });
    expect(called('rpc')).toEqual([['get_covering_pricing_zone', { p_latitude: 5.68, p_longitude: -0.16 }]]);
    await expect(fetchZoneBinPrice(5.68, -0.16)).resolves.toEqual({ price: 20, name: 'Madina' }); // 120 L when no size
  });

  it('zone price is unknown (null), never made up: no position, no zone, an error, no price or 0', async () => {
    await expect(fetchZoneBinPrice(null, -0.16, 120)).resolves.toBeNull();
    await expect(fetchZoneBinPrice(5.6, NaN, 120)).resolves.toBeNull();
    expect(called('rpc')).toEqual([]);
    for (const answer of [{ data: [], error: null }, { data: null, error: { message: 'x' } }, { data: { price_120l: null }, error: null }, { data: { price_120l: '0' }, error: null }]) {
      mockAnswer = () => answer;
      await expect(fetchZoneBinPrice(5.6, -0.2, 120)).resolves.toBeNull();
    }
    mockAnswer = () => ({ data: { price_120l: 18, name: 'Zone A' }, error: null });
    await expect(fetchZoneBinPrice(5.6, -0.2, 120)).resolves.toEqual({ price: 18, name: 'Zone A' });
  });

  it('promotion: null for a bin booked at the standard price, or one that can\'t be read', async () => {
    mockAnswer = () => ({ data: { id: 'b1', is_promotional: false }, error: null });
    await expect(fetchBinPromotion('b1', 120)).resolves.toBeNull();
    mockAnswer = () => ({ data: null, error: { message: 'x' } });
    await expect(fetchBinPromotion('b1', 120)).resolves.toBeNull();
    mockAnswer = () => ({ data: { id: 'b1', is_promotional: 'true' }, error: null }); // only a real true counts
    await expect(fetchBinPromotion('b1', 120)).resolves.toBeNull();
  });

  it('promotion: the request number and the active schedule for the bin size', async () => {
    mockAnswer = (own) => (own[0][1] === 'digital_bins'
      ? { data: { id: 'b1', is_promotional: true, promo_request_number: '2' }, error: null }
      : { data: { client_fee: '10.00', collector_payout: '22', platform_subsidy: 12 }, error: null });
    await expect(fetchBinPromotion('b1', 240)).resolves.toEqual({ requestNumber: 2, clientFee: 10, collectorPayout: 22, subsidy: 12 });
    expect(called('eq')).toEqual(expect.arrayContaining([['id', 'b1'], ['bin_size_liters', 240], ['is_active', true]]));
  });

  it('promotion with no active schedule: the request number, unknown fees', async () => {
    mockAnswer = (own) => (own[0][1] === 'digital_bins'
      ? { data: { id: 'b1', is_promotional: true, promo_request_number: null }, error: null }
      : { data: null, error: null });
    await expect(fetchBinPromotion('b1')).resolves.toEqual({ requestNumber: null, clientFee: null, collectorPayout: null, subsidy: null });
    expect(called('eq')).toEqual(expect.arrayContaining([['bin_size_liters', 120]]));
  });
});
