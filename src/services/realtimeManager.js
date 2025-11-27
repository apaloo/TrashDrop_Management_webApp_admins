import { supabase } from '../utils/supabase';

/**
 * Centralized Real-time Subscription Manager
 * Handles all real-time subscriptions with conflict resolution and performance optimization
 */
class RealtimeManager {
  constructor() {
    this.subscriptions = new Map();
    this.channels = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000; // Start with 1 second
    this.isConnected = false;
    
    this.setupConnectionMonitoring();
  }

  /**
   * Setup connection monitoring and auto-reconnection
   */
  setupConnectionMonitoring() {
    // Get the channel for connection status
    const channel = supabase.channel('connection-status');
    
    // Subscribe to connection status changes
    channel
      .on('broadcast', { event: 'status' }, (payload) => {
        if (payload.event === 'connected') {
          console.log('Realtime connection established');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectInterval = 1000; // Reset interval
        } else if (payload.event === 'disconnected') {
          console.log('Realtime connection closed');
          this.isConnected = false;
          this.handleReconnection();
        } else if (payload.event === 'error') {
          console.error('Realtime connection error:', payload.error);
          this.isConnected = false;
        }
      })
      .subscribe((status) => {
        // Handle subscription status changes
        if (status === 'SUBSCRIBED') {
          // Initial status
          this.isConnected = true;
          this.reconnectAttempts = 0;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error occurred');
          this.isConnected = false;
          this.handleReconnection();
        }
      });
      
    // Store the channel for cleanup
    this.connectionChannel = channel;
  }

  /**
   * Handle reconnection with exponential backoff
   */
  async handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    
    setTimeout(() => {
      console.log(`Attempting to reconnect... (attempt ${this.reconnectAttempts})`);
      // Resubscribe to all active channels
      this.resubscribeAll();
    }, this.reconnectInterval);

