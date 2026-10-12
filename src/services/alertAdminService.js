/**
 * Data layer for the Alerts page. Status changes, assignment and creation go
 * to the alerts table; the database triggers (20261017_alerts_rules.sql)
 * record each change in alert_activity, copy it to the Logs page and send
 * header-bell notifications. Comments and actions are added here.
 * Every write throws on failure; nothing is reported as saved when it wasn't.
 */
import { supabase } from '../utils/supabase';
import { logFailure } from './auditLogService';
import { normalizeAlert } from '../utils/alertUtils';
import { FULL_ACCESS_ADMIN_EMAILS } from '../constants/accessControl';
import { OPEN_ALERT_STATUSES } from '../constants/alerts';

const fail = (error, fallback) => new Error(error?.message || fallback);

export const isMissingSchema = (error) =>
  /42P01|42703|PGRST20[0-5]|does not exist|Could not find/i.test(`${error?.code || ''} ${error?.message || ''}`);

/** All alerts, newest first. needsMigration = the status column isn't there yet. */
export const fetchAlerts = async () => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('alerts').select('*')
      .order('created_at', { ascending: false }).range(from, from + 999);
    if (error) throw fail(error, 'Could not load alerts');
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const alerts = out.map(normalizeAlert);
  return { alerts, needsMigration: out.length > 0 && !alerts[0].hasStatusColumn };
};

export const fetchAlert = async (id) => {
  const { data, error } = await supabase.from('alerts').select('*').eq('id', id).maybeSingle();
  if (error) throw fail(error, 'Could not load the alert');
  return data ? normalizeAlert(data) : null;
};

// Successful alert changes reach the Logs page through the alert timeline
// trigger; failures are logged here because they never reach the database.
const alertFailure = (alertId, error, context) =>
  logFailure('alert.update_failed', { source: 'alerts', entityType: 'alert', entityId: alertId, error, context });

const updateAlert = async (id, payload) => {
  const { data, error } = await supabase.from('alerts').update(payload).eq('id', id).select('*');
  if (error || !data || !data.length) {
    const failure = error || new Error('Alert not found, or you do not have permission to change it');
    alertFailure(id, failure, { attempted: payload });
    throw fail(failure, 'Update failed');
  }
  return normalizeAlert(data[0]);
};

/** Acknowledge / start / resolve / close / reopen. Resolving needs a note. */
export const setAlertStatus = async (alert, to, { note = '', userId = null } = {}) => {
  if (to === 'resolved' && !String(note).trim()) throw new Error('Add a note saying how it was resolved');
  const payload = { status: to };
  if (to === 'resolved' || to === 'closed') {
    payload.resolution_note = String(note).trim() || null;
    if (to === 'resolved') payload.resolved_by = userId;
  }
  if (OPEN_ALERT_STATUSES.includes(to)) payload.resolution_note = null;
  return updateAlert(alert.id, payload);
};

/** Run one status change over many alerts; returns { ok, failed: [{ alert, message }] } */
export const bulkSetStatus = async (alerts, to, opts) => {
  const failed = [];
  let ok = 0;
  for (const a of alerts) {
    try { await setAlertStatus(a, to, opts); ok += 1; } catch (error) { failed.push({ alert: a, message: error.message }); }
  }
  return { ok, failed };
};

/** Assign (or unassign with null). The database notifies the assignee. */
export const assignAlert = async (alert, userId) => updateAlert(alert.id, { assigned_to: userId || null });

export const createAlert = async (form, userId) => {
  const payload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    type: form.type,
    severity: form.priority,
    status: 'open',
    entity_type: form.entity?.type || 'system',
    entity_source: form.entity?.source || null,
    entity_ref: form.entity?.ref || null,
    assigned_to: form.assignedTo || null,
    location_lat: form.location?.lat ?? null,
    location_lng: form.location?.lng ?? null,
    location_address: form.location?.address || null,
    metadata: form.entity?.label ? { label: form.entity.label } : {},
    created_by: userId || null,
  };
  const { data, error } = await supabase.from('alerts').insert(payload).select('*').single();
  if (error) {
    alertFailure(null, error, { operation: 'create', title: payload.title });
    throw fail(error, 'Could not create the alert');
  }
  return normalizeAlert(data);
};

/* ── timeline ───────────────────────────────────────────────────────────── */

