import {
  ROLES, SECTIONS, COMPANY_TYPES, getEffectiveRole, canAccessSection, deriveRoleForUser, getRoleForCompanyType,
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
  it('everyone gets Dashboard, Settings and Regulatory', () => {
    ['user', 'volunteer', 'media', 'manager', 'authority'].forEach(r => {
      expect(can(SECTIONS.DASHBOARD, r)).toBe(true);
      expect(can(SECTIONS.SETTINGS, r)).toBe(true);
      expect(can(SECTIONS.REGULATORY, r)).toBe(true);
    });
  });
  it('Illegal Dumping stays Manager and Admin until the scoped roles are built', () => {
    expect(can(SECTIONS.ILLEGAL_DUMPING, 'manager')).toBe(true);
    ['user', 'volunteer', 'media', 'authority'].forEach(r => expect(can(SECTIONS.ILLEGAL_DUMPING, r)).toBe(false));
    expect(canAccessSection(SECTIONS.ILLEGAL_DUMPING, 'user', admin)).toBe(true);
  });
  it('Request Pickup, Bin Management and Account Approvals are admin only', () => {
    [SECTIONS.REQUEST_PICKUP, SECTIONS.BIN_MANAGEMENT, SECTIONS.ACCOUNTS].forEach(s => {
      expect(can(s, 'manager')).toBe(false);
      expect(can(s, 'authority')).toBe(false);
      expect(canAccessSection(s, 'user', admin)).toBe(true);
    });
  });
});
