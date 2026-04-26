import { supabase } from './supabase';
import { fetchDashboardStats, fetchChartData, fetchBagRequestStatsReal, fetchCollectorStatsReal, fetchPerformanceStatsReal } from './databaseUtils';
import { fetchDashboardChartData } from './realDataUtils';
import { safeDatabaseService } from './safeDatabaseService';

const normalizeKey = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

const formatPctChange = (current, previous) => {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) {
    if (cur === 0) return '0%';
    return 'N/A';
  }
  const pct = ((cur - prev) / prev) * 100;
  const rounded = Math.round(pct);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
};

const safeLatestTimestamp = async (tableName) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(`Trend calc: failed to read latest created_at from ${tableName} (possible RLS):`, error);
      return null;
    }
    return data?.created_at ? new Date(data.created_at) : null;
  } catch (e) {
    console.warn(`Trend calc: error reading latest created_at from ${tableName}:`, e);
    return null;
  }
};

const safeSlaRateInWindow = async ({ startIso, endIso } = {}) => {
  try {
    let completedQuery = supabase
      .from('pickup_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed');

    let onTimeQuery = supabase
      .from('pickup_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .lt('completed_at', 'scheduled_pickup_time');

    if (startIso) {
      completedQuery = completedQuery.gte('created_at', startIso);
      onTimeQuery = onTimeQuery.gte('created_at', startIso);
    }
    if (endIso) {
      completedQuery = completedQuery.lt('created_at', endIso);
      onTimeQuery = onTimeQuery.lt('created_at', endIso);
    }

    const [completedRes, onTimeRes] = await Promise.all([completedQuery, onTimeQuery]);
    if (completedRes.error) {
      console.warn('SLA trend: failed to count completed pickup_requests (possible RLS):', completedRes.error);
      return 0;
    }
    if (onTimeRes.error) {
      console.warn('SLA trend: failed to count on-time pickup_requests (possible RLS):', onTimeRes.error);
      return 0;
    }

    const totalCompleted = completedRes.count || 0;
    const onTimeCompleted = onTimeRes.count || 0;
    if (totalCompleted === 0) return 0;
    return Math.round((onTimeCompleted / totalCompleted) * 100);
  } catch (e) {
    console.warn('SLA trend: error computing SLA rate:', e);
    return 0;
  }
};

const safeCountPendingPickups = async ({ startIso = null, endIso = null } = {}) => {
  try {
    const pendingStatuses = ['pending', 'new', 'requested', 'unassigned'];

    let query = supabase
      .from('pickup_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', pendingStatuses);

    if (startIso) query = query.gte('created_at', startIso);
    if (endIso) query = query.lt('created_at', endIso);

    const { count, error } = await query;
    if (error) {
      console.warn('Pending Requests KPI: failed to count pending pickup_requests (possible RLS):', error);
      return 0;
    }
    return count || 0;
  } catch (e) {
    console.warn('Pending Requests KPI: error counting pending pickup_requests:', e);
    return 0;
  }
};

const safeCountActiveBins = async ({ startIso = null, endIso = null, nowIso } = {}) => {
  try {
    let query = supabase
      .from('digital_bins')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (nowIso) query = query.gt('expires_at', nowIso);
    if (startIso) query = query.gte('created_at', startIso);
    if (endIso) query = query.lt('created_at', endIso);

    const { count, error } = await query;
    if (error) {
      console.warn('Pending Requests KPI: failed to count active digital_bins (possible RLS):', error);
      return 0;
    }
    return count || 0;
  } catch (e) {
    console.warn('Pending Requests KPI: error counting active digital_bins:', e);
    return 0;
  }
};

const safeCountInWindow = async (tableName, startIso, endIso) => {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso);

    if (error) {
      console.warn(`Trend calc: failed to count ${tableName} in window (possible RLS):`, error);
      return 0;
    }
    return count || 0;
  } catch (e) {
    console.warn(`Trend calc: error counting ${tableName} in window:`, e);
    return 0;
  }
};

const mapPickupStatusToBucket = (rawStatus) => {
  const s = normalizeKey(rawStatus);
  if (!s) return null;

  // Completed
  if (s === 'completed' || s === 'complete' || s === 'done') return 'Completed';

  // Cancelled
  if (s === 'cancelled' || s === 'canceled' || s === 'cancel' || s === 'rejected') return 'Cancelled';

  // In progress
  if (
    s === 'in progress' ||
    s === 'in_progress' ||
    s === 'inprogress' ||
    s === 'en route' ||
    s === 'en_route' ||
    s === 'assigned' ||
    s === 'accepted'
  ) {
    return 'In Progress';
  }

  // Pending
  if (s === 'pending' || s === 'new' || s === 'requested' || s === 'unassigned') return 'Pending';

  // Default bucket: treat unknown statuses as Pending so they still show up in the chart.
  // (This avoids the chart appearing empty due to unexpected status strings.)
  return 'Pending';
};

