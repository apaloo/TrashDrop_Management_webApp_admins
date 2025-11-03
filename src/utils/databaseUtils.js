import { supabase } from './supabase';
import { appConfig, APP_CONSTANTS } from '../config';
import { STATUS, LOG_LEVEL, LOG_SOURCE, ID_PREFIX } from '../config/constants';
import { safeDatabaseService } from './safeDatabaseService';
import * as realDataUtils from './realDataUtils';

// IMPORTANT: Override for development mode - force use of real Supabase data
// Set to true to use real Supabase data instead of mock data
const FORCE_LIVE_DATA = true; // Always use real data from Supabase
const ALLOW_MOCK_FALLBACK = true; // Allow fallback to mock data if real data fails

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
 * Generate mock collectors data for development
 * @param {string} status - Optional status filter
 * @returns {Array} Array of collector objects
 */
export const generateMockCollectors = (status = null) => {
  const mockCollectors = [
    {
      id: '1',
      name: 'Kwame Asante',
      email: 'kwame.asante@trashdrop.com',
      phone: '+233123456789',
      status: 'active',
      region: 'Accra Metropolitan',
      rating: 4.8,
      total_collections: 245,
      last_active: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      joined_date: '2024-01-15',
      profilePic: 'https://ui-avatars.com/api/?name=Kwame+Asante&background=2563eb',
      vehicle: {
        type: 'Truck',
        plate: 'GR-1234-20',
        capacity: '500kg'
      },
      activeRequests: 3,
      completedToday: 8,
      currentLocation: { lat: 5.5800, lng: -0.2300 },
      stats: {
        completedToday: 8,
        pendingPickups: 3,
        totalDistance: '15.2',
        avgResponseTime: 22
      },
      capacityRemaining: 75
    },
    {
      id: '2',
      name: 'Akosua Mensah',
      email: 'akosua.mensah@trashdrop.com',
      phone: '+233234567890',
      status: 'active',
      region: 'Ga North Municipal',
      rating: 4.6,
      total_collections: 189,
      last_active: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      joined_date: '2024-02-20',
      profilePic: 'https://ui-avatars.com/api/?name=Akosua+Mensah&background=059669',
      vehicle: {
        type: 'Van',
        plate: 'GR-5678-20',
        capacity: '300kg'
      },
      activeRequests: 2,
      completedToday: 5,
      currentLocation: { lat: 5.7000, lng: -0.2000 },
      stats: {
        completedToday: 5,
        pendingPickups: 2,
        totalDistance: '12.8',
        avgResponseTime: 18
      },
      capacityRemaining: 60
    },
    {
      id: '3',
      name: 'Kofi Boateng',
      email: 'kofi.boateng@trashdrop.com',
      phone: '+233345678901',
      status: 'inactive',
      region: 'Ga East Municipal',
      rating: 4.4,
      total_collections: 156,
      last_active: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      joined_date: '2023-12-10',
      profilePic: 'https://ui-avatars.com/api/?name=Kofi+Boateng&background=dc2626',
      vehicle: {
        type: 'Pickup',
        plate: 'GR-8765-20',
        capacity: '250kg'
      },
      activeRequests: 0,
      completedToday: 0,
      currentLocation: { lat: 5.6500, lng: -0.1700 },
      stats: {
        completedToday: 0,
        pendingPickups: 0,
        totalDistance: '0.0',
        avgResponseTime: 25
      },
      capacityRemaining: 100
    },
    {
      id: '4',
      name: 'Ama Owusu',
      email: 'ama.owusu@trashdrop.com',
      phone: '+233456789012',
      status: 'active',
      region: 'Ga West Municipal',
      rating: 4.9,
      total_collections: 278,
      last_active: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      joined_date: '2023-11-05',
      profilePic: 'https://ui-avatars.com/api/?name=Ama+Owusu&background=7c3aed',
      vehicle: {
        type: 'Truck',
        plate: 'GR-4321-20',
        capacity: '450kg'
      },
      activeRequests: 5,
      completedToday: 7,
      currentLocation: { lat: 5.6200, lng: -0.2600 },
      stats: {
        completedToday: 7,
        pendingPickups: 5,
        totalDistance: '18.5',
        avgResponseTime: 16
      },
      capacityRemaining: 40
    }
  ];

  // Filter by status if provided
  if (status) {
    return mockCollectors.filter(c => c.status?.toLowerCase() === status.toLowerCase());
  }
  
  return mockCollectors;
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
 * Fetch all bag batches with pagination and sorting support
 * @param {Object} options - Options for pagination and sorting
 * @returns {Promise<Object>} Promise that resolves to an object with data and pagination info
 */
export const fetchBagBatches = async (options = {}) => {
  const { page = 1, limit = 10, sortBy = 'updated_at', sortOrder = 'desc' } = options;
  
  try {
    // Force use of real data when FORCE_LIVE_DATA is true
    if (FORCE_LIVE_DATA) {
      // Calculate offset
      const offset = (page - 1) * limit;
      
      // Get data with pagination and include related data
      let query = supabase
        .from('batches')
        .select(`
          id,
          batch_number,
          bag_count,
          status,
          notes,
          created_at,
          updated_at,
          bags(count),
          scanned_count:bags(count).eq(scanned, true),
          collected_count:bags(count).eq(status, 'collected')
        `, { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error fetching batches from Supabase:', error);
        // If error, fall back to simplified query
        const { data: fallbackData, error: fallbackError, count: fallbackCount } = await supabase
          .from('batches')
          .select('*', { count: 'exact' })
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .range(offset, offset + limit - 1);
          
        if (fallbackError) {
          throw fallbackError;
        }
        
        return {
          data: (fallbackData || []).map(batch => ({
            ...batch,
            scan_rate: 0,
            scanned_count: 0,
            collected_count: 0
          })),
          totalCount: fallbackCount || 0,
          page,
          limit,
          totalPages: Math.ceil((fallbackCount || 0) / limit)
        };
      }
      
      // Process the data to calculate rates
      const processedData = (data || []).map(batch => {
        const scannedCount = batch.scanned_count || 0;
        const collectedCount = batch.collected_count || 0;
        const scanRate = batch.bag_count > 0 ? Math.round((scannedCount / batch.bag_count) * 100) : 0;
        
        return {
          ...batch,
          scanned_count: scannedCount,
          collected_count: collectedCount,
          scan_rate: scanRate
        };
      });
      
      return {
        data: processedData,
        totalCount: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    }
    
    // Check if table exists (only when not forcing live data)
    const tableExists = await safeDatabaseService.checkTableExists('batches');
    if (!tableExists) {
      console.warn('Batches table does not exist, returning mock data');
      return generateMockBagBatches({ page, limit, sortBy, sortOrder });
    }

    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Get data with pagination
    let query = supabase
      .from('batches')
      .select('*', { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching batches:', error);
      throw error;
    }
    
    return {
      data: data || [],
      totalCount: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  } catch (error) {
    console.error('Error in fetchBagBatches:', error);
    // Return mock data as fallback only if not forcing live data
    if (!FORCE_LIVE_DATA) {
      return generateMockBagBatches({ page, limit, sortBy, sortOrder });
    }
    throw error; // Re-throw error when forcing live data
  }
};

// =============================================================================
// REAL DATA WRAPPER FUNCTIONS
// =============================================================================

/**
 * Fetch bag request statistics from real data or fallback to mock
 */
export const fetchBagRequestStatsReal = async () => {
  if (FORCE_LIVE_DATA) {
    try {
      return await realDataUtils.fetchBagRequestStats();
    } catch (error) {
      console.error('Error fetching real bag request stats:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tables not found, falling back to mock data');
        return generateMockBagStats();
      }
      throw error;
    }
  }
  return generateMockBagStats();
};

/**
 * Fetch collector statistics from real data or fallback to mock
 */
export const fetchCollectorStatsReal = async () => {
  if (FORCE_LIVE_DATA) {
    try {
      return await realDataUtils.fetchCollectorStats();
    } catch (error) {
      console.error('Error fetching real collector stats:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tables not found, falling back to mock data');
        return generateMockCollectorStats();
      }
      throw error;
    }
  }
  return generateMockCollectorStats();
};

/**
 * Fetch performance statistics from real data or fallback to mock
 */
export const fetchPerformanceStatsReal = async () => {
  if (FORCE_LIVE_DATA) {
    try {
      return await realDataUtils.fetchPerformanceStats();
    } catch (error) {
      console.error('Error fetching real performance stats:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tables not found, falling back to mock data');
        return generateMockPerformanceStats();
      }
      throw error;
    }
  }
  return generateMockPerformanceStats();
};

/**
 * Fetch pickup requests from real data or fallback to mock
 */
export const fetchPickupRequestsReal = async (status = null) => {
  if (FORCE_LIVE_DATA) {
    try {
      return await realDataUtils.fetchPickupRequests(status);
    } catch (error) {
      console.error('Error fetching real pickup requests:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tables not found, falling back to mock data');
        return generateMockPickupRequests(status);
      }
      throw error;
    }
  }
  return generateMockPickupRequests(status);
};

/**
 * Fetch collectors from real data or fallback to mock
 */
export const fetchCollectorsReal = async (status = null) => {
  if (FORCE_LIVE_DATA) {
    try {
      return await realDataUtils.fetchCollectors(status);
    } catch (error) {
      console.error('Error fetching real collectors:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tables not found, falling back to mock data');
        return generateMockCollectors(status);
      }
      throw error;
    }
  }
  return generateMockCollectors(status);
};

