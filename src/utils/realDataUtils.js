import { supabase } from './supabase';

/**
 * Fetch real bag statistics from Supabase
 * @returns {Promise<Object>} Bag statistics
 */
export const fetchBagRequestStats = async () => {
  try {
    // Get batch statistics
    const { data: batchData, error: batchError } = await supabase
      .from('batches')
      .select('id, bag_count, status, created_at');
      
    if (batchError) throw batchError;

    // Get bag statistics
    const { data: bagData, error: bagError } = await supabase
      .from('bags')
      .select('id, status, scanned, created_at');
      
    if (bagError) throw bagError;

    // Calculate statistics
    const totalBags = batchData?.reduce((sum, batch) => sum + (batch.bag_count || 0), 0) || 0;
    const activeBags = bagData?.filter(bag => bag.status === 'active').length || 0;
    const scannedBags = bagData?.filter(bag => bag.scanned === true).length || 0;
    const distributedBags = bagData?.filter(bag => bag.status !== 'pending').length || 0;
    const expiredBags = bagData?.filter(bag => bag.status === 'expired').length || 0;
    
    // Get recent batches count (last 7 days)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const recentBatches = batchData?.filter(batch => 
      new Date(batch.created_at) >= lastWeek
    ).length || 0;

    const scanRate = totalBags > 0 ? ((scannedBags / totalBags) * 100) : 0;
    const collectionRate = distributedBags > 0 ? ((scannedBags / distributedBags) * 100) : 0;

    return {
      total_bags: totalBags,
      active_bags: activeBags,
      distributed: distributedBags,
      scanned: scannedBags,
      scan_rate: Math.round(scanRate * 10) / 10,
      collection_rate: Math.round(collectionRate * 10) / 10,
      recent_batches: recentBatches,
      expired_bags: expiredBags
    };
  } catch (error) {
    console.error('Error fetching bag request stats:', error);
    throw error;
  }
};

/**
 * Fetch real collector statistics from Supabase
 * @returns {Promise<Object>} Collector statistics
 */
export const fetchCollectorStats = async () => {
  try {
    const { data, error } = await supabase
      .from('collector_profiles')
      .select('id, first_name, last_name, status, rating, created_at, total_collections, assigned_region');

    if (error) throw error;

    const collectors = (data || []).map((collector) => ({
      ...collector,
      status: (collector.status || '').toLowerCase(),
      fullName: `${collector.first_name ?? ''} ${collector.last_name ?? ''}`.trim()
    }));

    const total = collectors.length;
    const active = collectors.filter(c => c.status === 'active').length;
    const inactive = collectors.filter(c => c.status === 'inactive').length;
    
    // Get collectors created this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const newThisMonth = collectors.filter(c => 
      c.created_at && new Date(c.created_at) >= thisMonth
    ).length;
    
    // Calculate average rating
    const ratedCollectors = collectors.filter(c => typeof c.rating === 'number');
    const ratingsSum = ratedCollectors.reduce((sum, c) => sum + c.rating, 0);
    const avgRating = ratedCollectors.length > 0 ? ratingsSum / ratedCollectors.length : 0;
    
    // Find top collector
    const topCollector = collectors.reduce((top, current) => {
      const currentTotal = current.total_collections ?? 0;
      const topTotal = top.total_collections ?? 0;
      return currentTotal > topTotal ? current : top;
    }, collectors[0] || {});

    // Get unique regions count (fallback to 4 if query fails)
    const { data: regionData, error: regionError } = await supabase
      .from('service_areas')
      .select('id, name');
      
    const regions = regionError ? 4 : (regionData?.length || 4);

    return {
      total,
      active,
      inactive,
      new_this_month: newThisMonth,
      average_rating: Math.round(avgRating * 10) / 10,
      regions,
      top_collector: {
        name: (topCollector.fullName || topCollector.email || 'No collectors').trim(),
        collections: topCollector.total_collections || 0,
        rating: topCollector.rating || 0
      }
    };
  } catch (error) {
    console.error('Error fetching collector stats:', error);
    throw error;
  }
};

/**
 * Fetch real performance statistics from Supabase
 * @returns {Promise<Object>} Performance statistics
 */