const mapCollectorStatusToBucket = (rawStatus) => {
  const s = normalizeKey(rawStatus);
  if (!s) return null;

  if (s === 'active' || s === 'online' || s === 'working') return 'Active';
  if (s === 'idle' || s === 'available') return 'Idle';
  if (s === 'on break' || s === 'on_break' || s === 'break') return 'On Break';
  if (s === 'off duty' || s === 'off_duty' || s === 'offline' || s === 'inactive') return 'Off Duty';

  return null;
};

/**
 * Fetch all dashboard metrics and stats from Supabase
 * @returns {Promise<Object>} Object containing all dashboard metrics
 */
export const fetchDashboardMetrics = async () => {
  try {
    // First try to get real data from the new real data functions
    try {
      let pickupCount = 0;
      let binCount = 0;
      let totalTrend = '0%';
      let pendingTrend = '0%';
      let slaComplianceTrend = '0%';

      try {
        const [pickupRes, binsRes] = await Promise.all([
          supabase.from('pickup_requests').select('id', { count: 'exact', head: true }),
          supabase.from('digital_bins').select('id', { count: 'exact', head: true })
        ]);

        if (pickupRes.error) {
          console.warn('Total Requests KPI: failed to count pickup_requests (possible RLS):', pickupRes.error);
        } else {
          pickupCount = pickupRes.count || 0;
        }

        if (binsRes.error) {
          console.warn('Total Requests KPI: failed to count digital_bins (possible RLS):', binsRes.error);
        } else {
          binCount = binsRes.count || 0;
        }
      } catch (countError) {
        console.warn('Total Requests KPI: error counting pickup_requests/digital_bins:', countError);
      }

      // Compute week-over-week trend based on latest available data timestamp
      try {
        const [latestPickup, latestBins] = await Promise.all([
          safeLatestTimestamp('pickup_requests'),
          safeLatestTimestamp('digital_bins')
        ]);

        const latest = [latestPickup, latestBins].filter(Boolean).sort((a, b) => b - a)[0] || new Date();
        const end = new Date(latest);
        const start = new Date(end);
        start.setDate(end.getDate() - 7);
        const prevStart = new Date(end);
        prevStart.setDate(end.getDate() - 14);

        const [curPickups, curBins, prevPickups, prevBins] = await Promise.all([
          safeCountInWindow('pickup_requests', start.toISOString(), end.toISOString()),
          safeCountInWindow('digital_bins', start.toISOString(), end.toISOString()),
          safeCountInWindow('pickup_requests', prevStart.toISOString(), start.toISOString()),
          safeCountInWindow('digital_bins', prevStart.toISOString(), start.toISOString()),
        ]);

        const curTotal = curPickups + curBins;
        const prevTotal = prevPickups + prevBins;
        totalTrend = formatPctChange(curTotal, prevTotal);

        const nowIso = new Date(end).toISOString();
        const [curPendingPickups, curActiveBins, prevPendingPickups, prevActiveBins] = await Promise.all([
          safeCountPendingPickups({ startIso: start.toISOString(), endIso: end.toISOString() }),
          safeCountActiveBins({ startIso: start.toISOString(), endIso: end.toISOString(), nowIso }),
          safeCountPendingPickups({ startIso: prevStart.toISOString(), endIso: start.toISOString() }),
          safeCountActiveBins({ startIso: prevStart.toISOString(), endIso: start.toISOString(), nowIso }),
        ]);

        const curPendingTotal = curPendingPickups + curActiveBins;
        const prevPendingTotal = prevPendingPickups + prevActiveBins;
        pendingTrend = formatPctChange(curPendingTotal, prevPendingTotal);

        const [curSlaRate, prevSlaRate] = await Promise.all([
          safeSlaRateInWindow({ startIso: start.toISOString(), endIso: end.toISOString() }),
          safeSlaRateInWindow({ startIso: prevStart.toISOString(), endIso: start.toISOString() })
        ]);
        slaComplianceTrend = formatPctChange(curSlaRate, prevSlaRate);
      } catch (trendError) {
        console.warn('Total Requests KPI: trend calculation failed:', trendError);
      }

      const collectorStats = await fetchCollectorStatsReal();
      const performanceStats = await fetchPerformanceStatsReal();
      
      // Calculate metrics from real data
      const totalRequests = pickupCount + binCount;
      const nowIso = new Date().toISOString();
      const [pendingPickups, activeBins] = await Promise.all([
        safeCountPendingPickups(),
        safeCountActiveBins({ nowIso })
      ]);
      const pendingRequests = pendingPickups + activeBins;
      const activeCollectors = collectorStats.active || 0;
      const slaCompliance = performanceStats.on_time_rate || 85;
      
      // Calculate active collector percentage
      const activeCollectorPercent = collectorStats.total > 0 ? 
        Math.round((collectorStats.active / collectorStats.total) * 100) : 0;
      
      return {
        totalRequests,
        pendingRequests,
        activeCollectors,
        slaCompliance,
        totalTrend,
        pendingTrend,
        slaComplianceTrend,
        activeCollectorPercent
      };
    } catch (realDataError) {
      console.log('Real data fetch failed, falling back to safe database service:', realDataError);
    }
    
    // Fallback to safe database service for basic stats
    const { data: basicStats, fromFallback } = await safeDatabaseService.getSafeDashboardStats();
    
    if (fromFallback) {
      console.warn('Using fallback data for dashboard metrics');
      let slaComplianceTrend = '0%';
      try {
        const latestPickup = await safeLatestTimestamp('pickup_requests');
        const latest = latestPickup || new Date();
        const end = new Date(latest);
        const start = new Date(end);
        start.setDate(end.getDate() - 7);
        const prevStart = new Date(end);
        prevStart.setDate(end.getDate() - 14);

        const [curSlaRate, prevSlaRate] = await Promise.all([
          safeSlaRateInWindow({ startIso: start.toISOString(), endIso: end.toISOString() }),
          safeSlaRateInWindow({ startIso: prevStart.toISOString(), endIso: start.toISOString() })
        ]);
        slaComplianceTrend = formatPctChange(curSlaRate, prevSlaRate);
      } catch (e) {
        console.warn('SLA trend: fallback trend calculation failed:', e);
      }
      return {
        totalRequests: (basicStats && basicStats.totalPickups) || 0,
        pendingRequests: (basicStats && basicStats.pendingRequests) || 0,
        activeCollectors: (basicStats && basicStats.activeCollectors) || 0,
        slaCompliance: 85,
        totalTrend: '+5%',
        pendingTrend: '-2%',
        slaComplianceTrend,
        activeCollectorPercent: 75
      };
    }
    
    // Calculate additional metrics (with null safety)
    const totalRequests = (basicStats && basicStats.totalBags) || 0;
    const pendingRequests = (basicStats && basicStats.pendingRequests) || 0;
    const activeCollectors = (basicStats && basicStats.activeCollectors) || 0;
    
    // Calculate SLA compliance
    const { data: slaData, error: slaError } = await supabase
      .from('pickup_requests')
      .select('*')
      .lt('completed_at', 'scheduled_pickup_time')
      .not('status', 'eq', 'cancelled');
    
    const { data: allCompletedRequests, error: completedError } = await supabase
      .from('pickup_requests')
      .select('*')
      .eq('status', 'completed');
    
    if (slaError || completedError) {
      console.error('Error calculating SLA compliance:', slaError || completedError);
      throw new Error('Error calculating SLA compliance');
    }
    
    const slaCount = slaData?.length || 0;
    const totalCompleted = allCompletedRequests?.length || 0;
    const slaCompliance = totalCompleted > 0 ? Math.round((slaCount / totalCompleted) * 100) : 0;
    
    // Calculate trends (comparing to previous period)
    const totalTrend = await calculateTrend('pickup_requests', 'created_at');
    const pendingTrend = await calculateTrend('pickup_requests', 'created_at', 'status', 'Pending');
    let slaComplianceTrend = '0%';
    try {
      const latestPickup = await safeLatestTimestamp('pickup_requests');
      const latest = latestPickup || new Date();
      const end = new Date(latest);
      const start = new Date(end);
      start.setDate(end.getDate() - 7);
      const prevStart = new Date(end);
      prevStart.setDate(end.getDate() - 14);

      const [curSlaRate, prevSlaRate] = await Promise.all([
        safeSlaRateInWindow({ startIso: start.toISOString(), endIso: end.toISOString() }),
        safeSlaRateInWindow({ startIso: prevStart.toISOString(), endIso: start.toISOString() })
      ]);
      slaComplianceTrend = formatPctChange(curSlaRate, prevSlaRate);
    } catch (e) {
      console.warn('SLA trend: calculation failed:', e);
    }
    
    // Fetch active collector percentage
    const { count: totalCollectors, error: totalCollectorsError } = await supabase
      .from('collector_profiles')
      .select('*', { count: 'exact', head: true });
      
    if (totalCollectorsError) {
      throw totalCollectorsError;
    }
    
    const activeCollectorPercent = totalCollectors > 0 ? 
      Math.round((activeCollectors / totalCollectors) * 100) : 0;
    
    return {
      totalRequests,
      pendingRequests,
      activeCollectors,
      slaCompliance,
      totalTrend,
      pendingTrend,
      slaComplianceTrend,
      activeCollectorPercent
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    throw error;
  }
};

export const fetchPickupVsBinsPieData = async () => {
  try {
    const [pickupRes, binsRes] = await Promise.all([
      supabase.from('pickup_requests').select('id', { count: 'exact', head: true }),
      supabase.from('digital_bins').select('id', { count: 'exact', head: true })
    ]);

    if (pickupRes.error) throw pickupRes.error;
    if (binsRes.error) throw binsRes.error;

    const pickupCount = pickupRes.count || 0;
    const binsCount = binsRes.count || 0;

    return {
      labels: ['Pickup Requests', 'Digital Bins'],
      datasets: [{
        data: [pickupCount, binsCount],
        backgroundColor: ['#2196F3', '#10b981'],
        borderWidth: 1,
      }]
    };
  } catch (error) {
    console.warn('Error fetching pickup vs bins pie data:', error);
    return {
      labels: ['Pickup Requests', 'Digital Bins'],
      datasets: [{
        data: [0, 0],
        backgroundColor: ['#2196F3', '#10b981'],
        borderWidth: 1,
      }]
    };
  }
};

export const fetchDigitalBinsBreakdownBarData = async () => {
  try {
    const nowIso = new Date().toISOString();

    const [activeRes, inactiveRes, expiredRes] = await Promise.all([
      supabase
        .from('digital_bins')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .gt('expires_at', nowIso),
      supabase
        .from('digital_bins')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', false)
        .gt('expires_at', nowIso),
      supabase
        .from('digital_bins')
        .select('id', { count: 'exact', head: true })
        .lte('expires_at', nowIso)
    ]);

    if (activeRes.error) throw activeRes.error;
    if (inactiveRes.error) throw inactiveRes.error;
    if (expiredRes.error) throw expiredRes.error;

    return {
      labels: ['Active', 'Inactive', 'Expired'],
      datasets: [{
        label: 'Digital Bins',
        data: [activeRes.count || 0, inactiveRes.count || 0, expiredRes.count || 0],
        backgroundColor: ['#10b981', '#9E9E9E', '#FF5722'],
        borderWidth: 1,
      }]
    };
  } catch (error) {
    console.warn('Error fetching digital bins breakdown data:', error);
    return {
      labels: ['Active', 'Inactive', 'Expired'],
      datasets: [{
        label: 'Digital Bins',
        data: [0, 0, 0],
        backgroundColor: ['#10b981', '#9E9E9E', '#FF5722'],
        borderWidth: 1,
      }]
    };
  }
};

export const fetchDumpingReportsChartData = async () => {
  try {
    const tableExists = await safeDatabaseService.checkTableExists('illegal_dumping_mobile');
    if (!tableExists) {
      console.warn('Table illegal_dumping_mobile does not exist. Dumping Reports will be empty.');
      return {
        labels: Array.from({ length: 30 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - i));
          return d.toISOString().slice(0, 10);
        }),
        datasets: [{
          label: 'Reports',
          data: Array(30).fill(0),
          backgroundColor: '#FF5722',
          borderColor: '#E64A19',
          borderWidth: 1,
        }]
      };
    }

    // Support different timestamp column names.
    // Prefer reported_at if present, else fall back to created_at.
    let timeColumn = 'reported_at';
    let latest = null;

    try {
      const { data, error } = await supabase
        .from('illegal_dumping_mobile')
        .select(timeColumn)
        .order(timeColumn, { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      latest = data?.[timeColumn] ? new Date(data[timeColumn]) : null;
    } catch (e) {
      timeColumn = 'created_at';
      try {
        const { data, error } = await supabase
          .from('illegal_dumping_mobile')
          .select(timeColumn)
          .order(timeColumn, { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        latest = data?.[timeColumn] ? new Date(data[timeColumn]) : null;
      } catch (fallbackError) {
        console.warn('Dumping Reports: unable to determine timestamp column (possible RLS):', fallbackError);
        latest = null;
      }
    }

    const end = latest || new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('illegal_dumping_mobile')
      .select(timeColumn)
      .gte(timeColumn, start.toISOString())
      .lte(timeColumn, end.toISOString());

    if (error) {
      console.warn('Error fetching dumping reports data:', error);
      return {
        labels: Array.from({ length: 30 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - i));
          return d.toISOString().slice(0, 10);
        }),
        datasets: [{
          label: 'Reports',
          data: Array(30).fill(0),
          backgroundColor: '#FF5722',
          borderColor: '#E64A19',
          borderWidth: 1,
        }]
      };
    }

    // Build labels for the last 30 days (oldest -> newest)
    const days = [];
    const counts = Array(30).fill(0);
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({
        key: d.toDateString(),
        label: d.toISOString().slice(0, 10),
      });
    }

    (data || []).forEach(row => {
      const d = new Date(row[timeColumn]);
      const key = d.toDateString();
      const idx = days.findIndex(x => x.key === key);
      if (idx >= 0) counts[idx] += 1;
    });

    return {
      labels: days.map(d => d.label),
      datasets: [{
        label: 'Reports',
        data: counts,
        backgroundColor: '#FF5722',
        borderColor: '#E64A19',
        borderWidth: 1,
      }]
    };
  } catch (error) {
    console.error('Error fetching dumping reports chart data:', error);
    return {
      labels: Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return d.toISOString().slice(0, 10);
      }),
      datasets: [{
        label: 'Reports',
        data: Array(30).fill(0),
        backgroundColor: '#FF5722',
        borderColor: '#E64A19',
        borderWidth: 1,
      }]
    };
  }
};

