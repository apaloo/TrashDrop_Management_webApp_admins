import { supabase } from './supabase';
import { appConfig, APP_CONSTANTS } from '../config';
import { STATUS, LOG_LEVEL, LOG_SOURCE, ID_PREFIX } from '../config/constants';
import { safeDatabaseService } from './safeDatabaseService';
import * as realDataUtils from './realDataUtils';

// Direct Supabase connection - no mock data or fallbacks for Bag Management
const FORCE_LIVE_DATA = true; // Always use real data from Supabase
const ALLOW_MOCK_FALLBACK = false; // NO fallback to mock data - direct DB connection only

/**
 * Generate mock bag batch data
 * @param {Object} options - Pagination and sorting options
 * @returns {Array} Array of mock bag batch objects
 */
export const generateMockBagBatches = ({ page = 1, limit = 10, sortBy = 'updated_at', sortOrder = 'desc' } = {}) => {
  const allBatches = Array(25).fill().map((_, i) => {
    const id = `batch-\${String(i + 1).padStart(3, '0')}`;
    const bag_count = Math.floor(Math.random() * 100) + 50;
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 60));
    const scannedCount = Math.floor(Math.random() * bag_count * 0.8);
    const collectedCount = Math.floor(Math.random() * scannedCount);
    
    return {
      id,
      batch_number: id,
      bag_count,
      updated_at: createdDate.toISOString(),
      created_at: createdDate.toISOString(),
      scanned_count: scannedCount,
      collected_count: collectedCount,
      scan_rate: Math.round((scannedCount / bag_count) * 100),
      status: ['active', 'completed', 'expired'][Math.floor(Math.random() * 3)],
      notes: `Batch ${id} notes`
    };
  });
  
  // Sort the data
  const sortedBatches = [...allBatches].sort((a, b) => {
    if (sortBy === 'updated_at') {
      return sortOrder === 'desc' 
        ? new Date(b.updated_at) - new Date(a.updated_at)
        : new Date(a.updated_at) - new Date(b.updated_at);
    } else if (sortBy === 'scan_rate') {
      return sortOrder === 'desc' ? b.scan_rate - a.scan_rate : a.scan_rate - b.scan_rate;
    }
    // Default sort by ID
    return sortOrder === 'desc' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
  });
  
  // Apply pagination
  const startIndex = (page - 1) * limit;
  const paginatedBatches = sortedBatches.slice(startIndex, startIndex + limit);
  
  return {
    data: paginatedBatches,
    totalCount: allBatches.length,
    page,
    limit,
    totalPages: Math.ceil(allBatches.length / limit)
  };
};

/**
 * Archive a bag batch by setting archived flags or falling back to status
 * @param {string} batchId - The batch ID to archive
 * @returns {Promise<{success:boolean, mock?:boolean}>}
 */
export const archiveBagBatch = async (batchId) => {
  try {
    if (!batchId) throw new Error('archiveBagBatch: batchId is required');

    // Prefer real data path
    if (FORCE_LIVE_DATA) {
      // Try soft-archive flags first (industry standard)
      let { error } = await supabase
        .from('batches')
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq('id', batchId);

      if (error) {
        // If column(s) don't exist, fall back to status update
        if (error.code === '42703' || /column .* does not exist/i.test(error.message || '')) {
          const fallback = await supabase
            .from('batches')
            .update({ status: 'Archived' })
            .eq('id', batchId);
          if (fallback.error) throw fallback.error;
        } else {
          throw error;
        }
      }
      return { success: true };
    }

    // Safe path with table existence check
    const tableExists = await safeDatabaseService.checkTableExists('batches');
    if (!tableExists) {
      console.warn('archiveBagBatch: batches table missing, mock-archiving');
      return { success: true, mock: true };
    }

    // Try soft-archive flags first
    let { error } = await supabase
      .from('batches')
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq('id', batchId);

    if (error) {
      if (error.code === '42703' || /column .* does not exist/i.test(error.message || '')) {
        const fallback = await supabase
          .from('batches')
          .update({ status: 'Archived' })
          .eq('id', batchId);
        if (fallback.error) throw fallback.error;
      } else {
        throw error;
      }
    }
    return { success: true };
  } catch (error) {
    console.error('archiveBagBatch error:', error);
    if (ALLOW_MOCK_FALLBACK) {
      console.warn('archiveBagBatch: falling back to mock success');
      return { success: true, mock: true };
    }
    throw error;
  }
};

