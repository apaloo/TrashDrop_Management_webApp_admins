/**
 * Audit & Logging Service
 * 
 * Comprehensive audit trail and logging system for all admin portal activities.
 * Handles user actions, system events, data changes, and compliance reporting.
 */

import { supabaseAdmin } from '../utils/supabase';
import { performanceMonitor } from './performanceMonitor';

class AuditLoggingService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.batchSize = 50;
    this.pendingLogs = [];
    this.flushInterval = null;
    this.isInitialized = false;
    
    // Log levels and categories
    this.logLevels = {
      'INFO': { priority: 1, retention: '1 year' },
      'WARNING': { priority: 2, retention: '2 years' },
      'ERROR': { priority: 3, retention: '5 years' },
      'CRITICAL': { priority: 4, retention: '7 years' },
      'AUDIT': { priority: 5, retention: '10 years' }
    };

    this.categories = {
      'user_action': 'User-initiated actions',
      'system_event': 'Automated system events',
      'data_change': 'Database modifications',
      'auth_event': 'Authentication and authorization',
      'api_call': 'External API interactions',
      'performance': 'Performance and monitoring',
      'security': 'Security-related events',
      'compliance': 'Compliance and regulatory'
    };

    this.sensitiveFields = [
      'password', 'token', 'api_key', 'secret', 'private_key',
      'phone', 'email', 'address', 'credit_card'
    ];
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      if (this.isInitialized) return { success: true };

      // Start batch flush interval
      this.flushInterval = setInterval(() => {
        this.flushPendingLogs();
      }, 5000); // Flush every 5 seconds

      this.isInitialized = true;
      performanceMonitor.recordMetric('audit_logging_service_init', Date.now(), 'success');

      return { success: true };
    } catch (error) {
      console.error('Failed to initialize audit logging service:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log user action
   */
  async logUserAction(action, details = {}) {
    return this.createLog({
      level: 'AUDIT',
      category: 'user_action',
      action,
      details,
      requires_retention: true
    });
  }

  /**
   * Log system event
   */
  async logSystemEvent(event, level = 'INFO', details = {}) {
    return this.createLog({
      level,
      category: 'system_event',
      action: event,
      details
    });
  }

  /**
   * Log data change
   */
  async logDataChange(table, operation, recordId, oldData = null, newData = null, userId = null) {
    const changeDetails = {
      table,
      operation, // INSERT, UPDATE, DELETE
      record_id: recordId,
      old_data: this.sanitizeData(oldData),
      new_data: this.sanitizeData(newData),
      changes: this.calculateChanges(oldData, newData)
    };

    return this.createLog({
      level: 'AUDIT',
      category: 'data_change',
      action: `${operation.toUpperCase()}_${table.toUpperCase()}`,
      details: changeDetails,
      user_id: userId,
      requires_retention: true
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event, severity = 'WARNING', details = {}) {
    return this.createLog({
      level: severity,
      category: 'security',
      action: event,
      details,
      requires_immediate_attention: severity === 'CRITICAL'
    });
  }

  /**
   * Create log entry
   */
  async createLog(logData) {
    try {
      const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level: logData.level || 'INFO',
        category: logData.category || 'system_event',
        action: logData.action,
        details: logData.details || {},
        user_id: logData.user_id || this.getCurrentUserId(),
        session_id: logData.session_id || this.getCurrentSessionId(),
        ip_address: logData.ip_address || this.getCurrentIP(),
        user_agent: logData.user_agent || navigator.userAgent,
        source: 'admin_portal',
        requires_retention: logData.requires_retention || false,
        requires_immediate_attention: logData.requires_immediate_attention || false
      };

      // Add to pending batch
      this.pendingLogs.push(logEntry);

      // Flush immediately for critical logs
      if (logData.level === 'CRITICAL' || logData.requires_immediate_attention) {
        await this.flushPendingLogs();
      }

      return { success: true, id: logEntry.id };
    } catch (error) {
      console.error('Error creating log entry:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Flush pending logs to database
   */
  async flushPendingLogs() {
    if (this.pendingLogs.length === 0) return;

    try {
      const logsToFlush = [...this.pendingLogs];
      this.pendingLogs = [];

      const { error } = await supabaseAdmin
        .from('audit_logs')
        .insert(logsToFlush);

      if (error) {
        // Re-add logs to pending if flush failed
        this.pendingLogs.unshift(...logsToFlush);
        throw error;
      }

      performanceMonitor.recordMetric('audit_logs_batch_flush', Date.now(), 'success', logsToFlush.length);
    } catch (error) {
      console.error('Error flushing pending logs:', error);
    }
  }

  /**
   * Search audit logs
   */
  async searchLogs(options = {}) {
    const startTime = Date.now();

    try {
      const {
        page = 1,
        limit = 50,
        level,
        category,
        action,
        userId,
        dateFrom,
        dateTo,
        search,
        sortBy = 'timestamp',
        sortDirection = 'desc'
      } = options;

      let query = supabaseAdmin
        .from('audit_logs')
        .select(`
          *,
          user:users(first_name, last_name, email)
        `, { count: 'exact' });

      // Apply filters
      if (level) query = query.eq('level', level);
      if (category) query = query.eq('category', category);
      if (action) query = query.ilike('action', `%${action}%`);
      if (userId) query = query.eq('user_id', userId);
      if (dateFrom) query = query.gte('timestamp', dateFrom);
      if (dateTo) query = query.lte('timestamp', dateTo);

      // Search functionality
      if (search) {
        query = query.or(`
          action.ilike.%${search}%,
          details->>message.ilike.%${search}%,
          details->>description.ilike.%${search}%
        `);
      }

      // Sorting and pagination
      const from = (page - 1) * limit;
      query = query
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .range(from, from + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      performanceMonitor.recordMetric('audit_logs_search', Date.now() - startTime, 'success');

      return {
        success: true,
        data,
        totalCount: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      };
    } catch (error) {
      console.error('Error searching audit logs:', error);
      performanceMonitor.recordMetric('audit_logs_search', Date.now() - startTime, 'error');
      return { success: false, error: this.formatUserError(error) };
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(options = {}) {
    const startTime = Date.now();

    try {
      const {
        dateFrom,
        dateTo,
        includeCategories = ['data_change', 'security', 'auth_event'],
        format = 'json'
      } = options;

      const { data, error } = await supabaseAdmin.rpc('generate_compliance_report', {
        start_date: dateFrom,
        end_date: dateTo,
        categories: includeCategories,
        report_format: format
      });

      if (error) throw error;

      performanceMonitor.recordMetric('audit_compliance_report', Date.now() - startTime, 'success');

      return { success: true, data };
    } catch (error) {
      console.error('Error generating compliance report:', error);
      return { success: false, error: this.formatUserError(error) };
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(timeRange = '24h') {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_audit_statistics', {
        time_range: timeRange
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error fetching audit statistics:', error);
      return { success: false, error: this.formatUserError(error) };
    }
  }

  /**
   * Utility functions
   */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    this.sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  calculateChanges(oldData, newData) {
    if (!oldData || !newData) return null;

    const changes = {};
    Object.keys(newData).forEach(key => {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          from: oldData[key],
          to: newData[key]
        };
      }
    });
    return Object.keys(changes).length > 0 ? changes : null;
  }

  getCurrentUserId() {
    // Get from auth context or session
    return localStorage.getItem('current_user_id') || null;
  }

  getCurrentSessionId() {
    return localStorage.getItem('session_id') || null;
  }

  getCurrentIP() {
    // This would typically come from request headers in a server environment
    return '127.0.0.1';
  }

  formatUserError(error) {
    const errorMap = {
      'permission_denied': 'Insufficient permissions to access audit logs',
      'invalid_date_range': 'Invalid date range specified'
    };

    return errorMap[error.code] || 'An error occurred while processing audit logs.';
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      pendingLogCount: this.pendingLogs.length,
      cacheSize: this.cache.size,
      flushIntervalActive: !!this.flushInterval
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Flush any remaining logs
      await this.flushPendingLogs();

      // Clear flush interval
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }

      this.cache.clear();
      this.pendingLogs = [];
      this.isInitialized = false;

      return { success: true };
    } catch (error) {
      console.error('Error during audit logging service cleanup:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const auditLoggingService = new AuditLoggingService();
export default auditLoggingService;
