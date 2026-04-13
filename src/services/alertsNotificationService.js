/**
 * Alerts & Notification Service
 * 
 * Manages real-time alerts, notifications, and system-wide communication.
 * Handles multiple notification channels, alert prioritization, escalation
 * workflows, and user preference management.
 */

import { supabase } from '../utils/supabase';
import { realtimeManager } from './realtimeManager';
import { performanceMonitor } from './performanceMonitor';

class AlertsNotificationService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 2 * 60 * 1000; // 2 minutes for alerts
    this.subscribers = new Set();
    this.isInitialized = false;
    
    // Alert type configurations
    this.alertTypes = {
      'system_error': {
        priority: 'critical',
        channels: ['in_app', 'email', 'sms'],
        escalationTime: 5 * 60 * 1000, // 5 minutes
        autoResolve: false
      },
      'pickup_delayed': {
        priority: 'high',
        channels: ['in_app', 'email'],
        escalationTime: 30 * 60 * 1000, // 30 minutes
        autoResolve: true,
        resolveAfter: 2 * 60 * 60 * 1000 // 2 hours
      },
      'illegal_dumping_urgent': {
        priority: 'high',
        channels: ['in_app', 'email', 'push'],
        escalationTime: 15 * 60 * 1000, // 15 minutes
        autoResolve: false
      },
      'collector_offline': {
        priority: 'medium',
        channels: ['in_app'],
        escalationTime: 60 * 60 * 1000, // 1 hour
        autoResolve: true,
        resolveAfter: 5 * 60 * 1000 // 5 minutes after collector comes back
      },
      'bin_full': {
        priority: 'medium',
        channels: ['in_app', 'push'],
        escalationTime: 2 * 60 * 60 * 1000, // 2 hours
        autoResolve: true,
        resolveAfter: 30 * 60 * 1000 // 30 minutes
      },
      'performance_degradation': {
        priority: 'low',
        channels: ['in_app'],
        escalationTime: 4 * 60 * 60 * 1000, // 4 hours
        autoResolve: true,
        resolveAfter: 60 * 60 * 1000 // 1 hour
      }
    };

    // Notification channels configuration
    this.notificationChannels = {
      'in_app': {
        enabled: true,
        handler: this.sendInAppNotification.bind(this),
        retryAttempts: 3,
        retryDelay: 1000
      },
      'email': {
        enabled: true,
        handler: this.sendEmailNotification.bind(this),
        retryAttempts: 5,
        retryDelay: 5000,
        rateLimitWindow: 60000, // 1 minute
        rateLimitMax: 10
      },
      'sms': {
        enabled: false, // Disabled by default
        handler: this.sendSMSNotification.bind(this),
        retryAttempts: 3,
        retryDelay: 2000,
        rateLimitWindow: 300000, // 5 minutes
        rateLimitMax: 5
      },
      'push': {
        enabled: true,
        handler: this.sendPushNotification.bind(this),
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimitWindow: 30000, // 30 seconds
        rateLimitMax: 20
      }
    };

    // Rate limiting tracking
    this.rateLimitTracking = new Map();
    
    // Performance metrics
    this.performanceMetrics = {
      alertsCreatedToday: 0,
      notificationsSent: 0,
      escalationsTriggered: 0,
      averageResolutionTime: 0,
      channelSuccessRates: {}
    };

    // Escalation tracking
    this.escalationTimers = new Map();
    this.autoResolveTimers = new Map();
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      if (this.isInitialized) return { success: true };

      // Set up real-time subscriptions for alert triggers
      const alertTriggerTables = [
        'pickup_requests', 
        'illegal_dumping', 
        'collector_sessions', 
        'system_logs',
        'digital_bins'
      ];

      for (const table of alertTriggerTables) {
        const subscription = await realtimeManager.subscribe(`alerts_${table}`, {
          table,
          callback: this.handleRealtimeAlertTrigger.bind(this),
          conflictResolution: false
        });

        if (!subscription.success) {
          console.warn(`Failed to establish alert subscription for ${table}`);
        }
      }

      // Set up alerts table subscription for real-time alert updates
      const alertsSubscription = await realtimeManager.subscribe('alerts', {
        table: 'alerts',
        callback: this.handleRealtimeAlertUpdate.bind(this),
        conflictResolution: false
      });

      if (!alertsSubscription.success) {
        throw new Error('Failed to establish alerts table subscription');
      }

      // Load user notification preferences
      await this.loadUserPreferences();

      // Start background tasks
      this.startBackgroundTasks();

      this.isInitialized = true;
      performanceMonitor.recordMetric('alerts_notification_service_init', Date.now(), 'success');

      return { success: true };

    } catch (error) {
      console.error('Failed to initialize alerts notification service:', error);
      performanceMonitor.recordMetric('alerts_notification_service_init', Date.now(), 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new alert
   */
  async createAlert(alertData) {
    const startTime = Date.now();

    try {
      const {
        type,
        title,
        message,
        severity,
        source_table,
        source_id,
        metadata = {},
        assignedTo = null
      } = alertData;

      // Validate alert type
      const alertConfig = this.alertTypes[type];
      if (!alertConfig) {
        throw new Error(`Unknown alert type: ${type}`);
      }

      // Check for duplicate alerts (within 5 minutes)
      const duplicateCheck = await this.checkForDuplicateAlert(type, source_table, source_id);
      if (duplicateCheck.isDuplicate) {
        // Update existing alert instead of creating new one
        return await this.updateAlert(duplicateCheck.alertId, {
          occurrence_count: duplicateCheck.occurrenceCount + 1,
          last_occurred_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Create alert record
      const alertRecord = {
        id: crypto.randomUUID(),
        type,
        title,
        message,
        severity: severity || alertConfig.priority,
        status: 'active',
        source_table,
        source_id,
        metadata,
        assigned_to: assignedTo,
        occurrence_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_occurred_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('alerts')
        .insert(alertRecord)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      this.updateCache(data.id, data);

      // Send notifications through configured channels
      await this.processAlertNotifications(data, alertConfig);

      // Set up escalation timer if configured
      if (alertConfig.escalationTime) {
        this.setupEscalationTimer(data.id, alertConfig.escalationTime);
      }

      // Set up auto-resolve timer if configured
      if (alertConfig.autoResolve && alertConfig.resolveAfter) {
        this.setupAutoResolveTimer(data.id, alertConfig.resolveAfter);
      }

      // Update metrics
      this.performanceMetrics.alertsCreatedToday++;

      // Notify subscribers
      this.notifySubscribers('alert_created', data);

      performanceMonitor.recordMetric('alerts_create', Date.now() - startTime, 'success');

      return { success: true, data };

    } catch (error) {
      console.error('Error creating alert:', error);
      performanceMonitor.recordMetric('alerts_create', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'ALERT_CREATE_FAILED'
      };
    }
  }

  /**
   * Update alert status and properties
   */
  async updateAlert(alertId, updates) {
    const startTime = Date.now();

    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // If resolving alert, track resolution in updated_at
      if (updates.status === 'resolved') {
        // resolved_at column doesn't exist in database schema
        
        // Calculate resolution time
        const currentAlert = await this.getAlertById(alertId);
        if (currentAlert.success) {
          const createdAt = new Date(currentAlert.data.created_at);
          const resolvedAt = new Date();
          updateData.resolution_time_minutes = Math.round((resolvedAt - createdAt) / (1000 * 60));
        }

        // Clear any active timers for this alert
        this.clearAlertTimers(alertId);
      }

      const { data, error } = await supabase
        .from('alerts')
        .update(updateData)
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      this.updateCache(alertId, data);

      // Update resolution metrics
      if (data.status === 'resolved' && data.resolution_time_minutes) {
        this.updateResolutionMetrics(data.resolution_time_minutes);
      }

      // Notify subscribers
      this.notifySubscribers('alert_updated', data);

      performanceMonitor.recordMetric('alerts_update', Date.now() - startTime, 'success');

      return { success: true, data };

    } catch (error) {
      console.error('Error updating alert:', error);
      performanceMonitor.recordMetric('alerts_update', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'ALERT_UPDATE_FAILED'
      };
    }
  }

  /**
   * Get alerts with filtering and pagination
   */
  async getAlerts(options = {}) {
    const startTime = Date.now();

    try {
      const {
        page = 1,
        limit = 20,
        status = 'active',
        severity,
        type,
        assignedTo,
        dateFrom,
        dateTo,
        search,
        sortBy = 'created_at',
        sortDirection = 'desc'
      } = options;

      // Check cache for recent identical queries
      const cacheKey = JSON.stringify(options);
      const cached = this.getCachedQuery(cacheKey);
      if (cached) {
        performanceMonitor.recordMetric('alerts_fetch', Date.now() - startTime, 'cached');
        return { success: true, ...cached };
      }

      // Build query
      let query = supabase
        .from('alerts')
        .select(`
          *
        `, { count: 'exact' });

      // Apply filters
      // Note: alerts table doesn't have 'status' column - removed to prevent errors
      // if (status && status !== 'all') {
      //   query = query.eq('status', status);
      // }
      if (severity) query = query.eq('severity', severity);
      if (type) query = query.eq('type', type);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      // Search functionality
      if (search) {
        query = query.or(`
          title.ilike.%${search}%,
          message.ilike.%${search}%,
          type.ilike.%${search}%
        `);
      }

      // Sorting and pagination
      const from = (page - 1) * limit;
      query = query
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .range(from, from + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      const result = {
        data,
        totalCount: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        hasNext: page < Math.ceil(count / limit),
        hasPrev: page > 1
      };

      // Cache result
      this.setCachedQuery(cacheKey, result);

      performanceMonitor.recordMetric('alerts_fetch', Date.now() - startTime, 'success');

      return { success: true, ...result };

    } catch (error) {
      console.error('Error fetching alerts:', error);
      performanceMonitor.recordMetric('alerts_fetch', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'ALERTS_FETCH_FAILED'
      };
    }
  }

  /**
   * Get alert by ID
   */
  async getAlertById(alertId) {
    const startTime = Date.now();

    try {
      // Check cache first
      const cached = this.cache.get(alertId);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        performanceMonitor.recordMetric('alerts_get_by_id', Date.now() - startTime, 'cached');
        return { success: true, data: cached.data };
      }

      const { data, error } = await supabase
        .from('alerts')
        .select(`
          *,
          alert_notifications(*)
        `)
        .eq('id', alertId)
        .single();

      if (error) throw error;

      // Update cache
      this.updateCache(alertId, data);

      performanceMonitor.recordMetric('alerts_get_by_id', Date.now() - startTime, 'success');

      return { success: true, data };

    } catch (error) {
      console.error('Error fetching alert:', error);
      performanceMonitor.recordMetric('alerts_get_by_id', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'ALERT_FETCH_FAILED'
      };
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(timeRange = '24h') {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.rpc('get_alert_statistics', {
        time_range: timeRange
      });

      if (error) throw error;

      const statistics = {
        ...data,
        ...this.performanceMetrics,
        channelStats: this.getChannelStatistics()
      };

      performanceMonitor.recordMetric('alerts_statistics', Date.now() - startTime, 'success');

      return { success: true, data: statistics };

    } catch (error) {
      console.error('Error fetching alert statistics:', error);
      performanceMonitor.recordMetric('alerts_statistics', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'ALERT_STATS_FAILED'
      };
    }
  }

  /**
   * Process alert notifications through configured channels
   */
  async processAlertNotifications(alert, alertConfig) {
    try {
      const notificationPromises = alertConfig.channels.map(async (channel) => {
        const channelConfig = this.notificationChannels[channel];
        if (!channelConfig.enabled) return;

        // Check rate limits
        if (this.isRateLimited(channel, alert.assigned_to)) {
          console.warn(`Rate limit exceeded for channel ${channel}`);
          return;
        }

        // Get user preferences for this channel
        const userPrefs = await this.getUserChannelPreference(alert.assigned_to, channel, alert.type);
        if (!userPrefs.enabled) return;

        // Send notification with retries
        await this.sendNotificationWithRetry(channel, alert, channelConfig);
      });

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Error processing alert notifications:', error);
    }
  }

  /**
   * Send notification with retry logic
   */
  async sendNotificationWithRetry(channel, alert, channelConfig, attempt = 1) {
    try {
      await channelConfig.handler(alert);
      
      // Record successful notification
      await this.recordNotification(alert.id, channel, 'sent', null);
      this.performanceMetrics.notificationsSent++;
      
      // Update channel success rate
      this.updateChannelSuccessRate(channel, true);

    } catch (error) {
      console.error(`Error sending ${channel} notification (attempt ${attempt}):`, error);
      
      if (attempt < channelConfig.retryAttempts) {
        // Retry with exponential backoff
        const delay = channelConfig.retryDelay * Math.pow(2, attempt - 1);
        setTimeout(() => {
          this.sendNotificationWithRetry(channel, alert, channelConfig, attempt + 1);
        }, delay);
      } else {
        // Record failed notification
        await this.recordNotification(alert.id, channel, 'failed', error.message);
        this.updateChannelSuccessRate(channel, false);
      }
    }
  }

  /**
   * In-app notification handler
   */
  async sendInAppNotification(alert) {
    // Send real-time notification to connected clients
    this.notifySubscribers('notification', {
      type: 'in_app',
      alert,
      timestamp: new Date().toISOString()
    });

    // Store in-app notification for offline users
    await supabase
      .from('in_app_notifications')
      .insert({
        user_id: alert.assigned_to,
        alert_id: alert.id,
        title: alert.title,
        message: alert.message,
        type: alert.type,
        severity: alert.severity,
        read: false,
        created_at: new Date().toISOString()
      });
  }

  /**
   * Email notification handler
   */
  async sendEmailNotification(alert) {
    // Get user email preferences and details
    const { data: user } = await supabase
      .from('users')
      .select('email, first_name, last_name, notification_preferences')
      .eq('id', alert.assigned_to)
      .single();

    if (!user || !user.email) return;

    // Prepare email data
    const emailData = {
      to: user.email,
      subject: `Alert: ${alert.title}`,
      template: 'alert_notification',
      data: {
        userName: `${user.first_name} ${user.last_name}`,
        alertTitle: alert.title,
        alertMessage: alert.message,
        alertSeverity: alert.severity,
        alertType: alert.type,
        createdAt: alert.created_at,
        dashboardUrl: `${process.env.REACT_APP_BASE_URL}/alerts/${alert.id}`
      }
    };

    // Send email using Supabase Edge Function or external service
    const { error } = await supabase.functions.invoke('send-email', {
      body: emailData
    });

    if (error) throw error;
  }

  /**
   * SMS notification handler
   */
  async sendSMSNotification(alert) {
    // Get user phone number
    const { data: user } = await supabase
      .from('users')
      .select('phone, notification_preferences')
      .eq('id', alert.assigned_to)
      .single();

    if (!user || !user.phone) return;

    // Prepare SMS data
    const smsData = {
      to: user.phone,
      message: `TrashDrop Alert: ${alert.title}. ${alert.message.substring(0, 100)}...`
    };

    // Send SMS using Supabase Edge Function or external service
    const { error } = await supabase.functions.invoke('send-sms', {
      body: smsData
    });

    if (error) throw error;
  }

  /**
   * Push notification handler
   */
  async sendPushNotification(alert) {
    // Get user push tokens
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', alert.assigned_to)
      .eq('active', true);

    if (!tokens || tokens.length === 0) return;

    // Prepare push notification data
    const pushData = {
      tokens: tokens.map(t => t.token),
      title: alert.title,
      body: alert.message,
      data: {
        alert_id: alert.id,
        type: alert.type,
        severity: alert.severity
      }
    };

    // Send push notifications
    const { error } = await supabase.functions.invoke('send-push', {
      body: pushData
    });

    if (error) throw error;
  }

  /**
   * Handle real-time alert triggers
   */
  handleRealtimeAlertTrigger(payload) {
    const { eventType, new: newRecord, table } = payload;

    try {
      // Define trigger conditions for different tables
      const triggerConditions = {
        'pickup_requests': this.checkPickupRequestTriggers.bind(this),
        'illegal_dumping': this.checkIllegalDumpingTriggers.bind(this),
        'collector_sessions': this.checkCollectorSessionTriggers.bind(this),
        'system_logs': this.checkSystemLogTriggers.bind(this),
        'digital_bins': this.checkDigitalBinTriggers.bind(this)
      };

      const checkTriggers = triggerConditions[table];
      if (checkTriggers) {
        checkTriggers(eventType, newRecord);
      }

    } catch (error) {
      console.error('Error handling real-time alert trigger:', error);
    }
  }

  /**
   * Check pickup request alert triggers
   */
  checkPickupRequestTriggers(eventType, record) {
    // Check for delayed pickups
    if (record.status === 'in_progress' && record.scheduled_at) {
      const scheduledTime = new Date(record.scheduled_at);
      const now = new Date();
      const delayMinutes = (now - scheduledTime) / (1000 * 60);

      if (delayMinutes > 30) { // 30 minutes delay
        this.createAlert({
          type: 'pickup_delayed',
          title: 'Pickup Request Delayed',
          message: `Pickup request ${record.id} is ${Math.round(delayMinutes)} minutes behind schedule`,
          severity: delayMinutes > 60 ? 'high' : 'medium',
          source_table: 'pickup_requests',
          source_id: record.id,
          metadata: { delay_minutes: delayMinutes },
          assignedTo: record.assigned_collector
        });
      }
    }
  }

  /**
   * Utility functions
   */
  checkForDuplicateAlert(type, sourceTable, sourceId) {
    // Implementation for duplicate checking within time window
  }

  isRateLimited(channel, userId) {
    // Implementation for rate limiting checks
    const key = `${channel}_${userId}`;
    const channelConfig = this.notificationChannels[channel];
    const tracking = this.rateLimitTracking.get(key) || { count: 0, windowStart: Date.now() };

    if (Date.now() - tracking.windowStart > channelConfig.rateLimitWindow) {
      tracking.count = 0;
      tracking.windowStart = Date.now();
    }

    if (tracking.count >= channelConfig.rateLimitMax) {
      return true;
    }

    tracking.count++;
    this.rateLimitTracking.set(key, tracking);
    return false;
  }

  setupEscalationTimer(alertId, escalationTime) {
    const timer = setTimeout(async () => {
      await this.escalateAlert(alertId);
    }, escalationTime);

    this.escalationTimers.set(alertId, timer);
  }

  setupAutoResolveTimer(alertId, resolveAfter) {
    const timer = setTimeout(async () => {
      await this.updateAlert(alertId, { status: 'auto_resolved' });
    }, resolveAfter);

    this.autoResolveTimers.set(alertId, timer);
  }

  clearAlertTimers(alertId) {
    if (this.escalationTimers.has(alertId)) {
      clearTimeout(this.escalationTimers.get(alertId));
      this.escalationTimers.delete(alertId);
    }
    if (this.autoResolveTimers.has(alertId)) {
      clearTimeout(this.autoResolveTimers.get(alertId));
      this.autoResolveTimers.delete(alertId);
    }
  }

  /**
   * Cache management
   */
  updateCache(id, data) {
    if (this.cache.size >= 200) { // Limit cache size
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(id, {
      data,
      timestamp: Date.now()
    });
  }

  getCachedQuery(key) {
    return this.queryCache?.get(key);
  }

  setCachedQuery(key, data) {
    if (!this.queryCache) this.queryCache = new Map();
    if (this.queryCache.size >= 50) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    this.queryCache.set(key, { ...data, cachedAt: Date.now() });
  }

  /**
   * Background tasks
   */
  startBackgroundTasks() {
    // Clean up expired rate limit tracking every 5 minutes
    setInterval(() => {
      this.cleanupRateLimitTracking();
    }, 5 * 60 * 1000);

    // Update performance metrics every 10 minutes
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 10 * 60 * 1000);
  }

  cleanupRateLimitTracking() {
    const now = Date.now();
    for (const [key, tracking] of this.rateLimitTracking.entries()) {
      // Clean up tracking entries older than their rate limit window
      const maxWindow = Math.max(...Object.values(this.notificationChannels).map(c => c.rateLimitWindow || 0));
      if (now - tracking.windowStart > maxWindow) {
        this.rateLimitTracking.delete(key);
      }
    }
  }

  /**
   * Subscribe to service updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(event, data) {
    this.subscribers.forEach(callback => {
      try {
        callback({ event, data });
      } catch (error) {
        console.error('Error notifying subscriber:', error);
      }
    });
  }

  formatUserError(error) {
    const errorMap = {
      'invalid_alert_type': 'Invalid alert type specified',
      'notification_send_failed': 'Failed to send notification',
      'rate_limit_exceeded': 'Too many notifications sent recently'
    };

    const errorCode = error.code || error.message;
    return errorMap[errorCode] || 'An error occurred while processing the alert.';
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      cacheSize: this.cache.size,
      subscriberCount: this.subscribers.size,
      activeEscalationTimers: this.escalationTimers.size,
      activeAutoResolveTimers: this.autoResolveTimers.size,
      performanceMetrics: this.performanceMetrics
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Clear all timers
      for (const timer of this.escalationTimers.values()) {
        clearTimeout(timer);
      }
      for (const timer of this.autoResolveTimers.values()) {
        clearTimeout(timer);
      }

      this.escalationTimers.clear();
      this.autoResolveTimers.clear();

      // Unsubscribe from real-time updates
      const tables = ['pickup_requests', 'illegal_dumping', 'collector_sessions', 'system_logs', 'digital_bins', 'alerts'];
      for (const table of tables) {
        await realtimeManager.unsubscribe(`alerts_${table}`);
      }

      this.cache.clear();
      this.rateLimitTracking.clear();
      this.subscribers.clear();
      this.isInitialized = false;

      return { success: true };
    } catch (error) {
      console.error('Error during alerts notification service cleanup:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const alertsNotificationService = new AlertsNotificationService();
export default alertsNotificationService;
