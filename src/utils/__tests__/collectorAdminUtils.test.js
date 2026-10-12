import {
  normalizeGhanaPhone, formatGhanaPhone, isValidEmail, cleanEmail, normalizeVehicleType, vehicleSummary,
  matchesCollectorSearch, filterCollectors, sortCollectors, withCollectorStats, validateCollectorForm,
  EMPTY_COLLECTOR_FORM, DEFAULT_COLLECTOR_FILTERS, UNASSIGNED, assignBlockedReason, zoneOf, formFromCollector,
} from '../collectorAdminUtils';
import { collectorPresence } from '../liveMapUtils';

const NOW = new Date('2026-10-16T12:00:00Z').getTime();
const ago = (min) => new Date(NOW - min * 60000).toISOString();

describe('Ghana phone numbers', () => {
  it.each([
    ['0241234567', '+233241234567'],
    ['024 123 4567', '+233241234567'],
    ['233241234567', '+233241234567'],
    ['+233 24 123 4567', '+233241234567'],
    ['+233-50-123-4567', '+233501234567'],
    ['00233241234567', '+233241234567'],
    ['241234567', '+233241234567'],
    ['0302123456', '+233302123456'],
  ])('%s → %s', (input, out) => expect(normalizeGhanaPhone(input)).toBe(out));

  it.each([['', null], ['12345', null], ['+44 7700 900123', null], ['jack@x.com', null], ['0241234', null], [null, null]])(
    'rejects %p', (input, out) => expect(normalizeGhanaPhone(input)).toBe(out));

  it('formats for display', () => {
    expect(formatGhanaPhone('0241234567')).toBe('+233 24 123 4567');
    expect(formatGhanaPhone('weird')).toBe('weird');
  });
});

describe('email', () => {
  it('validates format', () => {
    expect(isValidEmail('ama@trashdrop.app')).toBe(true);
    expect(isValidEmail('233241234567')).toBe(false);
    expect(isValidEmail('ama@trashdrop')).toBe(false);
  });
  it('drops phone numbers stored as email', () => {
    expect(cleanEmail('233241234567')).toBeNull();
    expect(cleanEmail(' Ama@TrashDrop.app ')).toBe('ama@trashdrop.app');
  });
});

describe('vehicle', () => {
  it('normalises types from both apps', () => {
    expect(normalizeVehicleType('Tricycle')).toBe('tricycle');
    expect(normalizeVehicleType('aboboyaa')).toBe('tricycle');
    expect(normalizeVehicleType('motorbike')).toBe('motorcycle');
    expect(normalizeVehicleType('van')).toBe('van');
    expect(normalizeVehicleType('N/A')).toBeNull();
  });
  it('never shows "cart - N/A - N/A"', () => {
    expect(vehicleSummary({ vehicleType: 'cart', vehicleRegistration: 'N/A', vehicleCapacityBags: null })).toBe('Cart');
    expect(vehicleSummary({ vehicleType: 'tricycle', vehicleRegistration: 'gr 1234-21', vehicleCapacityBags: 20 })).toBe('Tricycle · GR 1234-21 · 20 bags');
    expect(vehicleSummary({})).toBeNull();
  });
});

const base = (over) => ({
  id: 'aaaaaaaa-1111-2222-3333-444444444444', userId: 'u-1', name: 'Jack Bhone', firstName: 'Jack', lastName: 'Bhone',
  email: null, phone: '+233241234567', status: 'active', zone: 'Tamale', locationUpdatedAt: ago(5), ...over,
});

describe('presence (same 10-minute rule as the Live Map)', () => {
  it('is online within 10 min, recent within 24 h, offline after', () => {
    expect(collectorPresence(base({ locationUpdatedAt: ago(5) }), NOW).key).toBe('online');
    expect(collectorPresence(base({ locationUpdatedAt: ago(180) }), NOW).key).toBe('recent');
    expect(collectorPresence(base({ locationUpdatedAt: ago(60 * 30) }), NOW).key).toBe('offline');
    expect(collectorPresence(base({ locationUpdatedAt: null }), NOW)).toMatchObject({ key: 'offline', lastSeen: null });
  });
});