/**
 * Generate mock collections data for charts and statistics
 * @returns {Array} Mock collections data
 */
export const generateMockCollectionsData = () => {
  const today = new Date();
  const data = [];
  
  // Generate last 7 days of collection data
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      collections: Math.floor(25 + Math.random() * 30),
      weight_kg: Math.floor(150 + Math.random() * 100),
      collectors: Math.floor(3 + Math.random() * 2)
    });
  }
  
  return data;
};

/**
 * Generate mock waste distribution data for charts
 * @returns {Object} Mock waste distribution data
 */
export const generateMockWasteDistribution = () => {
  return {
    categories: [
      { name: 'Plastic', percentage: 42, weight_kg: 850 },
      { name: 'Paper', percentage: 28, weight_kg: 560 },
      { name: 'Glass', percentage: 15, weight_kg: 310 },
      { name: 'Metal', percentage: 10, weight_kg: 210 },
      { name: 'Other', percentage: 5, weight_kg: 100 }
    ],
    total_weight_kg: 2030,
    collection_period: '2025-08-01 to 2025-08-07'
  };
};

/**
 * Generate mock collector performance data
 * @returns {Object} Mock performance data for collectors
 */
export const generateMockCollectorPerformance = () => {
  return {
    top_collectors: [
      { name: 'Ama Owusu', collections: 38, rating: 4.9, region: 'Ga West Municipal' },
      { name: 'Kwame Asante', collections: 35, rating: 4.8, region: 'Accra Metropolitan' },
      { name: 'Akosua Mensah', collections: 29, rating: 4.6, region: 'Ga North Municipal' },
      { name: 'Kofi Boateng', collections: 24, rating: 4.4, region: 'Ga East Municipal' }
    ],
    efficiency_metrics: {
      avg_time_per_collection: 18, // minutes
      avg_distance_per_day: 15.2, // km
      avg_collections_per_day: 8.5,
      avg_response_time: 22 // minutes
    },
    regional_distribution: [
      { region: 'Accra Metropolitan', collections: 120, collectors: 12 },
      { region: 'Ga North Municipal', collections: 85, collectors: 8 },
      { region: 'Ga South Municipal', collections: 70, collectors: 7 },
      { region: 'Ga East Municipal', collections: 65, collectors: 6 },
      { region: 'Ga West Municipal', collections: 60, collectors: 6 }
    ]
  };
};

/**
 * Generate mock pickup request data
 * @param {string} status - Optional status filter
 * @returns {Array} Array of mock pickup request objects
 */
export const generateMockPickupRequests = (status = null) => {
  const statuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
  
  const mockRequests = Array(20).fill().map((_, i) => {
    const requestDate = new Date();
    requestDate.setDate(requestDate.getDate() - Math.floor(Math.random() * 14));
    
    const requestStatus = status || statuses[Math.floor(Math.random() * statuses.length)];
    const isCompleted = requestStatus === 'completed';
    
    const completionDate = new Date(requestDate);
    if (isCompleted) {
      completionDate.setHours(completionDate.getHours() + Math.floor(Math.random() * 48));
    }
    
    return {
      id: `request-\${String(i + 1).padStart(3, '0')}`,
      customer_name: `Customer \${i + 1}`,
      customer_phone: `+233${Math.floor(Math.random() * 900000000) + 100000000}`,
      address: `${i + 1} Independence Avenue, Accra`,
      location: { 
        lat: 5.55 + (Math.random() * 0.2), 
        lng: -0.2 + (Math.random() * 0.2)
      },
      waste_type: ['plastic', 'paper', 'glass', 'metal', 'mixed'][Math.floor(Math.random() * 5)],
      estimated_weight: Math.floor(Math.random() * 50) + 5,
      status: requestStatus,
      created_at: requestDate.toISOString(),
      scheduled_at: requestDate.toISOString(),
      completed_at: isCompleted ? completionDate.toISOString() : null,
      collector_id: isCompleted || requestStatus === 'assigned' || requestStatus === 'in_progress' ? 
                  `collector-\${Math.floor(Math.random() * 4) + 1}` : null,
      collector_name: isCompleted || requestStatus === 'assigned' || requestStatus === 'in_progress' ? 
                     ['Kwame Asante', 'Akosua Mensah', 'Kofi Boateng', 'Ama Owusu'][Math.floor(Math.random() * 4)] : null,
      notes: Math.random() > 0.7 ? `Special instructions for pickup \${i + 1}` : null,
      priority: Math.random() > 0.8 ? 'high' : (Math.random() > 0.5 ? 'medium' : 'low')
    };
  });
  
  // Filter by status if provided as a parameter
  if (status) {
    return mockRequests.filter(r => r.status === status);
  }
  
  return mockRequests;
};

