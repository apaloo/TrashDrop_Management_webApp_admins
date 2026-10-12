/**
 * One definition of alert statuses, priorities, types and rules, used by the
 * Alerts table, details modal, filters, cards and exports. Stored values are
 * lower-case snake_case (the td_alert_normalise trigger in
 * supabase/migrations/20261017_alerts_rules.sql enforces this); the aliases
 * cover rows written before that.
 */

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export const ALERT_STATUSES = [
  { key: 'open',         label: 'Open',         className: 'bg-red-100 text-red-800',       aliases: ['open', 'new', 'active', 'triggered'] },
  { key: 'acknowledged', label: 'Acknowledged', className: 'bg-amber-100 text-amber-800',   aliases: ['acknowledged', 'ack', 'seen'] },
  { key: 'in_progress',  label: 'In progress',  className: 'bg-blue-100 text-blue-800',     aliases: ['in_progress', 'investigating', 'working'] },
  { key: 'resolved',     label: 'Resolved',     className: 'bg-green-100 text-green-800',   aliases: ['resolved', 'auto_resolved', 'fixed', 'done'] },
  { key: 'closed',       label: 'Closed',       className: 'bg-gray-200 text-gray-700',     aliases: ['closed', 'dismissed', 'archived', 'ignored'] },
];
export const OPEN_ALERT_STATUSES = ['open', 'acknowledged', 'in_progress'];

export const ALERT_PRIORITIES = [
  { key: 'critical', label: 'Critical', rank: 4, color: '#DC2626', className: 'bg-red-600 text-white',        aliases: ['critical', 'urgent', 'emergency', 'p1'] },
  { key: 'high',     label: 'High',     rank: 3, color: '#EA580C', className: 'bg-orange-100 text-orange-800', aliases: ['high', 'error', 'p2'] },
  { key: 'medium',   label: 'Medium',   rank: 2, color: '#D97706', className: 'bg-amber-100 text-amber-800',  aliases: ['medium', 'normal', 'warning', 'p3'] },
  { key: 'low',      label: 'Low',      rank: 1, color: '#6B7280', className: 'bg-gray-100 text-gray-700',    aliases: ['low', 'info', 'minor', 'p4'] },
];

/** entity: what the alert links to (pickup_request | collector | region | system) */
export const ALERT_TYPES = [
  { key: 'request_delay',        label: 'Request not assigned', entity: 'pickup_request', icon: 'fas fa-hourglass-half' },
  { key: 'unassigned_job',       label: 'Job without collector', entity: 'pickup_request', icon: 'fas fa-user-slash' },
  { key: 'stalled_job',          label: 'Stalled job',          entity: 'pickup_request', icon: 'fas fa-pause-circle' },
  { key: 'invalid_location',     label: 'Location problem',     entity: 'pickup_request', icon: 'fas fa-map-marker-alt' },
  { key: 'outside_service_area', label: 'Outside service area', entity: 'pickup_request', icon: 'fas fa-draw-polygon' },
  { key: 'duplicate_request',    label: 'Possible duplicate',   entity: 'pickup_request', icon: 'far fa-clone' },
  { key: 'fee_mismatch',         label: 'Fee mismatch',         entity: 'pickup_request', icon: 'fas fa-coins' },
  { key: 'collector_offline',    label: 'Collector not reporting', entity: 'collector',   icon: 'fas fa-signal' },
  { key: 'collector_capacity',   label: 'Collector at capacity', entity: 'collector',     icon: 'fas fa-truck-loading' },
  { key: 'invalid_contact',      label: 'Collector contact details', entity: 'collector', icon: 'fas fa-address-card' },
  { key: 'region',               label: 'Region / service area', entity: 'region',        icon: 'fas fa-map' },
  { key: 'system',               label: 'System',               entity: 'system',         icon: 'fas fa-cog' },
];

export const ENTITY_TYPES = [
  { key: 'system', label: 'System (no record)' },
  { key: 'pickup_request', label: 'Pickup request' },
  { key: 'collector', label: 'Collector' },
  { key: 'region', label: 'Region' },
];

const findBy = (list, raw, fallback) => {
  const v = norm(raw);
  return list.find(x => x.key === v || (x.aliases || []).includes(v)) || fallback;
};