/**
 * Fetch data for pickup status chart (Completed, In Progress, Pending, Cancelled)
 * @returns {Promise<Object>} Chart data object
 */
export const fetchPickupStatusChartData = async () => {
  try {
    const { data, error } = await supabase
      .from('pickup_requests')
      .select('status')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.warn('Error fetching pickup status data:', error);
      return generateMockPickupStatusData();
    }

    if ((data || []).length === 0) {
      console.warn(
        'Pickup status chart: pickup_requests returned 0 rows. ' +
          'If you expect data, this is usually Row Level Security (RLS) blocking SELECT for the current user/session, ' +
          'or you are connected to a different Supabase project/environment.'
      );
    }
    
    // Count requests by normalized status bucket
    const statusCounts = {
      Completed: 0,
      'In Progress': 0,
      Pending: 0,
      Cancelled: 0
    };

    let unmatched = 0;
    (data || []).forEach(request => {
      const bucket = mapPickupStatusToBucket(request?.status);
      if (bucket && statusCounts.hasOwnProperty(bucket)) {
        statusCounts[bucket]++;
      } else {
        unmatched++;
      }
    });

    if ((data || []).length > 0 && Object.values(statusCounts).every(v => v === 0)) {
      console.warn(
        'Pickup status chart: received rows but none matched known status buckets. ' +
          'This is usually a status mapping mismatch or unexpected status values.',
        { sampleStatuses: (data || []).slice(0, 10).map(r => r?.status) }
      );
    }

    return {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          '#4CAF50', '#2196F3', '#FFC107', '#dc3545'
        ],
        borderWidth: 1,
      }]
    };
  } catch (error) {
    console.error('Error fetching pickup status chart data:', error);
    return generateMockPickupStatusData();
  }
};

