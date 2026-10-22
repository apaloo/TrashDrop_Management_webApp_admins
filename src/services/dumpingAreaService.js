/**
 * Illegal dumping for Authority, Media, Volunteer and User accounts
 * (supabase/migrations/20261104_area_dumping_access.sql).
 *
 * These accounts don't read or change illegal_dumping_mobile directly. They
 * read area_dumping_reports() (their area only, no reporter details) and act
 * through functions that check their area first. Admins and Managers keep the
 * direct table path.
 */
import { supabase } from '../utils/supabase';

/** Accounts whose dumping actions go through the area functions */
export const usesAreaActions = (role) => role !== 'admin' && role !== 'manager';

const call = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw Object.assign(new Error(error.message || 'Request failed'), { code: error.code });
  return data;
};

/** Reports in the account's area, without who reported them */
export const fetchAreaDumpingReports = async ({ status = null } = {}) =>
  (await call('area_dumping_reports', { p_status: status || null })) || [];

export const areaVerifyReport = (id) => call('area_dumping_verify', { p_id: id });
export const areaMarkCleaned = (id) => call('area_dumping_mark_cleaned', { p_id: id });
export const areaAssignTeam = (id, teamId, fee) => call('area_dumping_assign', { p_id: id, p_team: teamId, p_fee: fee ?? null });

/** Teams the account may assign, shaped like collector_profiles rows for the assignment window */
export const fetchAreaTeams = async () => {
  const rows = (await call('area_assignable_teams', {})) || [];
  return rows.map(t => ({ id: t.id, first_name: t.name, last_name: '', collector_type: t.collector_type, region: t.region, vehicle_type: t.vehicle_type, status: 'active' }));
};
