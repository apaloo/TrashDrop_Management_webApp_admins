/**
 * Access levels for the admin app.
 *
 * The role in force comes from the database (account_roles, read through
 * my_access(); see supabase/migrations/20261023_account_roles.sql), never from
 * the account's own user_metadata, which its owner can edit. A requested role
 * only takes effect once an admin approves it; until then the account works
 * as a User.
 */
import { GHANA_REGIONS, OTHER_DISTRICT, isKnownDistrict } from './ghanaRegions';
import { can, rolesWith, rolesWithAny } from '../lib/permissions';

export const ROLES = {
  USER: 'user',
  VOLUNTEER: 'volunteer',
  MEDIA: 'media',
  MANAGER: 'manager',
  AUTHORITY: 'authority',
  ADMIN: 'admin'
};

export const ROLE_LABELS = {
  user: 'User',
  volunteer: 'Volunteer',
  media: 'Media',
  manager: 'Manager',
  authority: 'Authority (MMDA)',
  admin: 'Admin'
};

export const SECTIONS = {
  DASHBOARD: 'dashboard',
  REQUEST_PICKUP: 'request-pickup',
  BIN_MANAGEMENT: 'bin-management',
  ILLEGAL_DUMPING: 'illegal-dumping',
  SETTINGS: 'settings',
  REGULATORY: 'regulatory',
  ACCOUNTS: 'accounts',
  MEDIA_DATA: 'media-data',
  MY_PERFORMANCE: 'my-performance',
  ACCOUNT_PERFORMANCE: 'account-performance'
};

/**
 * Company types offered at sign-up and onboarding, and the access each asks
 * for. Same mapping as td_role_for_company_type() in the database.
 */
export const COMPANY_TYPES = [
  { value: 'waste_management', label: 'Waste Management', role: ROLES.MANAGER },
  { value: 'recycling', label: 'Recycling', role: ROLES.MANAGER },
  { value: 'municipality', label: 'Municipal / District Assembly (MMDA)', role: ROLES.AUTHORITY },
  { value: 'volunteer_group', label: 'Volunteer / Community Group', role: ROLES.VOLUNTEER },
  { value: 'nonprofit', label: 'Non-Profit Organization / NGO', role: ROLES.VOLUNTEER },
  { value: 'media', label: 'Journalist / Media', role: ROLES.MEDIA },
  { value: 'other', label: 'Individual / Other', role: ROLES.USER }
];

export const COMPANY_TYPE_ROLE_MAP = Object.fromEntries(COMPANY_TYPES.map(t => [t.value, t.role]));

const normalizeEmail = (email) => email?.trim().toLowerCase() || '';
// Same list as td_admin_emails() in the database; change both together.
export const FULL_ACCESS_ADMIN_EMAILS = [
  'otisadomako50@gmail.com',
  'xahlijah@gmail.com'
];

const isWhitelistedAdminEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);
  return FULL_ACCESS_ADMIN_EMAILS.some(whitelistedEmail =>
    normalizeEmail(whitelistedEmail) === normalizedEmail
  );
};

export const hasFullAdminAccess = (role, user) => (
  role === ROLES.ADMIN && isWhitelistedAdminEmail(user?.email)
);

export const getRoleForCompanyType = (companyType) => {
  return COMPANY_TYPE_ROLE_MAP[companyType] || ROLES.USER;
};

/** The role a company type asks for (what sign-up records as requested, not granted) */
export const deriveRoleForUser = ({ email, companyType }) => {
  if (isWhitelistedAdminEmail(email)) {
    return ROLES.ADMIN;
  }
  return getRoleForCompanyType(companyType);
};

const KNOWN_ROLES = Object.values(ROLES);

/**
 * The role in force. `role` must come from the database (my_access()); Admin
 * is only ever the whitelisted emails.
 */
export const getEffectiveRole = (role, user) => {
  if (isWhitelistedAdminEmail(user?.email)) {
    return ROLES.ADMIN;
  }
  if (role === ROLES.ADMIN || !KNOWN_ROLES.includes(role)) {
    return ROLES.USER;
  }
  return role;
};

// Sections are worked out from the capability table (src/lib/permissions.js)
// so a menu item, a route and a data call can never disagree. Settings and
// Regulatory are open to every account (a person's own profile and the
// regulatory information).
const EVERY_ROLE = Object.values(ROLES);

