/**
 * Dashboard data: one database call for every card and chart
 * (admin_dashboard_stats), and the stale-request list. See
 * supabase/migrations/20261022_dashboard.sql and 20261101_role_permissions.sql.
 *
 * A failed call throws a DashboardError whose `kind` tells the page what to
 * show; its `message` is safe to display (the database's own text is only
 * kept in `detail` for the console).
 *  - forbidden: the database refused this role (the page's own check should
 *    have stopped the call, so this is logged as a mismatch)
 *  - missing:   the database is missing the Dashboard update
 *  - failed:    anything else (network, server error)
 */
import { supabase } from '../utils/supabase';
import { SLA } from '../utils/dashboardUtils';

export class DashboardError extends Error {
  constructor(kind, what, detail) {
    super(MESSAGES[kind](what));
    this.name = 'DashboardError';
    this.kind = kind;
    this.detail = detail;
  }
}

const MESSAGES = {
  forbidden: () => 'Your role does not include these numbers.',
  missing: () => 'The database is missing the Dashboard update. Ask an admin to run the latest migrations.',
  failed: () => 'Couldn’t load these numbers. Try Refresh.',
};

const missing = (error) => ['42883', 'PGRST202', '42P01'].includes(error?.code) || /could not find|does not exist/i.test(error?.message || '');
const forbidden = (error) => error?.code === '42501' || error?.status === 403 || /not allowed|permission denied/i.test(error?.message || '');

const toError = (error, what) => {
  const kind = forbidden(error) ? 'forbidden' : missing(error) ? 'missing' : 'failed';
  return new DashboardError(kind, what, `${what}: ${error?.message || 'unknown error'} (${error?.code || error?.status || 'no code'})`);
};

export const fetchDashboard = async (period) => {
  const { data, error } = await supabase.rpc('admin_dashboard_stats', {
    p_from: period.from.toISOString(), p_to: period.to.toISOString(),
    p_assign_min: SLA.assignMinutes, p_complete_hours: SLA.completeHours,
  });
  if (error) throw toError(error, 'admin_dashboard_stats');
  return data || {};
};

/** Requests pending with no collector for more than `days` days (oldest first) */
export const fetchStaleRequests = async (days = 30) => {
  const { data, error } = await supabase.rpc('admin_stale_requests', { p_days: days });
  if (error) throw toError(error, 'admin_stale_requests');
  return data || [];
};