/**
 * Fetch data for collector activity chart (Active, Idle, On Break, Off Duty)
 * @returns {Promise<Object>} Chart data object
 */
export const fetchCollectorActivityChartData = async () => {
  try {
    // Fetch collectors
    const { data, error } = await supabase
      .from('collector_profiles')
      .select('status');
    
    if (error) {
      console.warn('Error fetching collector activity data:', error);
      return generateMockCollectorActivityData();
    }

    if ((data || []).length === 0) {
      console.warn(
        'Collector activity chart: collector_profiles returned 0 rows. ' +
          'If you expect data, this is usually Row Level Security (RLS) blocking SELECT for the current user/session.'
      );
    }
    
    // Count collectors by normalized status bucket
    const statusCounts = {
      Active: 0,
      Idle: 0,
      'On Break': 0,
      'Off Duty': 0
    };

    (data || []).forEach(collector => {
      const bucket = mapCollectorStatusToBucket(collector?.status);
      if (bucket && statusCounts.hasOwnProperty(bucket)) {
        statusCounts[bucket]++;
      }
    });

    if ((data || []).length > 0 && Object.values(statusCounts).every(v => v === 0)) {
      console.warn(
        'Collector activity chart: received rows but none matched known status buckets. ' +
          'This is usually a status mapping mismatch or unexpected status values.',
        { sampleStatuses: (data || []).slice(0, 10).map(r => r?.status) }
      );
    }

    return {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          '#4CAF50',
          '#FFC107',
          '#2196F3',
          '#9E9E9E'
        ],
        borderWidth: 1,
      }]
    };
  } catch (error) {
    console.error('Error fetching collector activity chart data:', error);
    return {
      labels: [],
      datasets: []
    };
  }
};

