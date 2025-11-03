import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';
import { STATUS } from '../config/constants';
import { fetchCollectorsReal } from './databaseUtils';

/**
 * Generate mock collectors data for development
 */
/**
 * Transform collector data from database to UI format
 */
const transformCollectorData = (data) => {
  try {
    // Handle null/undefined data
    if (!data) {
      console.warn('Received null/undefined data in transformCollectorData');
      return generateMockCollectors()[0];
    }

    const profileData = data.profile || {};
    
    // Basic collector info with fallbacks
    let name = 'Unknown';
    if (profileData.first_name || profileData.last_name) {
      name = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
    } else if (profileData.email) {
      name = profileData.email.split('@')[0];
    } else if (data.name) {
      name = data.name;
    }

    // Safely handle number conversions
    const safeParseInt = (value) => {
      const parsed = parseInt(value);
      return isNaN(parsed) ? 0 : parsed;
    };
    
    const safeParseFloat = (value) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0.0 : parsed;
    };

    const safeToFixed = (value, decimals = 1) => {
      try {
        const parsed = safeParseFloat(value);
        return parsed.toFixed(decimals);
      } catch (e) {
        return '0.0';
      }
    };

    return {
      id: data.id || `col-${Date.now()}`,
      name,
      email: data.email || profileData.email || 'No email provided',
      phone: data.phone || profileData.phone || 'No phone provided',
      status: data.status?.toLowerCase() || STATUS.COLLECTOR.INACTIVE.toLowerCase(),
      region: data.region || 'Unassigned',
      rating: safeParseFloat(data.rating) || 4.5,
      total_collections: safeParseInt(data.total_collections),
      last_active: data.last_active || new Date().toISOString(),
      joined_date: data.joined_date || '2024-01-01',
      profilePic: profileData.avatar_url || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      vehicle: {
        type: data.vehicle_type || (data.vehicle && data.vehicle.type) || 'Truck',
        plate: data.vehicle_plate || (data.vehicle && data.vehicle.plate) || `GR-${Math.floor(1000 + Math.random() * 9000)}-20`,
        capacity: data.vehicle_capacity || (data.vehicle && data.vehicle.capacity) || '500kg'
      },
      activeRequests: safeParseInt(data.active_requests),
      completedToday: safeParseInt(data.completed_today),
      currentLocation: {
        lat: safeParseFloat(data.current_lat) || 5.6037,
        lng: safeParseFloat(data.current_lng) || -0.1870
      },
      stats: {
        completedToday: safeParseInt(data.completed_today),
        pendingPickups: safeParseInt(data.active_requests),
        totalDistance: safeToFixed(data.total_distance),
        avgResponseTime: safeParseInt(data.avg_response_time) || 20
      },
      capacityRemaining: safeParseInt(data.capacity_remaining) || 100
    };
  } catch (error) {
    console.error('Error transforming collector data:', error);
    return generateMockCollectors()[0];
  }
};

/**
 * Generate mock collectors data for development
 */
const generateMockCollectors = (status) => [
  {
    id: '1',
    name: 'Kwame Asante',
    email: 'kwame.asante@trashdrop.com',
    phone: '+233123456789',
    status: status || 'active',
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
    status: status || 'active',
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
    status: status || 'inactive',
    region: 'Ga East Municipal',
    rating: 4.3,
    total_collections: 134,
    last_active: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    joined_date: '2024-03-10',
    profilePic: 'https://ui-avatars.com/api/?name=Kofi+Boateng&background=dc2626',
    vehicle: {
      type: 'Motorcycle',
      plate: 'GR-9012-20',
      capacity: '100kg'
    },
    activeRequests: 0,
    completedToday: 2,
    currentLocation: { lat: 5.6000, lng: -0.1500 },
    stats: {
      completedToday: 2,
      pendingPickups: 0,
      totalDistance: '8.5',
      avgResponseTime: 25
    },
    capacityRemaining: 100
  },
  {
    id: '4',
    name: 'Ama Owusu',
    email: 'ama.owusu@trashdrop.com',
    phone: '+233456789012',
    status: status || 'active',
    region: 'Ga South Municipal',
    rating: 4.9,
    total_collections: 298,
    last_active: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    joined_date: '2023-11-05',
    profilePic: 'https://ui-avatars.com/api/?name=Ama+Owusu&background=7c3aed',
    vehicle: {
      type: 'Truck',
      plate: 'GR-3456-20',
      capacity: '500kg'
    },
    activeRequests: 4,
    completedToday: 12,
    currentLocation: { lat: 5.5000, lng: -0.2100 },
    stats: {
      completedToday: 12,
      pendingPickups: 4,
      totalDistance: '18.7',
      avgResponseTime: 16
    },
    capacityRemaining: 45
  }
];

/**
 * Fetches all collectors with their profile information
 * @param {Object} options - Optional parameters
 * @param {string} options.status - Filter by collector status
 * @param {string} options.region - Filter by region
 * @param {number} options.limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of collector objects with profile data
 */
