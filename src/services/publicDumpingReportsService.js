/**
 * Read-only illegal dumping reports for the public landing-page map.
 *
 * Reads the public_illegal_dumping_reports view (see
 * supabase/migrations/20261011_public_illegal_dumping_reports.sql), which the
 * anon role may SELECT. It exposes no reporter, assignee or note fields.
 */
import { supabase } from '../utils/supabase';
import { normalizeEnum, isOutsideGhana } from '../utils/illegalDumpingReportUtils';
import { secureUrls } from '../utils/secureUrl';

export const PUBLIC_REPORTS_VIEW = 'public_illegal_dumping_reports';
export const PUBLIC_REPORT_COLUMNS = 'id, latitude, longitude, severity, waste_type, status, created_at, completed_at, area_name, photo_urls';

const CLEANED_STATUSES = ['completed', 'disposed'];

export const mapPublicReport = (row) => {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  const status = normalizeEnum(row.status) || 'pending';
  return {
    id: row.id,
    location: { lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null },
    severity: normalizeEnum(row.severity) || 'medium',
    wasteType: normalizeEnum(row.waste_type) || 'mixed',
    status,
    isCleanedUp: CLEANED_STATUSES.includes(status),
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    areaName: cleanAreaName(row.area_name),
    photos: secureUrls(row.photo_urls).filter(u => typeof u === 'string' && u.startsWith('https://')),
  };
};

// The view already filters these out; this keeps the map safe if it ever doesn't.
export const isPublicMapReport = (r) =>
  Number.isFinite(r.location.lat) && Number.isFinite(r.location.lng) && r.status !== 'cancelled' && !isOutsideGhana(r);

export const fetchPublicDumpingReports = async ({ limit = 1000 } = {}) => {
  const { data, error } = await supabase
    .from(PUBLIC_REPORTS_VIEW)
    .select(PUBLIC_REPORT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapPublicReport).filter(isPublicMapReport);
};

const DAY_MS = 864e5;

/** "just now", "5 hours ago", "3 days ago", "2 months ago" */
export const timeAgo = (date, now = Date.now()) => {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, secs] of units) {
    const n = Math.floor(s / secs);
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
};

/** "Cleaned up 2 days after report" / "the same day" / null when unknown */
export const cleanupDurationText = (createdAt, completedAt) => {
  const ms = new Date(completedAt) - new Date(createdAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const days = Math.round(ms / DAY_MS);
  if (days < 1) {
    const hours = Math.max(1, Math.round(ms / 36e5));
    return `Cleaned up ${hours} hour${hours > 1 ? 's' : ''} after report`;
  }
  return `Cleaned up ${days} day${days > 1 ? 's' : ''} after report`;
};

/* ── Stats (computed from the same rows as the map) ──────────────────────── */

const toRad = (d) => (d * Math.PI) / 180;
export const distanceKm = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

export const HOTSPOT_RADIUS_KM = 0.5;
export const HOTSPOT_MIN_REPORTS = 3;

/**
 * Hotspot zones: groups of active (not cleaned-up) reports where each report is
 * within 500 m of another report in the group, counting groups with 3+ reports.
 */
export const countHotspots = (reports, radiusKm = HOTSPOT_RADIUS_KM, minReports = HOTSPOT_MIN_REPORTS) => {
  const pts = reports.filter(r => !r.isCleanedUp).map(r => r.location);
  const parent = pts.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (distanceKm(pts[i], pts[j]) <= radiusKm) parent[find(i)] = find(j);
    }
  }
  const sizes = {};
  pts.forEach((_, i) => { const root = find(i); sizes[root] = (sizes[root] || 0) + 1; });
  return Object.values(sizes).filter(n => n >= minReports).length;
};

export const computePublicStats = (reports = []) => {
  const total = reports.length;
  const cleaned = reports.filter(r => r.isCleanedUp);
  const hours = cleaned
    .map(r => (new Date(r.completedAt) - new Date(r.createdAt)) / 36e5)
    .filter(h => Number.isFinite(h) && h >= 0);
  return {
    total,
    active: total - cleaned.length,
    cleanedUp: cleaned.length,
    cleanupRate: total ? (cleaned.length / total) * 100 : null,
    avgResponseHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    hotspots: countHotspots(reports),
    areas: new Set(reports.map(r => r.areaName && r.areaName.toLowerCase()).filter(Boolean)).size,
  };
};

