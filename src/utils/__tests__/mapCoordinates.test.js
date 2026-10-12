import { validateCoordinates, parsePoint, assertSavableCoordinates, toCoordinate } from '../mapCoordinates';

describe('validateCoordinates', () => {
  it('accepts points in Ghana (numbers or numeric strings)', () => {
    expect(validateCoordinates(5.6037, -0.187)).toMatchObject({ valid: true, swapped: false });
    expect(validateCoordinates('6.6885', '-1.6244')).toMatchObject({ valid: true, lat: 6.6885, lng: -1.6244 });
  });

  it('rejects missing, non-numeric, 0,0 and out-of-Ghana points', () => {
    expect(validateCoordinates(null, -0.18)).toMatchObject({ valid: false, reason: 'Missing coordinates' });
    expect(validateCoordinates('', '')).toMatchObject({ valid: false, reason: 'Missing coordinates' });
    expect(validateCoordinates('abc', 1)).toMatchObject({ valid: false });
    expect(validateCoordinates(0, 0)).toMatchObject({ valid: false, reason: 'Coordinates are 0,0' });
    expect(validateCoordinates(0.001, -0.002)).toMatchObject({ valid: false, reason: 'Coordinates are 0,0' });
    expect(validateCoordinates(6.29, -10.78)).toMatchObject({ valid: false, reason: 'Outside Ghana' }); // Monrovia
    expect(validateCoordinates(51.5, -0.12)).toMatchObject({ valid: false, reason: 'Outside Ghana' });
  });

  it('detects and corrects swapped lat/lng', () => {
    expect(validateCoordinates(-0.187, 5.6037)).toMatchObject({ valid: true, swapped: true, lat: 5.6037, lng: -0.187 });
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
  it('allows saves without a location and with a Ghana location', () => {
    expect(() => assertSavableCoordinates({ status: 'assigned' })).not.toThrow();
    expect(() => assertSavableCoordinates({ latitude: 5.6, longitude: -0.2 })).not.toThrow();
    expect(() => assertSavableCoordinates({ location: 'POINT(-0.2 5.6)' })).not.toThrow();
  });

  it('blocks 0,0, out-of-Ghana and swapped locations', () => {
    expect(() => assertSavableCoordinates({ latitude: 0, longitude: 0 })).toThrow(/0,0/);
    expect(() => assertSavableCoordinates({ location: 'POINT(-10.78 6.29)' })).toThrow(/outside ghana/);
    expect(() => assertSavableCoordinates({ lat: -0.2, lng: 5.6 })).toThrow(/swapped/);
    expect(() => assertSavableCoordinates({ latitude: null, longitude: -0.2 })).toThrow(/missing/);
  });
});
