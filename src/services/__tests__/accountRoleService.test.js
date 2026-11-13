// Account access levels (account_roles): what the admin site sends to the
// database and how it reads the answers. The database decides who may do
// what (my_access, request_account_role, admin_*); these tests pin the
// app's side: the exact arguments, the defaults, and the errors staff see.
import {
  isMissingAccessSchema, fetchMyAccess, requestAccountRole, listAccountRoles, reviewAccountRole, setAccountArea,
} from '../accountRoleService';
import { supabase } from '../../utils/supabase';

jest.mock('../../utils/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const answer = (data, error = null) => supabase.rpc.mockResolvedValueOnce({ data, error });

beforeEach(() => supabase.rpc.mockReset());

describe('isMissingAccessSchema', () => {
  it.each(['42883', 'PGRST202', '42P01', 'PGRST205'])('code %s means the migration has not been run', (code) => {
    expect(isMissingAccessSchema({ code })).toBe(true);
  });
  it('recognises the message forms too', () => {
    expect(isMissingAccessSchema({ message: 'Could not find the function public.my_access' })).toBe(true);
    expect(isMissingAccessSchema({ message: 'relation "account_roles" does not exist' })).toBe(true);
  });
  it('a refusal or any other error is not a missing schema', () => {
    expect(isMissingAccessSchema({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingAccessSchema(null)).toBe(false);
    expect(isMissingAccessSchema(undefined)).toBe(false);
  });
});

describe('fetchMyAccess', () => {
  it('maps the database answer, team included', async () => {
    answer({
      role: 'authority', requested_role: 'authority', status: 'approved', company_type: 'municipal_assembly',
      org_name: 'Ga East', region: 'Greater Accra', district: 'Ga East', review_note: 'ok',
      team: { group_id: 'g1', group_name: 'Clean Abokobi', team_role: 'owner' },
    });
    await expect(fetchMyAccess()).resolves.toEqual({
      role: 'authority', requestedRole: 'authority', status: 'approved', companyType: 'municipal_assembly',
      orgName: 'Ga East', region: 'Greater Accra', district: 'Ga East', reviewNote: 'ok',
      team: { groupId: 'g1', groupName: 'Clean Abokobi', teamRole: 'owner' },
    });
    expect(supabase.rpc).toHaveBeenCalledWith('my_access');
  });

  it('an account with no access row is a plain approved user, with no area', async () => {
    answer(null);
    await expect(fetchMyAccess()).resolves.toEqual({
      role: 'user', requestedRole: 'user', status: 'approved', companyType: null, orgName: null,
      region: null, district: null, reviewNote: null, team: null,
    });
  });

  it('a pending request keeps the current role and shows what was asked for', async () => {
    answer({ role: 'user', requested_role: 'manager', status: 'pending', team: { group_id: 'g2', team_role: 'member' } });
    const a = await fetchMyAccess();
    expect(a).toMatchObject({ role: 'user', requestedRole: 'manager', status: 'pending' });
    expect(a.team).toEqual({ groupId: 'g2', groupName: null, teamRole: 'member' });
  });

  it('an error throws, marked when the migration is missing', async () => {
    answer(null, { code: 'PGRST202', message: 'Could not find the function' });
    await expect(fetchMyAccess()).rejects.toMatchObject({ missingSchema: true });
    answer(null, { code: '42501', message: 'permission denied' });
    await expect(fetchMyAccess()).rejects.toMatchObject({ message: 'permission denied', missingSchema: false });
    answer(null, {});
    await expect(fetchMyAccess()).rejects.toThrow('Access could not be loaded');
  });
});

describe('requestAccountRole', () => {
  it('sends the request with nulls (never undefined) for what was left out', async () => {
    answer({ role: 'user', requested_role: 'authority', status: 'pending' });
    const a = await requestAccountRole({ companyType: 'municipal_assembly', orgName: 'Ga East', region: 'Greater Accra', district: 'Ga East', details: { phone: '0200' } });
    expect(supabase.rpc).toHaveBeenCalledWith('request_account_role', {
      p_company_type: 'municipal_assembly', p_org_name: 'Ga East', p_region: 'Greater Accra', p_district: 'Ga East', p_details: { phone: '0200' },
    });
    expect(a).toMatchObject({ requestedRole: 'authority', status: 'pending' });

    answer({});
    await requestAccountRole();
    expect(supabase.rpc).toHaveBeenLastCalledWith('request_account_role', {
      p_company_type: null, p_org_name: null, p_region: null, p_district: null, p_details: {},
    });
  });

  it('a refusal reaches the person with the database message', async () => {
    answer(null, { message: 'Region and district are set by an admin' });
    await expect(requestAccountRole({ companyType: 'x' })).rejects.toThrow('Region and district are set by an admin');
    answer(null, {});
    await expect(requestAccountRole({})).rejects.toThrow('Request not saved');
  });
});

describe('listAccountRoles (admin)', () => {
  it('pending by default; any status, or all with null', async () => {
    answer([{ user_id: 'u1' }]);
    await expect(listAccountRoles()).resolves.toEqual([{ user_id: 'u1' }]);
    expect(supabase.rpc).toHaveBeenLastCalledWith('admin_list_account_roles', { p_status: 'pending' });
    answer(null);
    await expect(listAccountRoles(null)).resolves.toEqual([]);
    expect(supabase.rpc).toHaveBeenLastCalledWith('admin_list_account_roles', { p_status: null });
  });

  it('says which migration to run when the schema is missing; otherwise the database message', async () => {
    answer(null, { code: '42883' });
    await expect(listAccountRoles()).rejects.toThrow(/20261023_account_roles\.sql/);
    answer(null, { code: '42501', message: 'Only admins can list accounts' });
    await expect(listAccountRoles()).rejects.toThrow('Only admins can list accounts');
  });
});

describe('reviewAccountRole (admin)', () => {
  it('approve as another role, or reject with a reason', async () => {
    answer(null);
    await reviewAccountRole('u1', { approve: true, role: 'volunteer' });
    expect(supabase.rpc).toHaveBeenLastCalledWith('admin_review_account_role', { p_user_id: 'u1', p_approve: true, p_role: 'volunteer', p_note: null });
    answer(null);
    await reviewAccountRole('u2', { approve: false, note: 'No proof of employment' });
    expect(supabase.rpc).toHaveBeenLastCalledWith('admin_review_account_role', { p_user_id: 'u2', p_approve: false, p_role: null, p_note: 'No proof of employment' });
  });

  it('a refusal throws', async () => {
    answer(null, { message: 'Not allowed' });
    await expect(reviewAccountRole('u1', { approve: true })).rejects.toThrow('Not allowed');
    answer(null, {});
    await expect(reviewAccountRole('u1', { approve: true })).rejects.toThrow('Not saved');
  });
});

describe('setAccountArea (admin)', () => {
  it('sends the area and returns what the database stored', async () => {
    answer({ region: 'Greater Accra', district: 'Ga East' });
    await expect(setAccountArea('u1', { region: 'Greater Accra', district: 'Ga East' })).resolves.toEqual({ region: 'Greater Accra', district: 'Ga East' });
    expect(supabase.rpc).toHaveBeenLastCalledWith('admin_set_account_area', { p_user_id: 'u1', p_region: 'Greater Accra', p_district: 'Ga East' });
    answer(null);
    await setAccountArea('u1', { region: '', district: undefined });
    expect(supabase.rpc).toHaveBeenLastCalledWith('admin_set_account_area', { p_user_id: 'u1', p_region: null, p_district: null });
  });

  it('says which migration to run when the schema is missing; otherwise the database message', async () => {
    answer(null, { code: 'PGRST202' });
    await expect(setAccountArea('u1', {})).rejects.toThrow(/20261026_area_scope\.sql/);
    answer(null, { message: 'Only admins can set an area' });
    await expect(setAccountArea('u1', {})).rejects.toThrow('Only admins can set an area');
    answer(null, {});
    await expect(setAccountArea('u1', {})).rejects.toThrow('Area not saved');
  });
});