/**
 * Fetch data for waste distribution chart (Recyclable, Organic, Hazardous, Electronic, Other)
 * @returns {Promise<Object>} Chart data object
 */
export const fetchWasteDistributionChartData = async () => {
  try {
    // Try to get real data from real data utils
    try {
      const chartData = await fetchDashboardChartData('wasteDistribution');
      if (chartData && chartData.labels && chartData.datasets) {
        return chartData;
      }
    } catch (realDataError) {
      console.log('Real data fetch failed for waste distribution chart:', realDataError);
    }
    
    // Fallback to direct Supabase query
    const tableExists = await safeDatabaseService.checkTableExists('waste_items');
    if (!tableExists) {
      console.warn('Table waste_items does not exist. Using mock data.');
      return generateMockWasteDistributionData();
    }
    
    const { data, error } = await supabase
      .from('waste_items')
      .select('type, weight');
    
    if (error) {
      // Handle specific table not found errors
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Table waste_items does not exist. Using mock data.');
        return generateMockWasteDistributionData();
      }
      throw error;
    }
    
    // Aggregate by waste type
    const wasteTypes = {
      Recyclable: 0,
      Organic: 0,
      Hazardous: 0,
      Electronic: 0,
      Other: 0
    };
    
    data.forEach(item => {
      if (wasteTypes.hasOwnProperty(item.type)) {
        wasteTypes[item.type] += (item.weight || 1); // Use weight if available
      } else {
        wasteTypes.Other += (item.weight || 1);
      }
    });
    
    return {
      labels: Object.keys(wasteTypes),
      datasets: [{
        label: 'Waste Distribution',
        data: Object.values(wasteTypes),
        backgroundColor: [
          'rgba(76, 175, 80, 0.7)', // green for recyclable
          'rgba(255, 193, 7, 0.7)', // yellow for organic
          'rgba(220, 53, 69, 0.7)', // red for hazardous
          'rgba(33, 150, 243, 0.7)', // blue for electronic
          'rgba(158, 158, 158, 0.7)', // grey for other
        ],
        borderColor: [
          '#4CAF50', '#FFC107', '#dc3545', '#2196F3', '#9E9E9E'
        ],
        borderWidth: 1,
      }]
    };
  } catch (error) {
    console.error('Error fetching waste distribution chart data:', error);
    return {
      labels: ['Recyclable', 'Organic', 'Hazardous', 'Electronic', 'Other'],
      datasets: [{
        label: 'Waste Distribution',
        data: [0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(76, 175, 80, 0.7)', 'rgba(255, 193, 7, 0.7)', 
          'rgba(220, 53, 69, 0.7)', 'rgba(33, 150, 243, 0.7)', 
          'rgba(158, 158, 158, 0.7)'
        ],
        borderColor: [
          '#4CAF50', '#FFC107', '#dc3545', '#2196F3', '#9E9E9E'
        ],
        borderWidth: 1,
      }]
    };
  }
};

