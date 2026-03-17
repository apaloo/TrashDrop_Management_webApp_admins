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
  SETTINGS: 'settings',
  REGULATORY: 'regulatory'
};

export const COMPANY_TYPE_ROLE_MAP = {
  waste_management: ROLES.MANAGER,
  recycling: ROLES.MANAGER,
  municipality: ROLES.MANAGER,
  nonprofit: ROLES.USER,
  other: ROLES.USER
};

const normalizeEmail = (email) => email?.trim().toLowerCase() || '';
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

export const deriveRoleForUser = ({ email, companyType, requestedRole }) => {
  if (isWhitelistedAdminEmail(email)) {
    return ROLES.ADMIN;
  }

  if (requestedRole && requestedRole !== ROLES.ADMIN) {
    return requestedRole;
  }

  return getRoleForCompanyType(companyType);
};

export const getEffectiveRole = (role, user) => {
  if (isWhitelistedAdminEmail(user?.email)) {
    return ROLES.ADMIN;
  }

  if (role === ROLES.ADMIN && !isWhitelistedAdminEmail(user?.email)) {
    // Treat non-whitelisted admin accounts as basic users
    return ROLES.USER;
  }

  return role || ROLES.USER;
};

export const SECTION_PERMISSIONS = {
  [SECTIONS.DASHBOARD]: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN],
  [SECTIONS.SETTINGS]: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN],
  [SECTIONS.ILLEGAL_DUMPING]: [ROLES.MANAGER, ROLES.ADMIN],
  [SECTIONS.BIN_MANAGEMENT]: [ROLES.ADMIN],
  [SECTIONS.REQUEST_PICKUP]: [ROLES.ADMIN],
  [SECTIONS.REGULATORY]: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN]
};

export const canAccessSection = (section, role, user) => {
  if (!section) return true;
  const effectiveRole = getEffectiveRole(role, user);
  const allowedRoles = SECTION_PERMISSIONS[section] || [];
  return allowedRoles.includes(effectiveRole);
};

export const getAllowedRolesForSection = (section) => SECTION_PERMISSIONS[section] || [];
