/**
 * Who may do what, in one place.
 *
 * Every screen, menu item and data call asks `can(capability, role)` instead
 * of comparing role names. The database holds the same table
 * (td_capability_roles in supabase/migrations/20261101_role_permissions.sql)
 * and enforces it; src/lib/__tests__/permissions.test.js fails if the two
 * drift apart. Change a role's access in both places together.
 *
 * Roles are the ones that exist today (src/constants/accessControl.js): user,
 * volunteer, media, manager, authority, admin.
 */

export const CAPABILITY_ROLES = {
  'dashboard.stats':     ['admin', 'manager'],
  'dashboard.liveQueue': ['admin', 'manager'], // pending, stale, collectors online
  'requests.view':       ['admin', 'manager'],
  'requests.assign':     ['admin', 'manager'],
  'requests.cancel':     ['admin', 'manager'],
  'requests.locate':     ['admin'],
  'collectors.view':     ['admin'],
  'alerts.view':         ['admin'],
  'logs.view':           ['admin'],
  'bags.view':           ['admin'],
  'bags.manage':         ['admin'],
  // Illegal dumping (20261104_area_dumping_access.sql). Area: Authority its
  // district, Volunteer its region, User the district of its pickup address,
  // Media national. Accounts without dumping.reporters never see who reported.
  'dumping.view':        ['admin', 'manager', 'authority', 'media', 'volunteer', 'user'],
  'dumping.reporters':   ['admin', 'manager', 'authority'],
  'dumping.verify':      ['admin', 'manager', 'authority', 'media', 'volunteer'],
  'dumping.assign':      ['admin', 'manager', 'authority', 'volunteer'], // Volunteer: volunteer groups only
  'dumping.fee':         ['admin', 'manager', 'authority'],
  'dumping.markCleaned': ['admin', 'manager', 'authority', 'volunteer'],
  'dumping.manage':      ['admin', 'manager'], // everything else, e.g. cancel
  'reports.view':        ['admin', 'manager', 'media', 'authority', 'volunteer'],
  'reports.export':      ['admin', 'manager', 'media', 'authority', 'volunteer'],
  'users.manage':        ['admin'],
  'settings.manage':     ['admin'], // system settings; every account still edits its own profile
};

/** Does `role` (the effective role) include `capability`? Unknown capabilities are refused. */
export const can = (capability, role) => (CAPABILITY_ROLES[capability] || []).includes(role);

export const canAny = (capabilities, role) => capabilities.some(c => can(c, role));

/** Roles that include `capability` */
export const rolesWith = (capability) => [...(CAPABILITY_ROLES[capability] || [])];

/** Roles that include at least one of `capabilities` */
export const rolesWithAny = (capabilities) =>
  [...new Set(capabilities.flatMap(c => CAPABILITY_ROLES[c] || []))];

/** Where each role starts (the table agreed for each role); unknown roles start on Settings */
const LANDING_BY_ROLE = {
  admin: '/dashboard',
  manager: '/dashboard',
  authority: '/illegal-dumping/reports',
  media: '/media-data',
  volunteer: '/settings',
  user: '/settings',
};

export const landingPathFor = (role) => LANDING_BY_ROLE[role] || '/settings';
