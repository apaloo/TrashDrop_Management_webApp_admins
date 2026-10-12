/**
 * Dashboard data: one database call for every card and chart
 * (admin_dashboard_stats), and the stale-request list. See
 * supabase/migrations/20261022_dashboard.sql.
 */
import { supabase } from '../utils/supabase';
import { SLA } from '../utils/dashboardUtils';

const missing = (error) => ['42883', 'PGRST202', '42P01'].includes(error?.code) || /could not find|does not exist/i.test(error?.message || '');

const fail = (error, what) => new Error(missing(error)
  ? `${what}: the database is missing the Dashboard update. Run supabase/migrations/20261022_dashboard.sql in Supabase.`
  : `${what}: ${error?.message || 'unknown error'}`);

export const fetchDashboard = async (period) => {
  const { data, error } = await supabase.rpc('admin_dashboard_stats', {
    p_from: period.from.toISOString(), p_to: period.to.toISOString(),
    p_assign_min: SLA.assignMinutes, p_complete_hours: SLA.completeHours,
  });
  if (error) throw fail(error, 'Dashboard numbers could not be loaded');
  return data || {};
};

/** Requests pending with no collector for more than `days` days (oldest first) */
export const fetchStaleRequests = async (days = 30) => {
  const { data, error } = await supabase.rpc('admin_stale_requests', { p_days: days });
  if (error) throw fail(error, 'Stale requests could not be loaded');
  return data || [];
};
