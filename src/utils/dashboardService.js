import { supabase } from './supabase';
import { fetchDashboardStats, fetchChartData } from './databaseUtils';

/**
 * Fetch all dashboard metrics and stats from Supabase
 * @returns {Promise<Object>} Object containing all dashboard metrics
 */
export const fetchDashboardMetrics = async () => {
  try {
    // Get basic dashboard statistics
    const basicStats = await fetchDashboardStats();
    
    // Calculate additional metrics
    const totalRequests = basicStats.totalBags || 0;
    const pendingRequests = basicStats.pendingRequests || 0;
    const activeCollectors = basicStats.activeCollectors || 0;
    
    // Calculate SLA compliance
    const { data: slaData, error: slaError } = await supabase
      .from('pickup_requests')
      .select('*')
      .lt('completed_at', 'scheduled_pickup_time')
      .not('status', 'eq', 'Cancelled');
    
    const { data: allCompletedRequests, error: completedError } = await supabase
      .from('pickup_requests')
      .select('*')
      .eq('status', 'Completed');
    
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
    const slaComplianceTrend = '+3%'; // This would require more complex calculations
    
    // Fetch active collector percentage
    const { count: totalCollectors, error: totalCollectorsError } = await supabase
      .from('collectors')
      .select('*', { count: 'exact', head: true });
      
    if (totalCollectorsError) {
      throw new Error('Error fetching total collectors count');
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
    
    if (error) throw error;
    
    // Count requests by status
    const statusCounts = {
      Completed: 0,
      'In Progress': 0,
      Pending: 0,
      Cancelled: 0
    };
    
    data.forEach(request => {
      if (statusCounts.hasOwnProperty(request.status)) {
        statusCounts[request.status]++;
      }
    });
    
    return {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          '#4CAF50', // green for completed
          '#2196F3', // blue for in progress
          '#FFC107', // yellow for pending
          '#dc3545', // red for cancelled
        ],
        borderWidth: 1,
      }]
    };
  } catch (error) {
    console.error('Error fetching pickup status chart data:', error);
    return {
      labels: ['Completed', 'In Progress', 'Pending', 'Cancelled'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: [
          '#4CAF50', '#2196F3', '#FFC107', '#dc3545'
        ],
        borderWidth: 1,
      }]
    };
  }
};

/**
 * Fetch data for collector activity chart (Active, Idle, On Break, Off Duty)
 * @returns {Promise<Object>} Chart data object
 */
export const fetchCollectorActivityChartData = async () => {
  try {
    const { data, error } = await supabase
      .from('collectors')
      .select('status');
    
    if (error) throw error;
    
    // Count collectors by status
    const statusCounts = {
      Active: 0,
      Idle: 0,
      'On Break': 0,
      'Off Duty': 0
    };
    
    data.forEach(collector => {
      if (statusCounts.hasOwnProperty(collector.status)) {
        statusCounts[collector.status]++;
      }
    });
    
    return {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          '#4CAF50', // green for active
          '#FFC107', // yellow for idle
          '#2196F3', // blue for on break
          '#9E9E9E', // grey for off duty
        ],
        borderWidth: 1,
      }]
    };
  } catch (error) {
    console.error('Error fetching collector activity chart data:', error);
    return {
      labels: ['Active', 'Idle', 'On Break', 'Off Duty'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: [
          '#4CAF50', '#FFC107', '#2196F3', '#9E9E9E'
        ],
        borderWidth: 1,
      }]
    };
  }
};

/**
 * Fetch data for waste distribution chart (Recyclable, Organic, Hazardous, Electronic, Other)
 * @returns {Promise<Object>} Chart data object
 */
export const fetchWasteDistributionChartData = async () => {
  try {
    // In a real implementation, this would use a specialized endpoint or stored procedure
    // For now, we'll simulate with a query to the pickups or waste_items table
    
    const { data, error } = await supabase
      .from('waste_items')
      .select('type, weight');
    
    if (error) throw error;
    
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
    // Get last 6 weeks of data
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 6 * 7);
    
    // Distributed bags (from batches)
    const { data: distributedData, error: distributedError } = await supabase
      .from('batches')
      .select('created_at, quantity')
      .gte('created_at', sixWeeksAgo.toISOString());
    
    // Collected bags (from scans)
    const { data: collectedData, error: collectedError } = await supabase
      .from('scans')
      .select('scanned_at')
      .gte('scanned_at', sixWeeksAgo.toISOString());
    
    if (distributedError || collectedError) {
      throw new Error('Error fetching bag utilization data');
    }
    
    // Group by week
    const weeks = [];
    for (let i = 0; i < 6; i++) {
      weeks.push(`Week ${i + 1}`);
    }
    
    // Process distributed bags
    const distributedByWeek = Array(6).fill(0);
    distributedData.forEach(item => {
      const weekIndex = getWeekIndex(new Date(item.created_at), sixWeeksAgo);
      if (weekIndex >= 0 && weekIndex < 6) {
        distributedByWeek[weekIndex] += (item.quantity || 0);
      }
    });
    
    // Process collected bags
    const collectedByWeek = Array(6).fill(0);
    collectedData.forEach(item => {
      const weekIndex = getWeekIndex(new Date(item.scanned_at), sixWeeksAgo);
      if (weekIndex >= 0 && weekIndex < 6) {
        collectedByWeek[weekIndex]++;
      }
    });
    
    return {
      labels: weeks,
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
    console.error('Error fetching bag utilization trend data:', error);
    return {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
      datasets: [
        {
          label: 'Bags Distributed',
          data: [0, 0, 0, 0, 0, 0],
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.2)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Bags Collected',
          data: [0, 0, 0, 0, 0, 0],
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          tension: 0.3,
          fill: true,
        }
      ]
    };
  }
};

/**
 * Fetch alerts for dashboard activity feed
 * @param {number} limit Maximum number of alerts to return
 * @returns {Promise<Array>} Array of alert objects
 */
export const fetchDashboardAlerts = async (limit = 5) => {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        *,
        creator:created_by(first_name, last_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data.map(alert => {
      const creator = alert.creator ? 
        `${alert.creator.first_name} ${alert.creator.last_name}` : 'System';
      
      return {
        id: alert.id,
        title: alert.title,
        description: alert.description,
        type: alert.type || 'info', // Default to info
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
    // We'll set up multiple subscriptions for different tables that affect the dashboard
    const pickupSubscription = supabase
      .channel('pickup_requests_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'pickup_requests' },
        handleDataChange
      )
      .subscribe();
      
    const collectorsSubscription = supabase
      .channel('collectors_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'collectors' },
        handleDataChange
      )
      .subscribe();
      
    const alertsSubscription = supabase
      .channel('alerts_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'alerts' },
        handleDataChange
      )
      .subscribe();
      
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
        pickupSubscription.unsubscribe();
        collectorsSubscription.unsubscribe();
        alertsSubscription.unsubscribe();
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
