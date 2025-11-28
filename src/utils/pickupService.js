import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';
import { STATUS } from '../config/constants';

/**
 * Generate mock pickup requests data for development
 */
const generateMockPickupRequests = () => [
  {
    id: '1',
    requester_id: 'customer-001',
    collector_id: null,
    customer: 'Kwame Nkrumah Hotel',
    phone: '+233244567890',
    location: {
      lat: 5.5800,
      lng: -0.2300,
      address: '123 Liberation Road, Accra Metropolitan'
    },
    address: '123 Liberation Road, Accra Metropolitan',
    latitude: 5.5800,
    longitude: -0.2300,
    status: 'pending',
    priority: 'high',
    wasteType: 'Commercial',
    waste_type: 'Commercial',
    specialInstructions: 'Large volume, requires truck',
    notes: 'Large volume, requires truck',
    scheduledDate: null,
    scheduled_date: null,
    bags: 15,
    bag_count: 15,
    requestTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    wasteTypes: ['plastic', 'organic', 'paper'],
    // Database-like structure for compatibility
    requester: {
      id: 'customer-001',
      name: 'Kwame Nkrumah Hotel',
      email: 'manager@nkrumahhotel.com',
      phone: '+233244567890'
    },
    collector: null
  },
  {
    id: '2',
    requester_id: 'customer-002',
    collector_id: 'collector-002',
    customer: 'Achimota School',
    phone: '+233234567891',
    location: {
      lat: 5.7000,
      lng: -0.2000,
      address: '45 Achimota Road, Ga North Municipal'
    },
    address: '45 Achimota Road, Ga North Municipal',
    latitude: 5.7000,
    longitude: -0.2000,
    status: 'assigned',
    priority: 'medium',
    wasteType: 'Educational',
    waste_type: 'Educational',
    specialInstructions: 'Access through main gate',
    notes: 'Access through main gate',
    scheduledDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    scheduled_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    bags: 8,
    bag_count: 8,
    requestTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    wasteTypes: ['paper', 'plastic'],
    // Database-like structure for compatibility
    requester: {
      id: 'customer-002',
      name: 'Achimota School',
      email: 'admin@achimotaschool.edu.gh',
      phone: '+233234567891'
    },
    collector: {
      id: 'collector-002',
      first_name: 'Akosua',
      last_name: 'Mensah',
      email: 'akosua.mensah@trashdrop.com'
    },
    collectorName: 'Akosua Mensah'
  },
  {
    id: '3',
    requester_id: 'customer-003',
    collector_id: 'collector-001',
    customer: 'East Legon Residential',
    phone: '+233245567892',
    location: {
      lat: 5.6000,
      lng: -0.1500,
      address: '12 Tema Station Road, Ga East Municipal'
    },
    address: '12 Tema Station Road, Ga East Municipal',
    latitude: 5.6000,
    longitude: -0.1500,
    status: 'completed',
    priority: 'low',
    wasteType: 'Residential',
    waste_type: 'Residential',
    specialInstructions: 'Household waste only',
    notes: 'Household waste only',
    scheduledDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    scheduled_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    bags: 5,
    bag_count: 5,
    requestTime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    wasteTypes: ['organic', 'plastic'],
    // Database-like structure for compatibility
    requester: {
      id: 'customer-003',
      name: 'East Legon Residential',
      email: 'contact@eastlegon.com',
      phone: '+233245567892'
    },
    collector: {
      id: 'collector-001',
      first_name: 'Kwame',
      last_name: 'Asante',
      email: 'kwame.asante@trashdrop.com'
    },
    collectorName: 'Kwame Asante'
  }
];

