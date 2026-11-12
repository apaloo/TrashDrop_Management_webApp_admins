// Admins (TD10): what the Account approvals page sends to the database. The
// database enforces the rules (checked on production 2026-11-12): only admins
// can read staff_admins or call admin_add_staff / admin_remove_staff; every
// change is logged; the last admin can't be removed.
import { listAdmins, addAdmin, removeAdmin } from '../staffAdminService';

// Plain functions, not jest.fn: CRA's resetMocks would wipe implementations.
let mockCalls = [];
let mockTable = () => ({ data: [], error: null });
let mockRpc = () => ({ data: null, error: null });
jest.mock('../../utils/supabase', () => ({
  supabase: {
    from: (table) => {
      const q = {
        select: (cols) => { mockCalls.push(['select', table, cols]); return q; },
        order: (col, opts) => { mockCalls.push(['order', col, opts]); return Promise.resolve(mockTable(table)); },
      };
      return q;
    },
    rpc: (fn, args) => { mockCalls.push(['rpc', fn, args]); return Promise.resolve(mockRpc(fn, args)); },
  },
}));

beforeEach(() => {
  mockCalls = [];
  mockTable = () => ({ data: [], error: null });
  mockRpc = () => ({ data: null, error: null });
});

describe('listAdmins', () => {
  it('reads staff_admins oldest first and adds each email', async () => {
    mockTable = () => ({ data: [{ user_id: 'a1', added_at: '2026-11-12T10:00:00Z', note: 'founder' }, { user_id: 'a2', added_at: '2026-11-12T11:00:00Z', note: null }], error: null });
    mockRpc = () => ({ data: [{ id: 'a1', email: 'one@example.com' }, { id: 'a2', email: 'two@example.com' }], error: null });
    expect(await listAdmins()).toEqual([
      { userId: 'a1', email: 'one@example.com', addedAt: '2026-11-12T10:00:00Z', note: 'founder' },
      { userId: 'a2', email: 'two@example.com', addedAt: '2026-11-12T11:00:00Z', note: null },
    ]);
    expect(mockCalls).toContainEqual(['select', 'staff_admins', 'user_id, added_at, note']);
    expect(mockCalls).toContainEqual(['order', 'added_at', { ascending: true }]);
    expect(mockCalls).toContainEqual(['rpc', 'get_user_emails', { user_ids: ['a1', 'a2'] }]);
  });

  it('still lists admins when emails cannot be looked up', async () => {
    mockTable = () => ({ data: [{ user_id: 'a1', added_at: null, note: null }], error: null });
    mockRpc = () => ({ data: null, error: { message: 'boom' } });
    expect(await listAdmins()).toEqual([{ userId: 'a1', email: null, addedAt: null, note: null }]);
  });

  it('reports a failure to read the list', async () => {
    mockTable = () => ({ data: null, error: { message: 'permission denied' } });
    await expect(listAdmins()).rejects.toThrow('permission denied');
  });
});

describe('addAdmin', () => {
  it('sends the trimmed email and note', async () => {
    await addAdmin('  new@example.com ', ' covers weekends ');
    expect(mockCalls).toEqual([['rpc', 'admin_add_staff', { p_email: 'new@example.com', p_note: 'covers weekends' }]]);
  });

  it('refuses an empty email without calling the database', async () => {
    await expect(addAdmin('   ')).rejects.toThrow('Enter the email of an existing account');
    expect(mockCalls).toEqual([]);
  });

  it("shows the database's refusal", async () => {
    mockRpc = () => ({ data: null, error: { message: 'Only admins can add admins' } });
    await expect(addAdmin('x@example.com')).rejects.toThrow('Only admins can add admins');
  });
});

describe('removeAdmin', () => {
  it('sends the account id and reason', async () => {
    await removeAdmin('a2', 'left the team');
    expect(mockCalls).toEqual([['rpc', 'admin_remove_staff', { p_user_id: 'a2', p_note: 'left the team' }]]);
  });

  it("shows the database's refusal to remove the last admin", async () => {
    mockRpc = () => ({ data: null, error: { message: "The last admin can't be removed" } });
    await expect(removeAdmin('a1')).rejects.toThrow("The last admin can't be removed");
  });
});