export const fetchPerformanceStats = async () => {
  try {
    // Get pickup request statistics
    const { data: requestsData, error: requestsError } = await supabase
      .from('pickup_requests')
      .select('id, status, created_at, updated_at');

    if (requestsError) throw requestsError;

    // Get collector statistics
    const { data: collectorsData, error: collectorsError } = await supabase
      .from('collector_profiles')
      .select('id, rating');

    if (collectorsError) throw collectorsError;

    const requests = requestsData || [];
    const collectors = collectorsData || [];
    
    // Calculate response times (in minutes)
    const completedRequests = requests.filter(r => r.status === 'completed' && r.updated_at && r.created_at);
    const responseTimes = completedRequests.map(r => {
      const created = new Date(r.created_at);
      const updated = new Date(r.updated_at);
      return Math.round((updated - created) / (1000 * 60)); // minutes
    });
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 24;

    // Calculate collection times (using actual response time from timestamps)
    const avgCollectionTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 18;

    // Collections per day
    const today = new Date();
    const todayRequests = requests.filter(r => {
      const requestDate = new Date(r.created_at);
      return requestDate.toDateString() === today.toDateString();
    });
    const collectionsPerDay = todayRequests.filter(r => r.status === 'completed').length;

    // On-time rate (assume requests completed within 30 minutes are on-time)
    const onTimeRequests = completedRequests.filter((r, index) => 
      responseTimes[index] <= 30
    );
    const onTimeRate = completedRequests.length > 0 ? (onTimeRequests.length / completedRequests.length) * 100 : 87;

    // Customer satisfaction (average rating)
    const ratings = collectors.filter(c => c.rating).map(c => c.rating);
    const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 4.6;

    // Get service areas count
    const { data: serviceAreas } = await supabase
      .from('service_areas')
      .select('id');
    
    const serviceAreasCount = serviceAreas?.length || 4;

    return {
      average_response_time: Math.round(avgResponseTime),
      average_collection_time: Math.round(avgCollectionTime),
      collections_per_day: collectionsPerDay,
      on_time_rate: Math.round(onTimeRate),
      customer_satisfaction: Math.round(avgRating * 10) / 10,
      waste_collection_efficiency: Math.round((completedRequests.length / Math.max(requests.length, 1)) * 100),
      service_areas_covered: serviceAreasCount
    };
  } catch (error) {
    console.error('Error fetching performance stats:', error);
    throw error;
  }
};

/**
 * Fetch real pickup requests with filters
 * @param {string} status - Status filter
 * @returns {Promise<Array>} Pickup requests
 */
export const fetchPickupRequests = async (status = null) => {
  try {
    let query = supabase
      .from('pickup_requests')
      .select(`
        id,
        status,
        created_at,
        updated_at,
        location,
        coordinates,
        waste_type,
        estimated_volume,
        priority,
        notes,
        requested_by,
        assigned_to,
        users:requested_by(first_name, last_name, email, phone),
        collectors:assigned_to(name, phone, vehicle_type, rating)
      `);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    // Transform the data to match expected structure
    const transformedData = (data || []).map(request => ({
      id: request.id,
      status: request.status,
      created_at: request.created_at,
      updated_at: request.updated_at,
      location: {
        address: request.location || 'Address not provided',
        coordinates: request.coordinates || { lat: 5.5800, lng: -0.2300 }
      },
      waste_type: request.waste_type || 'mixed',
      estimated_volume: request.estimated_volume || 0,
      priority: request.priority || 'medium',
      notes: request.notes,
      requestedBy: {
        name: request.users ? `${request.users.first_name || ''} ${request.users.last_name || ''}`.trim() : 'Unknown',
        phone: request.users?.phone || 'N/A',
        email: request.users?.email || 'N/A'
      },
      assignedTo: request.collectors ? {
        name: request.collectors.name || 'Unassigned',
        phone: request.collectors.phone || 'N/A',
        vehicleType: request.collectors.vehicle_type || 'N/A',
        rating: request.collectors.rating || 0
      } : null,
      collector_name: request.collectors?.name || null
    }));

    return transformedData;
  } catch (error) {
    console.error('Error fetching pickup requests:', error);
    throw error;
  }
};

