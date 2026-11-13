// A dumping report's activity on the admin site: every status change the
// database's trigger logs in illegal_dumping_history_mobile, newest first.
import { fetchIllegalDumpingHistory, fetchCollectorStatsReal } from '../databaseUtils';
import { supabase } from '../supabase';
import * as realDataUtils from '../realDataUtils';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../realDataUtils', () => ({ fetchCollectorStats: jest.fn(), fetchIllegalDumpingReports: jest.fn() }));
jest.mock('../logger', () => ({ __esModule: true, default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

let calls;
const answer = (result) => {
  supabase.from.mockImplementation((table) => {
    calls.push(['from', table]);
    const q = {
      select: (cols) => { calls.push(['select', cols]); return q; },
      eq: (col, val) => { calls.push(['eq', col, val]); return Promise.resolve(result); },
    };
    return q;
  });
};

beforeEach(() => { calls = []; jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

it("reads one report's history and shows it newest first", async () => {
  answer({
    data: [
      { id: 'h1', dumping_id: 'r1', status: 'reported', created_at: '2026-11-10T08:00:00Z' },
      { id: 'h3', dumping_id: 'r1', status: 'completed', notes: 'Cleared', updated_by: 'u9', created_at: '2026-11-12T08:00:00Z' },
      { id: 'h2', dumping_id: 'r1', status: 'assigned', created_at: '2026-11-11T08:00:00Z' },
    ],
    error: null,
  });
  const history = await fetchIllegalDumpingHistory('r1');
  expect(calls).toEqual([['from', 'illegal_dumping_history_mobile'], ['select', '*'], ['eq', 'dumping_id', 'r1']]);
  expect(history.map((h) => h.status)).toEqual(['completed', 'assigned', 'reported']);
  expect(history[0]).toEqual({ id: 'h3', status: 'completed', notes: 'Cleared', at: '2026-11-12T08:00:00Z', by: 'u9' });
  expect(history[2]).toMatchObject({ notes: null, by: null });
});

it('a row without an id still gets a stable one', async () => {
  answer({ data: [{ dumping_id: 'r1', status: 'verified', created_at: '2026-11-12T08:00:00Z' }], error: null });
  expect((await fetchIllegalDumpingHistory('r1'))[0].id).toBe('r1-2026-11-12T08:00:00Z-verified');
});

it('a failed read shows no activity (and says why in the console), never stale rows', async () => {
  answer({ data: null, error: { message: 'permission denied' } });
  expect(await fetchIllegalDumpingHistory('r1')).toEqual([]);
  expect(console.warn).toHaveBeenCalledWith('Could not load report activity:', 'permission denied');
});

it('collector stats come from the real-data reader', async () => {
  realDataUtils.fetchCollectorStats.mockResolvedValue({ total: 3 });
  expect(await fetchCollectorStatsReal()).toEqual({ total: 3 });
});