/**
 * Fetch data for bag utilization trend chart
 * @returns {Promise<Object>} Chart data object
 */
export const fetchBagUtilizationTrendData = async () => {
  try {
    // Try to get real data from real data utils
    try {
      const chartData = await fetchDashboardChartData('bagUtilization');
      if (chartData && chartData.labels && chartData.datasets) {
        return chartData;
      }
    } catch (realDataError) {
      console.log('Real data fetch failed for bag utilization chart:', realDataError);
    }
    
    // Fallback to direct Supabase query
    // Check if tables exist
    const batchesExists = await safeDatabaseService.checkTableExists('batches');
    const scansExists = await safeDatabaseService.checkTableExists('scans');
    
    if (!batchesExists || !scansExists) {
      console.warn('Required tables (batches/scans) do not exist. Using mock data.');
      return generateMockBagUtilizationData();
    }
    
    // Get last 6 weeks of data
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 6 * 7);
    
    // Distributed bags (from batches)
    const { data: distributedData, error: distributedError } = await supabase
      .from('batches')
      .select('updated_at, bag_count')
      .gte('updated_at', sixWeeksAgo.toISOString());
    
    // Collected bags (from scans)
    const { data: collectedData, error: collectedError } = await supabase
      .from('scans')
      .select('created_at')
      .gte('created_at', sixWeeksAgo.toISOString());
    
    if (distributedError) {
      console.warn('Error fetching distributed bags data:', distributedError);
      return generateMockBagUtilizationData();
    }
    if (collectedError) {
      console.warn('Error fetching collected bags data:', collectedError);
      return generateMockBagUtilizationData();
    }
    
    // Group by week
    const weeks = [];
    for (let i = 0; i < 6; i++) {
      weeks.push(`Week ${i + 1}`);
    }
    
    // Process distributed bags
    const distributedByWeek = Array(6).fill(0);
    distributedData.forEach(item => {
      const weekIndex = getWeekIndex(new Date(item.updated_at), sixWeeksAgo);
      if (weekIndex >= 0 && weekIndex < 6) {
        distributedByWeek[weekIndex] += (item.bag_count || 0);
      }
    });
    
    // Process collected bags
    const collectedByWeek = Array(6).fill(0);
    collectedData.forEach(item => {
      const weekIndex = getWeekIndex(new Date(item.created_at), sixWeeksAgo);
      if (weekIndex >= 0 && weekIndex < 6) {
        collectedByWeek[weekIndex]++;
      }
    });
    
    return {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
      datasets: [
        {
          label: 'Bags Distributed',
          data: distributedByWeek,
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.2)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Bags Collected',
          data: collectedByWeek,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          tension: 0.3,
          fill: true,
        }
      ]
    };
  } catch (error) {
    console.error('Error fetching bag utilization data:', error);
    return generateMockBagUtilizationData();
  }
};