export const SECTION_PERMISSIONS = {
  [SECTIONS.DASHBOARD]: rolesWithAny(['dashboard.stats', 'dashboard.liveQueue']),
  [SECTIONS.SETTINGS]: EVERY_ROLE,
  [SECTIONS.REGULATORY]: EVERY_ROLE,
  // Authority sees its own district, read-only (see areaScopeFor). Volunteers
  // work from the collector app; Media gets its read-only view separately.
  [SECTIONS.ILLEGAL_DUMPING]: rolesWith('dumping.view'),
  [SECTIONS.BIN_MANAGEMENT]: rolesWith('bags.view'),
  [SECTIONS.REQUEST_PICKUP]: rolesWith('requests.view'),
  [SECTIONS.ACCOUNTS]: rolesWith('users.manage'),
  // National, read-only report data without reporter details (media_dumping_reports)
  [SECTIONS.MEDIA_DATA]: rolesWith('reports.view'),
  // An account's own numbers and rank (my_performance() returns only the
  // caller's own page; 20261109). Volunteer groups and MMDAs have metrics.
  [SECTIONS.MY_PERFORMANCE]: [ROLES.VOLUNTEER, ROLES.AUTHORITY],
  // Every account side by side, and any account's page (performance_overview()
  // and my_performance(account) are staff only in the database)
  [SECTIONS.ACCOUNT_PERFORMANCE]: rolesWith('users.manage')
};

export const canAccessSection = (section, role, user) => {
  if (!section) return true;
  const effectiveRole = getEffectiveRole(role, user);
  const allowedRoles = SECTION_PERMISSIONS[section] || [];
  return allowedRoles.includes(effectiveRole);
};

/** Who can verify, assign, complete or cancel illegal dumping reports */
export const canManageDumping = (role) => can('dumping.manage', role);

/**
 * The area an account may see. Same rules as td_my_area() in the database
 * (supabase/migrations/20261026_area_scope.sql):
 * Admin, Manager, Media → national; Authority → its district;
 * Volunteer → its region; anyone else, or no known district / region → none.
 */
export const areaScopeFor = (role, access) => {
  if (role === ROLES.ADMIN || role === ROLES.MANAGER || role === ROLES.MEDIA) return { level: 'national' };
  const region = GHANA_REGIONS.some(r => r.name === access?.region) ? access.region : null;
  if (role === ROLES.AUTHORITY && region && isKnownDistrict(region, access?.district) && access.district !== OTHER_DISTRICT) {
    return { level: 'district', region, district: access.district };
  }
  if (role === ROLES.VOLUNTEER && region) return { level: 'region', region };
  return { level: 'none' };
};

export const getAllowedRolesForSection = (section) => SECTION_PERMISSIONS[section] || [];

/** "Greater Accra Region " → "greater accra" (same as td_norm_region in the database) */
export const normalizeRegion = (value) => {
  const v = String(value ?? '').replace(/\s+region\s*$/i, '').trim().toLowerCase();
  return v || null;
};
export const sameRegion = (a, b) => normalizeRegion(a) !== null && normalizeRegion(a) === normalizeRegion(b);

/**
 * Who may put collectors on pickup requests, and where. Same rule as
 * td_my_assign_region() in supabase/migrations/20261103_manager_assign_scope.sql:
 * Admin anywhere; a Manager only when the account type is Waste Management and
 * the account has a region, and then only in that region. `access` is
 * my_access() as AuthContext holds it (companyType, region).
 */
export const assignScopeFor = (role, access) => {
  if (role === ROLES.ADMIN) return { canAssign: true, region: null };
  if (role !== ROLES.MANAGER) return { canAssign: false, region: null, reason: null };
  // my_access() comes through normalizeAccess (accountRoleService), so the field is companyType
  if ((access?.companyType ?? access?.company_type) !== 'waste_management') {
    return { canAssign: false, region: null, reason: 'Assigning collectors is for Waste Management accounts. Ask an admin if your account type is wrong.' };
  }
  if (!normalizeRegion(access?.region)) {
    return { canAssign: false, region: null, reason: 'Your account has no region yet, so you can’t assign collectors. Ask an admin to set your region.' };
  }
  return { canAssign: true, region: access.region };
};
