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
  return {
    total,
    cancelled,
    cleanedUp: cleaned.length,
    confirmed,
    eligibleForVerification: eligible,
    verificationRate: eligible > 0 ? (confirmed / eligible) * 100 : null,
    avgCleanupHours: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    cleanupSampleSize: durations.length,
  };
};
