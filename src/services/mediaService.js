/**
 * National report data for Media accounts (supabase/migrations/20261030_media_access.sql).
 * Nothing that identifies who reported a site is included.
 */
import { supabase } from '../utils/supabase';

export const MEDIA_ROW_LIMIT = 5000;

/** filters: { from, to (yyyy-mm-dd), region, district, status } */
export const fetchMediaReports = async ({ from, to, region, district, status } = {}) => {
  const { data, error } = await supabase.rpc('media_dumping_reports', {
    p_from: from || null, p_to: to || null,
    p_region: region || null, p_district: district || null, p_status: status || null,
  });
  if (error) {
    if (/could not find the function|does not exist/i.test(error.message || '')) {
      throw new Error('The database is missing the Media update. Run supabase/migrations/20261030_media_access.sql in Supabase.');
    }
    throw new Error(error.message || 'Reports could not be loaded');
  }
  return Array.isArray(data) ? data : [];
};

/** Records a download in Logs (who, filters, how many rows) */
export const logMediaExport = async (filters, rows) => {
  const { error } = await supabase.rpc('log_media_export', { p_filters: filters || {}, p_rows: rows });
  if (error) throw new Error(error.message || 'Download not recorded');
};

const CSV_COLUMNS = [
  ['id', 'Report ID'], ['reported_at', 'Reported at'], ['status', 'Status'], ['severity', 'Severity'],
  ['waste_type', 'Waste type'], ['size', 'Size'], ['region', 'Region'], ['district', 'District'],
  ['area_name', 'Area'], ['latitude', 'Latitude'], ['longitude', 'Longitude'], ['cleaned_at', 'Cleaned at'],
  ['disposed_at', 'Disposed at'], ['cleanup_by', 'Cleanup by'], ['photos', 'Report photos'], ['cleanup_photos', 'Cleanup photos'],
];

const cell = (v) => {
  const s = Array.isArray(v) ? v.join(' ') : v == null ? '' : String(v);
  // Quote when needed, and stop spreadsheet formulas from text that starts with = + - @
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (rows) => [
  CSV_COLUMNS.map(([, label]) => label).join(','),
  ...rows.map(r => CSV_COLUMNS.map(([key]) => cell(r[key])).join(',')),
].join('\r\n');

/** Days from report to cleanup, or null when not cleaned */
export const daysToClean = (r) => {
  if (!r.cleaned_at || !r.reported_at) return null;
  const d = (new Date(r.cleaned_at) - new Date(r.reported_at)) / 86400000;
  return Number.isFinite(d) && d >= 0 ? d : null;
};

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const CLEANED = ['completed', 'disposed'];

/** Headline numbers and a per-region breakdown */
export const summarise = (rows) => {
  const open = rows.filter(r => !CLEANED.includes(r.status) && r.status !== 'cancelled');
  const cleaned = rows.filter(r => CLEANED.includes(r.status));
  const byRegion = {};
  rows.forEach(r => {
    const k = r.region || 'Outside Ghana / unknown';
    byRegion[k] = byRegion[k] || { region: k, total: 0, cleaned: 0, open: 0 };
    byRegion[k].total += 1;
    if (CLEANED.includes(r.status)) byRegion[k].cleaned += 1;
    else if (r.status !== 'cancelled') byRegion[k].open += 1;
  });
  return {
    total: rows.length,
    open: open.length,
    cleaned: cleaned.length,
    byVolunteers: cleaned.filter(r => r.cleanup_by === 'volunteer group').length,
    medianDays: median(cleaned.map(daysToClean).filter(d => d != null)),
    regions: Object.values(byRegion).sort((a, b) => b.total - a.total),
  };
};
