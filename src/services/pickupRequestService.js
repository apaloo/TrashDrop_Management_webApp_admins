import { supabase, handleDatabaseError } from '../utils/supabase';
import { realtimeManager } from './realtimeManager';
import { trackDatabaseOperation } from './performanceMonitor';

/**
 * Pickup Request Service with Real-time Sync and Conflict Resolution
 * Handles all pickup request operations with mobile app synchronization
 */
class PickupRequestService {
  constructor() {
    this.subscribers = new Map();
    this.reservationCache = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize service with real-time subscriptions
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Subscribe to real-time changes
      realtimeManager.subscribeToPickupRequests((payload) => {
        this.handleRealtimeChange(payload);
      });

      this.isInitialized = true;
      console.log('✅ Pickup Request Service initialized with real-time sync');
    } catch (error) {
      console.error('❌ Failed to initialize Pickup Request Service:', error);
      throw error;
    }
  }

  /**
   * Handle real-time changes from Supabase
   */
  handleRealtimeChange(payload) {
    const { eventType, new: newRecord, old: oldRecord, tableName } = payload;

    // Handle different table changes
    switch (tableName) {
      case 'pickup_requests':
        this.handlePickupRequestChange(eventType, newRecord, oldRecord);
        break;
      case 'collector_sessions':
        this.handleCollectorSessionChange(eventType, newRecord, oldRecord);
        break;
      default:
        console.log(`Unhandled realtime change for table: ${tableName}`);
    }

    // Notify subscribers
    this.notifySubscribers('pickup_request_change', {
      eventType,
      newRecord,
      oldRecord,
      tableName,
      timestamp: new Date()
    });
  }

  /**
   * Handle pickup request real-time changes
   */
  handlePickupRequestChange(eventType, newRecord, oldRecord) {
    switch (eventType) {
      case 'INSERT':
        console.log('New pickup request created:', newRecord.id);
        break;
      case 'UPDATE':
        this.handlePickupRequestUpdate(newRecord, oldRecord);
        break;
      case 'DELETE':
        console.log('Pickup request deleted:', oldRecord.id);
        this.reservationCache.delete(oldRecord.id);
        break;
    }
  }

  /**
   * Handle pickup request updates with conflict detection
   */
  handlePickupRequestUpdate(newRecord, oldRecord) {
    const requestId = newRecord.id;

    // Check for status changes
    if (newRecord.status !== oldRecord.status) {
      console.log(`Pickup request ${requestId} status changed: ${oldRecord.status} → ${newRecord.status}`);
    }

    // Check for reservation changes
    if (newRecord.reserved_by !== oldRecord.reserved_by) {
      if (newRecord.reserved_by) {
        console.log(`Pickup request ${requestId} reserved by collector: ${newRecord.reserved_by}`);
        this.reservationCache.set(requestId, {
          collectorId: newRecord.reserved_by,
          reservedAt: newRecord.reserved_at,
          reservedUntil: newRecord.reserved_until
        });
      } else {
        console.log(`Pickup request ${requestId} reservation released`);
        this.reservationCache.delete(requestId);
      }
    }
  }

  /**
   * Handle collector session changes
   */
  handleCollectorSessionChange(eventType, newRecord, oldRecord) {
    if (eventType === 'UPDATE' && newRecord.reserved_requests !== oldRecord.reserved_requests) {
      console.log(`Collector ${newRecord.collector_id} reservation list updated`);
    }
  }

  /**
   * Fetch pickup requests with advanced filtering and pagination
   */
  async fetchPickupRequests({
    page = 1,
    limit = 50,
    status = null,
    priority = null,
    collectorId = null,
    dateRange = null,
    searchQuery = '',
    sortBy = 'created_at',
    sortOrder = 'desc',
    includeReservations = true,
    cursor = null // For cursor-based pagination
  } = {}) {
    return trackDatabaseOperation('fetchPickupRequests', async () => {
      try {
        // Calculate pagination
        const from = cursor ? 0 : (page - 1) * limit;
        const to = from + limit - 1;

        // Build base query with relationships
        let query = supabase
          .from('pickup_requests')
          .select(`
            *,
            location:location_id(
              id,
              address,
              coordinates,
              is_default
            ),
            collector:collector_id(
              id,
              first_name,
              last_name,
              phone,
              email,
              status
            ),
            reserved_collector:reserved_by(
              id,
              first_name,
              last_name,
              phone
            ),
            payment_method:payment_method_id(
              id,
              type,
              provider
            )
          `, { count: 'exact' })
          .range(from, to);

        // Apply cursor-based pagination for better performance
        if (cursor) {
          query = query.gt('created_at', cursor);
        }

        // Apply filters
        if (status && status !== 'all') {
          if (Array.isArray(status)) {
            query = query.in('status', status);
          } else {
            query = query.eq('status', status);
          }
        }

        if (priority && priority !== 'all') {
          query = query.eq('priority', priority);
        }

        if (collectorId) {
          query = query.eq('collector_id', collectorId);
        }

        // Date range filter
        if (dateRange?.start && dateRange?.end) {
          query = query
            .gte('created_at', dateRange.start)
            .lte('created_at', dateRange.end);
        }

        // Search functionality
        if (searchQuery && searchQuery.trim()) {
          const searchTerm = searchQuery.trim();
          query = query.or(`
            id.ilike.%${searchTerm}%,
            location.ilike.%${searchTerm}%,
            special_instructions.ilike.%${searchTerm}%
          `);
        }

        // Apply sorting
        const ascending = sortOrder === 'asc';
        query = query.order(sortBy, { ascending });

        // Execute query
        const { data, error, count } = await query;

        if (error) throw error;

        // Enhance data with reservation info
        const enhancedData = await this.enhanceWithReservationInfo(data);

        // Add real-time sync metadata
        const result = {
          data: enhancedData,
          totalCount: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
          hasNextPage: (page * limit) < count,
          hasPrevPage: page > 1,
          syncedAt: new Date()
        };

        return result;

      } catch (error) {
        const dbError = handleDatabaseError(error, 'fetchPickupRequests');
        throw dbError;
      }
    });
  }

  /**
   * Enhance pickup requests with real-time reservation information
   */
  async enhanceWithReservationInfo(requests) {
    if (!requests || !Array.isArray(requests)) return requests;

    return requests.map(request => {
      const cachedReservation = this.reservationCache.get(request.id);
      return {
        ...request,
        _realtime: {
          reservation: cachedReservation,
          isReserved: !!request.reserved_by,
          isExpired: request.reserved_until && new Date(request.reserved_until) < new Date(),
          syncedAt: new Date()
        }
      };
    });
  }

  /**
   * Reserve pickup request with atomic operation and conflict resolution
   */
  async reservePickupRequest(requestId, collectorId, reservationMinutes = 15) {
    return trackDatabaseOperation('reservePickupRequest', async () => {
      try {
        // Call the database function for atomic reservation
        const { data, error } = await supabase.rpc('reserve_pickup_request', {
          p_request_id: requestId,
          p_collector_id: collectorId,
          p_reservation_duration_minutes: reservationMinutes
        });

        if (error) throw error;

        if (!data.success) {
          throw new Error(data.message || 'Failed to reserve pickup request');
        }

        // Update local cache
        this.reservationCache.set(requestId, {
          collectorId,
          reservedAt: new Date(data.reserved_until).getTime() - (reservationMinutes * 60 * 1000),
          reservedUntil: data.reserved_until
        });

        // Notify subscribers
        this.notifySubscribers('pickup_request_reserved', {
          requestId,
          collectorId,
          reservedUntil: data.reserved_until
        });

        return {
          success: true,
          data: {
            requestId,
            collectorId,
            reservedUntil: data.reserved_until,
            message: data.message
          }
        };

      } catch (error) {
        console.error('Error reserving pickup request:', error);
        throw handleDatabaseError(error, 'reservePickupRequest');
      }
    });
  }

  /**
   * Release pickup request reservation
   */
  async releaseReservation(requestId, collectorId) {
    return trackDatabaseOperation('releaseReservation', async () => {
      try {
        const { data, error } = await supabase
          .from('pickup_requests')
          .update({
            reserved_by: null,
            reserved_at: null,
            reserved_until: null,
            status: 'pending', // Reset to pending if it was assigned
            updated_at: new Date()
          })
          .eq('id', requestId)
          .eq('reserved_by', collectorId) // Ensure only the reserving collector can release
          .select()
          .single();

        if (error) throw error;

        // Update local cache
        this.reservationCache.delete(requestId);

        // Clean up collector session
        await this.updateCollectorSession(collectorId, requestId, 'remove');

        // Notify subscribers
        this.notifySubscribers('pickup_request_released', {
          requestId,
          collectorId
        });

        return {
          success: true,
          data: data
        };

      } catch (error) {
        console.error('Error releasing reservation:', error);
        throw handleDatabaseError(error, 'releaseReservation');
      }
    });
  }

  /**
   * Update pickup request status with validation
   */
  async updatePickupRequestStatus(requestId, newStatus, collectorId = null, metadata = {}) {
    return trackDatabaseOperation('updatePickupRequestStatus', async () => {
      try {
        // Validate status transition
        const validTransitions = {
          'pending': ['assigned', 'cancelled'],
          'assigned': ['in_progress', 'pending', 'cancelled'],
          'in_progress': ['completed', 'assigned', 'cancelled'],
          'completed': [], // Final state
          'cancelled': [] // Final state
        };

        // Get current request data
        const { data: currentRequest, error: fetchError } = await supabase
          .from('pickup_requests')
          .select('status, reserved_by')
          .eq('id', requestId)
          .single();

        if (fetchError) throw fetchError;

        const currentStatus = currentRequest.status;
        const allowedTransitions = validTransitions[currentStatus] || [];

        if (!allowedTransitions.includes(newStatus)) {
          throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
        }

        // Prepare update data
        const updateData = {
          status: newStatus,
          updated_at: new Date(),
          ...metadata
        };

        // Handle collector assignment
        if (newStatus === 'assigned' && collectorId) {
          updateData.collector_id = collectorId;
        }

        if (newStatus === 'completed') {
          updateData.completed_at = new Date();
        }

        // Update request
        const { data, error } = await supabase
          .from('pickup_requests')
          .update(updateData)
          .eq('id', requestId)
          .select(`
            *,
            collector:collector_id(id, first_name, last_name, phone)
          `)
          .single();

        if (error) throw error;

        // Handle reservation cleanup for final states
        if (['completed', 'cancelled'].includes(newStatus)) {
          this.reservationCache.delete(requestId);
          if (data.reserved_by) {
            await this.updateCollectorSession(data.reserved_by, requestId, 'remove');
          }
        }

        // Notify subscribers
        this.notifySubscribers('pickup_request_status_updated', {
          requestId,
          oldStatus: currentStatus,
          newStatus,
          collectorId,
          updatedAt: updateData.updated_at
        });

        return {
          success: true,
          data: data
        };

      } catch (error) {
        console.error('Error updating pickup request status:', error);
        throw handleDatabaseError(error, 'updatePickupRequestStatus');
      }
    });
  }

  /**
   * Update collector session with pickup request changes
   */
  async updateCollectorSession(collectorId, requestId, action = 'add') {
    try {
      if (action === 'add') {
        // Add request to collector's reserved list
        const { error } = await supabase
          .from('collector_sessions')
          .upsert({
            collector_id: collectorId,
            reserved_requests: supabase.sql`array_append(COALESCE(reserved_requests, '{}'), ${requestId}::uuid)`,
            last_activity: new Date(),
            is_active: true
          });

        if (error) throw error;
      } else if (action === 'remove') {
        // Remove request from collector's reserved list
        const { error } = await supabase
          .from('collector_sessions')
          .update({
            reserved_requests: supabase.sql`array_remove(reserved_requests, ${requestId}::uuid)`,
            last_activity: new Date()
          })
          .eq('collector_id', collectorId);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating collector session:', error);
      // Don't throw - this is supplementary data
    }
  }

  /**
   * Get pickup request statistics for dashboard
   */
  async getPickupRequestStats(dateRange = null) {
    return trackDatabaseOperation('getPickupRequestStats', async () => {
      try {
        let query = supabase.from('pickup_requests').select('status, priority, created_at');

        // Apply date range if provided
        if (dateRange?.start && dateRange?.end) {
          query = query
            .gte('created_at', dateRange.start)
            .lte('created_at', dateRange.end);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Calculate statistics
        const stats = {
          total: data.length,
          byStatus: {},
          byPriority: {},
          avgCompletionTime: 0,
          totalRevenue: 0,
          dateRange: dateRange || { start: null, end: null }
        };

        data.forEach(request => {
          // Count by status
          stats.byStatus[request.status] = (stats.byStatus[request.status] || 0) + 1;
          
          // Count by priority
          if (request.priority) {
            stats.byPriority[request.priority] = (stats.byPriority[request.priority] || 0) + 1;
          }
        });

        return stats;

      } catch (error) {
        console.error('Error getting pickup request stats:', error);
        throw handleDatabaseError(error, 'getPickupRequestStats');
      }
    });
  }

  /**
   * Subscribe to pickup request changes
   */
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Notify subscribers of changes
   */
  notifySubscribers(eventType, data) {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in pickup request subscriber callback:`, error);
        }
      });
    }
  }

  /**
   * Release expired reservations (can be called periodically)
   */
  async releaseExpiredReservations() {
    return trackDatabaseOperation('releaseExpiredReservations', async () => {
      try {
        const { data, error } = await supabase.rpc('release_expired_reservations');
        
        if (error) throw error;

        if (data.success && data.released_count > 0) {
          console.log(`Released ${data.released_count} expired reservations`);
          
          // Clear local cache for expired reservations
          const now = new Date();
          this.reservationCache.forEach((reservation, requestId) => {
            if (new Date(reservation.reservedUntil) < now) {
              this.reservationCache.delete(requestId);
            }
          });

          // Notify subscribers
          this.notifySubscribers('reservations_released', {
            count: data.released_count,
            timestamp: data.timestamp
          });
        }

        return data;

      } catch (error) {
        console.error('Error releasing expired reservations:', error);
        // Don't throw - this is a maintenance operation
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      subscribersCount: Array.from(this.subscribers.values())
        .reduce((total, callbacks) => total + callbacks.size, 0),
      cachedReservations: this.reservationCache.size,
      realtimeConnected: realtimeManager.isConnected
    };
  }

  /**
   * Cleanup service resources
   */
  cleanup() {
    this.subscribers.clear();
    this.reservationCache.clear();
    this.isInitialized = false;
    console.log('✅ Pickup Request Service cleaned up');
  }
}

// Create singleton instance
export const pickupRequestService = new PickupRequestService();

// Export the class for testing
export { PickupRequestService };

export default pickupRequestService;