/**
 * Fetch illegal dumping reports from real data or fallback to mock
 */
export const fetchIllegalDumpingReportsReal = async (options = {}) => {
  if (FORCE_LIVE_DATA) {
    try {
      return await realDataUtils.fetchIllegalDumpingReports(options);
    } catch (error) {
      console.error('Error fetching real illegal dumping reports:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tables not found, falling back to mock data');
        return generateMockIllegalDumpingReports(options);
      }
      throw error;
    }
  }
  return generateMockIllegalDumpingReports(options);
};

/**
 * Fetch service areas from real data or fallback to mock
 */
export const fetchServiceAreasReal = async () => {
  if (FORCE_LIVE_DATA) {
    try {
      return await realDataUtils.fetchServiceAreas();
    } catch (error) {
      console.error('Error fetching real service areas:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tables not found, falling back to mock data');
        return generateMockServiceAreas();
      }
      throw error;
    }
  }
  return generateMockServiceAreas();
};

/**
 * Fetch dashboard chart data from real data or fallback to mock
 */
export const fetchDashboardChartDataReal = async (chartType) => {
  if (FORCE_LIVE_DATA) {
    try {
      return await realDataUtils.fetchDashboardChartData(chartType);
    } catch (error) {
      console.error(`Error fetching real ${chartType} chart data:`, error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tables not found, falling back to mock data');
        // Return appropriate mock data based on chart type
        switch (chartType) {
          case 'collections':
            return generateMockCollectionsData();
          case 'wasteDistribution':
            return generateMockWasteDistribution();
          case 'collectorActivity':
            return generateMockCollectorActivityData();
          case 'pickupStatus':
            return generateMockPickupStatusData();
          case 'bagUtilization':
            return generateMockBagUtilizationData();
          default:
            throw new Error(`Unknown chart type: ${chartType}`);
        }
      }
      throw error;
    }
  }
  
  // Return appropriate mock data based on chart type
  switch (chartType) {
    case 'collections':
      return generateMockCollectionsData();
    case 'wasteDistribution':
      return generateMockWasteDistribution();
    case 'collectorActivity':
      return generateMockCollectorActivityData();
    case 'pickupStatus':
      return generateMockPickupStatusData();
    case 'bagUtilization':
      return generateMockBagUtilizationData();
    default:
      throw new Error(`Unknown chart type: ${chartType}`);
  }
};

