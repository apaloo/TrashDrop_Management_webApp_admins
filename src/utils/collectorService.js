import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';
import { STATUS } from '../config/constants';

/**
 * Transform collector profile rows into the structure expected by the UI
 */
const transformCollectorData = (profile) => {
  if (!profile) {
    return null;
  }

  const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
  const status = (profile.status ?? STATUS.COLLECTOR.INACTIVE).toLowerCase();

  const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    id: profile.id,
    userId: profile.user_id,
    name: fullName || profile.email || 'Unknown Collector',
    email: profile.email ?? 'No email provided',
    phone: profile.phone ?? 'No phone provided',
    status,
    region: profile.region ?? profile.assigned_region ?? 'Unassigned',
    rating: safeNumber(profile.rating, 0),
    total_collections: safeNumber(profile.total_collections, 0),
    last_active: profile.updated_at,
    joined_date: profile.created_at,
    profilePic: profile.profile_image_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'Collector')}&background=random`,
    vehicle: {
      type: profile.vehicle_type ?? 'Truck',
      plate: profile.license_plate ?? 'N/A',
      capacity: profile.vehicle_capacity ?? 'N/A'
    },
    activeRequests: safeNumber(profile.active_requests, 0),
    completedToday: safeNumber(profile.completed_today, 0),
    currentLocation: {
      lat: safeNumber(profile.current_latitude, null),
      lng: safeNumber(profile.current_longitude, null)
    },
    stats: {
      completedToday: safeNumber(profile.completed_today, 0),
      pendingPickups: safeNumber(profile.active_requests, 0),
      totalDistance: profile.total_distance ?? '0',
      avgResponseTime: safeNumber(profile.avg_response_time, 0)
    },
    capacityRemaining: safeNumber(profile.capacity_remaining, 0),
    notes: profile.notes ?? '',
    assignedRegion: profile.assigned_region ?? null
  };
};

/**
 * Fetches all collectors with their profile information
 * @param {Object} options - Optional parameters
 * @param {string} options.status - Filter by collector status
 * @param {string} options.region - Filter by region
 * @param {number} options.limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of collector objects with profile data
 */
export const fetchCollectors = async ({ status = null, region = null, limit = 100 } = {}) => {
  const { data } = await safeDatabaseService.safeQuery({
    tableName: 'collector_profiles',
    throwOnMissing: true,
    enableMock: false,
    queryFn: async () => {
      let query = supabase
        .from('collector_profiles')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          region,
          status,
          vehicle_type,
          vehicle_plate,
          vehicle_capacity,
          company_name,
          created_at,
          updated_at,
          rating,
          total_collections,
          completed_today,
          active_requests,
          current_latitude,
          current_longitude,
          assigned_region,
          profile_image_url,
          notes
        `)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      if (region) {
        query = query.eq('region', region);
      }

      return query;
    }
  });

  return (data ?? [])
    .map(transformCollectorData)
    .filter(Boolean);
};

/**
 * Fetches a single collector by ID with their profile information
 * @param {string} collectorId - The ID of the collector to fetch
 * @returns {Promise<Object>} Collector object with profile data
 */
export const fetchCollectorById = async (collectorId) => {
  if (!collectorId) {
    throw new Error('Collector ID is required');
  }

  const { data } = await safeDatabaseService.safeQuery({
    tableName: 'collector_profiles',
    throwOnMissing: true,
    enableMock: false,
    queryFn: async () =>
      supabase
        .from('collector_profiles')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          region,
          status,
          vehicle_type,
          vehicle_plate,
          vehicle_capacity,
          company_name,
          created_at,
          updated_at,
          rating,
          total_collections,
          completed_today,
          active_requests,
          current_latitude,
          current_longitude,
          assigned_region,
          profile_image_url,
          notes
        `)
        .eq('id', collectorId)
        .single()
  });

  return transformCollectorData(data);
};

/**
 * Updates a collector's status
 * @param {string} collectorId - The ID of the collector to update
 * @param {string} status - The new status ('active', 'inactive', 'on_break', etc.)
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object>} The updated collector object
 */
export const updateCollectorStatus = async (collectorId, status, additionalData = {}) => {
  if (!collectorId) {
    throw new Error('Collector ID is required to update status');
  }

  const payload = {
    status,
    updated_at: new Date().toISOString(),
    ...additionalData
  };

  const { data } = await safeDatabaseService.safeQuery({
    tableName: 'collector_profiles',
    throwOnMissing: true,
    enableMock: false,
    queryFn: async () =>
      supabase
        .from('collector_profiles')
        .update(payload)
        .eq('id', collectorId)
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          region,
          status,
          vehicle_type,
          vehicle_plate,
          vehicle_capacity,
          company_name,
          created_at,
          updated_at,
          rating,
          total_collections,
          completed_today,
          active_requests,
          current_latitude,
          current_longitude,
          assigned_region,
          profile_image_url,
          notes
        `)
  });

  const updatedRow = Array.isArray(data) ? data[0] : data;
  return transformCollectorData(updatedRow);
};

// Add other collector-related functions as needed
