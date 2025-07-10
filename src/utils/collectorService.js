import { supabase } from './supabase';

/**
 * Fetches all collectors with their profile information
 * @returns {Promise<Array>} Array of collector objects with profile data
 */
export const fetchCollectors = async () => {
  try {
    const { data, error } = await supabase
      .from('collectors')
      .select(`
        *,
        profile:profiles!inner (
          first_name,
          last_name,
          avatar_url,
          email,
          phone
        )
      `);

    if (error) throw error;

    // Transform the data to match the expected format
    return data.map(collector => ({
      id: collector.id,
      name: `${collector.profile.first_name || ''} ${collector.profile.last_name || ''}`.trim() || collector.profile.email,
      email: collector.profile.email,
      phone: collector.phone || collector.profile.phone,
      status: collector.status || 'inactive',
      region: collector.region || 'Unassigned',
      rating: collector.rating || 0,
      total_collections: collector.total_collections || 0,
      last_active: collector.last_active,
      joined_date: collector.joined_date,
      profilePic: collector.profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(collector.profile.first_name || collector.profile.email.split('@')[0])}&background=random`,
      // Add any other fields needed for the UI
      vehicle: `TRK-${String(collector.id).substring(0, 4).toUpperCase()}`,
      currentLocation: { lat: 0, lng: 0 }, // Will be updated with real-time location if available
      stats: {
        completedToday: Math.floor(Math.random() * 10), // Replace with actual stats from database
        pendingPickups: Math.floor(Math.random() * 5), // Replace with actual stats from database
        totalDistance: (Math.random() * 20).toFixed(1), // Replace with actual stats from database
        avgResponseTime: Math.floor(Math.random() * 30) + 15 // Replace with actual stats from database
      },
      capacityRemaining: Math.floor(Math.random() * 100) // Replace with actual data if available
    }));
  } catch (error) {
    console.error('Error fetching collectors:', error);
    throw error;
  }
};

/**
 * Fetches a single collector by ID with their profile information
 * @param {string} collectorId - The ID of the collector to fetch
 * @returns {Promise<Object>} Collector object with profile data
 */
export const fetchCollectorById = async (collectorId) => {
  try {
    const { data, error } = await supabase
      .from('collectors')
      .select(`
        *,
        profile:profiles!inner (
          first_name,
          last_name,
          avatar_url,
          email,
          phone
        )
      `)
      .eq('id', collectorId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: `${data.profile.first_name || ''} ${data.profile.last_name || ''}`.trim() || data.profile.email,
      email: data.profile.email,
      phone: data.phone || data.profile.phone,
      status: data.status || 'inactive',
      region: data.region || 'Unassigned',
      rating: data.rating || 0,
      total_collections: data.total_collections || 0,
      last_active: data.last_active,
      joined_date: data.joined_date,
      profilePic: data.profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.profile.first_name || data.profile.email.split('@')[0])}&background=random`,
      vehicle: `TRK-${String(data.id).substring(0, 4).toUpperCase()}`,
      currentLocation: { lat: 0, lng: 0 },
      stats: {
        completedToday: Math.floor(Math.random() * 10),
        pendingPickups: Math.floor(Math.random() * 5),
        totalDistance: (Math.random() * 20).toFixed(1),
        avgResponseTime: Math.floor(Math.random() * 30) + 15
      },
      capacityRemaining: Math.floor(Math.random() * 100)
    };
  } catch (error) {
    console.error(`Error fetching collector ${collectorId}:`, error);
    throw error;
  }
};

/**
 * Updates a collector's status
 * @param {string} collectorId - The ID of the collector to update
 * @param {string} status - The new status ('Active', 'Inactive', 'On Break', etc.)
 * @returns {Promise<Object>} The updated collector object
 */
export const updateCollectorStatus = async (collectorId, status) => {
  try {
    const { data, error } = await supabase
      .from('collectors')
      .update({ 
        status,
        last_active: new Date().toISOString()
      })
      .eq('id', collectorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error updating collector ${collectorId} status:`, error);
    throw error;
  }
};

// Add other collector-related functions as needed