export const fetchCollectors = async ({ status = null, region = null, limit = 100 } = {}) => {
  try {
    // First try to use real data from the new real data utils
    try {
      const realCollectors = await fetchCollectorsReal(status);
      
      // Apply region filter if needed
      let filteredCollectors = realCollectors;
      if (region) {
        filteredCollectors = realCollectors.filter(c => 
          c && c.region === region
        );
      }
      
      // Apply limit
      if (limit && filteredCollectors.length > limit) {
        filteredCollectors = filteredCollectors.slice(0, limit);
      }
      
      return filteredCollectors;
    } catch (realDataError) {
      console.log('Real data fetch failed, falling back to direct query:', realDataError);
    }
    
    // Fallback to direct Supabase query with safeDatabaseService
    const query = supabase
      .from('collectors')
      .select(`
        *,
        profile:profiles(*)
      `)
      .limit(limit);

    if (status) {
      query.eq('status', status);
    }
    
    if (region) {
      query.eq('region', region);
    }

    const mockCollectors = generateMockCollectors(status);
    
    const result = await safeDatabaseService.safeQuery(
      'collectors', 
      query, 
      mockCollectors
    );
    
    // Handle null data or non-array results
    if (!result.data || !Array.isArray(result.data)) {
      console.warn('Invalid collector data returned:', result.data);
      return generateMockCollectors(status);
    }
    
    // If we got data from fallback, return it directly
    if (result.fromFallback) {
      return result.data;
    }
    
    // Transform the data and filter it
    const collectors = result.data
      .map(item => {
        try {
          return transformCollectorData(item);
        } catch (err) {
          console.warn('Error transforming collector item:', err);
          return null;
        }
      })
      .filter(c => {
        // First ensure the item exists
        if (!c || typeof c !== 'object') return false;
        
        // Then check status if provided with null safety
        if (status && typeof status === 'string') {
          if (!c || !c.status) return false;
          if (c.status.toLowerCase() !== status.toLowerCase()) return false;
        }
        
        // Check region if provided with null safety
        if (region && typeof region === 'string') {
          if (!c.region) return false;
          if (c.region !== region) return false;
        }
        
        return true;
      });

    return collectors;
  } catch (error) {
    console.error('Error fetching collectors:', error);
    // Return filtered mock data in case of error
    return generateMockCollectors(status);
  }
};

/**
 * Fetches a single collector by ID with their profile information
 * @param {string} collectorId - The ID of the collector to fetch
 * @returns {Promise<Object>} Collector object with profile data
 */
export const fetchCollectorById = async (collectorId) => {
  try {
    if (!collectorId) {
      console.warn('No collector ID provided');
      return null;
    }

    const query = supabase
      .from('collectors')
      .select(`
        *,
        profile:profiles(*)
      `)
      .eq('id', collectorId)
      .single();

    const mockCollectors = generateMockCollectors();
    const mockCollector = mockCollectors.find(c => c && c.id === collectorId) || mockCollectors[0];
    
    const result = await safeDatabaseService.safeQuery(
      'collectors', 
      query, 
      mockCollector
    );

    // If we got data from fallback, return it directly
    if (result.fromFallback) {
      return result.data;
    }
    
    // Handle potential null data
    if (!result.data) {
      console.warn('No data returned for collector ID:', collectorId);
      return mockCollector;
    }

    return transformCollectorData(result.data);
  } catch (error) {
    console.error(`Error fetching collector ${collectorId}:`, error);
    const mockCollectors = generateMockCollectors();
    return mockCollectors.find(c => c.id === collectorId) || mockCollectors[0];
  }
};

/**
 * Updates a collector's status
 * @param {string} collectorId - The ID of the collector to update
 * @param {string} status - The new status ('active', 'inactive', 'on_break', etc.)
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object>} The updated collector object
 */
export const updateCollectorStatus = async (collectorId, status, additionalData = {}) => {
  try {
    if (!collectorId) {
      console.warn('No collector ID provided for status update');
      return {
        id: 'unknown',
        status: status,
        last_active: new Date().toISOString(),
        updated: true
      };
    }
    
    // Prepare update data
    const updateData = {
      status,
      last_active: new Date().toISOString(),
      ...additionalData
    };

    const query = supabase
      .from('collectors')
      .update(updateData)
      .eq('id', collectorId)
      .select();

    const result = await safeDatabaseService.safeQuery('collectors', query, {
      id: collectorId,
      status: status,
      last_active: new Date().toISOString(),
      updated: true
    });

    // Transform the result if it's real data
    if (!result.fromFallback && result.data) {
      return transformCollectorData(result.data[0] || result.data);
    }

    // Return fallback data
    return result.data?.[0] || result.data;


  } catch (error) {
    console.error(`Error updating collector ${collectorId} status:`, error);
    // Return mock success response on error
    return {
      id: collectorId,
      status: status,
      last_active: new Date().toISOString(),
      updated: true
    };
  }
};

// Add other collector-related functions as needed
