/**
 * Dashboard helpers: the selected period (kept in the URL), change against
 * the previous period, SLA, chart rows and links to the filtered lists.
 * All numbers come from admin_dashboard_stats (supabase/migrations/20261022_dashboard.sql).
 */
import { TRASH_TYPES } from '../constants/bagStatus';
import { CHART } from '../theme/brand';

export const RANGE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'custom', label: 'Custom' },
];
export const DEFAULT_RANGE = '30d';

/** SLA limits (also sent to the database and shown in the tooltip) */
export const SLA = { assignMinutes: 30, completeHours: 24 };

const DAY = 864e5;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && Number.isFinite(Date.parse(`${v}T00:00:00Z`));
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * URL → period. Accra is UTC, so day boundaries are UTC midnights.
 * Returns { key, from: Date, to: Date, fromDay, toDay } with to exclusive.
 */
export const periodFromParams = (params, now = new Date()) => {
  const key = params.get('range') || DEFAULT_RANGE;
  const end = new Date(now);
  if (key === 'custom' && isDate(params.get('from'))) {
    const from = new Date(`${params.get('from')}T00:00:00Z`);
    const toDay = isDate(params.get('to')) ? params.get('to') : ymd(end);
    let to = new Date(Date.parse(`${toDay}T00:00:00Z`) + DAY);
    if (to > end) to = end;
    if (to > from) return { key, from, to, fromDay: ymd(from), toDay };
  }
  if (key === 'today') {
    const from = new Date(`${ymd(end)}T00:00:00Z`);
    return { key, from, to: end, fromDay: ymd(from), toDay: ymd(end) };
  }
  const preset = RANGE_PRESETS.find(p => p.key === key && p.days) || RANGE_PRESETS.find(p => p.key === DEFAULT_RANGE);
  const from = new Date(end.getTime() - preset.days * DAY);
  return { key: preset.key, from, to: end, fromDay: ymd(from), toDay: ymd(end) };
};

/** "+25%", "-10%", "0%"; "—" when there is nothing to compare with */
export const pctChange = (cur, prev) => {
  const c = Number(cur) || 0;
  const p = Number(prev);
  if (!Number.isFinite(p) || p <= 0) return '—';
  const v = Math.round(((c - p) / p) * 100);
  return `${v > 0 ? '+' : ''}${v}%`;
};

/** SLA % from met / measured; null when nothing could be measured */
export const slaPct = (met, measured) => (Number(measured) > 0 ? Math.round((Number(met) / Number(measured)) * 100) : null);

/** Change in SLA, in percentage points: "+5 pts", "—" */
export const ptsChange = (cur, prev) => {
  if (cur === null || prev === null || cur === undefined || prev === undefined) return '—';
  const v = cur - prev;
  return `${v > 0 ? '+' : ''}${v} pts`;
};

export const SLA_HELP = `SLA: of the completed requests in this period that have both times recorded, the share assigned to a collector within ${SLA.assignMinutes} minutes and completed within ${SLA.completeHours} hours of being requested. Compared with the previous period of the same length.`;

/* ── requests ─────────────────────────────────────────────────────────── */

/** Status groups in display order, with the request-list filter each opens */
export const REQUEST_GROUPS = [
  { key: 'pending', label: 'Pending', color: CHART.orange, filter: { status: 'status:pending', unassigned: '1' }, help: 'No collector yet, not completed or cancelled' },
  { key: 'assigned', label: 'Assigned', color: CHART.blue, filter: { status: 'status:accepted' }, help: 'A collector is set but has not started' },
  { key: 'in_progress', label: 'In Progress', color: CHART.purple, filter: { status: 'status:en_route,arrived,collecting' }, help: 'En route, arrived or collecting' },
  { key: 'completed', label: 'Completed', color: CHART.green, filter: { status: 'status:disposed' }, help: 'Collected and disposed' },
  { key: 'cancelled', label: 'Cancelled', color: CHART.grey, filter: { status: 'group:cancelled' }, help: 'Cancelled, rejected or expired' },
  { key: 'other', label: 'Other', color: CHART.dark, filter: {}, help: 'A status value the admin does not recognise' },
];

