import { supabase, checkConnection } from '../utils/supabase';

/**
 * Performance Monitoring Service
 * Tracks database performance, connection health, and system metrics
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.healthChecks = [];
    this.alertThresholds = {
      slowQuery: 5000, // 5 seconds
      connectionFailure: 3, // 3 consecutive failures
      highErrorRate: 0.1, // 10% error rate
      memoryUsage: 0.8 // 80% memory usage
    };
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs = 30000) { // Default 30 seconds
    if (this.isMonitoring) {
      console.warn('Performance monitoring is already running');
      return;
    }

    console.log('Starting performance monitoring...');
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkSystemHealth();
        this.analyzePerformance();
      } catch (error) {
        console.error('Error during performance monitoring:', error);
      }
    }, intervalMs);

    // Initial collection
    this.collectMetrics();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
  }

  /**
   * Track a database operation
   */
  trackOperation(operationName, startTime, endTime, success, error = null) {
    const duration = endTime - startTime;
    const timestamp = new Date();

    const metric = {
      operation: operationName,
      duration,
      success,
      error,
      timestamp
    };

    // Store metric
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    
    const operationMetrics = this.metrics.get(operationName);
    operationMetrics.push(metric);

    // Keep only last 100 metrics per operation to prevent memory leaks
    if (operationMetrics.length > 100) {
      operationMetrics.shift();
    }

    // Log slow queries
    if (duration > this.alertThresholds.slowQuery) {
      console.warn(`Slow query detected: ${operationName} took ${duration}ms`);
    }

    return metric;
  }

  /**
   * Collect system metrics
   */
  async collectMetrics() {
    const timestamp = new Date();

    try {
      // Check database connection
      const connectionCheck = await checkConnection();
      
      // Get browser performance metrics if available
      const performanceMetrics = this.getBrowserPerformanceMetrics();
      
      // Get database health if functions are available
      let dbHealth = null;
      try {
        const { data, error } = await supabase.rpc('get_system_health');
        if (!error) {
          dbHealth = data;
        }
      } catch (err) {
        console.log('Database health function not available:', err.message);
      }

      const metrics = {
        timestamp,
        connection: connectionCheck,
        performance: performanceMetrics,
        database: dbHealth,
        operationStats: this.getOperationStats()
      };

      this.healthChecks.push(metrics);

      // Keep only last 50 health checks
      if (this.healthChecks.length > 50) {
        this.healthChecks.shift();
      }

      return metrics;
    } catch (error) {
      console.error('Error collecting metrics:', error);
      return null;
    }
  }

  /**
   * Get browser performance metrics
   */
  getBrowserPerformanceMetrics() {
    if (typeof window === 'undefined' || !window.performance) {
      return null;
    }

    const navigation = window.performance.getEntriesByType('navigation')[0];
    const memory = window.performance.memory;

    return {
      navigation: navigation ? {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domComplete: navigation.domComplete - navigation.navigationStart
      } : null,
      memory: memory ? {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usage: memory.usedJSHeapSize / memory.totalJSHeapSize
      } : null,
      timing: {
        now: window.performance.now(),
        timeOrigin: window.performance.timeOrigin
      }
    };
  }

  /**
   * Get operation statistics
   */
  getOperationStats() {
    const stats = {};
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    this.metrics.forEach((operations, operationName) => {
      const recentOperations = operations.filter(
        op => op.timestamp.getTime() > oneHourAgo
      );

      if (recentOperations.length === 0) {
        return;
      }

      const successful = recentOperations.filter(op => op.success);
      const failed = recentOperations.filter(op => !op.success);
      const durations = successful.map(op => op.duration);

      stats[operationName] = {
        total: recentOperations.length,
        successful: successful.length,
        failed: failed.length,
        successRate: successful.length / recentOperations.length,
        averageDuration: durations.length > 0 
          ? durations.reduce((a, b) => a + b, 0) / durations.length 
          : 0,
        maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
        minDuration: durations.length > 0 ? Math.min(...durations) : 0
      };
    });

    return stats;
  }

  /**
   * Check system health
   */
  async checkSystemHealth() {
    const issues = [];
    const operationStats = this.getOperationStats();

    // Check for high error rates
    Object.entries(operationStats).forEach(([operation, stats]) => {
      if (stats.successRate < (1 - this.alertThresholds.highErrorRate)) {
        issues.push({
          type: 'high_error_rate',
          operation,
          successRate: stats.successRate,
          threshold: 1 - this.alertThresholds.highErrorRate
        });
      }

      if (stats.averageDuration > this.alertThresholds.slowQuery) {
        issues.push({
          type: 'slow_operations',
          operation,
          averageDuration: stats.averageDuration,
          threshold: this.alertThresholds.slowQuery
        });
      }
    });

    // Check memory usage
    const browserMetrics = this.getBrowserPerformanceMetrics();
    if (browserMetrics?.memory?.usage > this.alertThresholds.memoryUsage) {
      issues.push({
        type: 'high_memory_usage',
        usage: browserMetrics.memory.usage,
        threshold: this.alertThresholds.memoryUsage
      });
    }

    // Check connection failures
    const recentHealthChecks = this.healthChecks.slice(-5);
    const connectionFailures = recentHealthChecks.filter(
      check => !check.connection.connected
    ).length;

    if (connectionFailures >= this.alertThresholds.connectionFailure) {
      issues.push({
        type: 'connection_failures',
        failures: connectionFailures,
        threshold: this.alertThresholds.connectionFailure
      });
    }

    if (issues.length > 0) {
      console.warn('System health issues detected:', issues);
      this.handleHealthIssues(issues);
    }

    return issues;
  }

  /**
   * Handle health issues
   */
  handleHealthIssues(issues) {
    issues.forEach(issue => {
      switch (issue.type) {
        case 'high_error_rate':
          console.error(`High error rate detected for ${issue.operation}: ${(issue.successRate * 100).toFixed(1)}%`);
          break;
        case 'slow_operations':
          console.warn(`Slow operations detected for ${issue.operation}: ${issue.averageDuration}ms average`);
          break;
        case 'high_memory_usage':
          console.warn(`High memory usage: ${(issue.usage * 100).toFixed(1)}%`);
          break;
        case 'connection_failures':
          console.error(`Multiple connection failures: ${issue.failures} recent failures`);
          break;
      }
    });

    // You can extend this to send alerts, log to external services, etc.
    this.logToConsole('HEALTH_ISSUES', { issues, timestamp: new Date() });
  }

  /**
   * Analyze performance trends
   */
  analyzePerformance() {
    const operationStats = this.getOperationStats();
    const trends = {};

    Object.entries(operationStats).forEach(([operation, stats]) => {
      // Simple trend analysis - you can make this more sophisticated
      const recentMetrics = this.metrics.get(operation) || [];
      const last10 = recentMetrics.slice(-10);
      const prev10 = recentMetrics.slice(-20, -10);

      if (last10.length >= 5 && prev10.length >= 5) {
        const recentAvg = last10.reduce((sum, m) => sum + m.duration, 0) / last10.length;
        const prevAvg = prev10.reduce((sum, m) => sum + m.duration, 0) / prev10.length;
        
        const change = ((recentAvg - prevAvg) / prevAvg) * 100;
        
        trends[operation] = {
          trend: change > 10 ? 'deteriorating' : change < -10 ? 'improving' : 'stable',
          change: change
        };
      }
    });

    return trends;
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData() {
    const operationStats = this.getOperationStats();
    const recentHealth = this.healthChecks.slice(-10);
    const browserMetrics = this.getBrowserPerformanceMetrics();

    return {
      operations: operationStats,
      healthChecks: recentHealth,
      browser: browserMetrics,
      trends: this.analyzePerformance(),
      isMonitoring: this.isMonitoring,
      uptime: this.healthChecks.length > 0 
        ? Date.now() - this.healthChecks[0].timestamp.getTime()
        : 0
    };
  }

  /**
   * Log performance data (can be extended to send to external services)
   */
  logToConsole(eventType, data) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PERF_MONITOR] ${eventType}:`, data);
    }
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return {
      timestamp: new Date(),
      metrics: Object.fromEntries(this.metrics),
      healthChecks: this.healthChecks,
      operationStats: this.getOperationStats(),
      browserMetrics: this.getBrowserPerformanceMetrics()
    };
  }

  /**
   * Clear all metrics (useful for testing or memory management)
   */
  clearMetrics() {
    this.metrics.clear();
    this.healthChecks = [];
    console.log('Performance metrics cleared');
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    console.log('Alert thresholds updated:', this.alertThresholds);
  }

  /**
   * Record a performance metric (alias for trackOperation for backward compatibility)
   */
  recordMetric(operationName, duration, success = true, error = null) {
    const startTime = Date.now() - duration;
    const endTime = Date.now();
    return this.trackOperation(operationName, startTime, endTime, success, error);
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export the class for testing
export { PerformanceMonitor };

// Wrapper function to track database operations
export const trackDatabaseOperation = (operationName, fn) => {
  return async (...args) => {
    const startTime = Date.now();
    try {
      const result = await fn(...args);
      const endTime = Date.now();
      performanceMonitor.trackOperation(operationName, startTime, endTime, true);
      return result;
    } catch (error) {
      const endTime = Date.now();
      performanceMonitor.trackOperation(operationName, startTime, endTime, false, error);
      throw error;
    }
  };
};

export default performanceMonitor;
