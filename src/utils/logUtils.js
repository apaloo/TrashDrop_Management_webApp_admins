/**
 * Helpers for the audit log (Logs page and History panels): one row shape,
 * Africa/Accra times, the before → after table and CSV.
 */
import { normalizeLogLevel, logActionLabel } from '../constants/alerts';

const obj = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try { return JSON.parse(v); } catch (e) { return null; }
  }
  return null;
};

/** logs row → page shape. Reads old rows too (timestamp, data, user_id). */
export const normalizeLog = (row) => {
  const metadata = obj(row.metadata) || obj(row.data) || obj(row.details) || {};
  return {
    id: String(row.id),
    createdAt: row.created_at || row.timestamp || null,
    level: normalizeLogLevel(row.level),
    source: row.source || null,
    action: row.action || null,
    actionLabel: logActionLabel(row.action),
    entityType: row.entity_type || null,
    entityId: row.entity_id != null ? String(row.entity_id) : null,
    actorId: row.actor_id || row.user_id || null,
    actorName: row.actor_name || (row.actor_id || row.user_id ? null : 'System'),
    actorRole: row.actor_role || (row.actor_id || row.user_id ? null : 'system'),
    message: row.message || '',
    before: obj(row.before),
    after: obj(row.after),
    metadata,
    userAgent: row.user_agent || null,
    isSample: !!row.is_sample,
  };
};

const ACCRA = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Accra', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** "12 Oct 2026, 14:05" in Accra time; "—" when missing or invalid */
export const formatAccra = (value) => {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) return '—';
  // en-GB gives "12 Oct 2026, 14:05"
  return ACCRA.format(d).replace(' at ', ', ');
};

/** "just now", "5 min ago", "3 h ago", "2 d ago" */
export const relativeFromNow = (value, now = Date.now()) => {
  const t = new Date(value).getTime();
  if (!value || !Number.isFinite(t)) return '';
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
};

const FIELD_LABELS = {
  status: 'Status', collector_id: 'Collector ID', collector: 'Collector', assigned_to: 'Assigned to', priority: 'Priority',
  first_name: 'First name', last_name: 'Last name', email: 'Email', phone: 'Phone', assigned_region: 'Service zone',
  vehicle_type: 'Vehicle type', license_plate: 'Registration', vehicle_plate: 'Registration (old field)',
  vehicle_capacity_bags: 'Capacity (bags)', notes: 'Notes', deactivation_reason: 'Deactivation reason', user_id: 'App account',
  cancellation_reason: 'Cancellation reason', note: 'Note', fee: 'Fee (GHS)', location: 'Location (lat, lng)', address: 'Address',
};
export const fieldLabel = (k) => FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

const show = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** [{ field, label, from, to }] for every field in before/after whose value differs */
export const changeRows = (before, after) => {
  const b = before || {};
  const a = after || {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .filter(k => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null))
    .map(k => ({ field: k, label: fieldLabel(k), from: show(b[k]), to: show(a[k]) }));
};

/** Where a record lives in the admin (deep link that opens its details) */
export const recordLink = (entityType, entityId) => {
  if (!entityId) return null;
  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case 'pickup_request': return `/request-pickup/requests?q=${id}&open=${id}`;
    case 'collector': return `/request-pickup/collectors?q=${id}&open=${id}`;
    case 'alert': return `/request-pickup/alerts?alert=${id}`;
    default: return null;
  }
};

/* ── filters ↔ URL ──────────────────────────────────────────────────────── */

export const DEFAULT_LOG_FILTERS = {
  q: '', level: '', source: '', actor: '', action: '', entityType: '', entity: '',
  range: '7d', from: '', to: '', sample: '0', page: 1,
};

/** ISO bounds for a date preset or custom range (custom dates are Accra days) */
export const rangeBounds = (f, now = new Date()) => {
  const day = 24 * 3600e3;
  switch (f.range) {
    case 'today': {
      const accraDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra' }).format(now); // yyyy-mm-dd
      return { from: `${accraDay}T00:00:00Z`, to: null };
    }
    case '24h': return { from: new Date(now - day).toISOString(), to: null };
    case '7d': return { from: new Date(now - 7 * day).toISOString(), to: null };
    case '30d': return { from: new Date(now - 30 * day).toISOString(), to: null };
    case 'custom': return {
      from: f.from ? `${f.from}T00:00:00Z` : null,
      to: f.to ? new Date(new Date(`${f.to}T00:00:00Z`).getTime() + day).toISOString() : null,
    };
    default: return { from: null, to: null };
  }
};

/** Characters that would break a PostgREST or() filter */
export const cleanLogSearch = (q) => String(q || '').trim().replace(/[,()*%\\]/g, ' ').trim();

/* ── CSV ────────────────────────────────────────────────────────────────── */

export const LOG_CSV_COLUMNS = ['Time (Accra)', 'Level', 'Actor', 'Actor role', 'Action', 'Record type', 'Record ID', 'Message', 'Changes', 'Source', 'User agent', 'Log ID'];

export const logsToCsv = (logs) => {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = logs.map(l => [
    formatAccra(l.createdAt), l.level, l.actorName || '', l.actorRole || '', l.action || '', l.entityType || '', l.entityId || '',
    l.message, changeRows(l.before, l.after).map(c => `${c.label}: ${c.from} → ${c.to}`).join('; '), l.source || '', l.userAgent || '', l.id,
  ]);
  return [LOG_CSV_COLUMNS, ...rows].map(r => r.map(cell).join(',')).join('\n');
};
