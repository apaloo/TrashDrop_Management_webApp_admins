// Bag Management (QR bag batches households buy): what the pages send to the
// database. Checked against production on 2026-11-12: the admin_bag_batches,
// admin_bag_items and admin_bag_events views have every column used here,
// and the database call check covers the rpc() names and parameters.
import {
  fetchBatchPage, fetchBatchBags, fetchAllBatches, generateBatches, setBatchArchived, fetchBagStats,
} from '../bagAdminService';

// Every query call is recorded as [method, ...args]; mockAnswer decides the result.
// Plain functions, not jest.fn: CRA's resetMocks would wipe implementations.
let mockCalls = [];
let mockAnswer = () => ({ data: [], error: null, count: 0 });
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

const called = (method) => mockCalls.filter(([m]) => m === method).map(([, ...args]) => args);

beforeEach(() => {
  mockCalls = [];
  mockFailures = [];
  mockAnswer = () => ({ data: [], error: null, count: 0 });
});

describe('batch list', () => {
  it('hides archived batches unless a stage is chosen, and pages in the database', async () => {
    mockAnswer = () => ({ data: [{ id: 'b1', bag_count: 10 }], error: null, count: 37 });
    const { rows, total } = await fetchBatchPage({ page: 3, size: 10 });

    expect(called('neq')).toContainEqual(['stage', 'archived']);
    expect(called('range')).toContainEqual([20, 29]);
    expect(total).toBe(37);
    expect(rows[0].id).toBe('b1');

    mockCalls = [];
    await fetchBatchPage({ stage: 'archived' });
    expect(called('eq')).toContainEqual(['stage', 'archived']);
    expect(called('neq')).toHaveLength(0);
  });

  it('cleans the search text before it reaches the query', async () => {
    await fetchBatchPage({ q: 'BATCH(1),*%' });
    const [[column, pattern]] = called('ilike');
    expect(column).toBe('search_text');
    expect(pattern).not.toMatch(/[(),*]/);
    expect(pattern).toContain('batch');
  });

  it('filters by scanned share only when one is set', async () => {
    await fetchBatchPage({ min: 50 });
    expect(called('gte')).toContainEqual(['scanned_pct', 50]);
    mockCalls = [];
    await fetchBatchPage({ min: 0 });
    expect(called('gte').some(([c]) => c === 'scanned_pct')).toBe(false);
  });

  it('exports at most 5,000 batches', async () => {
    await fetchAllBatches({});
    expect(called('limit')).toContainEqual([5000]);
  });

  it("pages a batch's bags in bag-number order", async () => {
    await fetchBatchBags('b1', { page: 2, size: 25 });
    expect(called('eq')).toContainEqual(['batch_id', 'b1']);
    expect(called('order')[0]).toEqual(['bag_no', { ascending: true }]);
    expect(called('range')).toContainEqual([25, 49]);
  });

  it('explains a missing database update instead of a raw error', async () => {
    mockAnswer = () => ({ data: null, error: { code: '42P01', message: 'relation "admin_bag_batches" does not exist' } });
    await expect(fetchBatchPage({})).rejects.toMatchObject({ code: 'MISSING_SCHEMA', message: expect.stringMatching(/Bag Management update/) });
  });
});

describe('generateBatches', () => {
  const form = { type: 'general', size: 'large', bags: 25, batches: 4, price: 50, prefix: '' };

  it('creates the batches in one database call with every setting', async () => {
    mockAnswer = () => ({ data: { batch_ids: ['b1', 'b2', 'b3', 'b4'] }, error: null });
    const result = await generateBatches(form, 500);

    expect(called('rpc')).toEqual([['admin_generate_batches', {
      p_type: 'general', p_size: 'large', p_bags_per_batch: 25, p_batches: 4,
      p_price_per_batch: 50, p_qr_prefix: null, p_max_total: 500,
    }]]);
    expect(result.batch_ids).toHaveLength(4);
  });

  it("shows the database's own reason when it refuses (limits, duplicates)", async () => {
    mockAnswer = () => ({ data: null, error: { code: 'P0001', message: 'At most 500 bags at a time' } });
    await expect(generateBatches(form, 500)).rejects.toThrow('At most 500 bags at a time');
    expect(mockFailures[0][0]).toBe('batch.update_failed');
    expect(mockFailures[0][1].context).toMatchObject({ operation: 'generate', bags: 25, batches: 4 });
  });

  it('reports any other failure as not generated', async () => {
    mockAnswer = () => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });
    await expect(generateBatches(form, 500)).rejects.toThrow(/Batches not generated/);
  });
});

describe('archive and numbers', () => {
  it('archives and restores through the database function, logging a failure', async () => {
    await setBatchArchived('b1', true);
    expect(called('rpc')).toEqual([['admin_set_batch_archived', { p_batch_id: 'b1', p_archived: true }]]);

    mockAnswer = () => ({ error: { code: '42501', message: 'permission denied' } });
    await expect(setBatchArchived('b1', false)).rejects.toThrow(/Batch not restored/);
    expect(mockFailures[0][1]).toMatchObject({ entityId: 'b1', context: { operation: 'restore' } });
  });

  it('gives empty numbers rather than null', async () => {
    mockAnswer = () => ({ data: null, error: null });
    expect(await fetchBagStats()).toEqual({});
  });
});