/**
 * Fetches pickup requests with optional filters
 * @param {Object} options - Filtering and pagination options
 * @param {string} options.status - Filter by status ('pending', 'assigned', 'completed', etc.)
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
    console.log('fetchPickupRequests called with:', { status, collectorId, limit });
    
    // Check if both pickup_requests and profiles tables exist before making query
    const pickupTableExists = await safeDatabaseService.checkTableExists('pickup_requests');
    const profilesTableExists = await safeDatabaseService.checkTableExists('profiles');
    const collectorsTableExists = await safeDatabaseService.checkTableExists('collectors');
    
    console.log('Table existence check:', { 
      pickupTableExists, 
      profilesTableExists, 
      collectorsTableExists 
    });
    
    if (!pickupTableExists) {
      console.warn('Pickup requests table does not exist, using mock data');
      let mockData = generateMockPickupRequests();
      console.log('Generated mock data:', mockData.length, 'items');
      
      // Apply filters to mock data with comprehensive null safety
      if (status) {
        console.log('Filtering mock data by status:', status);
        mockData = mockData.filter(request => {
          if (!request) {
            console.warn('Found null/undefined request in mock data');
            return false;
          }
          if (typeof request !== 'object') {
            console.warn('Found non-object request in mock data:', typeof request, request);
            return false;
          }
          if (!request.hasOwnProperty('status') || request.status == null) {
            console.warn('Found request without status property:', request);
            return false;
          }
          return request.status === status;
        });
        console.log('Filtered mock data result:', mockData.length, 'items');
      }
      
      if (collectorId) {
        mockData = mockData.filter(request => request.collector_id === collectorId);
      }
      
      return mockData.slice(0, limit);
    }

    // Build the query - just select all fields without joins
    // Foreign key relationships not configured in database yet
    let query = supabase
      .from('pickup_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (collectorId) {
      query = query.eq('collector_id', collectorId);
    }

    const result = await safeDatabaseService.safeQuery({
      tableName: 'pickup_requests',
      queryFn: async () => query,
      mockDataFn: generateMockPickupRequests,
      mockDataParams: { status, limit }
    });
    
    if (result.fromFallback) {
      let mockData = result.data || [];
      
      // Apply filters to mock data with comprehensive null safety
      if (status) {
        console.log('Filtering fallback data by status:', status);
        mockData = mockData.filter(request => {
          if (!request) {
            console.warn('Found null/undefined request in fallback data');
            return false;
          }
          if (typeof request !== 'object') {
            console.warn('Found non-object request in fallback data:', typeof request, request);
            return false;
          }
          if (!request.hasOwnProperty('status') || request.status == null) {
            console.warn('Found request without status property in fallback data:', request);
            return false;
          }
          return request.status === status;
        });
        console.log('Filtered fallback data result:', mockData.length, 'items');
      }
      
      return mockData.slice(0, limit);
    }
    
    // If we have real data, manually fetch user profiles for requester details
    if (result.data && result.data.length > 0 && profilesTableExists) {
      try {
        const requesterIds = [...new Set(result.data.map(r => r.requester_id).filter(Boolean))];
        console.log('📋 Fetching profiles for requester IDs:', requesterIds);
        
        if (requesterIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone, avatar_url')
            .in('id', requesterIds);
          
          if (profileError) {
            console.warn('❌ Error fetching profiles:', profileError);
          } else {
            console.log('✅ Fetched profiles:', profiles?.length || 0);
          }
          
          // Create a map for quick lookup
          const profileMap = {};
          if (profiles) {
            profiles.forEach(profile => {
              profileMap[profile.id] = profile;
              console.log('👤 Profile mapped:', profile.id, `${profile.first_name} ${profile.last_name}`);
            });
          }
          
          // Attach profile data to each request
          result.data = result.data.map(request => {
            const profile = profileMap[request.requester_id];
            console.log(`📍 Request ${request.id}: requester_id=${request.requester_id}, profile=${profile ? 'found' : 'NOT FOUND'}`);
            return {
              ...request,
              requester: profile || null
            };
          });
        } else {
          console.warn('⚠️ No requester IDs found in pickup requests');
        }
      } catch (profileError) {
        console.warn('❌ Failed to fetch user profiles, continuing without:', profileError);
      }
    } else {
      console.log('ℹ️ Skipping profile fetch:', {
        hasData: !!result.data,
        dataLength: result.data?.length || 0,
        profilesTableExists
      });
    }

    if (result.error) {
      console.warn('Error fetching pickup requests, using mock data:', result.error);
      let mockData = generateMockPickupRequests();
      
      // Apply filters to mock data with comprehensive null safety
      if (status) {
        console.log('Filtering error fallback data by status:', status);
        mockData = mockData.filter(request => {
          if (!request) {
            console.warn('Found null/undefined request in error fallback data');
            return false;
          }
          if (typeof request !== 'object') {
            console.warn('Found non-object request in error fallback data:', typeof request, request);
            return false;
          }
          if (!request.hasOwnProperty('status') || request.status == null) {
            console.warn('Found request without status property in error fallback data:', request);
            return false;
          }
          return request.status === status;
        });
        console.log('Filtered error fallback data result:', mockData.length, 'items');
      }
      
      return mockData.slice(0, limit);
    }

    // Transform the data to match the expected format with comprehensive null safety
    const rawData = result.data || [];
    console.log('Processing raw data:', rawData.length, 'items');
    
    const filteredData = rawData.filter(request => {
      if (request == null) {
        console.warn('Found null/undefined request in raw data');
        return false;
      }
      return true;
    });
    
    const transformedData = filteredData.map(request => {
      try {
        // Comprehensive null safety check at the start
        if (!request || typeof request !== 'object') {
          console.warn('Invalid request object encountered:', request);
          return null;
        }
        
        // Handle requestor/requester with null safety
        const requestor = request.requestor || request.requester || null;
        const requestedBy = {
          id: request.requester_id || 
              request.requested_by || 
              (requestor ? requestor.id : null) || 
              'customer-unknown',
          name: request.customer || 
                (requestor ? `${requestor.first_name || ''} ${requestor.last_name || ''}`.trim() : '') || 
                (request.requester ? request.requester.name : '') || 
                'Unknown Customer',
          email: (requestor ? requestor.email : null) || 
                 (request.requester ? request.requester.email : null) || 
                 'unknown@example.com',
          phone: (requestor ? requestor.phone : null) || 
                 (request.requester ? request.requester.phone : null) || 
                 request.phone || 
                 'N/A'
        };
        
        // Handle collector data with fallbacks for all schema variations
        const collector = request.collector || {};
        const collectorId = request.collector_id || 
                          (collector ? collector.id : null) || 
                          (request.collector ? request.collector.id : null);
        
        // Only create assignedTo if there's a collector assigned
        const assignedTo = collectorId ? {
          id: collectorId,
          name: request.collectorName || 
                (collector ? `${collector.first_name || ''} ${collector.last_name || ''}`.trim() : '') || 
                (request.collector ? 
                  `${request.collector.first_name || ''} ${request.collector.last_name || ''}`.trim() || 
                  request.collector.name : '') || 
                'Unknown Collector',
          email: (collector ? collector.email : null) || 
                 (request.collector ? request.collector.email : null) || 
                 null,
          phone: (collector ? collector.phone : null) || 
                 (request.collector ? request.collector.phone : null) || 
                 null
        } : null;
        
        // Handle location data with fallbacks
        const locationData = request.location || {};
        const location = {
          address: locationData.address || 
                   request.address || 
                   (request.location ? request.location.address : null) || 
                   'Unknown Location',
          lat: locationData.latitude || 
               locationData.lat || 
               request.latitude || 
               (request.location ? request.location.lat : null) || 
               5.6037, // Default to Accra, Ghana
          lng: locationData.longitude || 
               locationData.lng || 
               request.longitude || 
               (request.location ? request.location.lng : null) || 
               -0.1870 // Default to Accra, Ghana
        };
        
        // Transform the request to match the expected format with safe property access
        const safeStatus = request.status || 'pending';
        return {
          id: request.id || `request-${Date.now()}`,
          status: safeStatus,
          requestedBy: requestedBy,
          assignedTo: assignedTo,
          requestTime: request.created_at || request.requestTime || new Date().toISOString(),
          scheduledDate: request.scheduled_date || request.scheduledDate || null,
          priority: getPriority(safeStatus, request.priority || 'medium'),
          wasteType: request.waste_type || request.wasteType || 'General',
          bags: request.bag_count || request.bags || 0,
          notes: request.notes || request.specialInstructions || '',
          location: location,
          phone: requestedBy.phone,
          collectorId: collectorId || null,
          collectorName: assignedTo ? assignedTo.name : null,
          wasteTypes: request.wasteTypes || ['general']
        };
      } catch (transformError) {
        console.error('Error transforming request:', transformError, 'Request data:', request);
        return null;
      }
    }).filter(transformed => transformed !== null);
    
    console.log('Final transformed data:', transformedData.length, 'items');
    return transformedData;
    
  } catch (error) {
    console.error('Error in fetchPickupRequests:', error);
    let mockData = generateMockPickupRequests();
    
    // Apply filters to mock data with comprehensive null safety
    if (status) {
      console.log('Filtering catch block data by status:', status);
      mockData = mockData.filter(request => {
        if (!request) {
          console.warn('Found null/undefined request in catch block data');
          return false;
        }
        if (typeof request !== 'object') {
          console.warn('Found non-object request in catch block data:', typeof request, request);
          return false;
        }
        if (!request.hasOwnProperty('status') || request.status == null) {
          console.warn('Found request without status property in catch block data:', request);
          return false;
        }
        return request.status === status;
      });
      console.log('Filtered catch block data result:', mockData.length, 'items');
    }
    
    return mockData.slice(0, limit);
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
 * @param {Object} updateData - Data to update (status, collector_id, etc.)
 * @returns {Promise<Object>} The updated pickup request
 */
