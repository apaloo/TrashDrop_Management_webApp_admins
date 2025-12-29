import { supabase } from './supabase';

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
 * 
 * DEPRECATED: Database service_areas table integration removed
 * Service areas now use mock data only with valid coordinates
 * 
 * @returns {Promise<Array>} Array of service area objects
 */
export const fetchServiceAreas = async () => {
  // DEPRECATED: Service areas table integration removed - using mock data only
  // Database service areas had missing coordinates causing rendering issues
  const mockAreas = generateMockServiceAreas();
  console.log('📍 Service Areas: Using mock data with valid coordinates', {
    count: mockAreas.length,
    areas: mockAreas.map(a => ({ id: a.id, name: a.name, coordCount: a.coordinates?.length }))
  });
  return mockAreas;
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
 * 
 * DEPRECATED: Database integration removed - using mock data only
 * 
 * @param {string} areaId - The ID of the service area to fetch
 * @returns {Promise<Object>} The service area object
 */
export const getServiceAreaById = async (areaId) => {
  // DEPRECATED: Database integration removed - using mock data only
  const mockAreas = generateMockServiceAreas();
  return mockAreas.find(area => area.id === areaId) || null;
};
