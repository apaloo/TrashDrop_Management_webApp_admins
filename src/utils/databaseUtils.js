import logger from './logger';
import { supabase } from './supabase';
import { STATUS } from '../config/constants';
import { safeDatabaseService } from './safeDatabaseService';
import * as realDataUtils from './realDataUtils';

/**
 * Archive a bag batch (hidden in Bag Management; restore from the Archived filter).
 * Uses admin_set_batch_archived (20261019_bag_batches_admin.sql); never writes
 * batches.status, which the household app relies on.
 * @param {string} batchId - The batch ID to archive
 * @returns {Promise<{success:boolean}>}
 */
export const archiveBagBatch = async (batchId) => {
  if (!batchId) throw new Error('archiveBagBatch: batchId is required');
  const { error } = await supabase.rpc('admin_set_batch_archived', { p_batch_id: batchId, p_archived: true });
  if (error) throw error;
  return { success: true };
};

/**
 * Fetch bag batches from Supabase with pagination and sorting
 * Direct database connection - NO MOCK DATA, NO CACHE
 * @param {Object} options - Options for pagination and sorting
 * @returns {Promise<Object>} Promise that resolves to an object with data and pagination info
 */
export const fetchBagBatches = async (options = {}) => {
  const {
    page = 1, limit = 10, filters = {},
    sortBy = options.sortField || 'created_at', sortOrder = options.sortDirection || 'desc'
  } = options;
  const SORTABLE = { id: 'id', type: 'type', size: 'size', quantity: 'bag_count', bag_count: 'bag_count', created_at: 'created_at', createdAt: 'created_at', scanned: 'filled_count', last_scan_date: 'last_activity_at' };
  const offset = (page - 1) * limit;

  let query = supabase
    .from('admin_bag_batches')
    .select('*', { count: 'exact' })
    .order(SORTABLE[sortBy] || 'created_at', { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  const stage = String(filters.status || '').toLowerCase();
  if (stage && stage !== 'all') query = query.eq('stage', stage);
  else query = query.neq('stage', 'archived');

  if (filters.search) {
    const term = String(filters.search).toLowerCase().replace(/[,()*%\\]/g, ' ').trim();
    if (term) query = query.ilike('search_text', `%${term}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('Error fetching batches (run supabase/migrations/20261019_bag_batches_admin.sql if admin_bag_batches is missing):', error);
    throw error;
  }

  // Same field names as before, plus the worked-out step
  const rows = (data || []).map(row => ({
    ...row,
    status: row.stage,
    quantity: row.bag_count,
    distributed: row.distributed_count,
    scanned: row.filled_count, // bags households have used (asked a pickup for)
    collected: row.collected_count,
    scan_rate: row.bag_count > 0 ? Math.round((row.filled_count / row.bag_count) * 100) : 0,
    last_scan_date: row.last_activity_at
  }));

  return {
    data: rows,
    totalCount: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
};

/**
 * Fetch bag scan history from Supabase
 * Direct database connection - NO MOCK DATA, NO CACHE
 * @param {string} batchId - Batch ID to fetch history for
 * @returns {Promise<Array>} Array of scan history records
 */
export const fetchBagHistory = async (batchId = null) => {
  // Read from the admin_bag_scans view (20261020_bag_history.sql), which looks the
  // scanner's name up itself. Embedding scans → scanned_by failed because no
  // foreign key backs that column.
  let query = supabase
    .from('admin_bag_scans')
    .select('id, bag_id, batch_id, scanned_at, scanned_by, scanned_by_name, location, status')
    .order('scanned_at', { ascending: false });
  if (batchId) query = query.eq('batch_id', batchId);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching scans:', error);
    throw error;
  }
  return (data || []).map(scan => ({ ...scan, bags: { batch_id: scan.batch_id } }));
};

/**
 * Create a new bag batch in the database
 * Schema: batches (id, batch_number, bag_count, status, notes, batch_name, created_at, updated_at, created_by)
 * Mobile app scans BATCH-LEVEL QR code containing the batch UUID
 * @param {Object} batchData - Batch data to create
 * @returns {Promise<{batch: Object, batchQRCode: string}>} Created batch and batch QR code (UUID)
 */
export const createBagBatch = async (batchData) => {
  // Build batch payload matching actual Supabase schema
  const batchPayload = {
    batch_number: batchData.batch_number || batchData.batchNumber || String(Date.now()).slice(-8),
    batch_name: batchData.batch_name || batchData.batchName || `${batchData.type || 'Bags'} - ${batchData.size || 'Standard'}`,
    bag_count: Number(batchData.bag_count ?? batchData.quantity ?? 0),
    // Stored value belongs to the household app: it only activates 'active' batches.
    // The admin shows the worked-out step instead (src/constants/bagStatus.js).
    status: 'active',
    notes: batchData.notes || `Type: ${batchData.type || 'Unknown'}, Size: ${batchData.size || 'Unknown'}`
  };
  // Columns added by supabase/migrations/20261019_bag_batches_admin.sql
  const detailColumns = {
    type: batchData.type || null,
    size: batchData.size || null,
    qr_prefix: batchData.qr_prefix || batchData.qrPrefix || null
  };

  // Include pricing if provided
  if (batchData.total_batch_price != null) {
    batchPayload.total_batch_price = batchData.total_batch_price;
  }
  if (batchData.unit_price != null) {
    batchPayload.unit_price = batchData.unit_price;
  }

  // Get current user for created_by field
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    batchPayload.created_by = user.id;
    detailColumns.generated_by = user.id; // created_by is overwritten with the household when it scans the batch
  }

  // Insert batch into database (without the detail columns if the database doesn't have them yet)
  let { data: batch, error: batchError } = await supabase
    .from('batches')
    .insert([{ ...batchPayload, ...detailColumns }])
    .select()
    .single();
  if (batchError && (batchError.code === '42703' || batchError.code === 'PGRST204')) {
    console.warn('batches has no type/size/qr_prefix columns yet; run supabase/migrations/20261019_bag_batches_admin.sql');
    ({ data: batch, error: batchError } = await supabase.from('batches').insert([batchPayload]).select().single());
  }

  if (batchError) {
    console.error('Error creating batch:', batchError);
    throw batchError;
  }
  
  logger.log('✅ Batch created successfully:', batch);
  
  // IMPORTANT: Mobile app scans the BATCH ID (UUID), not individual bag QR codes
  // The QR code contains just the batch UUID
  const batchQRCode = batch.id;
  
  // Create individual bags for this batch (for tracking purposes)
  const bagCount = batchPayload.bag_count;
  const bags = [];
  
  for (let i = 1; i <= bagCount; i++) {
    const bagRow = {
      batch_id: batch.id,
      qr_code: `${batch.id}-${String(i).padStart(4, '0')}`, // Bag-specific code
      status: 'active',
      scanned: false
    };
    if (batchPayload.unit_price != null) {
      bagRow.unit_price = batchPayload.unit_price;
    }
    bags.push(bagRow);
  }
  
  // Insert bags in batches of 100 to avoid hitting limits
  if (bags.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < bags.length; i += BATCH_SIZE) {
      const batchToInsert = bags.slice(i, i + BATCH_SIZE);
      const { error: bagsError } = await supabase
        .from('bags')
        .insert(batchToInsert);
      
      if (bagsError) {
        console.error('Error creating bags:', bagsError);
        console.warn(`Warning: Batch ${batch.id} created but some bags failed to insert`);
      }
    }
    logger.log(`✅ ${bags.length} individual bags created for tracking`);
  }
  
  return { 
    batch,
    batchQRCode, // This is what gets encoded in the QR code for mobile scanning
    bagCount: bags.length
  };
};

/**
 * Create a new collector in the database
 * @param {Object} collectorData - Collector data to create
 * @returns {Promise<Object>} Created collector record
 */
export const createCollector = async (collectorData) => {
  try {
    const payload = {
      first_name: collectorData.first_name || collectorData.name?.split(' ')[0] || 'Unknown',
      last_name: collectorData.last_name || collectorData.name?.split(' ').slice(1).join(' ') || '',
      email: collectorData.email,
      phone: collectorData.phone,
      status: collectorData.status || STATUS.COLLECTOR.ACTIVE.toLowerCase(),
      region: collectorData.region,
      assigned_region: collectorData.assigned_region ?? collectorData.region ?? null,
      vehicle_type: collectorData.vehicle_type ?? null,
      license_plate: collectorData.vehicle_plate ?? null,
      vehicle_capacity: collectorData.vehicle_capacity ?? null,
      profile_image_url: collectorData.avatar_url ?? collectorData.profile_image_url ?? null,
      notes: collectorData.notes ?? null,
      created_at: collectorData.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('collector_profiles')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error creating collector:', error);
    throw error;
  }
};

/**
 * Update a collector in the database
 * @param {string} collectorId - Collector ID to update
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated collector record
 */
export const updateCollector = async (collectorId, updateData) => {
  try {
    if (!collectorId) {
      throw new Error('collectorId is required to update collector');
    }

    const payload = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('collector_profiles')
      .update(payload)
      .eq('id', collectorId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error updating collector:', error);
    throw error;
  }
};

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
 * Fetch dashboard statistics
 * @returns {Promise<Object>} Dashboard statistics
 */
export const fetchDashboardStats = async () => {
  // First, try the RPC via safeDatabaseService
  try {
    const rpcData = await safeDatabaseService.safeRPC({
      functionName: 'fetch_dashboard_stats',
      params: {},
      throwOnMissing: false
    });
    if (rpcData !== null && rpcData !== undefined) {
      return { data: rpcData, error: null };
    }
    console.warn('fetch_dashboard_stats RPC unavailable or returned null; using table queries instead');
  } catch (error) {
    console.warn('Error calling fetch_dashboard_stats via safeRPC:', error.message);
    // Fall through to the table-based implementation
  }
  
  // Fall back to direct table queries
  return await safeDatabaseService.safeQuery({
    tableName: 'dashboard_stats',
    queryFn: async () => {
      // Fetch various stats from different tables
      const [illegalDumpingData, bagsData, pickupsData] = await Promise.all([
        supabase.from('illegal_dumping_reports').select('status'),
        supabase.from('batches').select('bag_count, status'),
        supabase.from('pickup_requests').select('status, created_at, updated_at')
      ]);
      
      const illegalReports = illegalDumpingData.data || [];
      const batches = bagsData.data || [];
      const pickups = pickupsData.data || [];
      
      // Calculate stats
      const totalIllegalDumpingReports = illegalReports.length;
      const openIllegalDumpingReports = illegalReports.filter(r => r.status !== 'resolved').length;
      const resolvedIllegalDumpingReports = illegalReports.filter(r => r.status === 'resolved').length;
      
      const totalBags = batches.reduce((sum, batch) => sum + (batch.bag_count || 0), 0);
      const activeBags = batches.filter(b => b.status === 'active').length;
      
      const completedPickups = pickups.filter(p => p.status === 'completed');
      const avgResolutionTime = completedPickups.length > 0 
        ? completedPickups.reduce((sum, p) => {
            const created = new Date(p.created_at);
            const updated = new Date(p.updated_at);
            return sum + ((updated - created) / (1000 * 60 * 60 * 24)); // days
          }, 0) / completedPickups.length
        : 0;
      
      return {
        data: {
          totalIllegalDumpingReports,
          openIllegalDumpingReports,
          resolvedIllegalDumpingReports,
          avgCleanupTimeInDays: Math.round(avgResolutionTime * 10) / 10,
          totalBags,
          activeBags,
          totalPickups: pickups.length,
          completedPickups: completedPickups.length
        },
        error: null
      };
    },
  });
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
 * Fetch bag request statistics from real data
 * Wrapper for realDataUtils.fetchBagRequestStats
 */
export const fetchBagRequestStatsReal = async () => {
  return await realDataUtils.fetchBagRequestStats();
};

/**
 * Fetch collector statistics from real data
 * Wrapper for realDataUtils.fetchCollectorStats
 */
export const fetchCollectorStatsReal = async () => {
  return await realDataUtils.fetchCollectorStats();
};

/**
 * Fetch performance statistics from real data
 * Wrapper for realDataUtils.fetchPerformanceStats
 */
export const fetchPerformanceStatsReal = async () => {
  return await realDataUtils.fetchPerformanceStats();
};

/**
 * Fetch collectors from Supabase collector_profiles
 */
export const fetchCollectors = async ({ status = null, region = null, limit = 100 } = {}) => {
  return await safeDatabaseService.safeQuery({
    tableName: 'collector_profiles',
    throwOnMissing: true, // MOCK DATA DEPRECATED - Strict mode only
    queryFn: async () => {
      let query = supabase
        .from('collector_profiles')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      if (region) {
        query = query.eq('assigned_region', region);
      }

      return query;
    }
  });
};

/**
 * Fetch illegal dumping reports from real data
 * Wrapper for realDataUtils.fetchIllegalDumpingReports
 */
export const fetchIllegalDumpingReportsReal = async (filters = {}) => {
  return await realDataUtils.fetchIllegalDumpingReports(filters);
};
