/**
 * Account performance: my_performance() for an account's own page (or any
 * account's, for staff) and performance_overview() for the staff comparison.
 * See supabase/migrations/20261109_account_performance.sql.
 *
 * A failed call throws a PerformanceError whose `kind` tells the page what to
 * show; its `message` is safe to display (the database's text is kept in
 * `detail` for the console).
 *  - forbidden: the database refused (someone else's page, or not staff)
 *  - missing:   the database is missing the performance update
 *  - failed:    anything else (network, server error)
 */
import { supabase } from '../utils/supabase';

const MESSAGES = {
  forbidden: 'You can only see your own performance.',
  missing: 'Performance numbers aren’t set up in the database yet. Ask an admin to run the latest migrations.',
  failed: 'Couldn’t load the numbers. Try Refresh.',
};

export class PerformanceError extends Error {
  constructor(kind, detail) {
    super(MESSAGES[kind]);
    this.name = 'PerformanceError';
    this.kind = kind;
    this.detail = detail;
  }
}

const missing = (error) => ['42883', 'PGRST202', '42P01'].includes(error?.code) || /could not find|does not exist/i.test(error?.message || '');
const forbidden = (error) => error?.code === '42501' || error?.status === 403 || /only see your own|only trashdrop admins|not allowed|permission denied/i.test(error?.message || '');

const toError = (error, what) => new PerformanceError(
  forbidden(error) ? 'forbidden' : missing(error) ? 'missing' : 'failed',
  `${what}: ${error?.message || 'unknown error'} (${error?.code || error?.status || 'no code'})`);

/** The signed-in account's page; staff may pass another account's id */
export const fetchMyPerformance = async (days, accountId) => {
  const args = { p_days: days };
  if (accountId) args.p_account = accountId;
  const { data, error } = await supabase.rpc('my_performance', args);
  if (error) throw toError(error, 'my_performance');
  return data || { metrics: [] };
};

/** Staff: every account of a type (and region) side by side */
export const fetchPerformanceOverview = async (role, region, days) => {
  const { data, error } = await supabase.rpc('performance_overview', { p_role: role, p_region: region || null, p_days: days });
  if (error) throw toError(error, 'performance_overview');
  return data || { metrics: [], accounts: [] };
};

/* ── metric list (admins; performance_metrics is staff-only in the database) ── */

const metricError = (error, what) => {
  if (error?.code === '23505') return new Error('A metric with that name already exists. Give it another name.');
  if (error?.code === '23514') return new Error('The database refused these settings. Check the actions and numbers, then try again.');
  if (forbidden(error)) return new Error('Only TrashDrop admins can change metrics.');
  if (missing(error)) return new Error(MESSAGES.missing);
  console.warn(`${what}:`, error?.message, error?.code);
  return new Error('Couldn’t save. Check your connection and try again.');
};

/** Every metric, shown or hidden, in page order */
export const fetchMetrics = async () => {
  const { data, error } = await supabase.from('performance_metrics').select('*')
    .order('sort_order', { ascending: true }).order('key', { ascending: true });
  if (error) throw metricError(error, 'fetchMetrics');
  return data || [];
};

export const createMetric = async (row, userId) => {
  const { data, error } = await supabase.from('performance_metrics')
    .insert({ ...row, updated_by: userId || null, updated_at: new Date().toISOString() })
    .select().single();
  if (error) throw metricError(error, 'createMetric');
  return data;
};

export const updateMetric = async (key, patch, userId) => {
  const { data, error } = await supabase.from('performance_metrics')
    .update({ ...patch, updated_by: userId || null, updated_at: new Date().toISOString() })
    .eq('key', key).select().single();
  if (error) throw metricError(error, 'updateMetric');
  return data;
};

export const deleteMetric = async (key) => {
  const { error } = await supabase.from('performance_metrics').delete().eq('key', key);
  if (error) throw metricError(error, 'deleteMetric');
};
