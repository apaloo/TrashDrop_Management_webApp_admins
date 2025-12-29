// Fix for Supabase subscription errors in RealtimeManager
// 
// This is a patch for the issue: "tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance"
//
// Steps to implement this fix:
// 1. Find the RealtimeManager.js file in your codebase (likely in src/services/ or src/utils/)
// 2. Replace the subscription handling code with this improved version
// 3. Make sure to adapt it to your specific file structure and import paths

/**
 * Enhanced RealtimeManager with proper subscription handling
 * This prevents the "tried to subscribe multiple times" error by:
 * 
 * 1. Tracking active subscriptions by unique channel ID
 * 2. Properly removing channels before resubscribing
 * 3. Adding retry logic with exponential backoff
 * 4. Implementing proper error handling
 */

class RealtimeManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.activeSubscriptions = new Map(); // Track subscriptions by channel ID
    this.retryDelays = [1000, 2000, 5000, 10000]; // Retry delays in ms
    this.debug = process.env.NODE_ENV !== 'production';
  }

  /**
   * Generate a unique channel ID for tracking subscriptions
   * @param {string} table - Table name
   * @param {string} event - Event type (INSERT, UPDATE, DELETE, etc.)
   * @param {Object} filter - Optional filter criteria
   * @returns {string} Unique channel identifier
   */
  generateChannelId(table, event, filter) {
    const filterStr = filter ? JSON.stringify(filter) : 'no-filter';
    return `${table}:${event}:${filterStr}`;
  }

  /**
   * Subscribe to real-time changes with proper error handling
   * @param {string} table - Table name to subscribe to
   * @param {string} event - Event type (INSERT, UPDATE, DELETE, *)
   * @param {Function} callback - Callback function when data changes
   * @param {Object} filter - Optional filter criteria
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(table, event, callback, filter = undefined) {
    const channelId = this.generateChannelId(table, event, filter);
    
    // Check if subscription already exists and remove it first
    if (this.activeSubscriptions.has(channelId)) {
      this.logDebug(`Removing existing subscription for ${channelId}`);
      this.unsubscribe(table, event, filter);
    }

    // Create unique channel name with random suffix to avoid collisions
    const channelName = `${table}-${event}-${Math.random().toString(36).substring(2, 10)}`;
    
    let channel;
    try {
      // Create the channel
      channel = this.supabase.channel(channelName);
      
      // Set up the subscription
      if (filter) {
        channel = channel.on(`postgres_changes`, {
          event: event,
          schema: 'public',
          table: table,
          filter: filter
        }, (payload) => callback(payload));
      } else {
        channel = channel.on(`postgres_changes`, {
          event: event,
          schema: 'public',
          table: table
        }, (payload) => callback(payload));
      }

      // Subscribe with error handling
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          this.logDebug(`✅ Successfully subscribed to ${channelId}`);
        } else if (status === 'CHANNEL_ERROR') {
          this.logError(`❌ Subscription error for ${table}: ${err?.message || 'Unknown error'}`);
          this.retrySubscription(table, event, callback, filter, 0);
        }
      });

      // Store subscription reference
      this.activeSubscriptions.set(channelId, { channel, channelName });
      
      return {
        unsubscribe: () => this.unsubscribe(table, event, filter)
      };
    } catch (error) {
      this.logError(`❌ Error creating subscription for ${table}: ${error.message}`);
      return { unsubscribe: () => {} }; // Return dummy unsubscribe function
    }
  }

  /**
   * Unsubscribe from real-time changes
   * @param {string} table - Table name
   * @param {string} event - Event type
   * @param {Object} filter - Filter criteria (must match subscription)
   */
  unsubscribe(table, event, filter) {
    const channelId = this.generateChannelId(table, event, filter);
    const subscription = this.activeSubscriptions.get(channelId);
    
    if (subscription) {
      try {
        this.supabase.removeChannel(subscription.channel);
        this.activeSubscriptions.delete(channelId);
        this.logDebug(`✅ Successfully unsubscribed from ${channelId}`);
      } catch (error) {
        this.logError(`❌ Error unsubscribing from ${channelId}: ${error.message}`);
      }
    }
  }

  /**
   * Retry subscription with exponential backoff
   * @param {string} table - Table name
   * @param {string} event - Event type
   * @param {Function} callback - Callback function
   * @param {Object} filter - Filter criteria
   * @param {number} attempt - Current attempt number
   */
  retrySubscription(table, event, callback, filter, attempt) {
    if (attempt >= this.retryDelays.length) {
      this.logError(`❌ Max retry attempts reached for ${table} subscription`);
      return;
    }

    const delay = this.retryDelays[attempt];
    this.logDebug(`⏱ Retrying ${table} subscription in ${delay}ms (attempt ${attempt + 1})`);

    setTimeout(() => {
      try {
        this.subscribe(table, event, callback, filter);
      } catch (error) {
        this.retrySubscription(table, event, callback, filter, attempt + 1);
      }
    }, delay);
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  unsubscribeAll() {
    for (const [channelId, subscription] of this.activeSubscriptions.entries()) {
      try {
        this.supabase.removeChannel(subscription.channel);
        this.logDebug(`✅ Unsubscribed from ${channelId}`);
      } catch (error) {
        this.logError(`❌ Error unsubscribing from ${channelId}: ${error.message}`);
      }
    }
    this.activeSubscriptions.clear();
  }

  /**
   * Log debug messages if debugging is enabled
   * @param {string} message - Debug message
   */
  logDebug(message) {
    if (this.debug) {
      console.log(`📡 RealtimeManager: ${message}`);
    }
  }

  /**
   * Log error messages
   * @param {string} message - Error message
   */
  logError(message) {
    console.error(`📡 RealtimeManager: ${message}`);
  }
}

export default RealtimeManager;