/**
 * Fetch alerts for dashboard activity feed
 * @param {number} limit Maximum number of alerts to return
 * @returns {Promise<Array>} Array of alert objects
 */
export const fetchDashboardAlerts = async (limit = 5) => {
  try {
    const { data, fromFallback } = await safeDatabaseService.getSafeAlerts(limit);
    
    if (fromFallback) {
      console.warn('Using mock alerts data');
    }
    
    return (data || []).map(alert => {
      const creator = alert.creator ? 
        `${alert.creator.first_name} ${alert.creator.last_name}` : 'System';

      const severityKey = normalizeKey(alert.severity);
      const typeKey = normalizeKey(alert.type);
      const title = alert.title || 'System Alert';
      const description = alert.message || alert.description || '';

      // Map DB severity/type into the dashboard UI buckets used for icon/colors.
      let feedType = 'info';
      if (severityKey === 'critical' || severityKey === 'high' || typeKey === 'critical') feedType = 'critical';
      else if (severityKey === 'warning' || severityKey === 'medium' || typeKey === 'warning') feedType = 'warning';
      else if (severityKey === 'success' || typeKey === 'success') feedType = 'success';
      else if (typeKey === 'new') feedType = 'new';
      else if (typeKey === 'report') feedType = 'report';
      
      return {
        id: alert.id,
        title,
        description,
        type: feedType,
        created_at: formatAlertTime(alert.created_at),
        creator,
        read: alert.read || false,
        entity_id: alert.entity_id,
        entity_type: alert.entity_type
      };
    });
  } catch (error) {
    console.error('Error fetching dashboard alerts:', error);
    return [];
  }
};

/**
 * Subscribe to real-time dashboard updates
 * @param {Function} callback Function to call when data changes
 * @returns {Object} Subscription that can be unsubscribed
 */
export const subscribeToDashboardUpdates = (callback) => {
  try {
    let pickupSubscription, collectorsSubscription, alertsSubscription;
    
    // Use safe subscriptions that fallback gracefully
    Promise.all([
      safeDatabaseService.safeSubscription('pickup_requests', {
        callback: handleDataChange
      }, () => console.log('Pickup requests polling fallback')),
      safeDatabaseService.safeSubscription('collector_profiles', {
        callback: handleDataChange  
      }, () => console.log('Collector profiles polling fallback')),
      safeDatabaseService.safeSubscription('alerts', {
        callback: handleDataChange
      }, () => console.log('Alerts polling fallback'))
    ]).then(([pickup, collectors, alerts]) => {
      pickupSubscription = pickup;
      collectorsSubscription = collectors;
      alertsSubscription = alerts;
    }).catch(error => {
      console.warn('Dashboard subscriptions using polling fallback:', error);
    });
      
    // Handle data changes by calling the callback
    async function handleDataChange() {
      try {
        // Fetch fresh data and pass it to the callback
        const dashboardData = await Promise.all([
          fetchDashboardMetrics(),
          fetchPickupStatusChartData(),
          fetchCollectorActivityChartData(),
          fetchWasteDistributionChartData(),
          fetchBagUtilizationTrendData(),
          fetchDashboardAlerts()
        ]);
        
        callback({
          metrics: dashboardData[0],
          pickupStatusData: dashboardData[1],
          collectorActivityData: dashboardData[2],
          wasteDistributionData: dashboardData[3],
          bagUtilizationData: dashboardData[4],
          alerts: dashboardData[5]
        });
      } catch (err) {
        console.error('Error handling dashboard data change:', err);
      }
    }
    
    // Return an object with an unsubscribe function that cleans up all subscriptions
    return {
      unsubscribe: () => {
        try {
          if (pickupSubscription && typeof pickupSubscription.unsubscribe === 'function') {
            pickupSubscription.unsubscribe();
          } else if (typeof pickupSubscription === 'number') {
            clearInterval(pickupSubscription); // For polling fallback
          }
          
          if (collectorsSubscription && typeof collectorsSubscription.unsubscribe === 'function') {
            collectorsSubscription.unsubscribe();
          } else if (typeof collectorsSubscription === 'number') {
            clearInterval(collectorsSubscription);
          }
          
          if (alertsSubscription && typeof alertsSubscription.unsubscribe === 'function') {
            alertsSubscription.unsubscribe();
          } else if (typeof alertsSubscription === 'number') {
            clearInterval(alertsSubscription);
          }
        } catch (error) {
          console.warn('Error during dashboard subscription cleanup:', error);
        }
      }
    };
  } catch (error) {
    console.error('Error setting up dashboard subscriptions:', error);
    return {
      unsubscribe: () => {}
    };
  }
};

// Helper Functions

/**
 * Calculate trend percentage comparing current period to previous period
 * @param {string} table Table to query
 * @param {string} dateField Date field to use for comparison
 * @param {string} filterField Optional field to filter by
 * @param {string} filterValue Optional value for filter
 * @returns {string} Trend percentage with +/- prefix
 */
