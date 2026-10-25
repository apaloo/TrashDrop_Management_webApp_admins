import {
  ROLES, SECTIONS, COMPANY_TYPES, getEffectiveRole, canAccessSection, deriveRoleForUser, getRoleForCompanyType,
  areaScopeFor, canManageDumping, assignScopeFor, sameRegion,
} from '../accessControl';

const admin = { email: 'otisadomako50@gmail.com' };
const someone = { email: 'kofi@example.com' };

describe('roles', () => {
  it('maps every company type to the role it asks for (same as the database)', () => {
    expect(Object.fromEntries(COMPANY_TYPES.map(t => [t.value, t.role]))).toEqual({
      waste_management: 'manager', recycling: 'manager', municipality: 'authority',
      volunteer_group: 'volunteer', nonprofit: 'volunteer', media: 'media', other: 'user',
    });
    expect(getRoleForCompanyType('unknown')).toBe('user');
    expect(deriveRoleForUser({ email: admin.email, companyType: 'other' })).toBe('admin');
  });

  it('only whitelisted emails are admin; unknown or admin roles from elsewhere become user', () => {
    expect(getEffectiveRole('user', admin)).toBe(ROLES.ADMIN);
    expect(getEffectiveRole('admin', someone)).toBe(ROLES.USER);
    expect(getEffectiveRole('superuser', someone)).toBe(ROLES.USER);
    expect(getEffectiveRole(undefined, someone)).toBe(ROLES.USER);
    expect(getEffectiveRole('volunteer', someone)).toBe(ROLES.VOLUNTEER);
  });
});

describe('sections', () => {
  const can = (section, role) => canAccessSection(section, role, someone);
  it('everyone gets Settings and Regulatory; only Admin and Manager get the Dashboard', () => {
    ['user', 'volunteer', 'media', 'manager', 'authority'].forEach(r => {
      expect(can(SECTIONS.SETTINGS, r)).toBe(true);
      expect(can(SECTIONS.REGULATORY, r)).toBe(true);
    });
    expect(can(SECTIONS.DASHBOARD, 'manager')).toBe(true);
    ['user', 'volunteer', 'media', 'authority'].forEach(r => expect(can(SECTIONS.DASHBOARD, r)).toBe(false));
    expect(canAccessSection(SECTIONS.DASHBOARD, 'user', admin)).toBe(true);
  });
  it('My Performance is for Volunteer groups and MMDAs; Account Performance is admin only', () => {
    ['volunteer', 'authority'].forEach(r => expect(can(SECTIONS.MY_PERFORMANCE, r)).toBe(true));
    ['user', 'media', 'manager'].forEach(r => expect(can(SECTIONS.MY_PERFORMANCE, r)).toBe(false));
    ['user', 'volunteer', 'media', 'manager', 'authority'].forEach(r => expect(can(SECTIONS.ACCOUNT_PERFORMANCE, r)).toBe(false));
    expect(canAccessSection(SECTIONS.ACCOUNT_PERFORMANCE, 'user', admin)).toBe(true);
  });
  it('Illegal Dumping is open to every role (each sees its own area; 20261104)', () => {
    ['manager', 'authority', 'media', 'volunteer', 'user'].forEach(r => expect(can(SECTIONS.ILLEGAL_DUMPING, r)).toBe(true));
    expect(canAccessSection(SECTIONS.ILLEGAL_DUMPING, 'user', admin)).toBe(true);
  });
  it('Bin Management and Account Approvals are admin only', () => {
    [SECTIONS.BIN_MANAGEMENT, SECTIONS.ACCOUNTS].forEach(s => {
      expect(can(s, 'manager')).toBe(false);
      expect(can(s, 'authority')).toBe(false);
      expect(canAccessSection(s, 'user', admin)).toBe(true);
    });
  });
  it('Request Pickup is Admin and Manager (requests.view)', () => {
    expect(can(SECTIONS.REQUEST_PICKUP, 'manager')).toBe(true);
    ['user', 'volunteer', 'media', 'authority'].forEach(r => expect(can(SECTIONS.REQUEST_PICKUP, r)).toBe(false));
    expect(canAccessSection(SECTIONS.REQUEST_PICKUP, 'user', admin)).toBe(true);
  });
});

describe('areas (same rules as td_my_area)', () => {
  const madina = { region: 'Greater Accra', district: 'La-Nkwantanang-Madina' };

  it('Admin, Manager and Media see the whole country', () => {
    ['admin', 'manager', 'media'].forEach(r => expect(areaScopeFor(r, madina)).toEqual({ level: 'national' }));
  });

  it('Authority sees its district only, and nothing without a known district', () => {
    expect(areaScopeFor('authority', madina)).toEqual({ level: 'district', ...madina });
    expect(areaScopeFor('authority', { region: 'Ashanti', district: madina.district })).toEqual({ level: 'none' });
    expect(areaScopeFor('authority', { region: 'Greater Accra', district: 'Other / not listed' })).toEqual({ level: 'none' });
    expect(areaScopeFor('authority', null)).toEqual({ level: 'none' });
  });

  it('Volunteer sees its region; User sees none', () => {
    expect(areaScopeFor('volunteer', { region: 'Greater Accra', district: 'La Nkwantanang Madina' })).toEqual({ level: 'region', region: 'Greater Accra' });
    expect(areaScopeFor('volunteer', { region: 'Narnia' })).toEqual({ level: 'none' });
    expect(areaScopeFor('user', madina)).toEqual({ level: 'none' });
  });

  it('only Manager and Admin have the full dumping controls (cancel); others act through their own capabilities', () => {
    expect(canAccessSection(SECTIONS.ILLEGAL_DUMPING, 'authority', someone)).toBe(true);
    expect(canManageDumping('authority')).toBe(false);
    expect(canManageDumping('volunteer')).toBe(false);
    expect(canManageDumping('manager')).toBe(true);
  });
});

describe('assigning collectors (same rule as td_my_assign_region)', () => {
  it('Admin anywhere; Waste Management Manager in their region only; everyone else never', () => {
    expect(assignScopeFor('admin', null)).toEqual({ canAssign: true, region: null });
    expect(assignScopeFor('manager', { companyType: 'waste_management', region: 'Greater Accra' })).toEqual({ canAssign: true, region: 'Greater Accra' });
    expect(assignScopeFor('manager', { companyType: 'recycling', region: 'Greater Accra' }).canAssign).toBe(false);
    expect(assignScopeFor('manager', { companyType: 'waste_management', region: '' }).canAssign).toBe(false);
    ['user', 'volunteer', 'media', 'authority'].forEach(r => expect(assignScopeFor(r, { companyType: 'waste_management', region: 'Greater Accra' }).canAssign).toBe(false));
  });
  it('matches region spellings', () => {
    expect(sameRegion('Greater Accra Region', ' greater accra')).toBe(true);
    expect(sameRegion('Ashanti', 'Greater Accra')).toBe(false);
    expect(sameRegion(null, null)).toBe(false);
  });
});
