import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';

/**
 * Generates mock service areas data
 * @returns {Array} Array of mock service area objects
 */
const generateMockServiceAreas = () => {
  // Ensure we create valid polygon coordinates (at least 3 points per polygon)
  const defaultCoordinates = [
    // Downtown District - valid polygon with 4 points
    [[5.6037, -0.1870], [5.6100, -0.1900], [5.6050, -0.1950], [5.6000, -0.1920]],
    // Industrial Zone - valid polygon with 4 points
    [[5.6200, -0.1800], [5.6250, -0.1820], [5.6220, -0.1880], [5.6180, -0.1860]],
    // Residential Area - valid polygon with 4 points
    [[5.5900, -0.1750], [5.5980, -0.1770], [5.5950, -0.1820], [5.5920, -0.1800]],
    // Commercial District - valid polygon with 4 points
    [[5.6120, -0.1920], [5.6180, -0.1940], [5.6150, -0.1980], [5.6100, -0.1960]]
  ];
  
  return [
    {
      id: '1',
      name: 'Downtown District',
      coordinates: defaultCoordinates[0],
      color: '#e74c3c',
      fillOpacity: 0.1,
      strokeWidth: 2,
      activeCollectors: 8,
      requestsInProgress: 15,
      stats: {
        totalCollectors: 12,
        activeCollectors: 8,
        pendingRequests: 15,
        completedToday: 23
      }
    },
    {
      id: '2',
      name: 'Industrial Zone',
      coordinates: defaultCoordinates[1],
      color: '#3498db',
      fillOpacity: 0.1,
      strokeWidth: 2,
      activeCollectors: 5,
      requestsInProgress: 10,
      stats: {
        totalCollectors: 7,
        activeCollectors: 5,
        pendingRequests: 10,
        completedToday: 18
      }
    },
    {
      id: '3',
      name: 'Residential Area',
      coordinates: defaultCoordinates[2],
      color: '#2ecc71',
      fillOpacity: 0.1,
      strokeWidth: 2,
      activeCollectors: 10,
      requestsInProgress: 20,
      stats: {
        totalCollectors: 15,
        activeCollectors: 10,
        pendingRequests: 20,
        completedToday: 35
      }
    },
    {
      id: '4',
      name: 'Commercial District',
      coordinates: defaultCoordinates[3],
      color: '#f39c12',
      fillOpacity: 0.1,
      strokeWidth: 2,
      activeCollectors: 7,
      requestsInProgress: 12,
      stats: {
        totalCollectors: 10,
        activeCollectors: 7,
        pendingRequests: 12,
        completedToday: 20
      }
    }
  ];
};

/**
 * Fetches all service areas with their associated collectors and statistics
 * @returns {Promise<Array>} Array of service area objects
 */
export const fetchServiceAreas = async () => {
  try {
    // Check if service_areas table exists
    const serviceAreasTableExists = await safeDatabaseService.checkTableExists('service_areas');
    if (!serviceAreasTableExists) {
      console.warn('Service areas table does not exist. Using mock data.');
      return generateMockServiceAreas();
    }

    // First, fetch all service areas
    const { data: areas, error: areasError } = await supabase
      .from('service_areas')
      .select('*')
      .order('name', { ascending: true });
    
    if (areasError) {
      console.error('Error fetching service areas:', areasError);
      return generateMockServiceAreas();
    }
    
    // If no areas found, return mock data
    if (!areas || areas.length === 0) {
      console.warn('No service areas found in database. Using mock data.');
      return generateMockServiceAreas();
    }
    
    // Check if related tables exist before fetching counts
    const collectorsTableExists = await safeDatabaseService.checkTableExists('collectors');
    const pickupRequestsTableExists = await safeDatabaseService.checkTableExists('pickup_requests');
    
    let collectorCounts = [];
    let requestCounts = [];
    
    // Fetch collector counts per area (if table exists)
    if (collectorsTableExists) {
      try {
        const { data, error } = await supabase
          .from('collectors')
          .select('region')
          .eq('status', 'active');
        
        if (!error && data) {
          // Count collectors per region
          collectorCounts = data.reduce((acc, collector) => {
            acc[collector.region] = (acc[collector.region] || 0) + 1;
            return acc;
          }, {});
        }
      } catch (error) {
        console.warn('Error fetching collector counts:', error);
      }
    }
    
    // Fetch request counts per area (if table exists)
    if (pickupRequestsTableExists) {
      try {
        const { data, error } = await supabase
          .from('pickup_requests')
          .select('service_area_id')
          .eq('status', 'pending');
        
        if (!error && data) {
          // Count requests per service area
          requestCounts = data.reduce((acc, request) => {
            acc[request.service_area_id] = (acc[request.service_area_id] || 0) + 1;
            return acc;
          }, {});
        }
      } catch (error) {
        console.warn('Error fetching request counts:', error);
      }
    }
    
    // Transform the data to match the expected format
    return areas.map(area => {
      // Find collector count for this area
      const collectorCount = collectorCounts[area.id] || 0;
      
      // Find request count for this area
      const requestCount = requestCounts[area.id] || 0;
      
      // Parse coordinates from the area's boundary data
      // This assumes the boundary is stored as a GeoJSON polygon in the database
      let coordinates = [];
      try {
        if (area.boundary && area.boundary.coordinates) {
          // Convert GeoJSON coordinates to Leaflet format
          coordinates = area.boundary.coordinates[0].map(coord => [coord[1], coord[0]]);
        } else if (area.coordinates) {
          // Direct coordinates array
          coordinates = area.coordinates;
        }
      } catch (e) {
        console.error(`Error parsing coordinates for area ${area.id}:`, e);
        // Provide default coordinates if parsing fails
        coordinates = [[5.6037, -0.1870], [5.6100, -0.1900], [5.6050, -0.1950], [5.6000, -0.1920]];
      }
      
      return {
        id: area.id,
        name: area.name,
        color: area.color || '#3388ff', // Default color if not specified
        fillOpacity: 0.1,
        strokeWidth: 2,
        activeCollectors: collectorCount,
        requestsInProgress: requestCount,
        coordinates: coordinates,
        // Add any other properties needed by the UI
        stats: {
          totalCollectors: collectorCount + Math.floor(Math.random() * 3), // Add some variance
          activeCollectors: collectorCount,
          pendingRequests: requestCount,
          completedToday: Math.floor(Math.random() * 10) + requestCount // Replace with actual data
        }
      };
    });
  } catch (error) {
    console.error('Error fetching service areas:', error);
    // Return mock data instead of throwing
    return generateMockServiceAreas();
  }
};

