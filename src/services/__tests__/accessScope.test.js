import { fetchMyAccess } from '../accountRoleService';
import { assignScopeFor } from '../../constants/accessControl';
import { supabase } from '../../utils/supabase';

jest.mock('../../utils/supabase', () => ({ supabase: { rpc: jest.fn() } }));

// The access object AuthContext holds is my_access() after normalizeAccess; the
// assign rule must read that shape, not the raw database row.
it('a Waste Management Manager with a region can assign, from the real my_access() answer', async () => {
  supabase.rpc.mockResolvedValue({ data: { role: 'manager', status: 'approved', company_type: 'waste_management', region: 'Greater Accra' }, error: null });
  const access = await fetchMyAccess();
  expect(assignScopeFor('manager', access)).toEqual({ canAssign: true, region: 'Greater Accra' });
});

it('a Recycling Manager cannot, from the real my_access() answer', async () => {
  supabase.rpc.mockResolvedValue({ data: { role: 'manager', status: 'approved', company_type: 'recycling', region: 'Greater Accra' }, error: null });
  expect(assignScopeFor('manager', await fetchMyAccess()).canAssign).toBe(false);
});
