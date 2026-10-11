#!/usr/bin/env node
/**
 * Fills illegal_dumping_mobile.area_name ("Town, Region") for reports that don't
 * have one, using OpenStreetMap Nominatim reverse geocoding.
 *
 * Nominatim usage policy: at most 1 request per second, an identifying
 * User-Agent, and caching. Reports at the same spot (rounded to ~11 m) share
 * one lookup.
 *
 * Usage:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
 *   node scripts/backfill-area-names.mjs [--apply] [--limit 200]
 *
 * Without --apply it only prints what it would write (dry run).
 * The service role key is needed to update rows; never ship it to the browser.
 */

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 500;

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NOMINATIM_URL = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const USER_AGENT = 'TrashDrop-AreaNames/1.0 (+https://trashdrops.com; hello@trashdrops.com)';
const MIN_INTERVAL_MS = Number(process.env.NOMINATIM_INTERVAL_MS || 1100);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const db = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...init,
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  },
});

/** "Town, Region" from a Nominatim address, e.g. "Pokuase, Greater Accra Region" */
export const areaFromAddress = (address = {}) => {
  const town = address.city || address.town || address.village || address.suburb || address.municipality || address.county;
  const region = address.state || address.region;
  const parts = [town, region].filter(Boolean);
  // Avoid "Accra, Accra"
  return parts.filter((p, i) => parts.indexOf(p) === i).join(', ') || null;
};

// null/'' must not become 0 (which would geocode the Gulf of Guinea)
const coord = (v) => (v === null || v === undefined || String(v).trim() === '' ? NaN : Number(v));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let lastRequestAt = 0;

const reverseGeocode = async (lat, lng) => {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const url = `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (res.status === 429) throw new Error('Nominatim rate limit hit (429); stopping');
  if (!res.ok) return null;
  const body = await res.json();
  return areaFromAddress(body.address);
};

const main = async () => {
  const res = await db(`illegal_dumping_mobile?select=id,latitude,longitude&area_name=is.null&latitude=not.is.null&longitude=not.is.null&order=created_at.desc&limit=${LIMIT}`);
  if (!res.ok) throw new Error(`Could not read reports: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  console.log(`${rows.length} report(s) without an area name${APPLY ? '' : ' (dry run; pass --apply to write)'}`);

  const cache = new Map();
  let updated = 0, skipped = 0;
  for (const row of rows) {
    const lat = coord(row.latitude), lng = coord(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { skipped++; continue; }
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (!cache.has(key)) cache.set(key, await reverseGeocode(lat, lng));
    const area = cache.get(key);
    if (!area) { skipped++; console.log(`  ${row.id}  ${key}  -> no area found`); continue; }

    console.log(`  ${row.id}  ${key}  -> ${area}`);
    if (APPLY) {
      // Only fill rows that are still empty, in case the app filled it meanwhile
      const upd = await db(`illegal_dumping_mobile?id=eq.${row.id}&area_name=is.null`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ area_name: area }),
      });
      if (!upd.ok) throw new Error(`Update failed for ${row.id}: ${upd.status} ${await upd.text()}`);
    }
    updated++;
  }
  console.log(`${APPLY ? 'Updated' : 'Would update'} ${updated}, skipped ${skipped}, Nominatim lookups ${cache.size}`);
};

main().catch(err => { console.error(err.message); process.exit(1); });