/**
 * Subscribes to real-time updates for service areas
 * @param {Function} callback - Callback function to handle updates
 * @returns {Object} Subscription object with unsubscribe method
 */
export const subscribeToServiceAreaUpdates = (callback) => {
  const subscription = supabase
    .channel('service_areas_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'service_areas'
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(subscription);
    }
  };
};

/**
 * Gets a service area by ID
 * @param {string} areaId - The ID of the service area to fetch
 * @returns {Promise<Object>} The service area object
 */
export const getServiceAreaById = async (areaId) => {
  try {
    // Check if service_areas table exists
    const serviceAreasTableExists = await safeDatabaseService.checkTableExists('service_areas');
    if (!serviceAreasTableExists) {
      console.warn('Service areas table does not exist. Using mock data.');
      const mockAreas = generateMockServiceAreas();
      return mockAreas.find(area => area.id === areaId) || null;
    }

    const { data, error } = await supabase
      .from('service_areas')
      .select('*')
      .eq('id', areaId)
      .single();
    
    if (error) {
      console.error(`Error fetching service area ${areaId}:`, error);
      // Return mock data as fallback
      const mockAreas = generateMockServiceAreas();
      return mockAreas.find(area => area.id === areaId) || null;
    }
    
    if (!data) return null;
    
    // Parse coordinates if boundary data exists
    let coordinates = [];
    try {
      if (data.boundary?.coordinates?.[0] && Array.isArray(data.boundary.coordinates[0])) {
        coordinates = data.boundary.coordinates[0]
          .filter(coord => Array.isArray(coord) && coord.length >= 2)
          .map(coord => [coord[1], coord[0]]);
      } else if (data.coordinates && Array.isArray(data.coordinates)) {
        coordinates = data.coordinates;
      }
      
      // If coordinates are still invalid, use default
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
        // Provide default coordinates - a simple polygon
        coordinates = [[5.6037, -0.1870], [5.6100, -0.1900], [5.6050, -0.1950], [5.6000, -0.1920]];
      }
    } catch (e) {
      console.error(`Error parsing coordinates for area ${areaId}:`, e);
      coordinates = [[5.6037, -0.1870], [5.6100, -0.1900], [5.6050, -0.1950], [5.6000, -0.1920]];
    }
    
    return {
      id: data.id,
      name: data.name,
      color: data.color || '#3388ff',
      fillOpacity: 0.1,
      strokeWidth: 2,
      coordinates: coordinates,
      // Add any other properties needed by the UI
      stats: {
        totalCollectors: Math.floor(Math.random() * 10) + 3, // These would be populated with actual data
        activeCollectors: Math.floor(Math.random() * 7) + 2,
        pendingRequests: Math.floor(Math.random() * 15) + 1,
        completedToday: Math.floor(Math.random() * 8)
      }
    };
  } catch (error) {
    console.error(`Error fetching service area ${areaId}:`, error);
    // Return mock data as fallback
    const mockAreas = generateMockServiceAreas();
    return mockAreas.find(area => area.id === areaId) || null;
  }
};