export const fetchActivity = async (alertId) => {
  const { data, error } = await supabase.from('alert_activity').select('*')
    .eq('alert_id', alertId).order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) {
    if (isMissingSchema(error)) return null; // migration not run yet
    throw fail(error, 'Could not load activity');
  }
  return data || [];
};

const addActivity = async (alertId, kind, { to = null, note = null, data = {} } = {}) => {
  const { error } = await supabase.from('alert_activity').insert({ alert_id: alertId, kind, to_value: to, note, data });
  if (error) {
    alertFailure(alertId, error, { operation: kind, action: to });
    throw fail(error, 'Could not save');
  }
};

export const addComment = async (alert, text) => {
  if (!String(text).trim()) throw new Error('Write a comment first');
  return addActivity(alert.id, 'comment', { note: String(text).trim() });
};

/** Record an action (Assign collector, Notify customer, …) and its outcome on the timeline and Logs page */
export const logAlertAction = (alert, action, { ok = true, note = null, data = {} } = {}) =>
  addActivity(alert.id, 'action', { to: action, note: ok ? note : `Failed: ${note || 'error'}`, data: { ok, ...data } })
    .catch(error => console.warn('Alert action not logged:', error.message));

/* ── people ─────────────────────────────────────────────────────────────── */

/** Admin accounts for "Assign to". Falls back to the admin email list (no ids) before the migration. */
export const fetchStaff = async () => {
  const { data, error } = await supabase.rpc('td_staff_users');
  if (!error && Array.isArray(data) && data.length) {
    return { staff: data.map(u => ({ id: u.id, email: u.email, name: u.name || u.email })), fromDatabase: true };
  }
  return { staff: FULL_ACCESS_ADMIN_EMAILS.map(email => ({ id: null, email, name: email })), fromDatabase: false };
};

/** In-app notification (notifications table) */
export const sendNotification = async (userId, { title, message, type = 'info' }) => {
  if (!userId) throw new Error('No user account to notify');
  const { error } = await supabase.from('notifications').insert({ user_id: userId, title, message, type, read: false });
  if (error) {
    logFailure('notification.failed', { source: 'alerts', entityType: 'user', entityId: userId, error, context: { title, type } });
    throw fail(error, 'Notification not sent');
  }
};

/** Correct a request's coordinates wherever the app stores them */
export const setRequestLocation = async (source, id, lat, lng) => {
  const { error } = await supabase.rpc('admin_set_request_location', { p_source: source, p_id: String(id), p_lat: lat, p_lng: lng });
  if (error) {
    logFailure('request.update_failed', { source: 'requests', entityType: 'pickup_request', entityId: id, error, context: { operation: 'fix_location', lat, lng } });
    throw fail(error, 'Location not saved');
  }
};

/* ── rules ──────────────────────────────────────────────────────────────── */

export const fetchRuleSettings = async () => {
  const { data, error } = await supabase.from('alert_rule_settings').select('*');
  if (error) {
    if (isMissingSchema(error)) return null;
    throw fail(error, 'Could not load rule settings');
  }
  return Object.fromEntries((data || []).map(r => [r.rule_key, { enabled: r.enabled, params: r.params || {}, updatedAt: r.updated_at }]));
};

export const saveRuleSetting = async (ruleKey, { enabled, params }, userId) => {
  const { data, error } = await supabase.from('alert_rule_settings')
    .update({ enabled, params, updated_at: new Date().toISOString(), updated_by: userId || null })
    .eq('rule_key', ruleKey).select('rule_key');
  if (error) throw fail(error, 'Settings not saved');
  if (!data || !data.length) throw new Error('Rule not found, or you do not have permission to change it');
};

/** Run the rules now. dryRun = report what would happen without changing anything. */
export const runRules = async (dryRun = true) => {
  const { data, error } = await supabase.rpc('run_alert_rules', { p_dry_run: dryRun });
  if (error) throw fail(error, 'Rules did not run');
  return data || [];
};

/** Live updates: calls onChange when any alert changes. Returns an unsubscribe function. */
export const subscribeToAlerts = (onChange) => {
  try {
    const channel = supabase.channel(`alerts-page-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, onChange)
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch (e) { /* already closed */ } };
  } catch (error) {
    return () => {};
  }
};
