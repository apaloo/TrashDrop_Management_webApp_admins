/**
 * Read-only illegal dumping reports for the public landing-page map.
 *
 * Reads the public_illegal_dumping_reports view (see
 * supabase/migrations/20261011_public_illegal_dumping_reports.sql), which the
 * anon role may SELECT. It exposes no reporter, assignee or note fields.
 */
import { supabase } from '../utils/supabase';
import { normalizeEnum, isOutsideGhana } from '../utils/illegalDumpingReportUtils';

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
    areaName: row.area_name || null,
    photos: (Array.isArray(row.photo_urls) ? row.photo_urls : []).filter(u => typeof u === 'string' && u.startsWith('https://')),
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
