/**
 * Audit & Logging Service
 * 
 * Thin wrapper kept for systemInit and older callers. Every entry goes to
 * public.logs through logAudit() (src/services/auditLogService.js); the old
 * separate audit_logs table, batching and search were removed.
 */

import { logAudit } from './auditLogService';
import { performanceMonitor } from './performanceMonitor';

class AuditLoggingService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
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
    // One audit trail: everything goes to public.logs through logAudit()
    // (this service used to batch into a separate audit_logs table).
    const slug = String(logData.action || logData.category || 'event').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '') || 'event';
    const id = await logAudit({
      level: String(logData.level || 'info').toLowerCase() === 'audit' ? 'info' : String(logData.level || 'info').toLowerCase(),
      source: 'system',
      action: `system.${slug}`,
      message: logData.message || logData.action || 'System event',
      metadata: { category: logData.category || null, ...(logData.details || {}) },
    });
    return id ? { success: true, id } : { success: false, error: 'Audit log not written' };
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
      cacheSize: this.cache.size,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      this.cache.clear();
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