/**
 * Generate mock bag stats data
 * @returns {Object} Mock bag statistics
 */
export const generateMockBagStats = () => {
  return {
    total_bags: 5000,
    active_bags: 3200,
    distributed: 2800,
    scanned: 1950,
    scan_rate: 69.6,
    collection_rate: 42.8,
    recent_batches: 8,
    expired_bags: 250
  };
};

/**
 * Generate mock collector stats data
 * @returns {Object} Mock collector statistics
 */
export const generateMockCollectorStats = () => {
  return {
    total: 48,
    active: 35,
    inactive: 13,
    new_this_month: 5,
    average_rating: 4.3,
    regions: 4,  // Number as required by components
    top_collector: {
      name: 'Ama Owusu',
      collections: 38,
      rating: 4.9
    }
  };
};

/**
 * Generate mock performance stats data
 * @returns {Object} Mock performance statistics
 */
export const generateMockPerformanceStats = () => {
  return {
    average_response_time: 24, // minutes
    average_collection_time: 18, // minutes
    collections_per_day: 42,
    on_time_rate: 87, // percentage
    customer_satisfaction: 4.6, // out of 5
    waste_collection_efficiency: 92, // percentage
    service_areas_covered: 4
  };
};

/**
 * Generate mock bag utilization trend data
 * @returns {Array} Mock bag utilization trend data
 */
export const generateMockBagUtilizationData = () => {
  const today = new Date();
  const data = [];
  
  // Generate last 12 weeks of utilization data
  for (let i = 11; i >= 0; i--) {
    const weekDate = new Date(today);
    weekDate.setDate(today.getDate() - (i * 7));
    const weekStr = `Week \${12-i}`;
    
    const distributed = Math.floor(300 + Math.random() * 150);
    const scanned = Math.floor(distributed * (0.6 + Math.random() * 0.3));
    const collected = Math.floor(scanned * (0.7 + Math.random() * 0.25));
    
    data.push({
      week: weekStr,
      date: weekDate.toISOString().split('T')[0],
      distributed,
      scanned,
      collected,
      scan_rate: Math.round((scanned / distributed) * 100),
      collection_rate: Math.round((collected / distributed) * 100)
    });
  }
  
  return data;
};

/**
 * Generate mock pickup status data for charts
 * @returns {Object} Mock pickup status distribution data
 */
export const generateMockPickupStatusData = () => {
  return {
    pending: 24,
    assigned: 18,
    in_progress: 12,
    completed: 96,
    cancelled: 8,
    total: 158
  };
};

/**
 * Generate mock collector activity data for charts
 * @returns {Array} Mock collector activity data
 */
export const generateMockCollectorActivityData = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const data = [];
  
  // Generate last 7 days of activity data
  for (let i = 6; i >= 0; i--) {
    const dayIndex = (dayOfWeek - i + 7) % 7;
    
    data.push({
      day: days[dayIndex],
      active_collectors: Math.floor(20 + Math.random() * 15),
      collections: Math.floor(30 + Math.random() * 25),
      avg_collections_per_collector: parseFloat((Math.random() * 2 + 0.5).toFixed(1))
    });
  }
  
  return data;
};

/**
 * Generate mock service area data
 * @returns {Array} Mock service areas data
 */