describe('search, filters and sorting', () => {
  const list = [
    base({ id: 'c1', name: 'Jack Bhone', phone: '+233241234567', zone: 'Tamale' }),
    base({ id: 'c2', name: 'Ama Owusu', phone: '0201112222', zone: null, locationUpdatedAt: ago(200) }),
    base({ id: 'c3', name: 'Kofi Asante', phone: '233501239999', zone: '', status: 'inactive', locationUpdatedAt: null }),
    base({ id: 'c4', name: 'Esi Mensah', phone: null, zone: 'Unassigned', locationUpdatedAt: null }),
    base({ id: 'c5', name: 'Yaw Boateng', phone: '0277778888', zone: 'Kumasi' }),
  ].map(c => withCollectorStats(c, {
    c1: { active: 2, completed: 12, earnings: 120, ratingCount: 3, rating: 4.7 },
    c5: { active: 0, completed: 3, earnings: 30, ratingCount: 0, rating: null },
  }, NOW));

  it('matches a phone typed as 0…, 233… or +233…', () => {
    ['0241234567', '233241234567', '+233 24 123 4567', '024 123', '241234'].forEach(q =>
      expect(matchesCollectorSearch(list[0], q)).toBe(true));
    expect(matchesCollectorSearch(list[2], '0501239999')).toBe(true);
    expect(matchesCollectorSearch(list[0], '0201112222')).toBe(false);
  });

  it('"Unassigned" finds every collector without a zone', () => {
    const f = { ...DEFAULT_COLLECTOR_FILTERS, zone: UNASSIGNED };
    expect(filterCollectors(list.map(c => ({ ...c, zone: zoneOf(c.zone) })), f).map(c => c.id)).toEqual(['c2', 'c3', 'c4']);
  });

  it('filters by presence', () => {
    expect(filterCollectors(list, { ...DEFAULT_COLLECTOR_FILTERS, presence: 'online' }).map(c => c.id)).toEqual(['c1', 'c5']);
    expect(filterCollectors(list, { ...DEFAULT_COLLECTOR_FILTERS, presence: 'offline' }).map(c => c.id)).toEqual(['c3', 'c4']);
    expect(filterCollectors(list, { ...DEFAULT_COLLECTOR_FILTERS, presence: 'recent' }).map(c => c.id)).toEqual(['c1', 'c2', 'c5']);
  });

  it('sorts by pickups, rating (no ratings last) and last seen', () => {
    expect(sortCollectors(list, 'pickups', 'desc').map(c => c.id).slice(0, 2)).toEqual(['c1', 'c5']);
    expect(sortCollectors(list, 'rating', 'desc')[0].id).toBe('c1');
    expect(sortCollectors(list, 'lastSeen', 'desc').map(c => c.id).slice(-2)).toEqual(['c4', 'c3']); // never seen: last, by name
    expect(sortCollectors(list, 'lastSeen', 'asc').map(c => c.id).slice(-2)).toEqual(['c4', 'c3']);
    expect(sortCollectors(list, 'name', 'asc')[0].name).toBe('Ama Owusu');
  });
});

describe('form validation', () => {
  const others = [base({ id: 'c1', email: 'jack@trashdrop.app' })];

  it('requires a name and a Ghana phone; email optional but valid', () => {
    const { errors } = validateCollectorForm({ ...EMPTY_COLLECTOR_FORM, phone: '12345', email: 'nope' }, others);
    expect(errors).toMatchObject({ firstName: expect.any(String), phone: expect.any(String), email: expect.any(String) });
    const ok = validateCollectorForm({ ...EMPTY_COLLECTOR_FORM, firstName: ' Ama ', phone: '020 111 2222' }, others);
    expect(ok.errors).toEqual({});
    expect(ok.values).toMatchObject({ firstName: 'Ama', phone: '+233201112222', email: null, zone: null });
  });

  it('blocks duplicates by phone (any format) and email', () => {
    expect(validateCollectorForm({ ...EMPTY_COLLECTOR_FORM, firstName: 'X', phone: '0241234567' }, others).errors.phone).toMatch(/Jack Bhone/);
    expect(validateCollectorForm({ ...EMPTY_COLLECTOR_FORM, firstName: 'X', phone: '0201112222', email: 'JACK@trashdrop.app' }, others).errors.email).toMatch(/Jack Bhone/);
    // editing yourself is fine
    expect(validateCollectorForm({ ...formFromCollector(others[0]) }, others, 'c1').errors).toEqual({});
  });

  it('checks the vehicle fields', () => {
    const { errors, values } = validateCollectorForm({ ...EMPTY_COLLECTOR_FORM, firstName: 'A', phone: '0201112222', vehicleType: 'tricycle', vehicleRegistration: ' gr 12 ', vehicleCapacityBags: '2.5' }, []);
    expect(errors.vehicleCapacityBags).toBeDefined();
    expect(values.vehicleRegistration).toBe('GR 12');
  });

  it('a fresh form never preselects a zone', () => {
    expect(EMPTY_COLLECTOR_FORM.zone).toBe('');
    expect(formFromCollector(base({ zone: null })).zone).toBe('');
  });
});

describe('assign availability', () => {
  it('blocks inactive, offline and app-less collectors', () => {
    const p = (over) => ({ ...base(over), presence: collectorPresence(base(over), NOW) });
    expect(assignBlockedReason(p({}))).toBeNull();
    expect(assignBlockedReason(p({ locationUpdatedAt: ago(180) }))).toBeNull();
    expect(assignBlockedReason(p({ status: 'inactive' }))).toMatch(/inactive/);
    expect(assignBlockedReason(p({ userId: null }))).toMatch(/app account/);
    expect(assignBlockedReason(p({ locationUpdatedAt: ago(60 * 48) }))).toMatch(/offline/);
  });
});
