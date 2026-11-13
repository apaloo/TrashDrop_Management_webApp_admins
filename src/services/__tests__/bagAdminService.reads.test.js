// Bag Management reads the other tests don't cover: one batch, a batch's
// history (bags and their scan timeline), the history numbers and the
// newest batches, and how a database without the Bag Management update is
// explained. bagAdminService.test.js covers paging, export and generation.
import {
  fetchBatch, fetchBatchHistory, fetchHistoryStats, fetchRecentBatches, fetchBatchPage,
} from '../bagAdminService';

// Each table (or rpc) answers with mockAnswers[name]; calls are recorded
let mockCalls = [];
let mockAnswers = {};
jest.mock('../../utils/supabase', () => {
  const builder = (name) => {
    const b = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve) => resolve(mockAnswers[name] || { data: [], error: null });
        return (...args) => {
          mockCalls.push([name, method, ...args]);
          return method === 'maybeSingle' ? Promise.resolve(mockAnswers[name] || { data: null, error: null }) : b;
        };
      },
    });
    return b;
  };
  return {
    supabase: {
      from: (table) => builder(table),
      rpc: (fn, args) => { mockCalls.push([fn, 'rpc', args]); return Promise.resolve(mockAnswers[fn] || { data: null, error: null }); },
    },
  };
});
jest.mock('../auditLogService', () => ({ logFailure: () => {} }));

const callsTo = (name) => mockCalls.filter(([n]) => n === name).map(([, ...rest]) => rest);

beforeEach(() => {
  mockCalls = [];
  mockAnswers = {};
});

describe('fetchBatch', () => {
  it('reads one batch by id from the admin view', async () => {
    mockAnswers.admin_bag_batches = { data: { id: 7, batch_number: 'B-007', bag_count: 20, stage: 'printed' }, error: null };
    const batch = await fetchBatch('7');
    expect(batch).toMatchObject({ id: '7', batchNumber: 'B-007', bagCount: 20 });
    expect(callsTo('admin_bag_batches')).toEqual([['select', '*'], ['eq', 'id', '7'], ['maybeSingle']]);
  });

  it('no such batch is null, not an error', async () => {
    expect(await fetchBatch('404')).toBeNull();
  });

  it('a refusal is reported with what was being loaded', async () => {
    mockAnswers.admin_bag_batches = { data: null, error: { code: '42501', message: 'permission denied for view admin_bag_batches' } };
    await expect(fetchBatch('7')).rejects.toThrow('Could not load the batch: permission denied for view admin_bag_batches');
  });
});

describe('fetchBatchHistory', () => {
  it("reads the batch's bags in number order and groups each bag's scans in time order", async () => {
    mockAnswers.admin_bag_items = { data: [{ id: 'b1', batch_id: 7, bag_no: 1, scan_count: 2 }], error: null };
    mockAnswers.admin_bag_events = {
      data: [
        { bag_id: 'b1', kind: 'collected', at: '2026-11-12T10:00:00Z', actor: 'Kofi' },
        { bag_id: 'b1', kind: 'scanned', at: '2026-11-11T09:00:00Z' },
        { bag_id: null, kind: 'stray', at: '2026-11-10T00:00:00Z' },
      ],
      error: null,
    };
    const { bags, events } = await fetchBatchHistory('7');
    expect(bags).toEqual([expect.objectContaining({ id: 'b1', batchId: '7', bagNo: 1, scanCount: 2 })]);
    expect(events.b1.map((e) => e.kind)).toEqual(['scanned', 'collected']);
    expect(Object.keys(events)).toEqual(['b1']);
    expect(callsTo('admin_bag_items')).toContainEqual(['order', 'bag_no', { ascending: true }]);
    expect(callsTo('admin_bag_events')).toContainEqual(['eq', 'batch_id', '7']);
  });

  it('a failed scan history read is not shown as a batch with no scans', async () => {
    mockAnswers.admin_bag_events = { data: null, error: { message: 'timeout' } };
    await expect(fetchBatchHistory('7')).rejects.toThrow('Could not load the scan history: timeout');
  });

  it('a failed bag read is reported first', async () => {
    mockAnswers.admin_bag_items = { data: null, error: { message: 'boom' } };
    await expect(fetchBatchHistory('7')).rejects.toThrow('Could not load the bags: boom');
  });
});

describe('fetchHistoryStats and fetchRecentBatches', () => {
  it('asks the database for the last 30 days by default', async () => {
    mockAnswers.admin_bag_history_stats = { data: { total_bags: 40 }, error: null };
    expect(await fetchHistoryStats()).toEqual({ total_bags: 40 });
    expect(callsTo('admin_bag_history_stats')).toEqual([['rpc', { p_days: 30 }]]);
  });

  it('no numbers yet is an empty set, not an error', async () => {
    expect(await fetchHistoryStats(7)).toEqual({});
  });

  it('the newest batches first, as many as asked', async () => {
    mockAnswers.admin_bag_batches = { data: [{ id: 2 }, { id: 1 }], error: null };
    expect((await fetchRecentBatches(2)).map((b) => b.id)).toEqual(['2', '1']);
    expect(callsTo('admin_bag_batches')).toEqual([
      ['select', '*'], ['order', 'created_at', { ascending: false }], ['order', 'id'], ['limit', 2],
    ]);
  });
});

describe('a database without the Bag Management update', () => {
  it.each([
    ['a missing view (42P01)', { code: '42P01', message: 'relation "admin_bag_batches" does not exist' }, fetchRecentBatches],
    ['a missing function (PGRST202)', { code: 'PGRST202', message: 'Could not find the function' }, fetchHistoryStats],
  ])('%s says which migrations to run, marked MISSING_SCHEMA', async (_label, error, fn) => {
    mockAnswers.admin_bag_batches = { data: null, error };
    mockAnswers.admin_bag_history_stats = { data: null, error };
    const e = await fn().then(() => null, (err) => err);
    expect(e.code).toBe('MISSING_SCHEMA');
    expect(e.message).toMatch(/missing the Bag Management update\. Run supabase\/migrations\/20261019_bag_batches_admin\.sql/);
  });

  it('archived batches are hidden unless asked for, and the page starts at the right row', async () => {
    await fetchBatchPage({ page: 3, size: 20 });
    const calls = callsTo('admin_bag_batches');
    expect(calls).toContainEqual(['neq', 'stage', 'archived']);
    expect(calls).toContainEqual(['range', 40, 59]);
  });
});
