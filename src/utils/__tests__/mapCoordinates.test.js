import {
  validateCoordinates, parsePoint, assertSavableCoordinates, toCoordinate,
  getSupportedCountry, isInSupportedCountry, SUPPORTED_COUNTRIES, SUPPORTED_COUNTRY_NAMES,
} from '../mapCoordinates';

describe('supported countries', () => {
  it('lists Ghana and Liberia, with boxes that do not overlap', () => {
    expect(SUPPORTED_COUNTRIES.map(c => c.code)).toEqual(['GH', 'LR']);
    expect(SUPPORTED_COUNTRY_NAMES).toBe('Ghana and Liberia');
    const [gh, lr] = SUPPORTED_COUNTRIES.map(c => c.bounds);
    expect(lr.maxLng < gh.minLng).toBe(true);
  });

  it('names the country a point is in', () => {
    expect(getSupportedCountry(5.6037, -0.187)?.name).toBe('Ghana');
    expect(getSupportedCountry(9.4, -0.85)?.name).toBe('Ghana'); // Tamale
    expect(getSupportedCountry(6.2938245, -10.7794291)?.name).toBe('Liberia'); // Sinkor, Monrovia
    expect(getSupportedCountry('6.2438817', '-10.449455')?.name).toBe('Liberia'); // Margibi
    expect(getSupportedCountry(7.54, -5.55)).toBeNull(); // Cote d'Ivoire, between the two
    expect(getSupportedCountry(null, -10.7)).toBeNull();
    expect(isInSupportedCountry(6.29, -10.78)).toBe(true);
    expect(isInSupportedCountry(0, 0)).toBe(false);
  });
});

describe('validateCoordinates', () => {
  it('accepts points in Ghana (numbers or numeric strings)', () => {
    expect(validateCoordinates(5.6037, -0.187)).toMatchObject({ valid: true, swapped: false, country: 'Ghana' });
    expect(validateCoordinates('6.6885', '-1.6244')).toMatchObject({ valid: true, lat: 6.6885, lng: -1.6244 });
  });

  it('accepts points in Liberia', () => {
    expect(validateCoordinates(6.2938245, -10.7794291)).toMatchObject({ valid: true, swapped: false, country: 'Liberia', reason: null });
    expect(validateCoordinates('6.24388', '-10.44948')).toMatchObject({ valid: true, country: 'Liberia' });
  });

  it('rejects missing, non-numeric, 0,0 and out-of-country points', () => {
    expect(validateCoordinates(null, -0.18)).toMatchObject({ valid: false, reason: 'Missing coordinates' });
    expect(validateCoordinates('', '')).toMatchObject({ valid: false, reason: 'Missing coordinates' });
    expect(validateCoordinates('abc', 1)).toMatchObject({ valid: false });
    expect(validateCoordinates(0, 0)).toMatchObject({ valid: false, reason: 'Coordinates are 0,0' });
    expect(validateCoordinates(0.001, -0.002)).toMatchObject({ valid: false, reason: 'Coordinates are 0,0' });
    expect(validateCoordinates(51.5, -0.12)).toMatchObject({ valid: false, reason: 'Outside Ghana and Liberia', country: null });
    expect(validateCoordinates(7.54, -5.55)).toMatchObject({ valid: false, reason: 'Outside Ghana and Liberia' }); // Cote d'Ivoire
  });

  it('detects and corrects swapped lat/lng in both countries', () => {
    expect(validateCoordinates(-0.187, 5.6037)).toMatchObject({ valid: true, swapped: true, lat: 5.6037, lng: -0.187, country: 'Ghana' });
    expect(validateCoordinates(-10.7794, 6.2938)).toMatchObject({ valid: true, swapped: true, lat: 6.2938, lng: -10.7794, country: 'Liberia' });
  });

  it('does not treat null as 0', () => {
    expect(toCoordinate(null)).toBeNull();
    expect(toCoordinate('  ')).toBeNull();
    expect(toCoordinate('5.5')).toBe(5.5);
  });
});

describe('parsePoint', () => {
  it('reads WKT and EWKT as (lng lat)', () => {
    expect(parsePoint('POINT(-0.2809 5.6726)')).toEqual({ lng: -0.2809, lat: 5.6726 });
    expect(parsePoint('SRID=4326;POINT(-0.2809 5.6726)')).toEqual({ lng: -0.2809, lat: 5.6726 });
  });

  it('reads GeoJSON', () => {
    expect(parsePoint({ type: 'Point', coordinates: [-0.2809, 5.6726] })).toEqual({ lng: -0.2809, lat: 5.6726 });
  });

  it('reads EWKB hex (what Supabase returns for geometry/geography)', () => {
    // SELECT ST_AsEWKB(ST_SetSRID(ST_MakePoint(-0.187, 5.6037), 4326)) → hex
    const hex = '0101000020e6100000560e2db29defc7bf7c613255306a1640';
    const p = parsePoint(hex);
    expect(p.lng).toBeCloseTo(-0.187, 6);
    expect(p.lat).toBeCloseTo(5.6037, 6);
  });

  it('returns null for things that are not points', () => {
    expect(parsePoint('Unknown location')).toBeNull();
    expect(parsePoint({ address: 'x' })).toBeNull();
    expect(parsePoint(null)).toBeNull();
  });
});

describe('assertSavableCoordinates', () => {
  it('allows saves without a location and with a Ghana or Liberia location', () => {
    expect(() => assertSavableCoordinates({ latitude: 6.2938245, longitude: -10.7794291 })).not.toThrow();
    expect(() => assertSavableCoordinates({ location: 'POINT(-10.449455 6.2438817)' })).not.toThrow();
    expect(() => assertSavableCoordinates({ status: 'assigned' })).not.toThrow();
    expect(() => assertSavableCoordinates({ latitude: 5.6, longitude: -0.2 })).not.toThrow();
    expect(() => assertSavableCoordinates({ location: 'POINT(-0.2 5.6)' })).not.toThrow();
  });

  it('blocks 0,0, out-of-country and swapped locations', () => {
    expect(() => assertSavableCoordinates({ latitude: 0, longitude: 0 })).toThrow(/0,0/);
    expect(() => assertSavableCoordinates({ location: 'POINT(-0.12 51.5)' })).toThrow(/outside ghana and liberia/);
    expect(() => assertSavableCoordinates({ lat: -0.2, lng: 5.6 })).toThrow(/swapped/);
    expect(() => assertSavableCoordinates({ latitude: -10.78, longitude: 6.29 })).toThrow(/swapped/);
    expect(() => assertSavableCoordinates({ latitude: null, longitude: -0.2 })).toThrow(/missing/);
  });
});