async function calculateTrend(table, dateField, filterField = null, filterValue = null) {
  try {
    // Current period is last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    
    // Previous period is 7 days before that
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);
    
    // Build queries
    let currentQuery = supabase
      .from(table)
      .select('*', { count: 'exact' })
      .gte(dateField, sevenDaysAgo.toISOString())
      .lt(dateField, now.toISOString());
      
    let previousQuery = supabase
      .from(table)
      .select('*', { count: 'exact' })
      .gte(dateField, fourteenDaysAgo.toISOString())
      .lt(dateField, sevenDaysAgo.toISOString());
    
    // Add filter if specified
    if (filterField && filterValue) {
      currentQuery = currentQuery.eq(filterField, filterValue);
      previousQuery = previousQuery.eq(filterField, filterValue);
    }
    
    // Run queries in parallel
    const [currentResult, previousResult] = await Promise.all([
      currentQuery,
      previousQuery
    ]);
    
    const currentCount = currentResult.count || 0;
    const previousCount = previousResult.count || 0;
    
    // Calculate percentage change
    let percentChange = 0;
    if (previousCount > 0) {
      percentChange = Math.round(((currentCount - previousCount) / previousCount) * 100);
    } else if (currentCount > 0) {
      percentChange = 100; // If previous was 0 and current is positive, that's a 100% increase
    }
    
    // Format with + or - prefix
    return (percentChange >= 0 ? '+' : '') + percentChange + '%';
  } catch (error) {
    console.error('Error calculating trend:', error);
    return '0%';
  }
}

/**
 * Format alert time to relative time (e.g., "5 mins ago")
 * @param {string} dateString ISO date string
 * @returns {string} Formatted relative time
 */
function formatAlertTime(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 0.17) { // 10 minutes
      return 'Just now';
    } else if (diffInHours < 1) {
      return `${Math.round(diffInHours * 60)} min ago`;
    } else if (diffInHours < 24) {
      return `${Math.round(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return `${Math.round(diffInHours / 24)} days ago`;
    }
  } catch (error) {
    console.error('Error formatting alert time:', error);
    return dateString;
  }
}

/**
 * Get the week index from a date
 * @param {Date} date Date to check
 * @param {Date} startDate Starting date for week 0
 * @returns {number} Week index
 */
function getWeekIndex(date, startDate) {
  const diffInDays = (date - startDate) / (1000 * 60 * 60 * 24);
  return Math.floor(diffInDays / 7);
}

/**
 * Generate mock waste distribution data when table doesn't exist
 * @returns {Object} Mock chart data object
 */
export const generateMockWasteDistributionData = () => {
  return {
    labels: ['Recyclable', 'Organic', 'Hazardous', 'Electronic', 'Other'],
    datasets: [{
      label: 'Waste Distribution',
      data: [45, 30, 10, 10, 5], // Mock percentages
      backgroundColor: [
        'rgba(76, 175, 80, 0.7)', // green for recyclable
        'rgba(255, 193, 7, 0.7)', // yellow for organic
        'rgba(220, 53, 69, 0.7)', // red for hazardous
        'rgba(33, 150, 243, 0.7)', // blue for electronic
        'rgba(158, 158, 158, 0.7)', // grey for other
      ],
      borderColor: [
        '#4CAF50', '#FFC107', '#dc3545', '#2196F3', '#9E9E9E'
      ],
      borderWidth: 1,
    }]
  };
};

/**
 * Generate mock bag utilization trend data when tables don't exist
 * @returns {Object} Mock chart data object
 */
export const generateMockBagUtilizationData = () => {
  return {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
    datasets: [
      {
        label: 'Bags Distributed',
        data: [150, 180, 220, 200, 160, 190], // Mock data
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Bags Collected',
        data: [120, 140, 180, 170, 130, 150], // Mock data
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        tension: 0.3,
        fill: true,
      }
    ]
  };
};

/**
 * Generate mock pickup status data when table doesn't exist
 * @returns {Object} Mock chart data object
 */
export const generateMockPickupStatusData = () => {
  return {
    labels: ['Completed', 'In Progress', 'Pending', 'Cancelled'],
    datasets: [{
      data: [45, 20, 30, 5], // Mock data
      backgroundColor: [
        '#4CAF50', '#2196F3', '#FFC107', '#dc3545'
      ],
      borderWidth: 1,
    }]
  };
};

/**
 * Generate mock collector activity data when table doesn't exist
 * @returns {Object} Mock chart data object
 */
export const generateMockCollectorActivityData = () => {
  return {
    labels: ['Active', 'Idle', 'On Break', 'Off Duty'],
    datasets: [{
      data: [12, 8, 3, 7], // Mock data
      backgroundColor: [
        '#4CAF50', '#FFC107', '#2196F3', '#9E9E9E'
      ],
      borderWidth: 1,
    }]
  };
};