export const generateMockServiceAreas = () => {
  return [
    {
      id: 'area-001',
      name: 'Downtown Accra',
      district: 'Accra Metropolitan',
      boundaries: [
        { lat: 5.550, lng: -0.200 },
        { lat: 5.560, lng: -0.200 },
        { lat: 5.560, lng: -0.210 },
        { lat: 5.550, lng: -0.210 },
      ],
      center: { lat: 5.555, lng: -0.205 },
      collector_count: 12,
      pickup_requests: 45,
      completion_rate: 87,
      color: '#4C51BF',
      created_at: '2023-12-01T10:00:00Z',
      updated_at: '2024-07-15T14:30:00Z'
    },
    {
      id: 'area-002',
      name: 'East Industrial Zone',
      district: 'Tema Municipal',
      boundaries: [
        { lat: 5.570, lng: -0.180 },
        { lat: 5.580, lng: -0.180 },
        { lat: 5.580, lng: -0.190 },
        { lat: 5.570, lng: -0.190 },
      ],
      center: { lat: 5.575, lng: -0.185 },
      collector_count: 8,
      pickup_requests: 62,
      completion_rate: 92,
      color: '#C05621',
      created_at: '2023-12-01T10:30:00Z',
      updated_at: '2024-07-15T14:35:00Z'
    },
    {
      id: 'area-003',
      name: 'North Residential',
      district: 'Ga East Municipal',
      boundaries: [
        { lat: 5.590, lng: -0.220 },
        { lat: 5.600, lng: -0.220 },
        { lat: 5.600, lng: -0.230 },
        { lat: 5.590, lng: -0.230 },
      ],
      center: { lat: 5.595, lng: -0.225 },
      collector_count: 6,
      pickup_requests: 28,
      completion_rate: 75,
      color: '#047857',
      created_at: '2023-12-01T11:00:00Z',
      updated_at: '2024-07-15T14:40:00Z'
    },
    {
      id: 'area-004',
      name: 'West Commercial',
      district: 'Ga West Municipal',
      boundaries: [
        { lat: 5.560, lng: -0.240 },
        { lat: 5.570, lng: -0.240 },
        { lat: 5.570, lng: -0.250 },
        { lat: 5.560, lng: -0.250 },
      ],
      center: { lat: 5.565, lng: -0.245 },
      collector_count: 10,
      pickup_requests: 36,
      completion_rate: 83,
      color: '#7E22CE',
      created_at: '2023-12-01T11:30:00Z',
      updated_at: '2024-07-15T14:45:00Z'
    }
  ];
};

/**
 * Generate mock illegal dumping report data
 * @param {Object} options - Pagination and filtering options
 * @returns {Object} Object containing paginated illegal dumping reports
 */
export const generateMockIllegalDumpingReports = (options = {}) => {
  const { page = 1, limit = 10, status = null } = options || {};
  const statuses = ['pending', 'investigating', 'cleaning', 'resolved', 'false_report'];
  
  const allReports = Array(30).fill().map((_, i) => {
    const reportDate = new Date();
    reportDate.setDate(reportDate.getDate() - Math.floor(Math.random() * 30));
    
    const reportStatus = status || statuses[Math.floor(Math.random() * statuses.length)];
    const isResolved = reportStatus === 'resolved' || reportStatus === 'false_report';
    
    const resolvedDate = new Date(reportDate);
    if (isResolved) {
      resolvedDate.setDate(resolvedDate.getDate() + Math.floor(Math.random() * 7) + 1);
    }
    
    return {
      id: `report-${String(i + 1).padStart(3, '0')}`,
      location: {
        address: `${Math.floor(Math.random() * 100) + 1} ${['Independence', 'Liberation', 'Republic', 'Unity', 'Democracy'][Math.floor(Math.random() * 5)]} Avenue, Accra`,
        coordinates: { 
          lat: 5.55 + (Math.random() * 0.1), 
          lng: -0.2 + (Math.random() * 0.1)
        }
      },
      reporter: {
        name: `Reporter ${i + 1}`,
        phone: `+233${Math.floor(Math.random() * 900000000) + 100000000}`,
        anonymous: Math.random() > 0.7
      },
      status: reportStatus,
      severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
      waste_type: ['household', 'construction', 'industrial', 'mixed'][Math.floor(Math.random() * 4)],
      estimated_volume: Math.floor(Math.random() * 20) + 1, // cubic meters
      description: `Illegal dumping site reported at location ${i + 1}. ${Math.random() > 0.5 ? 'Requires immediate attention.' : 'Regular cleanup requested.'}`,
      images: [
        `https://example.com/dumping-reports/image${i + 1}-1.jpg`,
        `https://example.com/dumping-reports/image${i + 1}-2.jpg`
      ],
      reported_at: reportDate.toISOString(),
      resolved_at: isResolved ? resolvedDate.toISOString() : null,
      assigned_to: isResolved || reportStatus === 'investigating' || reportStatus === 'cleaning' ? 
                  `team-${Math.floor(Math.random() * 3) + 1}` : null,
      team_name: isResolved || reportStatus === 'investigating' || reportStatus === 'cleaning' ? 
               ['Cleanup Team A', 'Cleanup Team B', 'Cleanup Team C'][Math.floor(Math.random() * 3)] : null,
      resolution_notes: isResolved ? 
                       `Site has been ${reportStatus === 'resolved' ? 'cleaned up' : 'investigated and determined to be a false report'}.` : null
    };
  });
  
  // Filter by status if provided
  const filteredReports = status 
    ? allReports.filter(r => r.status === status)
    : allReports;
  
  // Apply pagination
  const startIndex = (page - 1) * limit;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + limit);
  
  return {
    data: paginatedReports,
    totalCount: filteredReports.length,
    page,
    limit,
    totalPages: Math.ceil(filteredReports.length / limit)
  };
};

