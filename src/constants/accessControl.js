export const ROLES = {
  USER: 'user',
  MANAGER: 'manager',
  ADMIN: 'admin'
};

export const SECTIONS = {
  DASHBOARD: 'dashboard',
  REQUEST_PICKUP: 'request-pickup',
  BIN_MANAGEMENT: 'bin-management',
  ILLEGAL_DUMPING: 'illegal-dumping',
  SETTINGS: 'settings'
};

export const COMPANY_TYPE_ROLE_MAP = {
  waste_management: ROLES.MANAGER,
  recycling: ROLES.MANAGER,
  municipality: ROLES.MANAGER,
  nonprofit: ROLES.USER,
  other: ROLES.USER
};

const normalizeEmail = (email) => email?.trim().toLowerCase() || '';
export const FULL_ACCESS_ADMIN_EMAIL = 'otisadomako50@gmail.com';

export const hasFullAdminAccess = (role, user) => (
  role === ROLES.ADMIN && normalizeEmail(user?.email) === FULL_ACCESS_ADMIN_EMAIL
);

export const getEffectiveRole = (role, user) => {
  if (role === ROLES.ADMIN && !hasFullAdminAccess(role, user)) {
    // Treat non-whitelisted admin accounts as basic users
    return ROLES.USER;
  }
  return role || ROLES.USER;
};

export const getRoleForCompanyType = (companyType) => {
  return COMPANY_TYPE_ROLE_MAP[companyType] || ROLES.USER;
};

export const SECTION_PERMISSIONS = {
  [SECTIONS.DASHBOARD]: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN],
  [SECTIONS.SETTINGS]: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN],
  [SECTIONS.ILLEGAL_DUMPING]: [ROLES.MANAGER, ROLES.ADMIN],
  [SECTIONS.BIN_MANAGEMENT]: [ROLES.ADMIN],
  [SECTIONS.REQUEST_PICKUP]: [ROLES.ADMIN]
};

export const canAccessSection = (section, role, user) => {
  if (!section) return true;
  const effectiveRole = getEffectiveRole(role, user);
  const allowedRoles = SECTION_PERMISSIONS[section] || [];
  return allowedRoles.includes(effectiveRole);
};

export const getAllowedRolesForSection = (section) => SECTION_PERMISSIONS[section] || [];
