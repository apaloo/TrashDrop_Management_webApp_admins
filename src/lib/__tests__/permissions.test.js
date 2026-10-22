import fs from 'fs';
import path from 'path';
import { CAPABILITY_ROLES, can, canAny, rolesWith, landingPathFor } from '../permissions';
import { ROLES } from '../../constants/accessControl';

describe('capability table', () => {
  it('only names roles that exist', () => {
    const known = Object.values(ROLES);
    Object.entries(CAPABILITY_ROLES).forEach(([cap, roles]) => {
      roles.forEach(r => expect({ cap, r, known: known.includes(r) }).toEqual({ cap, r, known: true }));
    });
  });

  it('Users only view illegal dumping; Volunteers only dumping and Reports Data', () => {
    const granted = (role) => Object.keys(CAPABILITY_ROLES).filter(c => can(c, role)).sort();
    expect(granted('user')).toEqual(['dumping.view']);
    expect(granted('volunteer')).toEqual(['dumping.assign', 'dumping.markCleaned', 'dumping.verify', 'dumping.view', 'reports.export', 'reports.view']);
    expect(granted('media')).toEqual(['dumping.verify', 'dumping.view', 'reports.export', 'reports.view']);
    expect(granted('authority')).toEqual(['dumping.assign', 'dumping.fee', 'dumping.markCleaned', 'dumping.reporters', 'dumping.verify', 'dumping.view', 'reports.export', 'reports.view']);
  });

  it('gives Admin everything', () => {
    Object.keys(CAPABILITY_ROLES).forEach(cap => expect(can(cap, 'admin')).toBe(true));
  });

  it('Manager: dashboard, requests, dumping and reports; no users, settings, bags, alerts or logs', () => {
    ['dashboard.stats', 'dashboard.liveQueue', 'requests.view', 'requests.assign', 'dumping.manage', 'reports.view', 'reports.export']
      .forEach(c => expect(can(c, 'manager')).toBe(true));
    ['users.manage', 'settings.manage', 'bags.view', 'bags.manage', 'alerts.view', 'logs.view', 'collectors.view']
      .forEach(c => expect(can(c, 'manager')).toBe(false));
  });

  it('refuses unknown capabilities and unknown roles', () => {
    expect(can('nothing.here', 'admin')).toBe(false);
    expect(can('dashboard.stats', 'superuser')).toBe(false);
    expect(can('dashboard.stats', undefined)).toBe(false);
    expect(canAny(['users.manage', 'reports.view'], 'media')).toBe(true);
    expect(rolesWith('users.manage')).toEqual(['admin']);
  });

  it('sends each role to the first page it can open', () => {
    expect(landingPathFor('admin')).toBe('/dashboard');
    expect(landingPathFor('manager')).toBe('/dashboard');
    expect(landingPathFor('authority')).toBe('/illegal-dumping/reports');
    expect(landingPathFor('media')).toBe('/media-data');
    expect(landingPathFor('volunteer')).toBe('/settings');
    expect(landingPathFor('user')).toBe('/settings');
  });
});

describe('the database table matches this one', () => {
  // Reads td_capability_roles() from the newest migration that defines it, so changing one side only fails this test
  const dir = path.join(__dirname, '../../../supabase/migrations');
  const latest = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
    .find(f => fs.readFileSync(path.join(dir, f), 'utf8').includes('FUNCTION public.td_capability_roles'));
  const capSql = fs.readFileSync(path.join(dir, latest), 'utf8');
  const sql = fs.readFileSync(path.join(dir, '20261101_role_permissions.sql'), 'utf8');
  const fn = capSql.slice(capSql.indexOf('FUNCTION public.td_capability_roles'), capSql.indexOf('ELSE ARRAY[]::text[]', capSql.indexOf('FUNCTION public.td_capability_roles')));
  const db = Object.fromEntries([...fn.matchAll(/WHEN '([\w.]+)' THEN ARRAY\[([^\]]*)\]/g)]
    .map(([, cap, roles]) => [cap, [...roles.matchAll(/'(\w+)'/g)].map(m => m[1])]));

  it('lists the same capabilities with the same roles', () => {
    expect(Object.keys(db).sort()).toEqual(Object.keys(CAPABILITY_ROLES).sort());
    Object.keys(CAPABILITY_ROLES).forEach(cap => expect({ cap, roles: [...db[cap]].sort() }).toEqual({ cap, roles: [...CAPABILITY_ROLES[cap]].sort() }));
  });

  it('every admin_* function in the migration asks can_do, not td_is_staff', () => {
    const defs = sql.split('CREATE OR REPLACE FUNCTION public.admin_').slice(1);
    expect(defs.length).toBe(10);
    defs.forEach(d => {
      const body = d.slice(0, d.indexOf('$$;') > 0 ? d.indexOf('$$;') : undefined);
      expect(body).toMatch(/can_do\('[\w.]+'\)/);
      expect(body).not.toMatch(/td_is_staff/);
    });
  });
});