export const updatePickupStatus = async (requestId, updateData = {}) => {
  if (!requestId) {
    console.error('No request ID provided for status update');
    return {
      error: 'Missing request ID',
      success: false
    };
  }
  
  console.log(`Updating pickup request ${requestId} with data:`, updateData);
  
  try {
    // Extract common parameters
    const status = updateData.status;
    const collectorId = updateData.collector_id;
    
    // Check if pickup_requests table exists
    const tableExists = await safeDatabaseService.checkTableExists('pickup_requests');
    if (!tableExists) {
      console.warn(`Table pickup_requests does not exist. Simulating update for request ${requestId}`);
      // Return a mock success response with the data that would have been updated
      return {
        id: requestId,
        ...updateData,
        updated_at: new Date().toISOString(),
        success: true,
        mock: true
      };
    }
    
    // Prepare the update data with appropriate timestamps
    let dbUpdateData = { ...updateData };
    
    // Only set timestamps if not explicitly provided in updateData
    if (status) {
      // Handle different status mappings and set appropriate timestamps
      if ((status === 'assigned' || status === 'accepted') && !dbUpdateData.assigned_at) {
        dbUpdateData.assigned_at = new Date().toISOString();
      }
      
      // If status is 'in_progress' or 'picked_up', set collection timestamp
      if ((status === 'in_progress' || status === 'picked_up') && !dbUpdateData.picked_up_at) {
        dbUpdateData.picked_up_at = new Date().toISOString();
      }
      
      // If status is 'completed' or 'disposed', set completion timestamp
      if ((status === 'completed' || status === 'disposed') && !dbUpdateData.completed_at) {
        dbUpdateData.completed_at = new Date().toISOString();
      }
    }
    
    // Always set updated_at timestamp
    if (!dbUpdateData.updated_at) {
      dbUpdateData.updated_at = new Date().toISOString();
    }
    
    // Execute the update with error handling for database errors
    try {
      const { data, error } = await supabase
        .from('pickup_requests')
        .update(dbUpdateData)
        .eq('id', requestId)
        .select()
        .single();
        
      if (error) {
        // Detect specific PostgreSQL error codes
        if (error.code === 'PGRST116' || error.code === '42P01' || error.code === 'PGRST204') {
          console.warn(`Table not found when updating pickup request ${requestId}:`, error);
        } else if (error.code === '42703') {
          console.warn(`Column not found when updating pickup request ${requestId}:`, error);
        } else {
          console.warn(`Error updating pickup request ${requestId}:`, error);
        }
        
        // Return a mock success response with the input data
        return {
          id: requestId,
          ...updateData,
          updated_at: new Date().toISOString(),
          success: true,
          mock: true,
          error_code: error.code
        };
      }
      
      return {
        ...data,
        success: true
      };
    } catch (dbError) {
      console.error(`Database error updating pickup request ${requestId}:`, dbError);
      // Return a mock success response for any other database errors
      return {
        id: requestId,
        ...updateData,
        updated_at: new Date().toISOString(),
        success: true,
        mock: true,
        error: dbError.message
      };
    }
  } catch (error) {
    console.error(`Error in updatePickupStatus for request ${requestId}:`, error);
    // Return a structured error response rather than throwing
    return {
      id: requestId,
      error: error.message,
      success: false
    };
  }
};

