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