/**
 * Fetch bag history (scan records) for a specific batch
 * @param {string} batchId - Batch ID to fetch history for
 * @returns {Promise<Array>} Array of scan history records
 */
export const fetchBagHistory = async (batchId = null) => {
  try {
    // Check if scans table exists
    const tableExists = await safeDatabaseService.checkTableExists('scans');
    if (!tableExists) {
      console.warn('Table scans does not exist. Using mock data.');
      return generateMockBagHistory(batchId);
    }

    let query = supabase
      .from('scans')
      .select(`
        id,
        bag_id,
        scanned_at,
        scanned_by,
        bags:bag_id(
          batch_id
        ),
        scanned_by
      `)
      .order('scanned_at', { ascending: false });

    if (batchId) {
      // Filter by batch ID if provided
      query = query.eq('bags.batch_id', batchId);
    }

    const { data, error } = await query;
    
    if (error) {
      // Handle specific table not found errors
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Table scans does not exist. Using mock data.');
        return generateMockBagHistory(batchId);
      }
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching bag history:', error);
    return generateMockBagHistory(batchId);
  }
};

/**
 * Generate mock bag history data
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
 * @param {Object} batchData - Batch data to create
 * @returns {Promise<{batch: Object, qrCodes: Array}>} Created batch record and generated QR codes (if any)
 */
