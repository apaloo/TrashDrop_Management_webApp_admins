// Staff actions on illegal dumping reports (critical workflow): what the
// Illegal Dumping pages send to the database.
//   Admins and Managers: updateIllegalDumpingStatus / assignCleanupTeam (databaseUtils)
//   Other accounts:      the area functions (services/dumpingAreaService)
import { updateIllegalDumpingStatus, assignCleanupTeam } from '../databaseUtils';
import {
  usesAreaActions, areaVerifyReport, areaMarkCleaned, areaAssignTeam, fetchAreaTeams, fetchAreaDumpingReports,
} from '../../services/dumpingAreaService';

// Every query call is recorded as [method, ...args]; mockAnswer decides the result.
// Plain functions, not jest.fn: CRA's resetMocks would wipe implementations.
let mockCalls = [];
let mockAnswer = () => ({ data: { id: 'r1' }, error: null });
jest.mock('../supabase', () => {
  const builder = () => {
    const b = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve) => resolve(mockAnswer(mockCalls));
        return (...args) => {
          mockCalls.push([method, ...args]);
          return method === 'single' ? Promise.resolve(mockAnswer(mockCalls)) : b;
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
jest.mock('../safeDatabaseService', () => ({ safeDatabaseService: { safeQuery: ({ queryFn }) => queryFn() } }));
jest.mock('../realDataUtils', () => ({}));

const call = (method) => mockCalls.filter((c) => c[0] === method);

beforeEach(() => {
  mockCalls = [];
  mockAnswer = () => ({ data: { id: 'r1' }, error: null });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('updateIllegalDumpingStatus (Admins and Managers)', () => {
  it.each(['pending', 'verified', 'in_progress', 'completed', 'cancelled'])('writes status %s to that report', async (status) => {
    await updateIllegalDumpingStatus('r1', status);
    expect(call('from')).toEqual([['from', 'illegal_dumping_mobile']]);
    expect(call('update')[0][1]).toMatchObject({ status });
    expect(call('eq')).toEqual([['eq', 'id', 'r1']]);
  });

  it.each(['resolved', 'assigned', 'dismissed', 'reported', ''])('refuses %p before touching the database (not allowed by the table)', async (status) => {
    await expect(updateIllegalDumpingStatus('r1', status)).rejects.toThrow(/Invalid status value/);
    expect(mockCalls).toEqual([]);
  });
});

describe('assignCleanupTeam (Admins and Managers)', () => {
  it('assigns only a report that is still verified and unassigned', async () => {
    await assignCleanupTeam('r1', 'team-1', '2026-11-20');
    const [, payload] = call('update')[0];
    expect(payload).toMatchObject({ status: 'verified', assigned_to: 'team-1' });
    // The filters stop a second assignment, or assigning an unverified report
    expect(call('eq')).toEqual([['eq', 'id', 'r1'], ['eq', 'status', 'verified']]);
    expect(call('is')).toEqual([['is', 'assigned_to', null]]);
  });

  it.each([
    ['"150" is stored as 150', '150', 150],
    ['75.5 is stored as 75.5', 75.5, 75.5],
    ['no fee means the standard rate (null)', undefined, null],
    ['an empty field means the standard rate (null)', '', null],
    ['zero means the standard rate (null)', '0', null],
    ['a negative fee means the standard rate (null)', '-20', null],
    ['text means the standard rate (null)', 'abc', null],
  ])('cleanup fee: %s', async (_, given, stored) => {
    await assignCleanupTeam('r1', 'team-1', null, given);
    const [, payload] = call('update')[0];
    // Always written, so a fee from an earlier, released assignment never carries over
    expect(payload).toHaveProperty('cleanup_fee', stored);
  });

  it('returns the database error (for example, already assigned) instead of hiding it', async () => {
    mockAnswer = () => ({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    const result = await assignCleanupTeam('r1', 'team-1');
    expect(result).toEqual({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
  });
});

describe('dumpingAreaService (other accounts)', () => {
  it.each([
    ['admin', false], ['manager', false],
    ['authority', true], ['media', true], ['volunteer', true], ['user', true],
  ])('%s uses the area functions: %p', (role, expected) => {
    expect(usesAreaActions(role)).toBe(expected);
  });

  it('acts through the functions that check the account\'s area', async () => {
    await areaVerifyReport('r1');
    await areaMarkCleaned('r2');
    await areaAssignTeam('r3', 'team-1', 90);
    await areaAssignTeam('r4', 'team-2');
    expect(call('rpc')).toEqual([
      ['rpc', 'area_dumping_verify', { p_id: 'r1' }],
      ['rpc', 'area_dumping_mark_cleaned', { p_id: 'r2' }],
      ['rpc', 'area_dumping_assign', { p_id: 'r3', p_team: 'team-1', p_fee: 90 }],
      ['rpc', 'area_dumping_assign', { p_id: 'r4', p_team: 'team-2', p_fee: null }],
    ]);
    expect(call('from')).toEqual([]); // never the table directly
  });

  it('passes on a refusal with its message and code', async () => {
    mockAnswer = () => ({ data: null, error: { code: '42501', message: 'Report is outside your area' } });
    await expect(areaVerifyReport('r1')).rejects.toMatchObject({ message: 'Report is outside your area', code: '42501' });
  });

  it('lists area reports (none is an empty list) and shapes teams for the assignment window', async () => {
    mockAnswer = () => ({ data: null, error: null });
    await expect(fetchAreaDumpingReports({ status: 'verified' })).resolves.toEqual([]);
    expect(call('rpc')[0]).toEqual(['rpc', 'area_dumping_reports', { p_status: 'verified' }]);

    mockAnswer = () => ({ data: [{ id: 't1', name: 'Osu Volunteers', collector_type: 'volunteer_group', region: 'Greater Accra', vehicle_type: null }], error: null });
    await expect(fetchAreaTeams()).resolves.toEqual([
      { id: 't1', first_name: 'Osu Volunteers', last_name: '', collector_type: 'volunteer_group', region: 'Greater Accra', vehicle_type: null, status: 'active' },
    ]);
  });
});
