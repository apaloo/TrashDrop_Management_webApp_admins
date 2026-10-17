/**
 * Homepage settings. Everything here is shown to the public.
 */

const num = (v, fallback) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);

// The map's "Cleanup rate" and "Avg response" tiles stay hidden until the live
// numbers reach these. Override per deploy with the REACT_APP_ variables.
export const PUBLIC_STAT_THRESHOLDS = {
  minCleanupRatePct: num(process.env.REACT_APP_MIN_CLEANUP_RATE_PCT, 50),
  maxAvgResponseDays: num(process.env.REACT_APP_MAX_AVG_RESPONSE_DAYS, 7),
};

// Where households book: the TrashDrop household app (the booking card's QR code opens it too)
export const HOUSEHOLD_APP_URL = process.env.REACT_APP_HOUSEHOLD_APP_URL || 'https://trashdrop-mobile.windsurf.build/';

// Cities on the booking card, with a centre point for "use my location"
export const BOOKING_CITIES = [
  { name: 'Accra',    lat: 5.6037, lng: -0.1870 },
  { name: 'Kumasi',   lat: 6.6885, lng: -1.6244 },
  { name: 'Takoradi', lat: 4.8845, lng: -1.7554 },
  { name: 'Tamale',   lat: 9.4008, lng: -0.8393 },
];

const toRad = (d) => (d * Math.PI) / 180;

/** The booking city within maxKm of a point, or null when none is close enough */
export const nearestBookingCity = (lat, lng, maxKm = 60) => {
  let best = null;
  for (const c of BOOKING_CITIES) {
    const h = Math.sin(toRad(c.lat - lat) / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(c.lat)) * Math.sin(toRad(c.lng - lng) / 2) ** 2;
    const km = 6371 * 2 * Math.asin(Math.sqrt(h));
    if (km <= maxKm && (!best || km < best.km)) best = { name: c.name, km };
  }
  return best && best.name;
};

// Trust row under the top of the homepage. Update these when the numbers change.
export const TRUST_STATS = [
  { value: '480+', label: 'ID-verified collectors' },
  { value: '4.8★', label: 'rating' },
  { value: '98%',  label: 'pickups completed' },
  { value: String(BOOKING_CITIES.length), label: 'cities' },
];

// Photo on each city card; null shows a plain brand panel until we have a photo
export const CITY_CARD_PHOTOS = {
  accra:    '/images/cities/accra.jpg',
  kumasi:   '/images/cities/kumasi.jpg',
  takoradi: null,
  tamale:   '/images/cities/tamale.jpg',
};