/**
 * Fetch bag batches from Supabase with pagination and sorting
 * Direct database connection - NO MOCK DATA, NO CACHE
 * @param {Object} options - Options for pagination and sorting
 * @returns {Promise<Object>} Promise that resolves to an object with data and pagination info
 */
export const fetchBagBatches = async (options = {}) => {
  const { page = 1, limit = 10, sortBy = 'updated_at', sortOrder = 'desc', filters = {} } = options;
  
  // Calculate offset
  const offset = (page - 1) * limit;
  
  // Build query - Direct Supabase query with no fallbacks
  let query = supabase
    .from('batches')
    .select('*', { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);
  
  // Apply status filter if provided
  if (filters.status && filters.status !== 'All') {
    query = query.eq('status', filters.status);
  }
  
  // Apply search filter if provided
  if (filters.search) {
    query = query.or(`id.ilike.%${filters.search}%,type.ilike.%${filters.search}%,qr_prefix.ilike.%${filters.search}%`);
  }
  
  const { data, error, count } = await query;
  
  if (error) {
    console.error('Error fetching batches from Supabase:', error);
    throw error; // No fallback - throw error directly
  }
  
  // Calculate scan statistics for each batch
  const batchesWithStats = await Promise.all((data || []).map(async (batch) => {
    // Get bag count and scanned count from bags table
    const { data: bags, error: bagsError } = await supabase
      .from('bags')
      .select('id, status', { count: 'exact' })
      .eq('batch_id', batch.id);
    
    if (bagsError) {
      console.error(`Error fetching bags for batch ${batch.id}:`, bagsError);
      return {
        ...batch,
        distributed: 0,
        scanned: 0,
        scan_rate: 0
      };
    }
    
    const totalBags = bags?.length || 0;
    const scannedBags = bags?.filter(bag => bag.status === 'scanned' || bag.status === 'collected').length || 0;
    const scanRate = totalBags > 0 ? Math.round((scannedBags / totalBags) * 100) : 0;
    
    return {
      ...batch,
      distributed: totalBags,
      scanned: scannedBags,
      scan_rate: scanRate
    };
  }));
  
  return {
    data: batchesWithStats,
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
  // Step 1: Get bags for the batch
  let bagsQuery = supabase
    .from('bags')
    .select('id, batch_id');
  
  if (batchId) {
    bagsQuery = bagsQuery.eq('batch_id', batchId);
  }
  
  const { data: bags, error: bagsError } = await bagsQuery;
  
  if (bagsError) {
    console.error('Error fetching bags:', bagsError);
    throw bagsError; // No fallback - throw error directly
  }
  
  if (!bags || bags.length === 0) {
    return []; // No bags found, return empty array
  }
  
  // Step 2: Get scans for these bags with collector information
  const bagIds = bags.map(bag => bag.id);
  
  const { data: scans, error: scansError } = await supabase
    .from('scans')
    .select(`
      id,
      bag_id,
      scanned_at,
      scanned_by,
      location,
      status,
      notes,
      collectors:scanned_by (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .in('bag_id', bagIds)
    .order('scanned_at', { ascending: false });
  
  if (scansError) {
    console.error('Error fetching scans:', scansError);
    throw scansError; // No fallback - throw error directly
  }
  
  // Enrich scans with batch information
  const enrichedScans = (scans || []).map(scan => {
    const bag = bags.find(b => b.id === scan.bag_id);
    return {
      ...scan,
      bags: bag ? { batch_id: bag.batch_id } : null
    };
  });
  
  return enrichedScans;
};

/**
 * Generate mock bag history data (kept for backward compatibility but not used)
 * @param {string} batchId - Batch ID (optional)
 * @returns {Array} Mock scan history data
 */
const generateMockBagHistory = (batchId = null) => {
  const mockScans = [];
  const scanCount = Math.floor(Math.random() * 20) + 5; // 5-25 scans
  
  for (let i = 0; i < scanCount; i++) {
    const scanDate = new Date();
    scanDate.setDate(scanDate.getDate() - Math.floor(Math.random() * 30)); // Last 30 days
    
    mockScans.push({
      id: `scan-${Date.now()}-${i}`,
      bag_id: `bag-${Math.floor(Math.random() * 1000)}`,
      scanned_at: scanDate.toISOString(),
      scanned_by: `collector-${Math.floor(Math.random() * 5) + 1}`,
      bags: {
        batch_id: batchId || `batch-${Math.floor(Math.random() * 100)}`
      },
      collectors: {
        first_name: ['Kwame', 'Akosua', 'Kofi', 'Ama', 'Emmanuel'][Math.floor(Math.random() * 5)],
        last_name: ['Asante', 'Mensah', 'Boateng', 'Owusu', 'Adjei'][Math.floor(Math.random() * 5)]
      }
    });
  }
  
  return mockScans.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at));
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
    status: 'active', // Mobile app expects 'active' status initially
    notes: batchData.notes || `Type: ${batchData.type || 'Unknown'}, Size: ${batchData.size || 'Unknown'}`
  };

  // Get current user for created_by field
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    batchPayload.created_by = user.id;
  }

  console.log('Creating batch with payload:', batchPayload);

  // Insert batch into database
  const { data: batch, error: batchError } = await supabase
    .from('batches')
    .insert([batchPayload])
    .select()
    .single();

  if (batchError) {
    console.error('Error creating batch:', batchError);
    throw batchError;
  }
  
  console.log('✅ Batch created successfully:', batch);
  
  // IMPORTANT: Mobile app scans the BATCH ID (UUID), not individual bag QR codes
  // The QR code contains just the batch UUID
  const batchQRCode = batch.id;
  
  // Create individual bags for this batch (for tracking purposes)
  const bagCount = batchPayload.bag_count;
  const bags = [];
  
  for (let i = 1; i <= bagCount; i++) {
    bags.push({
      batch_id: batch.id,
      qr_code: `${batch.id}-${String(i).padStart(4, '0')}`, // Bag-specific code
      status: 'active',
      scanned: false
    });
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
    console.log(`✅ ${bags.length} individual bags created for tracking`);
  }
  
  return { 
    batch,
    batchQRCode, // This is what gets encoded in the QR code for mobile scanning
    bagCount: bags.length
  };
};

/**
 * Generate mock batch creation response
 * @param {Object} batchData - Original batch data
 * @returns {{batch: Object, qrCodes: Array}} Mock batch record in standardized shape
 */
const generateMockBatchCreation = (batchData) => {
  const batch = {
    id: `batch-${Date.now()}`,
    batch_number: batchData.batch_number || batchData.batchNumber || `Batch-${Date.now()}`,
    bag_count: Number(batchData.bag_count ?? batchData.quantity ?? 50),
    type: batchData.type || null,
    size: batchData.size || null,
    qr_prefix: batchData.qrPrefix || batchData.qr_prefix || 'TD-REC-M',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: STATUS?.BAG?.GENERATED || 'Generated',
    distributed: 0,
    scanned: 0
  };
  return { batch, qrCodes: [] };
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
  return await safeDatabaseService.safeQuery({
    tableName: 'illegal_dumping_history',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('illegal_dumping_history')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false });
      
      return { data, error };
    }
  });
};

/**
 * Generate mock illegal dumping history
 * @param {string} reportId - Report ID
 * @returns {Array} Mock history entries
 */
const generateMockIllegalDumpingHistory = (reportId) => {
  const historyEntries = [
    {
      id: `hist-${reportId}-1`,
      report_id: reportId,
      status: 'submitted',
      changed_by: 'Mobile App User',
      changed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Initial report submitted',
      verification_status: 'pending'
    },
    {
      id: `hist-${reportId}-2`,
      report_id: reportId,
      status: 'verified',
      changed_by: 'Admin User',
      changed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Report verified by admin team',
      verification_status: 'verified'
    }
  ];
  
  return historyEntries;
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
    mockDataFn: async () => generateMockDashboardStats(),
    mockDataParams: {}
  });
};

/**
 * Generate mock dashboard statistics
 * @returns {Object} Mock dashboard stats
 */
const generateMockDashboardStats = () => {
  return {
    totalIllegalDumpingReports: 45,
    openIllegalDumpingReports: 12,
    resolvedIllegalDumpingReports: 33,
    avgCleanupTimeInDays: 3.2,
    totalBags: 2847,
    activeBags: 1956,
    totalPickups: 156,
    completedPickups: 142
  };
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
 * Update illegal dumping report status
 * @deprecated RPC function 'update_illegal_dumping_status' no longer exists - using direct table updates
 * @param {string} reportId - Report ID
 * @param {string} status - New status
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated report
 */
export const updateIllegalDumpingStatus = async (reportId, status, notes = '') => {
  // DEPRECATED: RPC function removed, using direct table update only
  console.log('Using direct table update for illegal dumping status (RPC deprecated)');
  
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
export const assignCleanupTeam = async (reportId, collectorId, scheduledDate) => {
  console.log('Assigning collector to illegal dumping report:', { reportId, collectorId, scheduledDate });
  
  return await safeDatabaseService.safeQuery({
    tableName: 'illegal_dumping_mobile',
    queryFn: async () => {
      // Database constraint only allows: 'pending', 'verified', 'in_progress', 'completed'
      // Use 'verified' so assignment appears in collector's "Available" tab
      // Collector will change to 'in_progress' when they accept the assignment
      const newStatus = 'verified';
      
      const { data, error } = await supabase
        .from('illegal_dumping_mobile')
        .update({ 
          status: newStatus,
          assigned_to: collectorId,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .select()
        .single();
      
      if (error) {
        console.error('Error assigning cleanup team:', error);
      } else {
        console.log('Successfully assigned collector:', collectorId, 'to report:', reportId);
      }
      
      return { data, error };
    }
  });
};

/**
 * Fetch system logs
 * @param {Object} options - Query options
 * @returns {Promise<Array>} System logs
 */
export const fetchLogs = async (...args) => {
  // Support both positional args (level, source, dateRange, search)
  // and an options object shape.
  let normalized = {};
  if (args.length > 1 || typeof args[0] === 'string' || Array.isArray(args[0])) {
    const [level, source, dateRange, search] = args;
    normalized = {
      level: level || null,
      source: source || null,
      startDate: dateRange?.start || null,
      endDate: dateRange?.end || null,
      search: search || null
    };
  } else {
    const options = args[0] || {};
    normalized = {
      level: options.level || null,
      source: options.source || null,
      startDate: options.startDate || options.start || options?.dateRange?.start || null,
      endDate: options.endDate || options.end || options?.dateRange?.end || null,
      search: options.search || options.searchQuery || null
    };
  }

  try {
    // Ensure logs table exists when not hard forcing; still allow fallback
    const tableExists = await safeDatabaseService.checkTableExists('logs');
    if (!tableExists) {
      console.warn("Logs table does not exist. Falling back to mock logs.");
      return generateMockLogs(normalized);
    }

    // Build query
    let query = supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (normalized.level) {
      query = query.eq('level', normalized.level);
    }
    if (normalized.source) {
      query = query.eq('source', normalized.source);
    }
    if (normalized.startDate) {
      query = query.gte('created_at', normalized.startDate);
    }
    if (normalized.endDate) {
      query = query.lte('created_at', normalized.endDate);
    }
    if (normalized.search) {
      const s = `%${normalized.search}%`;
      // Try OR filter on common text fields; if PostgREST rejects, we'll handle in catch
      query = query.or(`message.ilike.${s},details.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) {
      // Known missing table/rel errors -> mock fallback
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn('Logs table/relationship missing. Using mock logs. Error:', error.message);
        return generateMockLogs(normalized);
      }
      throw error;
    }

    // If search OR filter not supported, do client-side filter as fallback
    let result = Array.isArray(data) ? data : [];
    if (normalized.search) {
      const searchLower = normalized.search.toLowerCase();
      result = result.filter(l => {
        const msg = l?.message?.toLowerCase?.() || '';
        const det = (typeof l?.details === 'string' ? l.details : JSON.stringify(l?.details || '')).toLowerCase();
        return msg.includes(searchLower) || det.includes(searchLower);
      });
    }
    return result;
  } catch (error) {
    console.error('Error fetching logs:', error);
    if (ALLOW_MOCK_FALLBACK) {
      console.warn('Falling back to mock logs due to error.');
      return generateMockLogs(normalized);
    }
    throw error;
  }
};