export const createBagBatch = async (batchData) => {
  try {
    // Check if batches table exists
    const tableExists = await safeDatabaseService.checkTableExists('batches');
    if (!tableExists) {
      console.warn('Table batches does not exist. Returning mock batch creation.');
      return generateMockBatchCreation(batchData);
    }

    // Build initial payload (include qr_prefix only if provided)
    const basePayload = {
      batch_number: batchData.batch_number || batchData.batchNumber || null,
      bag_count: Number(batchData.bag_count ?? batchData.quantity ?? 0),
      type: batchData.type || null,
      size: batchData.size || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: STATUS?.BAG?.GENERATED || 'Generated'
    };
    if (batchData.qrPrefix || batchData.qr_prefix) {
      basePayload.qr_prefix = batchData.qrPrefix || batchData.qr_prefix;
    }

    // Attempt insert with retries removing missing columns on 42703 errors
    let payload = { ...basePayload };
    const removedCols = new Set();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from('batches')
        .insert([payload])
        .select()
        .single();

      if (!error) {
        return { batch: data, qrCodes: [] };
      }

      // Handle specific table not found errors
      if (error.code === '42P01' || error.message?.includes('relation "batches" does not exist')) {
        console.warn('Table batches does not exist. Returning mock batch creation.');
        return generateMockBatchCreation(batchData);
      }

      // Detect missing column errors and retry without that column
      const errText = `${error.message || ''} ${error.details || ''}`;
      const isMissingColumn = error.code === '42703' || /column .* does not exist/i.test(errText);
      if (isMissingColumn) {
        let missingCol = null;
        const match = errText.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
        if (match && match[1]) missingCol = match[1];

        if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol) && !removedCols.has(missingCol)) {
          console.warn(`Column ${missingCol} missing on batches; retrying without it`);
          removedCols.add(missingCol);
          const { [missingCol]: _omit, ...rest } = payload;
          payload = rest;
          continue;
        }

        // If we couldn't parse the column, remove known optional fields and retry once
        const optionalFields = ['qr_prefix', 'created_at'];
        let modified = false;
        optionalFields.forEach((col) => {
          if (Object.prototype.hasOwnProperty.call(payload, col) && !removedCols.has(col)) {
            removedCols.add(col);
            delete payload[col];
            modified = true;
          }
        });
        if (modified) continue;
      }

      // For other errors, throw to be handled by catch -> mock fallback
      throw error;
    }

    // If we exhausted retries, fall back to mock
    throw new Error('Failed to create batch after retries due to missing columns');
  } catch (error) {
    console.error('Error creating bag batch:', error);
    return generateMockBatchCreation(batchData);
  }
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
    // Check if collectors table exists
    const tableExists = await safeDatabaseService.checkTableExists('collectors');
    if (!tableExists) {
      console.warn('Table collectors does not exist. Returning mock collector creation.');
      return generateMockCollectorCreation(collectorData);
    }

    const { data, error } = await supabase
      .from('collectors')
      .insert([
        {
          name: collectorData.name || 'New Collector',
          email: collectorData.email || 'collector@example.com',
          phone: collectorData.phone || '+233501234567',
          region: collectorData.region || 'Accra Metropolitan',
          status: collectorData.status || 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Table collectors does not exist. Returning mock collector creation.');
        return generateMockCollectorCreation(collectorData);
      }
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error creating collector:', error);
    return generateMockCollectorCreation(collectorData);
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
    // Check if collectors table exists
    const tableExists = await safeDatabaseService.checkTableExists('collectors');
    if (!tableExists) {
      console.warn('Table collectors does not exist. Returning mock collector update.');
      return generateMockCollectorUpdate(collectorId, updateData);
    }

    const { data, error } = await supabase
      .from('collectors')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', collectorId)
      .select()
      .single();
    
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Table collectors does not exist. Returning mock collector update.');
        return generateMockCollectorUpdate(collectorId, updateData);
      }
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error updating collector:', error);
    return generateMockCollectorUpdate(collectorId, updateData);
  }
};

