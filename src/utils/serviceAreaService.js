import { supabase } from './supabase';

/**
 * Fetches all service areas with their associated collectors and statistics
 * @returns {Promise<Array>} Array of service area objects
 */
export const fetchServiceAreas = async () => {
  try {
    // First, fetch all service areas
    const { data: areas, error: areasError } = await supabase
      .from('service_areas')
      .select('*')
      .order('name', { ascending: true });
    
    if (areasError) throw areasError;
    
    // If no areas found, return empty array
    if (!areas || areas.length === 0) return [];
    
    // Fetch collector counts per area
    const { data: collectorCounts, error: countsError } = await supabase
      .from('collectors')
      .select('region, count')
      .eq('status', 'active')
      .group('region');
    
    if (countsError) console.error('Error fetching collector counts:', countsError);
    
    // Fetch request counts per area
    const { data: requestCounts, error: requestsError } = await supabase
      .from('pickup_requests')
      .select('location:locations(region), count')
      .eq('status', 'available')
      .group('location.region');
    
    if (requestsError) console.error('Error fetching request counts:', requestsError);
    
    // Transform the data to match the expected format
    return areas.map(area => {
      // Find collector count for this area
      const collectorCount = collectorCounts?.find(c => c.region === area.id)?.count || 0;
      
      // Find request count for this area
      const requestCount = requestCounts?.find(r => r.region === area.id)?.count || 0;
      
      // Parse coordinates from the area's boundary data
      // This assumes the boundary is stored as a GeoJSON polygon in the database
      let coordinates = [];
      try {
        if (area.boundary && area.boundary.coordinates) {
          // Convert GeoJSON coordinates to Leaflet format
          coordinates = area.boundary.coordinates[0].map(coord => [coord[1], coord[0]]);
        }
      } catch (e) {
        console.error(`Error parsing coordinates for area ${area.id}:`, e);
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
          totalCollectors: collectorCount,
          activeCollectors: collectorCount,
          pendingRequests: requestCount,
          completedToday: Math.floor(Math.random() * 10) // Replace with actual data
        }
      };
    });
  } catch (error) {
    console.error('Error fetching service areas:', error);
    throw error;
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
    const { data, error } = await supabase
      .from('service_areas')
      .select('*')
      .eq('id', areaId)
      .single();
    
    if (error) throw error;
    if (!data) return null;
    
    // Parse coordinates if boundary data exists
    let coordinates = [];
    if (data.boundary?.coordinates?.[0]) {
      coordinates = data.boundary.coordinates[0].map(coord => [coord[1], coord[0]]);
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
        totalCollectors: 0, // These would be populated with actual data
        activeCollectors: 0,
        pendingRequests: 0,
        completedToday: 0
      }
    };
  } catch (error) {
    console.error(`Error fetching service area ${areaId}:`, error);
    throw error;
  }
};