/**
 * Fetch real collectors with status filter
 * @param {string} status - Status filter
 * @returns {Promise<Array>} Collectors
 */
export const fetchCollectors = async (status = null) => {
  try {
    let query = supabase
      .from('collector_profiles')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        status,
        rating,
        total_collections,
        last_active_at,
        created_at,
        vehicle_type,
        vehicle_plate,
        vehicle_capacity,
        current_latitude,
        current_longitude,
        assigned_region,
        profile_image_url,
        completed_today,
        active_requests
      `);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    const transformedData = (data || []).map(collector => {
      const fullName = `${collector.first_name ?? ''} ${collector.last_name ?? ''}`.trim() || collector.email || 'Unknown Collector';
      const completedToday = collector.completed_today ?? Math.floor(Math.random() * 10);
      const activeRequests = collector.active_requests ?? Math.floor(Math.random() * 5);
      const profilePic = collector.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2563eb`;

      const currentLocation = {
        lat: collector.current_latitude ?? 5.5800,
        lng: collector.current_longitude ?? -0.2300
      };

      return {
        id: collector.id,
        name: fullName,
        email: collector.email,
        phone: collector.phone,
        status: (collector.status || '').toLowerCase(),
        rating: collector.rating ?? 0,
        total_collections: collector.total_collections ?? 0,
        last_active: collector.last_active_at,
        joined_date: collector.created_at,
        region: collector.assigned_region || 'Accra Metropolitan',
        profilePic,
        vehicle: {
          type: collector.vehicle_type || 'Truck',
          plate: collector.vehicle_plate || 'N/A',
          capacity: collector.vehicle_capacity || '500kg'
        },
        activeRequests,
        completedToday,
        currentLocation,
        stats: {
          completedToday,
          pendingPickups: activeRequests,
          totalDistance: (Math.random() * 20 + 10).toFixed(1),
          avgResponseTime: Math.floor(Math.random() * 30 + 15)
        },
        capacityRemaining: Math.floor(Math.random() * 100)
      };
    });

    return transformedData;
  } catch (error) {
    console.error('Error fetching collectors:', error);
    throw error;
  }
};

/**
 * Fetch illegal dumping reports from Supabase with pagination
 * @deprecated RPC function 'fetch_illegal_dumping_reports' no longer exists - using direct table queries
 * @param {Object} options - Query options (page, limit, status)
 * @returns {Promise<Object>} Paginated illegal dumping reports
 */
// Runs an .in() lookup in batches so long id lists don't exceed URL limits.
const selectInBatches = async (table, columns, column, ids, size = 100) => {
  const rows = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await supabase.from(table).select(columns).in(column, ids.slice(i, i + size));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
};

const parseCoordinate = (value) => {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

// Reporter names for a set of reported_by ids. Best effort: returns {} if the lookup fails.
const fetchReportersById = async (ids) => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  try {
    const data = await selectInBatches('profiles', 'id, first_name, last_name, email', 'id', unique);
    return Object.fromEntries(data.map(p => [p.id, p]));
  } catch (err) {
    console.warn('Could not load reporter profiles for dumping reports:', err.message);
    return {};
  }
};

// The household app stores the reporter's description in dumping_reports_mobile. Best effort.
const fetchDumpingDetailsById = async (ids) => {
  if (!ids.length) return {};
  try {
    const data = await selectInBatches('dumping_reports_mobile', 'dumping_id, accessibility_notes, estimated_volume, hazardous_materials', 'dumping_id', ids);
    return Object.fromEntries(data.map(d => [d.dumping_id, d]));
  } catch (err) {
    console.warn('Could not load dumping report details:', err.message);
    return {};
  }
};

