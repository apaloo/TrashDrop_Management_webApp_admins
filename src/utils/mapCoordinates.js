/**
 * Coordinate parsing and validation for map markers and saved locations.
 *
 * PostGIS stores points as POINT(lng lat) / (x y). Values are only drawn or
 * saved when they fall inside Ghana; 0,0 ("null island") and anything outside
 * the box are rejected.
 */

// Roughly Ghana's bounding box
export const GHANA_BOUNDS = { minLat: 4.5, maxLat: 11.2, minLng: -3.3, maxLng: 1.2 };

// Accra, used when there is nothing to fit the map to
export const DEFAULT_MAP_VIEW = { lat: 5.6037, lng: -0.1870, zoom: 12 };

const NEAR_ZERO = 0.01;

/** Number from a number or numeric string; null for null/''/non-numeric */
export const toCoordinate = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

export const isInGhana = (lat, lng) =>
  lat >= GHANA_BOUNDS.minLat && lat <= GHANA_BOUNDS.maxLat &&
  lng >= GHANA_BOUNDS.minLng && lng <= GHANA_BOUNDS.maxLng;

/**
 * Checks a lat/lng pair.
 * @returns {{ valid: boolean, lat: number|null, lng: number|null, reason: string|null, swapped: boolean }}
 * A pair that is only inside Ghana with lat and lng exchanged is returned
 * corrected, with swapped: true, so it can be drawn and reported.
 */
export const validateCoordinates = (rawLat, rawLng) => {
  const lat = toCoordinate(rawLat);
  const lng = toCoordinate(rawLng);
  if (lat === null || lng === null) return { valid: false, lat, lng, reason: 'Missing coordinates', swapped: false };
  if (Math.abs(lat) < NEAR_ZERO && Math.abs(lng) < NEAR_ZERO) return { valid: false, lat, lng, reason: 'Coordinates are 0,0', swapped: false };
  if (isInGhana(lat, lng)) return { valid: true, lat, lng, reason: null, swapped: false };
  if (isInGhana(lng, lat)) return { valid: true, lat: lng, lng: lat, reason: 'Latitude and longitude were swapped', swapped: true };
  return { valid: false, lat, lng, reason: 'Outside Ghana', swapped: false };
};

const hexToDouble = (hex, littleEndian) => {
  const view = new DataView(new ArrayBuffer(8));
  for (let i = 0; i < 8; i++) view.setUint8(i, parseInt(hex.substr(i * 2, 2), 16));
  return view.getFloat64(0, littleEndian);
};

/**
 * Point from the formats Supabase returns for PostGIS columns:
 * GeoJSON { type: 'Point', coordinates: [lng, lat] }, WKT/EWKT "POINT(lng lat)",
 * or (E)WKB hex. Always (x, y) = (lng, lat), as PostGIS stores it.
 * @returns {{ lat: number, lng: number } | null}
 */
export const parsePoint = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    if (value.type === 'Point' && Array.isArray(value.coordinates)) {
      const lng = toCoordinate(value.coordinates[0]);
      const lat = toCoordinate(value.coordinates[1]);
      return lat === null || lng === null ? null : { lat, lng };
    }
    const lat = toCoordinate(value.lat ?? value.latitude ?? value.y);
    const lng = toCoordinate(value.lng ?? value.longitude ?? value.x);
    return lat === null || lng === null ? null : { lat, lng };
  }
  if (typeof value !== 'string') return null;

  const wkt = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?(?:e-?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e-?\d+)?)\s*\)/i);
  if (wkt) return { lng: Number(wkt[1]), lat: Number(wkt[2]) };

  // (E)WKB hex point: byte order, type (with optional SRID flag), [SRID], x, y
  if (/^[0-9a-f]+$/i.test(value) && value.length >= 42) {
    const le = value.slice(0, 2) === '01';
    const typeHex = value.slice(2, 10);
    const type = le
      ? parseInt(typeHex.match(/../g).reverse().join(''), 16)
      : parseInt(typeHex, 16);
    if ((type & 0xff) !== 1) return null; // not a point
    let offset = 10 + ((type & 0x20000000) ? 8 : 0);
    const lng = hexToDouble(value.substr(offset, 16), le);
    offset += 16;
    const lat = hexToDouble(value.substr(offset, 16), le);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  return null;
};

/**
 * Throws if the data being saved carries a location that is 0,0 or outside
 * Ghana. Looks at latitude/longitude, lat/lng, and point-like location or
 * coordinates fields; fields that aren't present are not checked.
 */
export const assertSavableCoordinates = (data = {}) => {
  const candidates = [];
  if (data.latitude !== undefined || data.longitude !== undefined) candidates.push([data.latitude, data.longitude]);
  if (data.lat !== undefined || data.lng !== undefined) candidates.push([data.lat, data.lng]);
  ['location', 'coordinates'].forEach(key => {
    if (data[key] === undefined || data[key] === null) return;
    const p = parsePoint(data[key]);
    if (p) candidates.push([p.lat, p.lng]);
  });
  candidates.forEach(([lat, lng]) => {
    const check = validateCoordinates(lat, lng);
    if (!check.valid || check.swapped) {
      throw new Error(`Location not saved: ${check.swapped ? 'latitude and longitude look swapped' : check.reason.toLowerCase()}. Pick a point in Ghana.`);
    }
  });
};