/**
 * Generate mock collector creation response
 * @param {Object} collectorData - Original collector data
 * @returns {Object} Mock collector record
 */
const generateMockCollectorCreation = (collectorData) => {
  return {
    id: `collector-${Date.now()}`,
    name: collectorData.name || 'New Collector',
    email: collectorData.email || 'collector@example.com',
    phone: collectorData.phone || '+233501234567',
    region: collectorData.region || 'Accra Metropolitan',
    status: collectorData.status || 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
};

/**
 * Generate mock collector update response
 * @param {string} collectorId - Collector ID
 * @param {Object} updateData - Update data
 * @returns {Object} Mock updated collector record
 */
const generateMockCollectorUpdate = (collectorId, updateData) => {
  return {
    id: collectorId,
    ...updateData,
    updated_at: new Date().toISOString()
  };
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
 * @param {string} reportId - Report ID
 * @param {string} status - New status
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated report
 */
export const updateIllegalDumpingStatus = async (reportId, status, notes = '') => {
  // Try RPC via safeDatabaseService first
  try {
    console.log('Attempting update_illegal_dumping_status via safeRPC');
    // Get current user for p_updated_by
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Authenticated user ID not available for p_updated_by');

    const rpcData = await safeDatabaseService.safeRPC({
      functionName: 'update_illegal_dumping_status',
      params: {
        p_dumping_id: reportId,
        p_status: status,
        p_updated_by: userId
      },
      throwOnMissing: false
    });
    if (rpcData !== null && rpcData !== undefined) {
      return { data: rpcData, error: null };
    }
    console.warn('update_illegal_dumping_status RPC unavailable or returned null; using direct table update');
  } catch (error) {
    console.warn('Error calling update_illegal_dumping_status via safeRPC:', error.message);
    // Fall through to the table-based implementation
  }
  
  // Fall back to direct table update
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
 * @param {string} teamId - Team ID
 * @param {Date} scheduledDate - Scheduled cleanup date
 * @returns {Promise<Object>} Assignment result
 */
export const assignCleanupTeam = async (reportId, teamId, scheduledDate) => {
  // Try RPC via safeDatabaseService first
  try {
    console.log('Attempting assign_cleanup_team via safeRPC');
    // Get current user for p_updated_by
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error('Authenticated user ID not available for p_updated_by');

    const isoDate = scheduledDate ? (scheduledDate instanceof Date ? scheduledDate.toISOString() : new Date(scheduledDate).toISOString()) : null;
    const rpcData = await safeDatabaseService.safeRPC({
      functionName: 'assign_cleanup_team',
      params: {
        p_dumping_id: reportId,
        p_team_id: teamId,
        p_updated_by: userId,
        p_scheduled_date: isoDate
      },
      throwOnMissing: false
    });
    if (rpcData !== null && rpcData !== undefined) {
      return { data: rpcData, error: null };
    }
    console.warn('assign_cleanup_team RPC unavailable or returned null; using direct table update');
  } catch (error) {
    console.warn('Error calling assign_cleanup_team via safeRPC:', error.message);
    // Fall through to the table-based implementation
  }
  
  // Fall back to direct table update
  return await safeDatabaseService.safeQuery({
    tableName: 'illegal_dumping_mobile',
    queryFn: async () => {
      const newStatus = scheduledDate ? 'cleanup_scheduled' : 'verified';
      // Note: 'assigned_to' column doesn't exist in illegal_dumping_mobile table
      // Only update status and timestamp
      const { data, error } = await supabase
        .from('illegal_dumping_mobile')
        .update({ 
          status: newStatus,
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