export const alertStatus = (raw) => findBy(ALERT_STATUSES, raw, ALERT_STATUSES[0]);
export const alertPriority = (raw) => findBy(ALERT_PRIORITIES, raw, ALERT_PRIORITIES[2]);
export const alertType = (raw) => {
  const v = norm(raw);
  if (!v || ['info', 'warning', 'error', 'success', 'general'].includes(v)) return ALERT_TYPES.find(t => t.key === 'system');
  return ALERT_TYPES.find(t => t.key === v) || { key: v, label: v.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()), entity: 'system', icon: 'fas fa-bell' };
};
export const isOpenAlert = (statusKey) => OPEN_ALERT_STATUSES.includes(alertStatus(statusKey).key);

/** Status changes an admin can make from each status */
export const STATUS_ACTIONS = {
  open:         ['acknowledged', 'in_progress', 'resolved', 'closed'],
  acknowledged: ['in_progress', 'resolved', 'closed'],
  in_progress:  ['resolved', 'closed'],
  resolved:     ['open', 'closed'],
  closed:       ['open'],
};
export const STATUS_ACTION_LABELS = { acknowledged: 'Acknowledge', in_progress: 'Start work', resolved: 'Resolve', closed: 'Close', open: 'Reopen' };

/**
 * Automatic rules (run_alert_rules in the database). params describe the
 * editable thresholds shown in the "Alert rules" panel.
 */
export const ALERT_RULES = [
  { key: 'pending_unassigned', label: 'Pending request not assigned', priority: 'High → Critical', type: 'request_delay',
    params: [{ key: 'high_minutes', label: 'High after (min)', min: 5 }, { key: 'critical_minutes', label: 'Critical after (min)', min: 10 }] },
  { key: 'in_progress_no_collector', label: 'Assigned / in progress with no collector', priority: 'Critical', type: 'unassigned_job', params: [] },
  { key: 'stalled_job', label: 'Assigned not started, or collecting too long', priority: 'High', type: 'stalled_job',
    params: [{ key: 'assigned_minutes', label: 'Not started after (min)', min: 10 }, { key: 'collecting_minutes', label: 'Collecting longer than (min)', min: 30 }] },
  { key: 'invalid_location', label: 'Invalid coordinates (missing, 0,0, outside Ghana, swapped)', priority: 'Medium', type: 'invalid_location', params: [] },
  { key: 'outside_service_area', label: 'Outside every service zone with a collector', priority: 'Medium', type: 'outside_service_area', params: [] },
  { key: 'duplicate_request', label: 'Possible duplicate request', priority: 'Low', type: 'duplicate_request',
    params: [{ key: 'radius_m', label: 'Within (metres)', min: 5 }, { key: 'window_hours', label: 'Within (hours)', min: 1 }] },
  { key: 'collector_offline', label: 'Collector on duty but not reporting location', priority: 'Medium', type: 'collector_offline',
    params: [{ key: 'minutes', label: 'No update for (min)', min: 5 }, { key: 'start_hour', label: 'Working from (hour)', min: 0, max: 23 }, { key: 'end_hour', label: 'Working until (hour)', min: 1, max: 24 }] },
  { key: 'collector_capacity', label: 'Collector vehicle nearly full', priority: 'Medium', type: 'collector_capacity',
    params: [{ key: 'percent', label: 'At or above (%)', min: 50, max: 100 }] },
  { key: 'fee_mismatch', label: 'Fee doesn\'t match the pricing', priority: 'Low', type: 'fee_mismatch',
    params: [{ key: 'days', label: 'Check requests from last (days)', min: 1 }] },
  { key: 'invalid_contact', label: 'Collector with invalid email or phone', priority: 'Low', type: 'invalid_contact', params: [] },
];
export const GENERAL_RULE_KEY = '_general';

/* ── Audit log (public.logs, Logs page) ─────────────────────────────────── */

/** Stored lower-case; normalizeLogLevel() reads any older spelling */
export const LOG_LEVELS = [
  { key: 'critical', label: 'Critical', rank: 5, className: 'bg-red-700 text-white' },
  { key: 'error',    label: 'Error',    rank: 4, className: 'bg-red-100 text-red-800' },
  { key: 'warn',     label: 'Warning',  rank: 3, className: 'bg-amber-100 text-amber-800' },
  { key: 'info',     label: 'Info',     rank: 2, className: 'bg-green-100 text-green-800' },
  { key: 'debug',    label: 'Debug',    rank: 1, className: 'bg-gray-100 text-gray-700' },
];
const LEVEL_ALIASES = { warning: 'warn', err: 'error', fatal: 'critical', crit: 'critical', trace: 'debug' };
export const normalizeLogLevel = (raw) => {
  const v = String(raw ?? '').trim().toLowerCase();
  const key = LEVEL_ALIASES[v] || v;
  return LOG_LEVELS.some(l => l.key === key) ? key : 'info';
};
export const logLevelInfo = (raw) => LOG_LEVELS.find(l => l.key === normalizeLogLevel(raw));

