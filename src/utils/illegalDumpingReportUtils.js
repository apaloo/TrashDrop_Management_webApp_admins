/**
 * Shared helpers for illegal dumping reports (map page filters, markers and stats).
 *
 * Reports are written by the household app into illegal_dumping_mobile with
 * lowercase enum values (severity: low|medium|high, waste_type: mixed|household|...),
 * so every comparison here is case-insensitive.
 */

// Ghana's bounding box, used to flag reports plotted outside the country.
export const GHANA_BOUNDS = { minLat: 4.5, maxLat: 11.2, minLng: -3.3, maxLng: 1.3 };

export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#22C55E' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#F97316' },
  { value: 'critical', label: 'Critical', color: '#DC2626' },
];

export const UNKNOWN_SEVERITY_COLOR = '#9E9E9E';

// Values the household app's report form can submit.
export const WASTE_TYPE_OPTIONS = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'household', label: 'Household' },
  { value: 'construction', label: 'Construction' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'hazardous', label: 'Hazardous' },
  { value: 'organic', label: 'Organic' },
  { value: 'recyclables', label: 'Recyclables' },
];

// Statuses after which the site counts as cleaned up.
export const CLEANED_STATUSES = ['completed', 'disposed'];
// Statuses that count as a confirmed (verified) report for the verification rate.
export const CONFIRMED_STATUSES = ['verified', 'in_progress', 'completed', 'disposed'];

export const normalizeEnum = (value) =>
  (value === null || value === undefined) ? '' : String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');

export const getSeverityColor = (severity) =>
  SEVERITY_OPTIONS.find(o => o.value === normalizeEnum(severity))?.color || UNKNOWN_SEVERITY_COLOR;

export const toTitle = (value) => {
  const v = normalizeEnum(value);
  return v ? v.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
};

export const hasCoordinates = (report) =>
  Number.isFinite(report?.location?.lat) && Number.isFinite(report?.location?.lng);

export const isOutsideGhana = (report) => {
  if (!hasCoordinates(report)) return false;
  const { lat, lng } = report.location;
  return lat < GHANA_BOUNDS.minLat || lat > GHANA_BOUNDS.maxLat || lng < GHANA_BOUNDS.minLng || lng > GHANA_BOUNDS.maxLng;
};

/**
 * Whether a report matches the active filters. Filter values and report fields are
 * compared case-insensitively. Coordinates are not required here; the map plots
 * the subset that has them.
 */
export const matchesFilters = (report, filters = {}, dateRange = {}) => {
  const { status = [], severity = [], wasteType = [] } = filters;
  if (status.length && !status.map(normalizeEnum).includes(normalizeEnum(report.status))) return false;
  if (severity.length && !severity.map(normalizeEnum).includes(normalizeEnum(report.severity))) return false;
  if (wasteType.length && !wasteType.map(normalizeEnum).includes(normalizeEnum(report.wasteType))) return false;

  if (dateRange.start || dateRange.end) {
    const reported = new Date(report.reportedAt);
    if (Number.isNaN(reported.getTime())) return false;
    if (dateRange.start && reported < new Date(`${dateRange.start}T00:00:00`)) return false;
    if (dateRange.end && reported > new Date(`${dateRange.end}T23:59:59.999`)) return false;
  }
  return true;
};

/**
 * Summary card values, computed from the same report list the map shows.
 * - cleanedUp: reports with status completed (or disposed)
 * - avgCleanupHours: mean of (resolvedAt - reportedAt) over cleaned-up reports, null if none
 * - verificationRate: (verified + in_progress + completed) / (total - cancelled), null if no eligible reports
 */
export const computeReportStats = (reports = []) => {
  const total = reports.length;
  const status = (r) => normalizeEnum(r.status);
  const cancelled = reports.filter(r => status(r) === 'cancelled').length;
  const cleaned = reports.filter(r => CLEANED_STATUSES.includes(status(r)));
  const confirmed = reports.filter(r => CONFIRMED_STATUSES.includes(status(r))).length;

  const durations = cleaned
    .map(r => (new Date(r.resolvedAt) - new Date(r.reportedAt)) / 36e5)
    .filter(h => Number.isFinite(h) && h >= 0);

  const eligible = total - cancelled;
  const byStatus = reports.reduce((acc, r) => { const k = status(r) || 'pending'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  return {
    total,
    byStatus,
    pending: byStatus.pending || 0,
    verified: byStatus.verified || 0,
    cancelled,
    cleanedUp: cleaned.length,
    confirmed,
    eligibleForVerification: eligible,
    verificationRate: eligible > 0 ? (confirmed / eligible) * 100 : null,
    avgCleanupHours: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    cleanupSampleSize: durations.length,
  };
};

/* ── Shared display helpers for the Reports, History and Map pages ───────── */

export const STATUS_LABELS = {
  pending: 'Pending',
  verified: 'Verified',
  in_progress: 'In Progress',
  completed: 'Completed',
  disposed: 'Disposed',
  cancelled: 'Cancelled',
};
export const statusLabel = (status) => STATUS_LABELS[normalizeEnum(status)] || toTitle(status) || 'Unknown';

// One colour per status everywhere (badges, modals, charts)
const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-800',
  verified: 'bg-teal-100 text-teal-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  disposed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
};
export const statusBadgeClass = (status) => STATUS_BADGE[normalizeEnum(status)] || 'bg-gray-100 text-gray-600';

const SEVERITY_BADGE = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};
export const severityBadgeClass = (severity) => SEVERITY_BADGE[normalizeEnum(severity)] || 'bg-gray-100 text-gray-600';

