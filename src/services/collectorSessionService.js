import { supabase, handleDatabaseError } from '../utils/supabase';
import { realtimeManager } from './realtimeManager';
import { trackDatabaseOperation } from './performanceMonitor';

/**
 * Collector Session Management Service
 * Handles collector sessions, real-time state management, and activity tracking
 */
class CollectorSessionService {
  constructor() {
    this.activeSessions = new Map();
    this.sessionSubscriptions = new Map();
    this.subscribers = new Map();
    this.isInitialized = false;
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.activityTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Initialize service with real-time tracking
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Subscribe to collector activities
      realtimeManager.subscribeToCollectors((payload) => {
        this.handleRealtimeChange(payload);
      });

      // Start session monitoring
      this.startSessionMonitoring();

      // Load existing active sessions
      await this.loadActiveSessions();

      this.isInitialized = true;
      console.log('✅ Collector Session Service initialized with real-time tracking');
    } catch (error) {
      console.error('❌ Failed to initialize Collector Session Service:', error);
      throw error;
    }
  }

  /**
   * Handle real-time changes from Supabase
   */
  handleRealtimeChange(payload) {
    const { eventType, new: newRecord, old: oldRecord, tableName } = payload;

    switch (tableName) {
      case 'collector_sessions':
        this.handleSessionChange(eventType, newRecord, oldRecord);
        break;
      case 'collectors':
        this.handleCollectorChange(eventType, newRecord, oldRecord);
        break;
      case 'scans':
        this.handleScanActivity(eventType, newRecord, oldRecord);
        break;
    }

    // Notify subscribers
    this.notifySubscribers('collector_activity', {
      eventType,
      newRecord,
      oldRecord,
      tableName,
      timestamp: new Date()
    });
  }

  /**
   * Handle session changes
   */
  handleSessionChange(eventType, newRecord, oldRecord) {
    const collectorId = newRecord?.collector_id || oldRecord?.collector_id;

    switch (eventType) {
      case 'INSERT':
        this.activeSessions.set(collectorId, {
          ...newRecord,
          localActivity: new Date()
        });
        console.log(`Collector session started: ${collectorId}`);
        this.notifySubscribers('session_started', newRecord);
        break;
        
      case 'UPDATE':
        const existingSession = this.activeSessions.get(collectorId);
        if (existingSession) {
          this.activeSessions.set(collectorId, {
            ...newRecord,
            localActivity: new Date(),
            previousReserved: oldRecord?.reserved_requests || []
          });
        }
        
        // Check for reservation changes
        if (JSON.stringify(newRecord.reserved_requests) !== JSON.stringify(oldRecord?.reserved_requests)) {
          console.log(`Collector ${collectorId} reservations updated`);
          this.notifySubscribers('reservations_updated', {
            collectorId,
            newReservations: newRecord.reserved_requests,
            oldReservations: oldRecord?.reserved_requests
          });
        }
        break;
        
      case 'DELETE':
        this.activeSessions.delete(collectorId);
        console.log(`Collector session ended: ${collectorId}`);
        this.notifySubscribers('session_ended', oldRecord);
        break;
    }
  }

  /**
   * Handle collector status changes
   */
  handleCollectorChange(eventType, newRecord, oldRecord) {
    if (eventType === 'UPDATE' && newRecord.status !== oldRecord?.status) {
      const collectorId = newRecord.id;
      console.log(`Collector ${collectorId} status changed: ${oldRecord?.status} → ${newRecord.status}`);
      
      // If collector becomes inactive, end their session
      if (newRecord.status === 'inactive') {
        this.endSession(collectorId);
      }
      
      this.notifySubscribers('collector_status_changed', {
        collectorId,
        oldStatus: oldRecord?.status,
        newStatus: newRecord.status
      });
    }
  }

  /**
   * Handle scan activity for session tracking
   */
  handleScanActivity(eventType, newRecord, oldRecord) {
    if (eventType === 'INSERT') {
      const collectorId = newRecord.scanned_by;
      
      // Update session activity
      this.updateSessionActivity(collectorId);
      
      this.notifySubscribers('scan_activity', {
        collectorId,
        bagId: newRecord.bag_id,
        scannedAt: newRecord.scanned_at
      });
    }
  }

  /**
   * Create or update collector session
   */
  async createOrUpdateSession(collectorId, filterCriteria = {}) {
    return trackDatabaseOperation('createOrUpdateSession', async () => {
      try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.sessionTimeout);

        const sessionData = {
          collector_id: collectorId,
          filter_criteria: filterCriteria,
          is_active: true,
          last_activity: now,
          expires_at: expiresAt,
          session_start: now
        };

        // Upsert session
        const { data, error } = await supabase
          .from('collector_sessions')
          .upsert(sessionData, { 
            onConflict: 'collector_id',
            returning: 'minimal' 
          })
          .select(`
            *,
            collector:collector_id(
              id,
              first_name,
              last_name,
              phone,
              email,
              status
            )
          `)
          .single();

        if (error) throw error;

        // Update local cache
        this.activeSessions.set(collectorId, {
          ...data,
          localActivity: now
        });

        // Notify subscribers
        this.notifySubscribers('session_updated', data);

        return {
          success: true,
          data
        };

      } catch (error) {
        console.error('Error creating/updating collector session:', error);
        throw handleDatabaseError(error, 'createOrUpdateSession');
      }
    });
  }

  /**
   * Update session activity (heartbeat)
   */
  async updateSessionActivity(collectorId, activity = {}) {
    return trackDatabaseOperation('updateSessionActivity', async () => {
      try {
        const now = new Date();

        // Update database
        const { data, error } = await supabase
          .from('collector_sessions')
          .update({
            last_activity: now,
            ...activity
          })
          .eq('collector_id', collectorId)
          .select()
          .single();

        if (error) throw error;

        // Update local cache
        const existingSession = this.activeSessions.get(collectorId);
        if (existingSession) {
          this.activeSessions.set(collectorId, {
            ...existingSession,
            ...data,
            localActivity: now
          });
        }

        return {
          success: true,
          data
        };

      } catch (error) {
        console.error('Error updating session activity:', error);
        throw handleDatabaseError(error, 'updateSessionActivity');
      }
    });
  }

  /**
   * End collector session
   */
  async endSession(collectorId) {
    return trackDatabaseOperation('endSession', async () => {
      try {
        // Update session as inactive
        const { data, error } = await supabase
          .from('collector_sessions')
          .update({
            is_active: false,
            session_end: new Date(),
            last_activity: new Date()
          })
          .eq('collector_id', collectorId)
          .select()
          .single();

        if (error && error.code !== 'PGRST116') { // Ignore "not found" errors
          throw error;
        }

        // Remove from local cache
        this.activeSessions.delete(collectorId);

        // Notify subscribers
        this.notifySubscribers('session_ended', { collectorId, data });

        return {
          success: true,
          data
        };

      } catch (error) {
        console.error('Error ending collector session:', error);
        throw handleDatabaseError(error, 'endSession');
      }
    });
  }

  /**
   * Get collector session details
   */
  async getCollectorSession(collectorId, useCache = true) {
    return trackDatabaseOperation('getCollectorSession', async () => {
      try {
        // Check cache first
        if (useCache && this.activeSessions.has(collectorId)) {
          const cached = this.activeSessions.get(collectorId);
          return {
            success: true,
            data: cached,
            fromCache: true
          };
        }

        // Fetch from database
        const { data, error } = await supabase
          .from('collector_sessions')
          .select(`
            *,
            collector:collector_id(
              id,
              first_name,
              last_name,
              phone,
              email,
              status,
              region
            )
          `)
          .eq('collector_id', collectorId)
          .eq('is_active', true)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return {
              success: true,
              data: null,
              message: 'No active session found'
            };
          }
          throw error;
        }

        // Update cache
        this.activeSessions.set(collectorId, {
          ...data,
          localActivity: new Date()
        });

        return {
          success: true,
          data
        };

      } catch (error) {
        console.error('Error getting collector session:', error);
        throw handleDatabaseError(error, 'getCollectorSession');
      }
    });
  }

  /**
   * Get all active collector sessions
   */
  async getActiveSessions({
    page = 1,
    limit = 50,
    region = null,
    includeReservations = true,
    sortBy = 'last_activity',
    sortOrder = 'desc'
  } = {}) {
    return trackDatabaseOperation('getActiveSessions', async () => {
      try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
          .from('collector_sessions')
          .select(`
            *,
            collector:collector_id(
              id,
              first_name,
              last_name,
              phone,
              email,
              status,
              region
            )
          `, { count: 'exact' })
          .eq('is_active', true)
          .range(from, to);

        // Apply filters
        if (region) {
          query = query.eq('collector.region', region);
        }

        // Apply sorting
        const ascending = sortOrder === 'asc';
        query = query.order(sortBy, { ascending });

        const { data, error, count } = await query;

        if (error) throw error;

        // Enhance with real-time data
        const enhancedData = data.map(session => {
          const cached = this.activeSessions.get(session.collector_id);
          return {
            ...session,
            _realtime: {
              lastSeen: cached?.localActivity || session.last_activity,
              isConnected: this.isSessionActive(session.collector_id),
              reservationCount: session.reserved_requests?.length || 0
            }
          };
        });

        return {
          data: enhancedData,
          totalCount: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
          hasNextPage: (page * limit) < count,
          hasPrevPage: page > 1
        };

      } catch (error) {
        console.error('Error getting active sessions:', error);
        throw handleDatabaseError(error, 'getActiveSessions');
      }
    });
  }

  /**
   * Get session statistics for dashboard
   */
  async getSessionStats(dateRange = null) {
    return trackDatabaseOperation('getSessionStats', async () => {
      try {
        let query = supabase
          .from('collector_sessions')
          .select(`
            collector_id,
            session_start,
            session_end,
            last_activity,
            is_active,
            collector:collector_id(region, status)
          `);

        // Apply date range if provided
        if (dateRange?.start && dateRange?.end) {
          query = query
            .gte('session_start', dateRange.start)
            .lte('session_start', dateRange.end);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Calculate statistics
        const stats = {
          totalSessions: data.length,
          activeSessions: 0,
          completedSessions: 0,
          byRegion: {},
          averageSessionDuration: 0,
          totalSessionTime: 0,
          uniqueCollectors: new Set(),
          dateRange: dateRange || { start: null, end: null }
        };

        let totalDuration = 0;
        let completedSessionCount = 0;

        data.forEach(session => {
          stats.uniqueCollectors.add(session.collector_id);
          
          if (session.is_active) {
            stats.activeSessions++;
          } else {
            stats.completedSessions++;
          }

          // Count by region
          const region = session.collector?.region || 'unknown';
          stats.byRegion[region] = (stats.byRegion[region] || 0) + 1;

          // Calculate session duration
          if (session.session_end) {
            const duration = new Date(session.session_end) - new Date(session.session_start);
            totalDuration += duration;
            completedSessionCount++;
          }
        });

        stats.uniqueCollectors = stats.uniqueCollectors.size;
        stats.averageSessionDuration = completedSessionCount > 0 
          ? Math.round(totalDuration / completedSessionCount / (1000 * 60)) // in minutes
          : 0;
        stats.totalSessionTime = Math.round(totalDuration / (1000 * 60)); // in minutes

        return stats;

      } catch (error) {
        console.error('Error getting session stats:', error);
        throw handleDatabaseError(error, 'getSessionStats');
      }
    });
  }

  /**
   * Track collector location update
   */
  async updateCollectorLocation(collectorId, location) {
    return trackDatabaseOperation('updateCollectorLocation', async () => {
      try {
        // Update session with location data
        const { data, error } = await supabase
          .from('collector_sessions')
          .update({
            last_activity: new Date(),
            filter_criteria: supabase.sql`
              COALESCE(filter_criteria, '{}'::jsonb) || 
              jsonb_build_object('last_location', ${JSON.stringify(location)})
            `
          })
          .eq('collector_id', collectorId)
          .eq('is_active', true)
          .select()
          .single();

        if (error) throw error;

        // Update local cache
        const existingSession = this.activeSessions.get(collectorId);
        if (existingSession) {
          this.activeSessions.set(collectorId, {
            ...existingSession,
            ...data,
            localActivity: new Date()
          });
        }

        // Notify subscribers
        this.notifySubscribers('location_updated', {
          collectorId,
          location,
          timestamp: new Date()
        });

        return {
          success: true,
          data
        };

      } catch (error) {
        console.error('Error updating collector location:', error);
        throw handleDatabaseError(error, 'updateCollectorLocation');
      }
    });
  }

  /**
   * Helper Methods
   */

  async loadActiveSessions() {
    try {
      const { data, error } = await supabase
        .from('collector_sessions')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      // Load into cache
      data.forEach(session => {
        this.activeSessions.set(session.collector_id, {
          ...session,
          localActivity: new Date()
        });
      });

      console.log(`Loaded ${data.length} active collector sessions`);
    } catch (error) {
      console.error('Error loading active sessions:', error);
    }
  }

  startSessionMonitoring() {
    // Monitor sessions every 5 minutes
    setInterval(() => {
      this.cleanupInactiveSessions();
      this.checkSessionHealth();
    }, 5 * 60 * 1000);
  }

  async cleanupInactiveSessions() {
    try {
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - this.activityTimeout);

      // Find sessions that haven't been active recently
      const inactiveSessions = [];
      this.activeSessions.forEach((session, collectorId) => {
        const lastActivity = new Date(session.localActivity);
        if (lastActivity < cutoffTime) {
          inactiveSessions.push(collectorId);
        }
      });

      // End inactive sessions
      if (inactiveSessions.length > 0) {
        console.log(`Cleaning up ${inactiveSessions.length} inactive sessions`);
        
        for (const collectorId of inactiveSessions) {
          await this.endSession(collectorId);
        }
      }
    } catch (error) {
      console.error('Error cleaning up inactive sessions:', error);
    }
  }

  checkSessionHealth() {
    const now = new Date();
    let unhealthySessions = 0;

    this.activeSessions.forEach((session, collectorId) => {
      const lastActivity = new Date(session.last_activity);
      const timeSinceActivity = now.getTime() - lastActivity.getTime();
      
      if (timeSinceActivity > this.activityTimeout) {
        unhealthySessions++;
      }
    });

    if (unhealthySessions > 0) {
      console.warn(`${unhealthySessions} collector sessions appear unhealthy`);
    }
  }

  isSessionActive(collectorId) {
    const session = this.activeSessions.get(collectorId);
    if (!session) return false;
    
    const lastActivity = new Date(session.localActivity || session.last_activity);
    const now = new Date();
    
    return (now.getTime() - lastActivity.getTime()) < this.activityTimeout;
  }

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);

    return () => {
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  notifySubscribers(eventType, data) {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in collector session subscriber callback:', error);
        }
      });
    }
  }

  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      activeSessionsCount: this.activeSessions.size,
      subscribersCount: Array.from(this.subscribers.values())
        .reduce((total, callbacks) => total + callbacks.size, 0),
      realtimeConnected: realtimeManager.isConnected
    };
  }

  cleanup() {
    this.activeSessions.clear();
    this.sessionSubscriptions.clear();
    this.subscribers.clear();
    this.isInitialized = false;
    console.log('✅ Collector Session Service cleaned up');
  }
}

// Create singleton instance
export const collectorSessionService = new CollectorSessionService();

export { CollectorSessionService };
export default collectorSessionService;