export const LOG_SOURCES = [
  { key: 'requests', label: 'Pickup requests' },
  { key: 'collectors', label: 'Collectors' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'bags', label: 'Bags' },
  { key: 'auth', label: 'Sign-in' },
  { key: 'system', label: 'System' },
  { key: 'logs', label: 'Logs page' },
];

/** Who did it */
export const ACTOR_ROLES = [
  { key: 'admin', label: 'Admin' },
  { key: 'collector', label: 'Collector' },
  { key: 'customer', label: 'Customer' },
  { key: 'rule', label: 'Alert rule' },
  { key: 'system', label: 'System' },
  { key: 'anonymous', label: 'Not signed in' },
];

export const LOG_ENTITY_TYPES = [
  { key: 'pickup_request', label: 'Pickup request' },
  { key: 'collector', label: 'Collector' },
  { key: 'alert', label: 'Alert' },
  { key: 'batch', label: 'Bag batch' },
  { key: 'user', label: 'User' },
];

/**
 * Every action written to the log. Database triggers write the request.*,
 * collector.* and alert.* ones; logAudit() writes the rest.
 */
export const LOG_ACTIONS = [
  { key: 'request.created', label: 'Request created' },
  { key: 'request.assigned', label: 'Request assigned' },
  { key: 'request.reassigned', label: 'Request reassigned' },
  { key: 'request.unassigned', label: 'Request unassigned' },
  { key: 'request.accepted', label: 'Request accepted' },
  { key: 'request.started', label: 'Pickup started' },
  { key: 'request.arrived', label: 'Collector arrived' },
  { key: 'request.collecting', label: 'Collecting' },
  { key: 'request.completed', label: 'Request completed' },
  { key: 'request.cancelled', label: 'Request cancelled' },
  { key: 'request.expired', label: 'Request expired' },
  { key: 'request.reopened', label: 'Request reopened' },
  { key: 'request.status_changed', label: 'Request status changed' },
  { key: 'request.merged', label: 'Merged as duplicate' },
  { key: 'request.fee_changed', label: 'Fee changed' },
  { key: 'request.location_fixed', label: 'Location fixed' },
  { key: 'request.update_failed', label: 'Request change failed' },
  { key: 'collector.created', label: 'Collector added' },
  { key: 'collector.updated', label: 'Collector edited' },
  { key: 'collector.deactivated', label: 'Collector deactivated' },
  { key: 'collector.reactivated', label: 'Collector reactivated' },
  { key: 'collector.status_changed', label: 'Collector status changed' },
  { key: 'collector.update_failed', label: 'Collector change failed' },
  { key: 'alert.created', label: 'Alert created' },
  { key: 'alert.acknowledged', label: 'Alert acknowledged' },
  { key: 'alert.started', label: 'Alert work started' },
  { key: 'alert.resolved', label: 'Alert resolved' },
  { key: 'alert.auto_resolved', label: 'Alert auto-resolved' },
  { key: 'alert.closed', label: 'Alert closed' },
  { key: 'alert.reopened', label: 'Alert reopened' },
  { key: 'alert.assigned', label: 'Alert assigned' },
  { key: 'alert.escalated', label: 'Alert escalated' },
  { key: 'alert.commented', label: 'Alert comment' },
  { key: 'alert.action', label: 'Alert action' },
  { key: 'alert.update_failed', label: 'Alert change failed' },
  { key: 'batch.created', label: 'Batch generated' },
  { key: 'batch.distributed', label: 'Batch scanned by household' },
  { key: 'batch.archived', label: 'Batch archived' },
  { key: 'batch.restored', label: 'Batch restored' },
  { key: 'batch.update_failed', label: 'Batch change failed' },
  { key: 'notification.failed', label: 'Notification failed' },
  { key: 'auth.login', label: 'Signed in' },
  { key: 'auth.login_failed', label: 'Sign-in failed' },
  { key: 'auth.logout', label: 'Signed out' },
  { key: 'logs.exported', label: 'Logs exported' },
  { key: 'logs.archived', label: 'Old logs archived' },
];
export const logActionLabel = (key) => LOG_ACTIONS.find(a => a.key === key)?.label
  || (key ? String(key).replace(/[._]/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '—');
