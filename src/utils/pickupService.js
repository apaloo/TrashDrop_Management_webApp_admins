import { supabase } from './supabase';

/**
 * Fetches pickup requests with optional filters
 * @param {Object} options - Filtering and pagination options
 * @param {string} options.status - Filter by status ('available', 'accepted', 'picked_up', 'disposed')
 * @param {string} options.collectorId - Filter by assigned collector ID
 * @param {number} options.limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of pickup request objects
 */
export const fetchPickupRequests = async ({ 
  status = null, 
  collectorId = null, 
  limit = 100 
} = {}) => {
  try {
    let query = supabase
      .from('pickup_requests')
      .select(`
        *,
        collector:collectors(
          id,
          profiles (
            first_name,
            last_name,
            avatar_url
          )
        ),
        location:locations!inner(*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    if (collectorId) {
      query = query.eq('collector_id', collectorId);
    }

    const { data, error } = await query;
    
    if (error) throw error;

    // Transform the data to match the expected format
    return data.map(request => ({
      id: request.id,
      location: {
        lat: parseFloat(request.location.latitude),
        lng: parseFloat(request.location.longitude)
      },
      status: this.formatStatus(request.status),
      address: request.location.address || 'Address not available',
      customer: request.location.location_name || 'Customer',
      phone: request.location.phone || '',
      requestTime: request.created_at,
      priority: this.getPriority(request.status, request.priority),
      collector: request.collector ? 
        `${request.collector.profiles.first_name || ''} ${request.collector.profiles.last_name || ''}`.trim() : 
        null,
      wasteType: request.waste_type || 'General',
      specialInstructions: request.special_instructions,
      scheduledDate: request.scheduled_date,
      originalData: request // Keep original data for reference
    }));
  } catch (error) {
    console.error('Error fetching pickup requests:', error);
    throw error;
  }
};

/**
 * Formats the status for display
 * @private
 */
const formatStatus = (status) => {
  const statusMap = {
    'available': 'New',
    'accepted': 'In Progress',
    'picked_up': 'Collected',
    'disposed': 'Completed'
  };
  return statusMap[status] || status;
};

/**
 * Determines priority based on status and priority
 * @private
 */
const getPriority = (status, priority) => {
  // If status is 'available' and no priority is set, default to 'Normal'
  if (status === 'available' && !priority) return 'Normal';
  
  // Map database priority to display priority
  const priorityMap = {
    'high': 'High',
    'medium': 'Normal',
    'low': 'Low'
  };
  
  return priorityMap[priority] || 'Normal';
};

/**
 * Updates the status of a pickup request
 * @param {string} requestId - The ID of the pickup request
 * @param {string} status - The new status
 * @param {string} collectorId - Optional collector ID to assign
 * @returns {Promise<Object>} The updated pickup request
 */
export const updatePickupStatus = async (requestId, status, collectorId = null) => {
  try {
    const updateData = { status };
    
    // If status is 'accepted' and collectorId is provided, assign the collector
    if (status === 'accepted' && collectorId) {
      updateData.collector_id = collectorId;
      updateData.accepted_at = new Date().toISOString();
    }
    
    // If status is 'picked_up', set picked_up_at timestamp
    if (status === 'picked_up') {
      updateData.picked_up_at = new Date().toISOString();
    }
    
    // If status is 'disposed', set disposed_at timestamp
    if (status === 'disposed') {
      updateData.disposed_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('pickup_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error updating pickup request ${requestId}:`, error);
    throw error;
  }
};

/**
 * Subscribes to real-time updates for pickup requests
 * @param {Function} callback - Callback function to handle updates
 * @returns {Object} Subscription object with unsubscribe method
 */
export const subscribeToPickupUpdates = (callback) => {
  const subscription = supabase
    .channel('pickup_requests_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pickup_requests'
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