/** Which threshold-gated stats are good enough to show publicly */
export const publicStatVisibility = (stats, { minCleanupRatePct, maxAvgResponseDays }) => ({
  cleanupRate: stats.cleanupRate !== null && stats.cleanupRate >= minCleanupRatePct,
  avgResponse: stats.avgResponseHours !== null && stats.avgResponseHours < maxAvgResponseDays * 24,
});

/** Newest reports first, optionally only waiting ('active') or cleaned up ('cleaned') ones */
export const latestReports = (reports = [], filter = 'all', limit = 15) => reports
  .filter(r => filter === 'all' || (filter === 'cleaned' ? r.isCleanedUp : !r.isCleanedUp))
  .slice()
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  .slice(0, limit);

/** "5.9h" under two days, otherwise "3.2 days"; "—" when unknown */
export const formatDuration = (hours) => {
  if (hours === null || hours === undefined) return '—';
  return hours < 48 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)} days`;
};

/* ── Area names ──────────────────────────────────────────────────────────── */

// Main towns used for a "Near <town>" fallback when a report has no area name
export const GHANA_TOWNS = [
  ['Accra', 5.6037, -0.1870], ['Tema', 5.6698, -0.0166], ['Madina', 5.6730, -0.1660], ['Ashaiman', 5.6950, -0.0300],
  ['Teshie', 5.5830, -0.1070], ['Dansoman', 5.5480, -0.2600], ['Pokuase', 5.6950, -0.2850], ['Amasaman', 5.7020, -0.3000],
  ['Dodowa', 5.8820, -0.0980], ['Kasoa', 5.5340, -0.4240], ['Nsawam', 5.8080, -0.3500], ['Koforidua', 6.0940, -0.2590],
  ['Nkawkaw', 6.5510, -0.7660], ['Akim Oda', 5.9260, -0.9850], ['Winneba', 5.3510, -0.6230], ['Mankessim', 5.2740, -1.0150],
  ['Cape Coast', 5.1053, -1.2466], ['Takoradi', 4.8845, -1.7554], ['Sekondi', 4.9430, -1.7040], ['Tarkwa', 5.3000, -1.9830],
  ['Sefwi Wiawso', 6.2080, -2.4860], ['Kumasi', 6.6885, -1.6244], ['Ejisu', 6.7190, -1.4730], ['Konongo', 6.6170, -1.2170],
  ['Obuasi', 6.2000, -1.6670], ['Goaso', 6.8040, -2.5170], ['Sunyani', 7.3349, -2.3123], ['Berekum', 7.4530, -2.5840],
  ['Techiman', 7.5830, -1.9330], ['Ho', 6.6008, 0.4713], ['Hohoe', 7.1510, 0.4730], ['Keta', 5.9180, 0.9870],
  ['Aflao', 6.1170, 1.1940], ['Dambai', 8.0670, 0.1800], ['Damongo', 9.0830, -1.8170], ['Tamale', 9.4075, -0.8533],
  ['Yendi', 9.4430, -0.0090], ['Nalerigu', 10.5270, -0.3690], ['Bolgatanga', 10.7856, -0.8514], ['Navrongo', 10.8950, -1.0920],
  ['Bawku', 11.0600, -0.2400], ['Wa', 10.0601, -2.5099],
].map(([name, lat, lng]) => ({ name, lat, lng }));

export const nearestTown = (location, maxKm = 30) => {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;
  let best = null;
  for (const t of GHANA_TOWNS) {
    const d = distanceKm(location, t);
    if (!best || d < best.km) best = { name: t.name, km: d };
  }
  return best && best.km <= maxKm ? best.name : null;
};

// Area names that are placeholders or raw coordinates, never shown publicly
const UNUSABLE_AREA = /coordinates|unknown location|location not specified|-?\d+\.\d{3,}/i;
export const cleanAreaName = (name) => (typeof name === 'string' && name.trim() && !UNUSABLE_AREA.test(name) ? name.trim() : null);

/** Area label for the public card: "Town, Region", else "Near <town>", else a neutral fallback. */
export const describeArea = (report) => {
  const area = cleanAreaName(report.areaName);
  if (area) return area;
  const town = nearestTown(report.location);
  return town ? `Near ${town}` : 'Location pinned on map';
};
