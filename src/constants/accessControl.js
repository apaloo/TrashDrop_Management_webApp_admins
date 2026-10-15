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
  ACCOUNTS: 'accounts'
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

export const SECTION_PERMISSIONS = {
  [SECTIONS.DASHBOARD]: [ROLES.USER, ROLES.VOLUNTEER, ROLES.MEDIA, ROLES.MANAGER, ROLES.AUTHORITY, ROLES.ADMIN],
  [SECTIONS.SETTINGS]: [ROLES.USER, ROLES.VOLUNTEER, ROLES.MEDIA, ROLES.MANAGER, ROLES.AUTHORITY, ROLES.ADMIN],
  [SECTIONS.REGULATORY]: [ROLES.USER, ROLES.VOLUNTEER, ROLES.MEDIA, ROLES.MANAGER, ROLES.AUTHORITY, ROLES.ADMIN],
  // Authority sees its own district, read-only (see areaScopeFor). Volunteers
  // work from the collector app; Media gets its read-only view separately.
  [SECTIONS.ILLEGAL_DUMPING]: [ROLES.AUTHORITY, ROLES.MANAGER, ROLES.ADMIN],
  [SECTIONS.BIN_MANAGEMENT]: [ROLES.ADMIN],
  [SECTIONS.REQUEST_PICKUP]: [ROLES.ADMIN],
  [SECTIONS.ACCOUNTS]: [ROLES.ADMIN]
};

export const canAccessSection = (section, role, user) => {
  if (!section) return true;
  const effectiveRole = getEffectiveRole(role, user);
  const allowedRoles = SECTION_PERMISSIONS[section] || [];
  return allowedRoles.includes(effectiveRole);
};

/** Who can verify, assign, complete or cancel illegal dumping reports */
export const canManageDumping = (role) => role === ROLES.MANAGER || role === ROLES.ADMIN;

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
