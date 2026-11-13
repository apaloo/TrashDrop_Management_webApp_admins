import logger from './logger';
import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';
import * as realDataUtils from './realDataUtils';

/**
 * Fetch illegal dumping history for a report
 * @param {string} reportId - Report ID to fetch history for
 * @returns {Promise<Array>} History entries
 */
export const fetchIllegalDumpingHistory = async (reportId) => {
  // The status trigger on illegal_dumping_mobile logs every change here
  // (dumping_id, status, notes, updated_by). Newest first.
  const { data, error } = await supabase
    .from('illegal_dumping_history_mobile')
    .select('*')
    .eq('dumping_id', reportId);
  if (error) {
    console.warn('Could not load report activity:', error.message);
    return [];
  }
  return (data || [])
    .map(row => ({
      id: row.id || `${row.dumping_id}-${row.created_at}-${row.status}`,
      status: row.status,
      notes: row.notes || null,
      at: row.created_at || row.updated_at || null,
      by: row.updated_by || null,
    }))
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
};

/**
 * Fetch illegal dumping reports (alias for compatibility)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Illegal dumping reports
 */
export const fetchIllegalDumpingReports = async (options = {}) => {
  return await fetchIllegalDumpingReportsReal(options);
};

/**
 * Fetch every illegal dumping report, page by page, so totals and KPIs are
 * never capped at one page of rows.
 * @param {Object} options - { status, pageSize, area } (area from useAuth())
 * @returns {Promise<Array>} All matching reports, newest first
 */
export const fetchAllIllegalDumpingReports = async ({ status = null, pageSize = 500, area = null, privateView = false } = {}) => {
  const all = [];
  for (let page = 1; ; page++) {
    const response = await fetchIllegalDumpingReportsReal({ status, limit: pageSize, page, area, privateView });
    const rows = Array.isArray(response) ? response : (response?.data || []);
    all.push(...rows);
    const total = response?.totalCount ?? 0;
    if (rows.length < pageSize || all.length >= total) break;
  }
  return all;
};

/**
 * Update illegal dumping report status
 * @deprecated RPC function 'update_illegal_dumping_status' no longer exists - using direct table updates
 * @param {string} reportId - Report ID
 * @param {string} status - New status
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated report
 */
export const updateIllegalDumpingStatus = async (reportId, status, notes = '') => {
  // DEPRECATED: RPC function removed, using direct table update only
  logger.log('Using direct table update for illegal dumping status (RPC deprecated)');

  // DB constraint: status IN ('pending', 'verified', 'in_progress', 'completed', 'cancelled')
  const DB_ALLOWED_STATUSES = ['pending', 'verified', 'in_progress', 'completed', 'cancelled'];
  if (!DB_ALLOWED_STATUSES.includes(status)) {
    console.error(`updateIllegalDumpingStatus: status '${status}' is not allowed by DB constraint. Allowed: ${DB_ALLOWED_STATUSES.join(', ')}`);
    throw new Error(`Invalid status value '${status}'. Must be one of: ${DB_ALLOWED_STATUSES.join(', ')}`);
  }

  // Direct table update
  return await safeDatabaseService.safeQuery({
    tableName: 'illegal_dumping_mobile',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('illegal_dumping_mobile')
        .update({ 
          status,
          // Align with SQL function which only updates status/updated_at
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .select()
        .single();
      
      return { data, error };
    }
  });
};

/**
 * Assign cleanup team to illegal dumping report
 * @param {string} reportId - Report ID
 * @param {string} collectorId - Collector UUID from collector_profiles table
 * @param {Date} scheduledDate - Scheduled cleanup date (optional, not persisted)
 * @returns {Promise<Object>} Assignment result
 */
export const assignCleanupTeam = async (reportId, collectorId, scheduledDate, fee) => {
  logger.log('Assigning collector to illegal dumping report:', { reportId, collectorId, scheduledDate, fee });
  
  return await safeDatabaseService.safeQuery({
    tableName: 'illegal_dumping_mobile',
    queryFn: async () => {
      // Database constraint only allows: 'pending', 'verified', 'in_progress', 'completed'
      // Use 'verified' so assignment appears in collector's "Available" tab
      // Collector will change to 'in_progress' when they accept the assignment
      // Callers check first (assignmentBlockReason); the filters below make sure the
      // report is still verified and unassigned when the update runs, so an
      // unverified report is never verified here by accident.
      const newStatus = 'verified';
      
      const updatePayload = { 
        status: newStatus,
        assigned_to: collectorId,
        updated_at: new Date().toISOString()
      };

      // Always written, so a fee left from an earlier (released) assignment
      // never carries over. null = the standard size × severity rate; volunteer
      // groups are unpaid whatever is stored (td_cleanup_payment in the collector app's database).
      const feeValue = fee !== '' && fee != null && !isNaN(parseFloat(fee)) && parseFloat(fee) > 0 ? parseFloat(fee) : null;
      updatePayload.cleanup_fee = feeValue;

      const { data, error } = await supabase
        .from('illegal_dumping_mobile')
        .update(updatePayload)
        .eq('id', reportId)
        .eq('status', 'verified')
        .is('assigned_to', null)
        .select()
        .single();
      
      if (error) {
        console.error('Error assigning cleanup team:', error);
      } else {
        logger.log('Successfully assigned collector:', collectorId, 'to report:', reportId);
      }
      
      return { data, error };
    }
  });
};


// =============================================================================
// STATISTICS FUNCTIONS - Wrappers for real data utils
// =============================================================================

/**
 * Fetch collector statistics from real data
 * Wrapper for realDataUtils.fetchCollectorStats
 */
export const fetchCollectorStatsReal = async () => {
  return await realDataUtils.fetchCollectorStats();
};

/**
 * Fetch illegal dumping reports from real data
 * Wrapper for realDataUtils.fetchIllegalDumpingReports
 */
export const fetchIllegalDumpingReportsReal = async (filters = {}) => {
  return await realDataUtils.fetchIllegalDumpingReports(filters);
};
