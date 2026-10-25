/**
 * Account access levels kept in the database (account_roles); see
 * supabase/migrations/20261023_account_roles.sql.
 */
import { supabase } from '../utils/supabase';

export const isMissingAccessSchema = (error) => ['42883', 'PGRST202', '42P01', 'PGRST205'].includes(error?.code)
  || /could not find the function|does not exist/i.test(error?.message || '');

const normalizeAccess = (d) => ({
  role: d?.role || 'user',
  requestedRole: d?.requested_role || d?.role || 'user',
  status: d?.status || 'approved',
  companyType: d?.company_type || null,
  orgName: d?.org_name || null,
  region: d?.region || null,
  district: d?.district || null,
  reviewNote: d?.review_note || null,
  // Volunteer group team (20261110): owner = the group's own account
  team: d?.team ? { groupId: d.team.group_id, groupName: d.team.group_name || null, teamRole: d.team.team_role } : null,
});

/** The signed-in account's access. Throws with .missingSchema when the migration isn't run yet. */
export const fetchMyAccess = async () => {
  const { data, error } = await supabase.rpc('my_access');
  if (error) {
    const e = new Error(error.message || 'Access could not be loaded');
    e.missingSchema = isMissingAccessSchema(error);
    throw e;
  }
  return normalizeAccess(data);
};

/** Ask for the access that goes with a company type (approval needed above User) */
export const requestAccountRole = async ({ companyType, orgName, region, district, details } = {}) => {
  const { data, error } = await supabase.rpc('request_account_role', {
    p_company_type: companyType || null, p_org_name: orgName || null,
    p_region: region || null, p_district: district || null, p_details: details || {},
  });
  if (error) throw new Error(error.message || 'Request not saved');
  return normalizeAccess(data);
};

/** Admin: accounts with their requests; status 'pending' | 'approved' | 'rejected' | null (all) */
export const listAccountRoles = async (status = 'pending') => {
  const { data, error } = await supabase.rpc('admin_list_account_roles', { p_status: status });
  if (error) {
    if (isMissingAccessSchema(error)) throw new Error('The database is missing the account roles update. Run supabase/migrations/20261023_account_roles.sql in Supabase.');
    throw new Error(error.message || 'Accounts could not be loaded');
  }
  return data || [];
};

/** Admin: approve (optionally as another role) or reject with a reason */
export const reviewAccountRole = async (userId, { approve, role = null, note = '' }) => {
  const { error } = await supabase.rpc('admin_review_account_role', {
    p_user_id: userId, p_approve: approve, p_role: role, p_note: note || null,
  });
  if (error) throw new Error(error.message || 'Not saved');
};

/** Admin: set or correct an account's region / district (an Authority sees only its district) */
export const setAccountArea = async (userId, { region, district }) => {
  const { data, error } = await supabase.rpc('admin_set_account_area', {
    p_user_id: userId, p_region: region || null, p_district: district || null,
  });
  if (error) {
    if (isMissingAccessSchema(error)) throw new Error('The database is missing the areas update. Run supabase/migrations/20261026_area_scope.sql in Supabase.');
    throw new Error(error.message || 'Area not saved');
  }
  return data;
};
