// Reward Redemptions (airtime and data households redeem with points; staff
// send them): what the page sends to the database. The database function
// admin_set_redemption_status enforces the rules (checked on production
// 2026-11-12): staff with rewards.manage only; sent or rejected; a reason to
// reject; pending only, so two staff can't both send the same one.
import { listRedemptions, setRedemptionStatus } from '../rewardRedemptionService';

// Plain functions, not jest.fn: CRA's resetMocks would wipe implementations.
let mockCalls = [];
let mockAnswer = () => ({ data: [], error: null });
jest.mock('../../utils/supabase', () => ({
  supabase: {
    rpc: (fn, args) => { mockCalls.push([fn, args]); return Promise.resolve(mockAnswer(fn, args)); },
  },
}));

beforeEach(() => {
  mockCalls = [];
  mockAnswer = () => ({ data: [], error: null });
});

describe('listRedemptions', () => {
  it('asks for pending redemptions by default', async () => {
    await listRedemptions();
    expect(mockCalls).toEqual([['admin_reward_redemptions', { p_status: 'pending' }]]);
  });

  it('passes the chosen tab and returns the rows', async () => {
    mockAnswer = () => ({ data: [{ id: 'r1', status: 'sent' }], error: null });
    expect(await listRedemptions('sent')).toEqual([{ id: 'r1', status: 'sent' }]);
    expect(mockCalls[0][1]).toEqual({ p_status: 'sent' });
  });

  it('gives an empty list when the database returns nothing', async () => {
    mockAnswer = () => ({ data: null, error: null });
    expect(await listRedemptions()).toEqual([]);
  });

  it('reports a failure instead of an empty list', async () => {
    mockAnswer = () => ({ data: null, error: { message: 'Not allowed' } });
    await expect(listRedemptions()).rejects.toThrow('Not allowed');
  });
});

describe('setRedemptionStatus', () => {
  it('marks a redemption sent', async () => {
    mockAnswer = () => ({ data: { id: 'r1', status: 'sent' }, error: null });
    expect(await setRedemptionStatus('r1', 'sent')).toEqual({ id: 'r1', status: 'sent' });
    expect(mockCalls).toEqual([['admin_set_redemption_status', { p_id: 'r1', p_status: 'sent', p_note: null }]]);
  });

  it('sends the reason with a rejection, and ids as text', async () => {
    await setRedemptionStatus(42, 'rejected', 'Wrong network');
    expect(mockCalls[0][1]).toEqual({ p_id: '42', p_status: 'rejected', p_note: 'Wrong network' });
  });

  it("shows the database's refusal (already handled, no reason given)", async () => {
    mockAnswer = () => ({ data: null, error: { message: 'This redemption was already handled, or no longer exists' } });
    await expect(setRedemptionStatus('r1', 'sent')).rejects.toThrow(/already handled/);
  });
});