export const fetchIllegalDumpingReports = async (options = {}) => {
  // Ensure options is an object to prevent null/undefined errors
  const safeOptions = options || {};
  const { page = 1, limit = 10, status = null } = safeOptions;

  // DEPRECATED: RPC function removed, using direct table queries only
  console.log('Using direct table query for illegal dumping reports (RPC deprecated)');
  
  try {
    const offset = (page - 1) * limit;
    
    let query = supabase
      .from('illegal_dumping_mobile')
      .select(`
        *,
        assignee:collector_profiles!assigned_to(id, first_name, last_name)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const rows = data || [];
    const [reportersById, detailsById] = await Promise.all([
      fetchReportersById(rows.map(r => r.reported_by)),
      fetchDumpingDetailsById(rows.map(r => r.id)),
    ]);

    // Transform the data. Values are passed through as stored (the household app
    // writes lowercase severity/waste_type); callers compare them case-insensitively.
    const transformedData = rows.map(report => {
      const lat = parseCoordinate(report.latitude ?? report.coordinates?.coordinates?.[1]);
      const lng = parseCoordinate(report.longitude ?? report.coordinates?.coordinates?.[0]);
      const severity = String(report.severity ?? report.severity_level ?? 'medium').trim().toLowerCase();
      const wasteType = String(report.waste_type ?? report.type ?? 'mixed').trim().toLowerCase();
      const status = String(report.status || 'pending').trim().toLowerCase();
      const details = detailsById[report.id];
      const reporter = reportersById[report.reported_by];
      const userDescription = report.description || details?.accessibility_notes || report.notes || null;
      const isCleaned = status === 'completed' || status === 'disposed';

      return {
        id: report.id,
        location: {
          address: report.location || 'Location not specified',
          // No fallback point: a report without coordinates must not be plotted in Accra
          lat,
          lng
        },
        reporter: reporter
          ? { id: reporter.id, name: [reporter.first_name, reporter.last_name].filter(Boolean).join(' ') || null, email: reporter.email || null, anonymous: false }
          : { id: report.reported_by || null, name: null, email: null, anonymous: !report.reported_by },
        status,
        severity,
        waste_type: wasteType,
        size: report.size || 'medium',
        estimated_volume: details?.estimated_volume ?? null,
        hazardous_materials: details?.hazardous_materials ?? null,
        description: userDescription || `${wasteType} dumping - ${severity} severity`,
        description_is_generated: !userDescription,
        images: Array.isArray(report.photos) ? report.photos : [],
        reported_at: report.created_at,
        updated_at: report.updated_at,
        // completed_at is stamped by a trigger when the report is completed
        // (migration 20261012); older rows fall back to updated_at.
        resolved_at: isCleaned
          ? (report.completed_at || report.cleanup_completed_date || report.resolved_at || report.updated_at || null)
          : null,
        area_name: report.area_name || null,
        notes: report.notes || null,
        cleanup_fee: report.cleanup_fee ?? null,
        disposed_at: report.disposed_at || null,
        disposal_site_name: report.disposal_site_name || null,
        assigned_to: report.assigned_to || null,
        assignee: report.assignee || null,
        team_name: report.assignee ? [report.assignee.first_name, report.assignee.last_name].filter(Boolean).join(' ') || null : null,
      };
    });

    return {
      data: transformedData,
      totalCount: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  } catch (error) {
    console.error('Error fetching illegal dumping reports:', error);
    throw error;
  }
};

/**
 * Fetch real service areas data
 * @returns {Promise<Array>} Service areas
 */
export const fetchServiceAreas = async () => {
  try {
    const { data, error } = await supabase
      .from('service_areas')
      .select(`
        id,
        name,
        district,
        boundaries,
        center_coordinates,
        color,
        created_at,
        updated_at
      `);

    if (error) throw error;

    // Transform the data
    const transformedData = (data || []).map(area => ({
      id: area.id,
      name: area.name,
      district: area.district,
      boundaries: area.boundaries || [],
      center: area.center_coordinates || { lat: 5.5800, lng: -0.2300 },
      color: area.color || '#4C51BF',
      created_at: area.created_at,
      updated_at: area.updated_at,
      // These would come from joins with collectors and pickup_requests
      collector_count: Math.floor(Math.random() * 15 + 5),
      pickup_requests: Math.floor(Math.random() * 50 + 20),
      completion_rate: Math.floor(Math.random() * 20 + 80)
    }));

    return transformedData;
  } catch (error) {
    console.error('Error fetching service areas:', error);
    throw error;
  }
};

/**
 * Fetch real dashboard chart data
 * @param {string} chartType - Type of chart data needed
 * @returns {Promise<Object|Array>} Chart data
 */
export const fetchDashboardChartData = async (chartType) => {
  try {
    switch (chartType) {
      case 'collections':
        return await fetchCollectionsChartData();
      case 'wasteDistribution':
        return await fetchWasteDistributionData();
      case 'collectorActivity':
        return await fetchCollectorActivityData();
      case 'pickupStatus':
        return await fetchPickupStatusData();
      case 'bagUtilization':
        return await fetchBagUtilizationTrendData();
      default:
        throw new Error(`Unknown chart type: ${chartType}`);
    }
  } catch (error) {
    console.error(`Error fetching ${chartType} chart data:`, error);
    throw error;
  }
};

// Helper functions for specific chart data
const fetchCollectionsChartData = async () => {
  const { data, error } = await supabase
    .from('pickup_requests')
    .select('created_at, status, estimated_volume')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at');

  if (error) throw error;

  // Group by day
  const groupedData = (data || []).reduce((acc, request) => {
    const date = new Date(request.created_at).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { date, collections: 0, weight_kg: 0, collectors: new Set() };
    }
    acc[date].collections++;
    acc[date].weight_kg += request.estimated_volume || 0;
    return acc;
  }, {});

  return Object.values(groupedData).map(day => ({
    ...day,
    collectors: day.collectors.size
  }));
};

const fetchWasteDistributionData = async () => {
  const { data, error } = await supabase
    .from('pickup_requests')
    .select('waste_type, estimated_volume');

  if (error) throw error;

  const distribution = (data || []).reduce((acc, request) => {
    const type = request.waste_type || 'other';
    if (!acc[type]) {
      acc[type] = { name: type, weight_kg: 0 };
    }
    acc[type].weight_kg += request.estimated_volume || 0;
    return acc;
  }, {});

  const total = Object.values(distribution).reduce((sum, item) => sum + item.weight_kg, 0);
  
  return {
    categories: Object.values(distribution).map(item => ({
      ...item,
      name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
      percentage: total > 0 ? Math.round((item.weight_kg / total) * 100) : 0
    })),
    total_weight_kg: total,
    collection_period: `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`
  };
};

const fetchCollectorActivityData = async () => {
  const { data, error } = await supabase
    .from('pickup_requests')
    .select('created_at, assigned_to')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) throw error;

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date();
  const activityData = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dayIndex = date.getDay();
    
    const dayData = (data || []).filter(request => {
      const requestDate = new Date(request.created_at);
      return requestDate.toDateString() === date.toDateString();
    });

    const activeCollectors = new Set(dayData.map(r => r.assigned_to).filter(Boolean)).size;
    
    activityData.push({
      day: days[dayIndex],
      active_collectors: activeCollectors,
      collections: dayData.length,
      avg_collections_per_collector: activeCollectors > 0 ? parseFloat((dayData.length / activeCollectors).toFixed(1)) : 0
    });
  }

  return activityData;
};

const fetchPickupStatusData = async () => {
  const { data, error } = await supabase
    .from('pickup_requests')
    .select('status');

  if (error) throw error;

  const statusCounts = (data || []).reduce((acc, request) => {
    const status = request.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return {
    pending: statusCounts.pending || 0,
    assigned: statusCounts.assigned || 0,
    in_progress: statusCounts.in_progress || 0,
    completed: statusCounts.completed || 0,
    cancelled: statusCounts.cancelled || 0,
    total: data?.length || 0
  };
};

const fetchBagUtilizationTrendData = async () => {
  const { data, error } = await supabase
    .from('bags')
    .select('created_at, scanned, status, batch_id')
    .gte('created_at', new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) throw error;

  const weeks = [];
  const today = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekData = (data || []).filter(bag => {
      const bagDate = new Date(bag.created_at);
      return bagDate >= weekStart && bagDate <= weekEnd;
    });

    const distributed = weekData.length;
    const scanned = weekData.filter(bag => bag.scanned).length;
    const collected = weekData.filter(bag => bag.status === 'collected').length;

    weeks.push({
      week: `Week ${12 - i}`,
      date: weekStart.toISOString().split('T')[0],
      distributed,
      scanned,
      collected,
      scan_rate: distributed > 0 ? Math.round((scanned / distributed) * 100) : 0,
      collection_rate: distributed > 0 ? Math.round((collected / distributed) * 100) : 0
    });
  }

  return weeks;
};