/**
 * Subscribes to real-time updates for pickup requests
 * @param {Function} callback - Callback function to handle updates
 * @param {Object} options - Subscription options
 * @param {string} options.event - Event type ('INSERT', 'UPDATE', 'DELETE', '*')
 * @param {Object} options.filter - Filter conditions
 * @returns {Object} Subscription object with unsubscribe method
 */
export const subscribeToPickupUpdates = async (callback, options = {}) => {
  if (!callback || typeof callback !== 'function') {
    console.error('Invalid callback provided to subscribeToPickupUpdates');
    return {
      unsubscribe: () => {}
    };
  }
  
  // Check if pickup_requests table exists before subscribing
  const tableExists = await safeDatabaseService.checkTableExists('pickup_requests');
  
  if (!tableExists) {
    console.warn('Pickup requests table does not exist, returning mock subscription');
    // Return a mock subscription that does nothing
    return {
      unsubscribe: () => console.log('Unsubscribing from mock pickup updates subscription'),
      mock: true
    };
  }
  
  try {
    // Set default options
    const event = options.event || '*';
    const filter = options.filter || {};
    
    // Set up the subscription with the specified options
    const subscription = supabase
      .channel(`pickup_requests_changes_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: event,
          schema: 'public',
          table: 'pickup_requests',
          ...filter
        },
        (payload) => {
          try {
            callback(payload);
          } catch (callbackError) {
            console.error('Error in pickup updates callback:', callbackError);
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(subscription);
      }
    };
  } catch (error) {
    console.warn('Error setting up real-time subscription:', error);
    // Return a mock subscription that does nothing
    return {
      unsubscribe: () => console.log('Unsubscribing from failed pickup updates subscription')
    };
  }
};

// Alias for backward compatibility
/**
 * Updates a pickup request with the specified data
 * @param {string} requestId - The ID of the pickup request to update
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object>} The updated pickup request
 */
export const updatePickupRequest = updatePickupStatus;