/** Rows for the status chart; "Other" only when it has requests. Sum = total. */
export const statusRows = (byStatus = {}) => REQUEST_GROUPS
  .map(g => ({ ...g, value: Number(byStatus[g.key]) || 0 }))
  .filter(g => g.key !== 'other' || g.value > 0);

/** /request-pickup/requests with the period and extra filters */
export const requestListUrl = (period, extra = {}) => {
  const sp = new URLSearchParams();
  if (period) { sp.set('from', period.fromDay); sp.set('to', period.toDay); }
  Object.entries(extra).forEach(([k, v]) => { if (v) sp.set(k, v); });
  return `/request-pickup/requests?${sp.toString()}`;
};

/* ── waste ────────────────────────────────────────────────────────────── */

const WASTE_COLORS = { Organic: CHART.green, Recyclable: CHART.blue, Hazardous: CHART.red, General: CHART.grey, Electronic: CHART.purple, Other: CHART.orange, Unclassified: CHART.light };

/**
 * Bags by type: the four main types always, Electronic / Other only when
 * present, Unclassified (no type saved) last so missing data is visible.
 */
export const wasteRows = (waste = {}) => {
  const main = ['Organic', 'Recyclable', 'Hazardous', 'General'];
  const optional = TRASH_TYPES.map(t => t.key).filter(k => !main.includes(k));
  const known = [...main, ...optional];
  const rows = main.map(k => ({ key: k, value: Number(waste[k]) || 0 }));
  optional.forEach(k => { if (Number(waste[k]) > 0) rows.push({ key: k, value: Number(waste[k]) }); });
  // a type outside the shared list counts as Other
  const extra = Object.entries(waste).filter(([k]) => !known.includes(k) && k !== 'Unclassified').reduce((s, [, v]) => s + (Number(v) || 0), 0);
  if (extra > 0) {
    const other = rows.find(r => r.key === 'Other');
    if (other) other.value += extra; else rows.push({ key: 'Other', value: extra });
  }
  rows.push({ key: 'Unclassified', value: Number(waste.Unclassified) || 0 });
  return rows.map(r => ({ ...r, color: WASTE_COLORS[r.key] || CHART.grey }));
};

/* ── time series ──────────────────────────────────────────────────────── */

/** "12 Oct" for a day bucket, "w/c 6 Oct" for a week bucket */
export const bucketLabel = (iso, bucket) => {
  const d = new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return bucket === 'week' ? `w/c ${d}` : d;
};

export const seriesTotal = (series = [], key) => series.reduce((s, r) => s + (Number(r[key]) || 0), 0);

/* ── alerts ───────────────────────────────────────────────────────────── */

/** "4 months", "3 days", "5 h", "20 min" */
export const durationSince = (iso, now = Date.now()) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.floor((now - t) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d} days`;
  return `${Math.floor(d / 30)} months`;
};

/** One alert from admin_dashboard_stats → display shape */
export const normalizeDashboardAlert = (a, now = Date.now()) => ({
  id: a.id,
  title: a.title || 'Alert',
  description: a.description || '',
  severity: String(a.severity || 'low').toLowerCase(),
  status: a.status,
  ruleKey: a.rule_key,
  entityType: a.entity_type,
  entitySource: a.entity_source,
  entityRef: a.entity_ref,
  raisedAt: a.raised_at,
  raisedAgo: durationSince(a.raised_at, now),
  requestCreatedAt: a.request_created_at || null,
  requestAge: a.request_created_at ? durationSince(a.request_created_at, now) : null,
  requestStatus: a.request_status || null,
  isRequest: a.entity_type === 'pickup_request' && !!a.entity_ref,
});