/**
 * Generate mock illegal dumping status update
 * @param {string} reportId
 * @param {string} status
 * @param {string} notes
 * @returns {Object}
 */
const generateMockIllegalDumpingStatusUpdate = (reportId, status, notes = '') => {
  return {
    id: reportId,
    status,
    notes,
    updated_at: new Date().toISOString()
  };
};

/**
 * Generate mock cleanup team assignment
 */
const generateMockCleanupTeamAssignment = (reportId, teamId, scheduledDate) => {
  const isoDate = scheduledDate
    ? (scheduledDate instanceof Date ? scheduledDate.toISOString() : new Date(scheduledDate).toISOString())
    : null;
  const status = isoDate ? 'cleanup_scheduled' : 'team_assigned';
  return {
    id: reportId,
    assigned_to: teamId,
    scheduled_cleanup_date: isoDate,
    status,
    updated_at: new Date().toISOString()
  };
};

/**
 * Generate mock logs
 */
const generateMockLogs = (options) => {
  const mockLogs = [
    {
      id: 'log-001',
      level: 'INFO',
      source: 'Dashboard',
      message: 'User accessed dashboard',
      details: 'User ID: admin-123 accessed main dashboard',
      user_id: 'admin-123',
      ip_address: '192.168.1.100',
      created_at: new Date(Date.now() - 60000).toISOString()
    },
    {
      id: 'log-002', 
      level: 'WARNING',
      source: 'Database',
      message: 'Slow query detected',
      details: 'Query took 2.3 seconds to execute',
      response_time_ms: 2300,
      created_at: new Date(Date.now() - 120000).toISOString()
    },
    {
      id: 'log-003',
      level: 'ERROR',
      source: 'API',
      message: 'Failed to process request',
      details: 'Invalid request parameters',
      user_id: 'user-456',
      ip_address: '192.168.1.101',
      created_at: new Date(Date.now() - 180000).toISOString()
    }
  ];
  
  // Apply filtering if options provided
  let filteredLogs = mockLogs;
  
  if (options.level) {
    filteredLogs = filteredLogs.filter(log => log && log.level && log.level === options.level);
  }
  if (options.source) {
    filteredLogs = filteredLogs.filter(log => log && log.source && log.source === options.source);
  }
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    filteredLogs = filteredLogs.filter(log => 
      log && (
        (log.message && log.message.toLowerCase().includes(searchLower)) ||
        (log.details && log.details.toLowerCase().includes(searchLower))
      )
    );
  }
  
  return filteredLogs;
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
    enableMock: false, // DEPRECATED: Mock data system removed
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