// Statuses shown on the History page
export const HISTORY_STATUSES = ['completed', 'disposed', 'cancelled'];

/**
 * Status flow: pending → verified → in_progress → completed → disposed, and
 * cancel from any open status. Assigning a collector keeps (or sets) verified;
 * the collector app moves it to in_progress when the collector accepts.
 * Mirrors the trigger in supabase/migrations/20261013_illegal_dumping_photos_and_status_flow.sql.
 */
export const STATUS_TRANSITIONS = {
  pending: ['verified', 'cancelled'],
  verified: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['disposed'],
  disposed: [],
  cancelled: [],
};
export const canTransition = (from, to) => {
  const f = normalizeEnum(from) || 'pending';
  const t = normalizeEnum(to);
  return f === t || (STATUS_TRANSITIONS[f] || []).includes(t);
};
export const isOpenStatus = (status) => ['pending', 'verified', 'in_progress'].includes(normalizeEnum(status) || 'pending');

/** "18.0 hrs" under 48 hours, otherwise "3.2 days"; "—" when there is no value */
export const formatDuration = (hours) => {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '—';
  return hours >= 48 ? `${(hours / 24).toFixed(1)} days` : `${hours.toFixed(1)} hrs`;
};

/** dd/mm/yyyy (or with time), "—" for missing or invalid dates */
export const formatDate = (value, { withTime = false } = {}) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
};

const PLACEHOLDER_ADDRESS = /coordinates|unknown location|location not specified|^n\/a$/i;
const looksLikeCoordinates = (text) => /-?\d+\.\d{3,}/.test(text);
const usableText = (text) => {
  const t = typeof text === 'string' ? text.trim() : '';
  return t && !PLACEHOLDER_ADDRESS.test(t) && !looksLikeCoordinates(t) ? t : null;
};

/**
 * One location label for list, details and History:
 * area name → address → "lat, lng" → "Unknown location".
 */
export const getReportLocation = (report) => {
  const named = usableText(report?.areaName) || usableText(report?.location?.address);
  if (named) return named;
  if (hasCoordinates(report)) return `${report.location.lat.toFixed(5)}, ${report.location.lng.toFixed(5)}`;
  return 'Unknown location';
};

/**
 * Photos that can be shown, and how many were lost. blob: URLs only ever
 * existed on the reporter's phone (legacy upload bug) and can't be recovered.
 */
export const splitReportPhotos = (photos) => {
  const list = Array.isArray(photos) ? photos.filter(p => typeof p === 'string' && p.trim()) : [];
  const viewable = list.filter(p => /^https?:\/\//i.test(p) || /^data:image\//i.test(p));
  return { viewable, lost: list.length - viewable.length };
};

/** Maps a row from fetchIllegalDumpingReports to the shape the pages use */
export const toReportViewModel = (item) => {
  const lat = item.location?.lat ?? parseFloat(item.latitude);
  const lng = item.location?.lng ?? parseFloat(item.longitude);
  const status = normalizeEnum(item.status) || 'pending';
  const report = {
    id: item.id,
    reportedAt: item.reported_at,
    reportedBy: item.reporter?.name || item.reporter?.email || 'Anonymous',
    reporterEmail: item.reporter?.email || null,
    resolvedAt: item.resolved_at || null,
    // Date a report entered History: completion time, or last update for cancelled
    closedAt: item.resolved_at || (status === 'cancelled' ? item.updated_at : null) || null,
    updatedAt: item.updated_at || null,
    location: {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      address: item.location?.address || null,
    },
    areaName: item.area_name || null,
    description: item.description_is_generated ? null : item.description,
    images: Array.isArray(item.images) ? item.images : [],
    severity: normalizeEnum(item.severity) || 'medium',
    wasteType: normalizeEnum(item.waste_type) || 'mixed',
    size: item.size || null,
    status,
    assignedTo: item.assigned_to || null,
    cleanupTeam: item.team_name || null,
    cleanupFee: item.cleanup_fee ?? null,
    notes: item.notes || null,
    disposedAt: item.disposed_at || null,
    disposalSite: item.disposal_site_name || null,
  };
  report.locationLabel = getReportLocation(report);
  return report;
};

/** Search on ID, location, description, waste type, status, reporter and team; ignores case and outer spaces */
export const matchesSearch = (report, term) => {
  const q = String(term || '').trim().toLowerCase();
  if (!q) return true;
  return [
    report.id, report.locationLabel, report.location?.address, report.description,
    report.wasteType, toTitle(report.wasteType), report.status, statusLabel(report.status),
    report.reportedBy, report.cleanupTeam,
  ].some(v => v && String(v).toLowerCase().includes(q));
};

/** Distinct collectors assigned to cleaned-up reports */
export const countCleanupTeams = (reports = []) =>
  new Set(reports.filter(r => CLEANED_STATUSES.includes(normalizeEnum(r.status)) && r.assignedTo).map(r => r.assignedTo)).size;
