import { supabase } from './supabase';
import { appConfig, APP_CONSTANTS } from '../config';
import { STATUS, LOG_LEVEL, LOG_SOURCE, ID_PREFIX } from '../config/constants';

// IMPORTANT: Override for development mode - force use of real Supabase data
// Remove this line if you want to use mock data in development mode
const FORCE_LIVE_DATA = true;

/**
 * Bag Management Database Operations
 */

// Fetch all bag batches with pagination and sorting support
export const fetchBagBatches = async ({
  page = 1,
  limit = appConfig.database.queryLimits.bagBatches,
  sortField = 'created_at',
  sortDirection = 'desc',
  filters = {}
} = {}) => {
  try {
    // Calculate pagination range
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Start building the query
    // Note: Check if we should use a different table name based on what's available in the database
    // If bag_batches doesn't exist, try batches or bags table instead
    let query = supabase
      .from('batches')
      .select('*', { count: 'exact' })
      .range(from, to);

    // Apply sorting
    query = query.order(sortField, { ascending: sortDirection === 'asc' });

    // Apply filters if provided
    if (filters.status && filters.status !== 'All') {
      query = query.eq('status', filters.status);
    }
    
    if (filters.search && filters.search.trim() !== '') {
      // Search by ID or type
      const searchTerm = filters.search.trim();
      query = query.or(
        `id.ilike.%${searchTerm}%,type.ilike.%${searchTerm}%,qr_prefix.ilike.%${searchTerm}%`
      );
    }

    const { data, error, count } = await query;
      
    if (error) throw error;
    
    return {
      data,
      totalCount: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  } catch (error) {
    console.error('Error fetching bag batches:', error);
    throw error;
  }
};

// Fetch bag scanning history
export const fetchBagHistory = async (batchId = null) => {
  try {
    let query = supabase
      .from('scans')
      .select(`
        *,
        bags:bag_id (id, batch_id),
        collectors:scanned_by (id, email, first_name, last_name)
      `)
      .order('scanned_at', { ascending: false });
    
    if (batchId) {
      query = query.eq('bags.batch_id', batchId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching bag history:', error);
    throw error;
  }
};

// Create a new bag batch
export const createBagBatch = async (batchData) => {
  try {
    // First create the batch
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert([{
        created_by: batchData.createdBy,
        quantity: batchData.quantity,
        type: batchData.type,
        size: batchData.size,
        status: 'Active',
        distributed: 0,
        scanned: 0,
        qr_prefix: batchData.qrPrefix
      }])
      .select()
      .single();
    
    if (batchError) throw batchError;

    // Generate QR codes for the batch
    const qrCodesData = Array.from({ length: batchData.quantity }, (_, i) => {
      const qrId = `${ID_PREFIX.BAG}-${batchData.batchNumber}-${i + 1}`.padStart(10, '0');
      return {
        id: qrId,
        batch_id: batch.id,
        qrCode: `${ID_PREFIX.BAG}-${batchData.batchNumber}-${i + 1}`.padStart(10, '0'),
        url: `https://${appConfig.app.domain}/bag/${qrId}`,
        status: 'Active'
      };
    });

    // Insert all QR codes
    const { data: qrCodes, error: qrError } = await supabase
      .from('bags')
      .insert(qrCodesData)
      .select();
    
    if (qrError) throw qrError;
    
    return { batch, qrCodes };
  } catch (error) {
    console.error('Error creating bag batch:', error);
    throw error;
  }
};

/**
 * Illegal Dumping Database Operations
 */

// Fetch all illegal dumping reports
export const fetchIllegalDumpingReports = async (status = null) => {
  try {
    let query = supabase
      .from('illegal_dumping')
      .select(`
        *,
        reporter:reported_by (id, email, first_name, last_name),
        assignee:assigned_to (id, email, first_name, last_name)
      `)
      .limit(appConfig.database.queryLimits.illegalDumping)
      .order('reported_at', { ascending: false });
    
    if (status && status !== 'All') {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching illegal dumping reports:', error);
    throw error;
  }
};

// Update illegal dumping report status
export const updateIllegalDumpingStatus = async (id, status, assignedTo = null) => {
  try {
    const updateData = { status };
    if (assignedTo) updateData.assigned_to = assignedTo;
    
    const { data, error } = await supabase
      .from('illegal_dumping')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Also record this status change in the history table
    const historyEntry = {
      report_id: id,
      status,
      changed_at: new Date().toISOString(),
      notes: `Status updated to ${status}`
    };
    
    await supabase
      .from('illegal_dumping_history')
      .insert(historyEntry);
      
    return data;
  } catch (error) {
    console.error('Error updating illegal dumping status:', error);
    throw error;
  }
};

// Fetch history for a specific illegal dumping report
export const fetchIllegalDumpingHistory = async (reportId) => {
  try {
    const { data, error } = await supabase
      .from('illegal_dumping_history')
      .select(`
        *,
        user:changed_by (id, email, first_name, last_name)
      `)
      .eq('report_id', reportId)
      .order('changed_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching illegal dumping history:', error);
    throw error;
  }
};

// Assign cleanup team to illegal dumping report
export const assignCleanupTeam = async (reportId, teamName, estimatedCleanupDate) => {
  try {
    // Update the report with cleanup details
    const updateData = {
      status: STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED,
      cleanup_team: teamName,
      cleanup_assigned: true,
      estimated_cleanup_date: estimatedCleanupDate
    };
    
    const { data, error } = await supabase
      .from('illegal_dumping')
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Add entry to history
    const historyEntry = {
      report_id: reportId,
      status: STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED,
      changed_at: new Date().toISOString(),
      notes: `Cleanup assigned to ${teamName}, scheduled for ${new Date(estimatedCleanupDate).toLocaleDateString()}`
    };
    
    await supabase
      .from('illegal_dumping_history')
      .insert(historyEntry);
      
    return data;
  } catch (error) {
    console.error('Error assigning cleanup team:', error);
    throw error;
  }
};
/**
 * Fetch dumping reports from mobile app that need admin verification
 */
export const fetchMobileAppDumpingReports = async (status = 'reported') => {
  try {
    const { data, error } = await supabase
      .from('dumping_reports')
      .select(`
        *,
        profiles:user_id (first_name, last_name, email)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching dumping reports:', error);
    throw error;
  }
};

/**
 * Verify a dumping report and create an illegal_dumping record
 * This creates the bridge between mobile app reports and admin workflow
 */
export const verifyDumpingReport = async (reportId, adminId, notes = '') => {
  try {
    // Begin transaction
    const { data: report, error: fetchError } = await supabase
      .from('dumping_reports')
      .select('*')
      .eq('id', reportId)
      .single();
    
    if (fetchError) throw fetchError;
    if (!report) throw new Error('Report not found');
    
    // Create point geometry from lat/long
    const point = `POINT(${report.longitude} ${report.latitude})`;
    
    // Create new illegal_dumping record
    const newDumpingRecord = {
      reported_by: report.user_id,
      original_report_id: reportId,
      location: report.address || `Location near ${report.latitude}, ${report.longitude}`,
      coordinates: point,
      waste_type: report.waste_type,
      size: report.approximate_size,
      images: report.images,
      status: 'Verified', // Initial status after verification
      reported_at: report.created_at
    };
    
    // Insert into illegal_dumping
    const { data: illegalDumping, error: insertError } = await supabase
      .from('illegal_dumping')
      .insert([newDumpingRecord])
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // Create history record
    await supabase
      .from('illegal_dumping_history')
      .insert([{
        report_id: illegalDumping.id,
        status: 'Verified',
        changed_by: adminId,
        notes: notes || 'Report verified by admin'
      }]);
    
    // Update original dumping report status
    await supabase
      .from('dumping_reports')
      .update({ status: 'verified' })
      .eq('id', reportId);
    
    return illegalDumping;
  } catch (error) {
    console.error('Error verifying dumping report:', error);
    throw error;
  }
};

/**
 * Assign cleaner to illegal dumping report
 */
export const assignDumpingCleaner = async (dumpingId, cleanerId, adminId, scheduledDate, notes = '') => {
  try {
    // Update illegal dumping record
    const { data, error } = await supabase
      .from('illegal_dumping')
      .update({
        status: 'Cleanup Scheduled',
        assigned_to: cleanerId,
        cleanup_assigned: true,
        estimated_cleanup_date: scheduledDate
      })
      .eq('id', dumpingId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Add to history
    await supabase
      .from('illegal_dumping_history')
      .insert([{
        report_id: dumpingId,
        status: 'Cleanup Scheduled',
        changed_by: adminId,
        notes: notes || `Cleanup assigned to collector ID: ${cleanerId}`
      }]);
    
    return data;
  } catch (error) {
    console.error('Error assigning cleaner:', error);
    throw error;
  }
};

/**
 * Mark illegal dumping as cleaned up
 */
export const markDumpingCleaned = async (dumpingId, adminId, verificationPhotos = [], notes = '') => {
  try {
    // Update illegal dumping record
    const { data, error } = await supabase
      .from('illegal_dumping')
      .update({
        status: 'Cleaned Up',
        cleaned_at: new Date().toISOString()
      })
      .eq('id', dumpingId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Add to history with verification photos
    await supabase
      .from('illegal_dumping_history')
      .insert([{
        report_id: dumpingId,
        status: 'Cleaned Up',
        changed_by: adminId,
        notes: notes || `Cleanup verified with ${verificationPhotos.length} photos`
      }]);
    
    // If this dumping was from a mobile app report, update the original report too
    if (data.original_report_id) {
      await supabase
        .from('dumping_reports')
        .update({ status: 'cleaned' })
        .eq('id', data.original_report_id);
    }
    
    return data;
  } catch (error) {
    console.error('Error marking dumping as cleaned:', error);
    throw error;
  }
};

/**
 * Get full dumping report details including history and original report
 */
export const getDumpingReportDetails = async (dumpingId) => {
  try {
    const [dumpingResult, historyResult, cleanerResult] = await Promise.all([
      // Get the dumping report
      supabase
        .from('illegal_dumping')
        .select('*')
        .eq('id', dumpingId)
        .single(),
      
      // Get the history
      supabase
        .from('illegal_dumping_history')
        .select(`
          *,
          admin:changed_by (email, first_name, last_name)
        `)
        .eq('report_id', dumpingId)
        .order('changed_at', { ascending: true }),
      
      // Get cleaner info if assigned
      supabase
        .from('illegal_dumping')
        .select(`
          assigned_to,
          cleaner:assigned_to (id, email, first_name, last_name)
        `)
        .eq('id', dumpingId)
        .single()
    ]);
    
    const { data: dumping, error: dumpingError } = dumpingResult;
    const { data: history, error: historyError } = historyResult;
    const { data: cleaner, error: cleanerError } = cleanerResult;
    
    if (dumpingError) throw dumpingError;
    if (historyError) throw historyError;
    
    // If there's an original report, get its details too
    let originalReport = null;
    if (dumping.original_report_id) {
      const { data: report, error: reportError } = await supabase
        .from('dumping_reports')
        .select(`
          *,
          reporter:user_id (first_name, last_name, email)
        `)
        .eq('id', dumping.original_report_id)
        .single();
      
      if (!reportError) {
        originalReport = report;
      }
    }
    
    return {
      details: dumping,
      history: history || [],
      cleaner: cleaner?.cleaner || null,
      originalReport
    };
  } catch (error) {
    console.error('Error fetching dumping report details:', error);
    throw error;
  }
};

/**
 * Pickup Request Database Operations
 */

// Fetch all pickup requests
export const fetchPickupRequests = async (status = null) => {
  try {
    let query = supabase
      .from('pickup_requests')
      .select(`
        *,
        requestor:requested_by (id, email, first_name, last_name),
        collector:assigned_to (id, email, first_name, last_name, phone, status)
      `)
      .order('requested_at', { ascending: false });
    
    if (status && status !== 'All') {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching pickup requests:', error);
    throw error;
  }
};

// Update pickup request status
export const updatePickupRequest = async (id, updateData) => {
  try {
    const { data, error } = await supabase
      .from('pickup_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating pickup request:', error);
    throw error;
  }
};

/**
 * Collectors Management Database Operations
 */

// Fetch all collectors
export const fetchCollectors = async (status = null) => {
  try {
    let query = supabase
      .from('collectors')
      .select('*')
      .limit(appConfig.database.queryLimits.collectors);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching collectors:', error);
    throw error;
  }
};

// Create a new collector
export const createCollector = async (collectorData) => {
  try {
    const { data, error } = await supabase
      .from('collectors')
      .insert([collectorData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating collector:', error);
    throw error;
  }
};

// Update an existing collector
export const updateCollector = async (collectorData) => {
  try {
    const { id, ...dataToUpdate } = collectorData;
    
    const { data, error } = await supabase
      .from('collectors')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating collector:', error);
    throw error;
  }
};

// Update collector status only
export const updateCollectorStatus = async (id, status) => {
  try {
    const { data, error } = await supabase
      .from('collectors')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating collector status:', error);
    throw error;
  }
};

// Create or update a collector
export const saveCollector = async (collectorData, id = null) => {
  try {
    if (id) {
      // Update existing collector
      const { data, error } = await supabase
        .from('collectors')
        .update(collectorData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new collector
      const { data, error } = await supabase
        .from('collectors')
        .insert([collectorData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error saving collector:', error);
    throw error;
  }
};

/**
 * Logs Management Database Operations
 */

// Fetch logs with filters
export const fetchLogs = async (level = null, source = null, dateRange = null, searchQuery = '') => {
  try {
    let query = supabase
      .from('logs')
      .select('*')
      .limit(appConfig.database.queryLimits.logs)
      .order('timestamp', { ascending: false });
    
    // Apply filters if provided
    if (level) {
      query = query.eq('level', level);
    }
    
    if (source) {
      query = query.eq('source', source);
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      query = query
        .gte('timestamp', dateRange.start)
        .lte('timestamp', dateRange.end);
    }
    
    if (searchQuery) {
      query = query.or(`message.ilike.%${searchQuery}%,user_email.ilike.%${searchQuery}%,details.ilike.%${searchQuery}%`);
    }
    
    // Limit the number of results to prevent loading too many logs
    query = query.limit(appConfig.database.queryLimits.logs);
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};

// Legacy function - keeping for backwards compatibility
export const fetchSystemLogs = async (filters = {}) => {
  return fetchLogs(filters.level, filters.source, filters.dateRange, filters.search);
};

/**
 * Alerts Management Database Operations
 */

// Fetch alerts
export const fetchAlerts = async (status = null) => {
  try {
    let query = supabase
      .from('alerts')
      .select(`
        *,
        user:user_id (id, email, first_name, last_name)
      `)
      .order('created_at', { ascending: false });
    
    if (status && status !== 'All') {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching alerts:', error);
    throw error;
  }
};

// Update alert status
export const updateAlertStatus = async (id, status) => {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating alert status:', error);
    throw error;
  }
};

/**
 * Dashboard Data Operations
 */

// Fetch dashboard statistics
export const fetchDashboardStats = async () => {
  try {
    // This would typically be a stored procedure or multiple queries
    // For simplicity, we'll just fetch summary data from each table
    
    const [
      { count: totalBags, error: bagsError },
      { count: activeBatches, error: batchesError },
      { count: totalCollections, error: collectionsError },
      { count: pendingRequests, error: requestsError },
      { count: activeCollectors, error: collectorsError },
      { count: unresolvedDumping, error: dumpingError }
    ] = await Promise.all([
      supabase.from('bags').select('*', { count: 'exact', head: true }),
      supabase.from('batches').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
      supabase.from('scans').select('*', { count: 'exact', head: true }),
      supabase.from('pickup_requests').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('collectors').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
      supabase.from('illegal_dumping').select('*', { count: 'exact', head: true }).not('status', 'eq', 'Cleaned Up')
    ]);
    
    if (bagsError || batchesError || collectionsError || requestsError || collectorsError || dumpingError) {
      throw new Error('Error fetching dashboard statistics');
    }
    
    return {
      totalBags,
      activeBatches,
      totalCollections,
      pendingRequests,
      activeCollectors,
      unresolvedDumping
    };
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    throw error;
  }
};

// Fetch chart data for the dashboard
export const fetchChartData = async (chartType) => {
  try {
    switch (chartType) {
      case 'collections':
        // Daily collections for the past 7 days
        const { data: collectionsData, error: collectionsError } = await supabase.rpc('get_daily_collections');
        if (collectionsError) throw collectionsError;
        return collectionsData;
        
      case 'waste_distribution':
        // Distribution by waste type
        const { data: wasteData, error: wasteError } = await supabase.rpc('get_waste_distribution');
        if (wasteError) throw wasteError;
        return wasteData;
        
      case 'collector_performance':
        // Collector performance metrics
        const { data: performanceData, error: perfError } = await supabase.rpc('get_collector_performance');
        if (perfError) throw perfError;
        return performanceData;
        
      default:
        throw new Error(`Unknown chart type: ${chartType}`);
    }
  } catch (error) {
    console.error(`Error fetching chart data for ${chartType}:`, error);
    throw error;
  }
};

/**
 * BagHistory Dashboard Statistics
 */

// Fetch bag request statistics for the BagHistory dashboard
export const fetchBagRequestStats = async () => {
  // Always use Supabase data, bypass any dev mode checks
  console.log('fetchBagRequestStats: Forcing use of Supabase data');
  try {
    // Define date ranges for current week and previous week
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    
    const twoWeeksAgo = new Date(oneWeekAgo);
    twoWeeksAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Get start of today for today's change calculation
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    
    // Get active (non-canceled) bag batches from current week
    const { data: currentWeekBags, error: weekError } = await supabase
      .from('batches')
      .select('created_at, quantity, status')
      .gte('created_at', oneWeekAgo.toISOString())
      .not('status', 'eq', 'canceled');
      
    if (weekError) throw weekError;
    
    // Get all active bag batches for total count
    const { data: allBags, error: totalError } = await supabase
      .from('batches')
      .select('id, quantity, status, created_at, distributed, scanned')
      .not('status', 'eq', 'canceled');
      
    if (totalError) throw totalError;
    
    // Get today's bag batches for today's change calculation
    const { data: todayBags, error: todayError } = await supabase
      .from('batches')
      .select('quantity')
      .gte('created_at', startOfToday.toISOString())
      .not('status', 'eq', 'canceled');
    
    if (todayError) throw todayError;
    
    // Get yesterday's bag batches for comparison
    const { data: yesterdayBags, error: yesterdayError } = await supabase
      .from('batches')
      .select('quantity')
      .gte('created_at', startOfYesterday.toISOString())
      .lt('created_at', startOfToday.toISOString())
      .not('status', 'eq', 'canceled');
    
    if (yesterdayError) throw yesterdayError;
    
    // Get previous week's batches for trend comparison
    const { data: prevWeekBags, error: prevError } = await supabase
      .from('batches')
      .select('created_at, quantity, status')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', oneWeekAgo.toISOString())
      .not('status', 'eq', 'canceled');
      
    if (prevError) throw prevError;
    
    // Calculate status breakdowns using batch status and collection data
    const pendingCollection = allBags.reduce((count, batch) => {
      // Pending means created but not yet collected
      const isPending = batch.status === 'pending' || 
                      (batch.status === 'active' && (!batch.scanned || batch.scanned === 0));
      return count + (isPending ? batch.quantity || 0 : 0);
    }, 0);
    
    const collected = allBags.reduce((count, batch) => {
      // Collected means scanned > 0
      return count + (batch.scanned > 0 ? batch.scanned : 0);
    }, 0);
    
    const awaiting = allBags.reduce((count, batch) => {
      // Awaiting means distributed but not scanned
      const isAwaiting = batch.status === 'active' && 
                        batch.distributed > 0 && 
                        (!batch.scanned || batch.distributed > batch.scanned);
      return count + (isAwaiting ? (batch.distributed - (batch.scanned || 0)) : 0);
    }, 0);
    
    // Calculate weekly totals
    const currentWeekTotal = currentWeekBags.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
    const prevWeekTotal = prevWeekBags.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
    const weeklyChange = currentWeekTotal - prevWeekTotal;
    
    // Calculate today's change compared to yesterday
    const todayTotal = todayBags.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
    const yesterdayTotal = yesterdayBags.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
    const todayChange = todayTotal - yesterdayTotal;
    
    // Get daily trend data with proper labeling based on current date
    const dailyTrend = Array(7).fill(0);
    const dayLabels = [];
    
    // Create day labels (Mon, Tue, etc.) in correct order from 6 days ago to today
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      dayLabels.unshift(d.toLocaleDateString('en-US', { weekday: 'short' }));
      
      // Initialize with zero value
      dailyTrend[6-i] = 0;
    }
    
    // Fill in actual values for daily trend
    currentWeekBags.forEach(batch => {
      const batchDate = new Date(batch.created_at);
      // Calculate days ago (0=today, 1=yesterday, etc.)
      const daysAgo = Math.floor((now - batchDate) / (1000 * 60 * 60 * 24));
      
      // Only count if within the past 7 days
      if (daysAgo >= 0 && daysAgo < 7) {
        // Index from right to left (newest=rightmost)
        dailyTrend[6 - daysAgo] += (batch.quantity || 0);
      }
    });
    
    // Calculate most recent bags - bags from the last 24 hours
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(now.getDate() - 1);
    const recentBags = allBags.filter(bag => new Date(bag.created_at) >= oneDayAgo);
    const recentTotal = recentBags.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
    
    return {
      total: allBags.reduce((sum, batch) => sum + (batch.quantity || 0), 0),
      weeklyChange,
      dailyTrend,
      dayLabels,
      recentTotal,
      avgDailyRequests: Math.round(currentWeekTotal / 7),
      // Add specific stats for the UI cards
      pendingCollection,
      collected,
      awaiting,
      todayChange
    };
    
  } catch (error) {
    console.error('Error fetching bag request stats:', error);
    throw error;
  }
};

// Fetch collector statistics for the BagHistory dashboard
export const fetchCollectorStats = async () => {
  // Always use Supabase data, bypass any dev mode checks
  console.log('fetchCollectorStats: Forcing use of Supabase data');
  try {
    // Get collectors with their status and activity information
    const { data: collectors, error: collectorError } = await supabase
      .from('collectors')
      .select('id, status, last_active, region');
      
    if (collectorError) throw collectorError;
    
    // Define active collectors based on status and recent activity
    const now = new Date();
    const activeThreshold = new Date(now);
    activeThreshold.setHours(now.getHours() - 24); // Consider active if active in the last 24 hours
    
    const active = collectors.filter(c => {
      // Check if explicitly marked as active
      if (c.status === 'active') return true;
      
      // Check if they've been active recently regardless of status
      if (c.last_active) {
        const lastActiveDate = new Date(c.last_active);
        if (lastActiveDate > activeThreshold) return true;
      }
      
      return false;
    }).length;
    
    // Get additional collector activity metrics
    const { data: recentActivity, error: activityError } = await supabase
      .from('scans')
      .select('collector_id, created_at')
      .gt('created_at', activeThreshold.toISOString());
    
    if (activityError) throw activityError;
    
    // Count unique active collectors based on recent scans
    const activeCollectorIds = new Set();
    recentActivity.forEach(scan => {
      if (scan.collector_id) {
        activeCollectorIds.add(scan.collector_id);
      }
    });
    
    // Return comprehensive collector stats
    return {
      total: collectors.length,
      active: Math.max(active, activeCollectorIds.size), // Use the higher number from both methods
      inactive: collectors.length - Math.max(active, activeCollectorIds.size),
      lastUpdated: new Date().toISOString(),
      regions: [...new Set(collectors.map(c => c.region).filter(Boolean))].length
    };
    
  } catch (error) {
    console.error('Error fetching collector stats:', error);
    throw error;
  }
};

// Fetch performance statistics for the BagHistory dashboard
export const fetchPerformanceStats = async () => {
  // Always use Supabase data, bypass any dev mode checks
  console.log('fetchPerformanceStats: Forcing use of Supabase data');
  try {
    // Define date ranges for current week/month and previous week/month
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    
    const twoWeeksAgo = new Date(oneWeekAgo);
    twoWeeksAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Use weekly comparison instead of monthly for more responsive feedback
    const useWeekly = true;
    
    // Define start/end dates based on time interval we're using
    const startOfCurrentPeriod = useWeekly ? oneWeekAgo : new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevPeriod = useWeekly ? twoWeeksAgo : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevPeriod = useWeekly ? oneWeekAgo : new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Get scan data from the current period
    const { data: currentPeriodScans, error: currentError } = await supabase
      .from('scans')
      .select('*')
      .gte('scan_timestamp', startOfCurrentPeriod.toISOString());
      
    if (currentError) throw currentError;
    
    // Get scan data from the previous period for comparison
    const { data: prevPeriodScans, error: prevError } = await supabase
      .from('scans')
      .select('*')
      .gte('scan_timestamp', startOfPrevPeriod.toISOString())
      .lt('scan_timestamp', startOfCurrentPeriod.toISOString());
      
    if (prevError) throw prevError;
    
    // Calculate success rate - what percentage of scans were successful?
    const currentSuccessRate = currentPeriodScans.length > 0 ? 
      (currentPeriodScans.filter(scan => scan.scan_status === 'successful').length / currentPeriodScans.length) * 100 : 0;
      
    const prevSuccessRate = prevPeriodScans.length > 0 ? 
      (prevPeriodScans.filter(scan => scan.scan_status === 'successful').length / prevPeriodScans.length) * 100 : 0;
    
    // Calculate average response time - how long it takes on average to scan a bag after it is distributed
    let totalResponseTime = 0;
    let countedScans = 0;
    
    for (const scan of currentPeriodScans) {
      if (scan.distribution_timestamp && scan.scan_timestamp) {
        const distTime = new Date(scan.distribution_timestamp);
        const scanTime = new Date(scan.scan_timestamp);
        const responseTimeMinutes = (scanTime - distTime) / (1000 * 60); // convert ms to minutes
        
        if (responseTimeMinutes > 0) {
          totalResponseTime += responseTimeMinutes;
          countedScans++;
        }
      }
    }
    
    const avgResponseTime = countedScans > 0 ? Math.round(totalResponseTime / countedScans) : 0;
    
    // Calculate average collection time - how long it takes from request to collection
    let totalCollectionTime = 0;
    let collectionTimeCount = 0;
    
    // Get batch data to calculate collection times
    const { data: batchData, error: batchError } = await supabase
      .from('batches')
      .select('created_at, first_collection_date')
      .not('status', 'eq', 'canceled')
      .not('first_collection_date', 'is', null);
      
    if (batchError) throw batchError;
    
    for (const batch of batchData) {
      if (batch.created_at && batch.first_collection_date) {
        const requestTime = new Date(batch.created_at);
        const collectionTime = new Date(batch.first_collection_date);
        const timeToCollectMinutes = (collectionTime - requestTime) / (1000 * 60);
        
        if (timeToCollectMinutes > 0) {
          totalCollectionTime += timeToCollectMinutes;
          collectionTimeCount++;
        }
      }
    }
    
    const avgCollectionTime = collectionTimeCount > 0 ? 
      Math.round(totalCollectionTime / collectionTimeCount) : 0; // Use 0 as default when no data is available
    
    // Calculate completion rate (percentage of bags that were scanned out of total bags distributed)
    const { data: completionData, error: completionError } = await supabase
      .from('batches')
      .select('distributed, scanned')
      .not('status', 'eq', 'canceled');
      
    if (completionError) throw completionError;
    
    const totalDistributed = completionData.reduce((sum, item) => sum + (item.distributed || 0), 0);
    const totalScanned = completionData.reduce((sum, item) => sum + (item.scanned || 0), 0);
    const completionRate = totalDistributed > 0 ? (totalScanned / totalDistributed) * 100 : 0;
    
    // Calculate scan accuracy - directly using the current success rate
    const scanAccuracy = Math.round(currentSuccessRate);
    
    // Calculate overall performance score (weighted average of our metrics)
    const weights = {
      successRate: 0.4,    // 40% weight for scan accuracy
      responseTime: 0.3,   // 30% weight for response time
      completionRate: 0.3  // 30% weight for completion rate
    };
    
    // Convert response time to a score (lower is better, max score at 0 minutes, min score at 60 minutes)
    const responseTimeScore = Math.max(0, 100 - (avgResponseTime * 5/3)); // 60 min -> 0%, 0 min -> 100%
    
    const overallScore = Math.round(
      (scanAccuracy * weights.successRate) +
      (responseTimeScore * weights.responseTime) +
      (completionRate * weights.completionRate)
    );
    
    // Calculate previous period's overall score for comparison
    const prevResponseTimeScore = Math.max(0, 100 - (avgResponseTime * 5/3)); // Using current response time as approximation
    
    const prevOverallScore = Math.round(
      (prevSuccessRate * weights.successRate) +
      (prevResponseTimeScore * weights.responseTime) +
      (completionRate * weights.completionRate) // Using current completion rate as approximation
    );
    
    const changeMetric = overallScore - prevOverallScore;
    
    return {
      overall: overallScore,
      monthlyChange: Math.round(changeMetric),
      changeInterval: useWeekly ? 'week' : 'month',
      responseTime: avgResponseTime,
      collectionTime: avgCollectionTime,
      completionRate: Math.round(completionRate),
      scanAccuracy: scanAccuracy,
    };
    
  } catch (error) {
    console.error('Error fetching performance stats:', error);
    throw error;
  }
};
