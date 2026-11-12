// MoMo payments an admin confirms or fails after checking TrendiPay (TD53).
// The database enforces the rules (checked on production 2026-11-12): admins
// only, a note is required, each payment is decided once, every decision is
// logged, and a confirmation is recorded as the admin's (confirmed_by staff).
import { listPaymentsToConfirm, decidePayment } from '../paymentConfirmationService';

// Plain functions, not jest.fn: CRA's resetMocks would wipe implementations.
let mockCalls = [];
let mockRpc = () => ({ data: null, error: null });
jest.mock('../../utils/supabase', () => ({
  supabase: { rpc: (fn, args) => { mockCalls.push([fn, args]); return Promise.resolve(mockRpc(fn, args)); } },
}));

beforeEach(() => { mockCalls = []; mockRpc = () => ({ data: null, error: null }); });

it('lists the payments awaiting confirmation', async () => {
  mockRpc = () => ({ data: [{ id: 'p1', status: 'pending' }], error: null });
  expect(await listPaymentsToConfirm()).toEqual([{ id: 'p1', status: 'pending' }]);
  expect(mockCalls).toEqual([['admin_bin_payments_to_confirm', undefined]]);
});

it('reports a refusal to list', async () => {
  mockRpc = () => ({ data: null, error: { message: 'Not allowed' } });
  await expect(listPaymentsToConfirm()).rejects.toThrow('Not allowed');
});

it.each(['confirm', 'fail'])('sends the %s decision with the trimmed note', async (decision) => {
  await decidePayment('p1', decision, '  Seen in TrendiPay  ');
  expect(mockCalls).toEqual([['admin_confirm_bin_payment', { p_id: 'p1', p_decision: decision, p_note: 'Seen in TrendiPay' }]]);
});

it('refuses a decision without a note, without calling the database', async () => {
  await expect(decidePayment('p1', 'confirm', '   ')).rejects.toThrow('Say what you checked in TrendiPay');
  expect(mockCalls).toEqual([]);
});

it("shows the database's refusal", async () => {
  mockRpc = () => ({ data: null, error: { message: 'This payment was already confirmed or failed, or no longer exists' } });
  await expect(decidePayment('p1', 'confirm', 'x')).rejects.toThrow('already confirmed or failed');
});