    // Exponential backoff with jitter
    this.reconnectInterval = Math.min(
      this.reconnectInterval * 2 + Math.random() * 1000,
      30000 // Max 30 seconds
    );
  }

  /**
   * Resubscribe to all active channels after reconnection
   */
  resubscribeAll() {
    const activeSubscriptions = Array.from(this.subscriptions.entries());
    
    // Clear existing subscriptions
    this.cleanup();
    
    // Resubscribe to each active subscription
    activeSubscriptions.forEach(([key, config]) => {
      this.subscribe(key, config.tables, config.callback, config.options);
    });
  }

  /**
   * Subscribe to real-time changes on specified tables
   * @param {string} subscriptionKey - Unique key for this subscription
   * @param {Array<string>} tables - Array of table names to monitor
   * @param {Function} callback - Callback function for changes
   * @param {Object} options - Additional options (filters, etc.)
   */
  subscribe(subscriptionKey, tables, callback, options = {}) {
    try {
      // Ensure we have a valid subscription key
      if (!subscriptionKey) {
        console.error('Invalid subscription key');
        return null;
      }
      
      // Forcefully clean up any existing subscription before creating a new one
      // This is more aggressive than just checking if it exists
      if (this.subscriptions.has(subscriptionKey)) {
        console.log(`Cleaning up existing subscription for ${subscriptionKey} before resubscribing`);
        this.unsubscribe(subscriptionKey);
        
        // Add a small delay to ensure proper cleanup before resubscribing
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(this._createNewSubscription(subscriptionKey, tables, callback, options));
          }, 100);
        });
      }
      
      return this._createNewSubscription(subscriptionKey, tables, callback, options);
    } catch (error) {
      console.error(`Error in subscription process for ${subscriptionKey}:`, error);
      return null;
    }
  }
  
  /**
   * Internal method to create a new subscription
   * @private
   */
  _createNewSubscription(subscriptionKey, tables, callback, options = {}) {
    try {
      // Create channel with unique name to prevent conflicts
      // Include more randomness to ensure uniqueness
      const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
      const channelName = `${subscriptionKey}-${uniqueId}`;
      
      // Check if the channel name is already in use
      const existingChannels = Array.from(this.channels.values())
        .filter(ch => ch && ch.topic && ch.topic.includes(subscriptionKey));
      
      if (existingChannels.length > 0) {
        console.warn(`Found ${existingChannels.length} existing channels for ${subscriptionKey}, cleaning up...`);
        existingChannels.forEach(ch => {
          try {
            ch.unsubscribe();
            supabase.removeChannel(ch);
          } catch (e) {
            console.warn('Error cleaning up existing channel:', e);
          }
        });
      }
      
      // Create the new channel
      const channel = supabase.channel(channelName);
      
      // Add table listeners with improved error handling
      tables.forEach(tableName => {
        if (!tableName) return; // Skip invalid table names
        
        channel.on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: tableName,
          ...options.filter
        }, (payload) => {
          try {
            this.handleRealtimeEvent(payload, tableName, callback);
          } catch (error) {
            console.error(`Error handling realtime event for ${tableName}:`, error);
          }
        });
      });
      
      // Subscribe to channel with enhanced error handling
      const subscription = channel.subscribe((status, error) => {
        if (error) {
          console.error(`❌ Subscription error for ${subscriptionKey}:`, error.message);
          
          // Handle specific error types
          if (error.message.includes('subscribe multiple times')) {
            console.warn(`Duplicate subscription detected for ${subscriptionKey}, cleaning up...`);
            this.unsubscribe(subscriptionKey);
            return;
          }
          
          // Add more error type handling here if needed
        }
        
        console.log(`Subscription ${subscriptionKey} status:`, status);
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to ${subscriptionKey}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error for ${subscriptionKey}`);
          this.unsubscribe(subscriptionKey);
        }
      });
      
      // Store subscription info with additional metadata
      this.subscriptions.set(subscriptionKey, {
        tables,
        callback,
        options,
        channel,
        subscription,
        createdAt: new Date(),
        channelName,
        uniqueId
      });
      
      this.channels.set(subscriptionKey, channel);
      
      return subscription;
    } catch (error) {
      console.error(`Error creating subscription ${subscriptionKey}:`, error);
      return null;
    }
  }

  /**
   * Handle real-time events with error handling and conflict resolution
   */
  handleRealtimeEvent(payload, tableName, callback) {
    try {
      const enhancedPayload = {
        ...payload,
        tableName,
        timestamp: new Date(),
        processed: false
      };

      // Add conflict detection for critical tables
      if (this.isCriticalTable(tableName)) {
        enhancedPayload.conflictCheck = this.checkForConflicts(payload, tableName);
      }

      callback(enhancedPayload);
    } catch (error) {
      console.error(`Error handling realtime event for ${tableName}:`, error);
    }
  }

  /**
   * Check if table requires conflict detection
   */
  isCriticalTable(tableName) {
    const criticalTables = [
      'pickup_requests',
      'digital_bins', 
      'bags',
      'illegal_dumping_mobile',
      'collector_sessions'
    ];
    return criticalTables.includes(tableName);
  }

  /**
   * Basic conflict detection for critical operations
   */
  checkForConflicts(payload, tableName) {
    // This is a placeholder - implement specific conflict detection logic
    // based on your business rules
    return {
      hasConflict: false,
      conflictType: null,
      resolution: null
    };
  }

  /**
   * Subscribe to pickup requests with conflict resolution
   */
  subscribeToPickupRequests(callback) {
    return this.subscribe(
      'pickup-requests',
      ['pickup_requests', 'collector_sessions'],
      callback,
      {
        filter: {
          filter: `status=in.(pending,assigned,in_progress)`
        }
      }
    );
  }

  /**
   * Subscribe to digital bin requests
   */
  subscribeToDigitalBins(callback) {
    return this.subscribe(
      'digital-bins',
      ['digital_bins'],
      callback
    );
  }

  /**
   * Subscribe to illegal dumping reports
   */
  subscribeToIllegalDumping(callback) {
    return this.subscribe(
      'illegal-dumping',
      ['illegal_dumping_mobile'],
      callback
    );
  }

  /**
   * Subscribe to collector activities
   */
  subscribeToCollectors(callback) {
    return this.subscribe(
      'collector-profiles',
      ['collector_profiles', 'collector_sessions', 'scans'],
      callback
    );
  }

  /**
   * Subscribe to QR code scanning activities
   */
  subscribeToQRScanning(callback) {
    return this.subscribe(
      'qr-scanning',
      ['scans', 'bags', 'batches'],
      callback
    );
  }

  /**
   * Subscribe to alerts and notifications
   */
  subscribeToAlerts(callback) {
    return this.subscribe(
      'alerts',
      ['alerts'],
      callback,
      {
        filter: {
          filter: `status=neq.closed`
        }
      }
    );
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionKey) {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      try {
        // Enhanced unsubscribe with better error handling
        if (subscription.channel) {
          // First try to unsubscribe
          try {
            subscription.channel.unsubscribe();
          } catch (e) {
            console.warn(`Warning unsubscribing channel for ${subscriptionKey}:`, e.message);
          }
          
          // Then try to remove the channel
          try {
            supabase.removeChannel(subscription.channel);
          } catch (e) {
            console.warn(`Warning removing channel for ${subscriptionKey}:`, e.message);
          }
        }
        
        // Clean up stored references
        this.subscriptions.delete(subscriptionKey);
        this.channels.delete(subscriptionKey);
        console.log(`✅ Unsubscribed from ${subscriptionKey}`);
      } catch (error) {
        console.error(`Error during unsubscribe process for ${subscriptionKey}:`, error);
        // Force cleanup even on error
        this.subscriptions.delete(subscriptionKey);
        this.channels.delete(subscriptionKey);
      }
    } else {
      console.log(`No active subscription found for ${subscriptionKey}`);
    }
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(subscriptionKey) {
    const subscription = this.subscriptions.get(subscriptionKey);
    return subscription ? {
      active: true,
      tables: subscription.tables,
      createdAt: subscription.createdAt,
      connected: this.isConnected
    } : {
      active: false,
      connected: this.isConnected
    };
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions() {
    return Array.from(this.subscriptions.keys()).map(key => ({
      key,
      ...this.getSubscriptionStatus(key)
    }));
  }

  /**
   * Clean up all subscriptions
   */
  /**
   * Clear all timers (needed for cleanup)
   */
  clearAllTimers() {
    // Implementation would go here - placeholder for now
    // This would typically clear any setTimeout or setInterval used by this class
  }

  /**
   * Clean up all subscriptions
   */
  cleanup() {
    console.log('Cleaning up all realtime subscriptions...');
    
    // Get a copy of all keys to avoid mutation during iteration
    const subscriptionKeys = Array.from(this.subscriptions.keys());
    
    // Unsubscribe from all channels with proper error handling
    subscriptionKeys.forEach(key => {
      try {
        this.unsubscribe(key);
      } catch (error) {
        console.warn(`Error during cleanup of subscription ${key}:`, error.message);
      }
    });
    
    // Ensure all channels are removed from Supabase
    Array.from(this.channels.values()).forEach(channel => {
      try {
        if (channel) {
          channel.unsubscribe();
          supabase.removeChannel(channel);
        }
      } catch (error) {
        console.warn('Error removing channel during cleanup:', error.message);
      }
    });
    
    // Unsubscribe from connection status channel
    if (this.connectionChannel) {
      try {
        this.connectionChannel.unsubscribe();
        supabase.removeChannel(this.connectionChannel);
      } catch (error) {
        console.warn('Error removing connection channel during cleanup:', error.message);
      }
      this.connectionChannel = null;
    }
    
    // Clear all collections
    this.subscriptions.clear();
    this.channels.clear();
    
    // Clear all timers
    this.clearAllTimers();
    
    console.log('✅ All realtime subscriptions cleaned up');
  }

  /**
   * Check connection health
   */
  async checkHealth() {
    return {
      connected: this.isConnected,
      activeSubscriptions: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
      channels: Array.from(this.channels.keys())
    };
  }
}

// Create singleton instance
export const realtimeManager = new RealtimeManager();

// Export the class for testing
export { RealtimeManager };

export default realtimeManager;
