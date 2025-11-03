/**
 * Dashboard Analytics Service
 * 
 * Provides optimized analytics data for dashboard widgets with intelligent
 * caching, real-time updates, and performance monitoring. Handles KPI calculations,
 * trend analysis, and statistical insights across all portal features.
 */

import { supabaseAdmin } from '../utils/supabase';
import { realtimeManager } from './realtimeManager';
import { performanceMonitor } from './performanceMonitor';

class DashboardAnalyticsService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = {
      'realtime': 30 * 1000,        // 30 seconds for real-time metrics
      'hourly': 5 * 60 * 1000,      // 5 minutes for hourly aggregations
      'daily': 15 * 60 * 1000,      // 15 minutes for daily aggregations
      'weekly': 60 * 60 * 1000,     // 1 hour for weekly aggregations
      'monthly': 6 * 60 * 60 * 1000 // 6 hours for monthly aggregations
    };
    
    this.subscribers = new Set();
    this.isInitialized = false;
    this.refreshInterval = null;
    
    // KPI Configuration
    this.kpiDefinitions = {
      'active_pickups': {
        query: 'get_active_pickups_count',
        type: 'realtime',
        threshold: { warning: 50, critical: 100 }
      },
      'pending_requests': {
        query: 'get_pending_requests_count',
        type: 'realtime',
        threshold: { warning: 20, critical: 50 }
      },
      'illegal_dumping_open': {
        query: 'get_open_illegal_dumping_count',
        type: 'realtime',
        threshold: { warning: 10, critical: 25 }
      },
      'digital_bins_active': {
        query: 'get_active_digital_bins_count',
        type: 'hourly',
        threshold: { warning: 500, critical: 1000 }
      },
      'collectors_online': {
        query: 'get_online_collectors_count',
        type: 'realtime',
        threshold: { warning: 5, critical: 2 }
      },
      'daily_revenue': {
        query: 'get_daily_revenue',
        type: 'daily',
        format: 'currency'
      },
      'weekly_bags_processed': {
        query: 'get_weekly_bags_processed',
        type: 'weekly',
        format: 'number'
      },
      'monthly_growth_rate': {
        query: 'get_monthly_growth_rate',
        type: 'monthly',
        format: 'percentage'
      }
    };

    // Chart configurations for different visualizations
    this.chartConfigs = {
      'pickup_trends': {
        type: 'line',
        timeRange: '7d',
        granularity: 'hour',
        metrics: ['requests', 'completed', 'cancelled']
      },
      'waste_distribution': {
        type: 'pie',
        metrics: ['household', 'commercial', 'construction', 'electronic', 'hazardous']
      },
      'collector_performance': {
        type: 'bar',
        timeRange: '30d',
        granularity: 'day',
        metrics: ['pickups_completed', 'efficiency_score', 'customer_rating']
      },
      'regional_activity': {
        type: 'heatmap',
        metrics: ['pickup_density', 'illegal_dumping_reports', 'bin_utilization']
      }
    };

    this.performanceMetrics = {
      cacheHitRate: 0,
      averageQueryTime: 0,
      dataFreshness: 0,
      lastRefresh: null
    };
  }

  /**
   * Initialize the analytics service
   */
  async initialize() {
    try {
      if (this.isInitialized) return { success: true };

      // Set up real-time subscriptions for analytics updates
      const tables = ['pickup_requests', 'digital_bins', 'illegal_dumping', 'collector_sessions', 'bags'];
      
      for (const table of tables) {
        const subscription = await realtimeManager.subscribe(`analytics_${table}`, {
          table,
          callback: this.handleRealtimeAnalyticsUpdate.bind(this),
          conflictResolution: false // Analytics don't need conflict resolution
        });

        if (!subscription.success) {
          console.warn(`Failed to establish analytics subscription for ${table}`);
        }
      }

      // Preload critical KPIs
      await this.preloadCriticalKPIs();

      // Start background refresh process
      this.startBackgroundRefresh();

      this.isInitialized = true;
      performanceMonitor.recordMetric('dashboard_analytics_init', Date.now(), 'success');

      return { success: true };

    } catch (error) {
      console.error('Failed to initialize dashboard analytics service:', error);
      performanceMonitor.recordMetric('dashboard_analytics_init', Date.now(), 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all KPI data for dashboard overview
   */
  async getKPIOverview(forceRefresh = false) {
    const startTime = Date.now();
    const cacheKey = 'kpi_overview';

    try {
      // Check cache unless forced refresh
      if (!forceRefresh) {
        const cached = this.getCachedData(cacheKey, 'realtime');
        if (cached) {
          performanceMonitor.recordMetric('dashboard_kpi_overview', Date.now() - startTime, 'cached');
          this.performanceMetrics.cacheHitRate++;
          return { success: true, data: cached, fromCache: true };
        }
      }

      // Fetch all KPIs in parallel
      const kpiPromises = Object.entries(this.kpiDefinitions).map(async ([key, config]) => {
        try {
          const { data, error } = await supabaseAdmin.rpc(config.query);
          if (error) throw error;

          return {
            key,
            value: data,
            type: config.type,
            threshold: config.threshold,
            format: config.format,
            lastUpdated: new Date().toISOString()
          };
        } catch (error) {
          console.error(`Error fetching KPI ${key}:`, error);
          return {
            key,
            value: null,
            error: error.message,
            lastUpdated: new Date().toISOString()
          };
        }
      });

      const kpiResults = await Promise.all(kpiPromises);
      
      // Process KPIs into structured data
      const kpiData = {
        metrics: {},
        summary: {
          totalActiveItems: 0,
          criticalAlerts: 0,
          warningAlerts: 0,
          systemHealth: 'healthy'
        },
        lastUpdated: new Date().toISOString()
      };

      kpiResults.forEach(kpi => {
        kpiData.metrics[kpi.key] = kpi;
        
        // Analyze thresholds for alerts
        if (kpi.threshold && kpi.value !== null) {
          if (kpi.value >= kpi.threshold.critical) {
            kpiData.summary.criticalAlerts++;
          } else if (kpi.value >= kpi.threshold.warning) {
            kpiData.summary.warningAlerts++;
          }
        }

        // Count active items
        if (['active_pickups', 'pending_requests', 'digital_bins_active', 'collectors_online'].includes(kpi.key)) {
          kpiData.summary.totalActiveItems += kpi.value || 0;
        }
      });

      // Determine overall system health
      if (kpiData.summary.criticalAlerts > 0) {
        kpiData.summary.systemHealth = 'critical';
      } else if (kpiData.summary.warningAlerts > 2) {
        kpiData.summary.systemHealth = 'warning';
      }

      // Cache the result
      this.setCachedData(cacheKey, kpiData, 'realtime');

      performanceMonitor.recordMetric('dashboard_kpi_overview', Date.now() - startTime, 'success');
      this.performanceMetrics.averageQueryTime = (this.performanceMetrics.averageQueryTime + (Date.now() - startTime)) / 2;

      return { success: true, data: kpiData };

    } catch (error) {
      console.error('Error fetching KPI overview:', error);
      performanceMonitor.recordMetric('dashboard_kpi_overview', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'KPI_FETCH_FAILED'
      };
    }
  }

  /**
   * Get chart data for specific visualization
   */
  async getChartData(chartType, options = {}) {
    const startTime = Date.now();
    const cacheKey = `chart_${chartType}_${JSON.stringify(options)}`;

    try {
      const config = this.chartConfigs[chartType];
      if (!config) {
        throw new Error(`Unknown chart type: ${chartType}`);
      }

      // Check cache
      const cached = this.getCachedData(cacheKey, this.getChartCacheType(config));
      if (cached) {
        performanceMonitor.recordMetric('dashboard_chart_data', Date.now() - startTime, 'cached');
        return { success: true, data: cached, fromCache: true };
      }

      // Prepare query parameters
      const queryParams = {
        chart_type: chartType,
        time_range: options.timeRange || config.timeRange,
        granularity: options.granularity || config.granularity,
        metrics: options.metrics || config.metrics,
        filters: options.filters || {},
        timezone: options.timezone || 'UTC'
      };

      // Execute the chart data query
      const { data, error } = await supabaseAdmin.rpc('get_dashboard_chart_data', queryParams);
      if (error) throw error;

      // Process data based on chart type
      const processedData = this.processChartData(data, config);

      // Cache the result
      this.setCachedData(cacheKey, processedData, this.getChartCacheType(config));

      performanceMonitor.recordMetric('dashboard_chart_data', Date.now() - startTime, 'success');

      return { success: true, data: processedData };

    } catch (error) {
      console.error(`Error fetching chart data for ${chartType}:`, error);
      performanceMonitor.recordMetric('dashboard_chart_data', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'CHART_DATA_FAILED'
      };
    }
  }

  /**
   * Get recent activity feed for dashboard
   */
  async getRecentActivity(limit = 20, filters = {}) {
    const startTime = Date.now();
    const cacheKey = `recent_activity_${limit}_${JSON.stringify(filters)}`;

    try {
      // Check cache
      const cached = this.getCachedData(cacheKey, 'realtime');
      if (cached) {
        performanceMonitor.recordMetric('dashboard_recent_activity', Date.now() - startTime, 'cached');
        return { success: true, data: cached, fromCache: true };
      }

      // Fetch recent activities across all systems
      const { data, error } = await supabaseAdmin.rpc('get_recent_system_activity', {
        activity_limit: limit,
        include_types: filters.types || ['pickup_request', 'illegal_dumping', 'bag_scan', 'collector_session'],
        since: filters.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
      });

      if (error) throw error;

      // Process and enrich activity data
      const processedActivity = data.map(activity => ({
        ...activity,
        timeAgo: this.calculateTimeAgo(activity.created_at),
        priority: this.calculateActivityPriority(activity),
        iconClass: this.getActivityIcon(activity.type),
        colorClass: this.getActivityColor(activity.type, activity.status)
      }));

      // Cache the result
      this.setCachedData(cacheKey, processedActivity, 'realtime');

      performanceMonitor.recordMetric('dashboard_recent_activity', Date.now() - startTime, 'success');

      return { success: true, data: processedActivity };

    } catch (error) {
      console.error('Error fetching recent activity:', error);
      performanceMonitor.recordMetric('dashboard_recent_activity', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'RECENT_ACTIVITY_FAILED'
      };
    }
  }

  /**
   * Get performance insights and recommendations
   */
  async getPerformanceInsights() {
    const startTime = Date.now();
    const cacheKey = 'performance_insights';

    try {
      // Check cache (insights can be cached longer)
      const cached = this.getCachedData(cacheKey, 'hourly');
      if (cached) {
        performanceMonitor.recordMetric('dashboard_performance_insights', Date.now() - startTime, 'cached');
        return { success: true, data: cached, fromCache: true };
      }

      // Get comprehensive performance data
      const { data, error } = await supabaseAdmin.rpc('get_system_performance_insights');
      if (error) throw error;

      // Analyze trends and generate insights
      const insights = {
        trends: this.analyzeTrends(data.trends),
        recommendations: this.generateRecommendations(data),
        alerts: this.identifyPerformanceAlerts(data),
        efficiency: this.calculateEfficiencyMetrics(data),
        forecasts: this.generateForecasts(data.historical),
        lastAnalyzed: new Date().toISOString()
      };

      // Cache insights
      this.setCachedData(cacheKey, insights, 'hourly');

      performanceMonitor.recordMetric('dashboard_performance_insights', Date.now() - startTime, 'success');

      return { success: true, data: insights };

    } catch (error) {
      console.error('Error generating performance insights:', error);
      performanceMonitor.recordMetric('dashboard_performance_insights', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'INSIGHTS_GENERATION_FAILED'
      };
    }
  }

  /**
   * Get custom analytics query results
   */
  async getCustomAnalytics(queryConfig) {
    const startTime = Date.now();
    
    try {
      const {
        metrics,
        dimensions,
        filters,
        timeRange,
        granularity,
        aggregation = 'sum'
      } = queryConfig;

      // Validate query configuration
      if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
        throw new Error('At least one metric is required');
      }

      // Build dynamic query
      const queryParams = {
        metrics,
        dimensions: dimensions || [],
        filters: filters || {},
        time_range: timeRange,
        granularity: granularity || 'day',
        aggregation
      };

      const { data, error } = await supabaseAdmin.rpc('execute_custom_analytics', queryParams);
      if (error) throw error;

      // Process results for visualization
      const processedData = {
        results: data,
        metadata: {
          query: queryParams,
          executedAt: new Date().toISOString(),
          rowCount: data.length,
          executionTime: Date.now() - startTime
        }
      };

      performanceMonitor.recordMetric('dashboard_custom_analytics', Date.now() - startTime, 'success');

      return { success: true, data: processedData };

    } catch (error) {
      console.error('Error executing custom analytics:', error);
      performanceMonitor.recordMetric('dashboard_custom_analytics', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'CUSTOM_ANALYTICS_FAILED'
      };
    }
  }

  /**
   * Export analytics data
   */
  async exportData(exportConfig) {
    const startTime = Date.now();

    try {
      const {
        type, // 'csv', 'json', 'xlsx'
        dateRange,
        tables,
        filters = {}
      } = exportConfig;

      if (!['csv', 'json', 'xlsx'].includes(type)) {
        throw new Error('Invalid export type');
      }

      // Get export data
      const { data, error } = await supabaseAdmin.rpc('export_analytics_data', {
        export_type: type,
        date_range: dateRange,
        tables: tables,
        filters: filters
      });

      if (error) throw error;

      performanceMonitor.recordMetric('dashboard_data_export', Date.now() - startTime, 'success');

      return { success: true, data: data.export_data, metadata: data.metadata };

    } catch (error) {
      console.error('Error exporting analytics data:', error);
      performanceMonitor.recordMetric('dashboard_data_export', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'DATA_EXPORT_FAILED'
      };
    }
  }

  /**
   * Handle real-time analytics updates
   */
  handleRealtimeAnalyticsUpdate(payload) {
    const { eventType, new: newRecord, table } = payload;

    try {
      // Invalidate relevant cache entries
      this.invalidateRelatedCache(table, eventType);

      // Update real-time metrics if applicable
      this.updateRealtimeMetrics(table, eventType, newRecord);

      // Notify subscribers of analytics updates
      this.notifySubscribers('analytics_update', {
        table,
        eventType,
        affectedMetrics: this.getAffectedMetrics(table, eventType)
      });

    } catch (error) {
      console.error('Error handling real-time analytics update:', error);
    }
  }

  /**
   * Process chart data based on chart type
   */
  processChartData(rawData, config) {
    switch (config.type) {
      case 'line':
        return this.processLineChartData(rawData, config);
      case 'pie':
        return this.processPieChartData(rawData, config);
      case 'bar':
        return this.processBarChartData(rawData, config);
      case 'heatmap':
        return this.processHeatmapData(rawData, config);
      default:
        return rawData;
    }
  }

  /**
   * Process line chart data
   */
  processLineChartData(rawData, config) {
    return {
      labels: rawData.map(item => item.time_period),
      datasets: config.metrics.map(metric => ({
        label: metric.replace('_', ' ').toUpperCase(),
        data: rawData.map(item => item[metric] || 0),
        borderColor: this.getMetricColor(metric),
        backgroundColor: this.getMetricColor(metric, 0.1),
        tension: 0.4
      }))
    };
  }

  /**
   * Process pie chart data
   */
  processPieChartData(rawData, config) {
    return {
      labels: rawData.map(item => item.category),
      datasets: [{
        data: rawData.map(item => item.value),
        backgroundColor: rawData.map((_, index) => this.getCategoryColor(index)),
        borderWidth: 2
      }]
    };
  }

  /**
   * Process bar chart data
   */
  processBarChartData(rawData, config) {
    return {
      labels: rawData.map(item => item.period),
      datasets: config.metrics.map(metric => ({
        label: metric.replace('_', ' ').toUpperCase(),
        data: rawData.map(item => item[metric] || 0),
        backgroundColor: this.getMetricColor(metric, 0.8),
        borderColor: this.getMetricColor(metric),
        borderWidth: 1
      }))
    };
  }

  /**
   * Analyze trends from historical data
   */
  analyzeTrends(trendsData) {
    return trendsData.map(trend => ({
      ...trend,
      direction: trend.change_percent > 0 ? 'up' : 'down',
      magnitude: Math.abs(trend.change_percent),
      significance: this.assessTrendSignificance(trend)
    }));
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(performanceData) {
    const recommendations = [];

    // Analyze pickup efficiency
    if (performanceData.pickup_completion_rate < 0.85) {
      recommendations.push({
        type: 'efficiency',
        priority: 'high',
        title: 'Improve Pickup Completion Rate',
        description: 'Completion rate is below 85%. Consider optimizing routes and collector training.',
        action: 'Review collector performance and implement route optimization.'
      });
    }

    // Analyze response times
    if (performanceData.avg_response_time > 24) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Reduce Response Times',
        description: 'Average response time exceeds 24 hours. Consider increasing collector capacity.',
        action: 'Review staffing levels during peak hours.'
      });
    }

    return recommendations;
  }

  /**
   * Cache management helpers
   */
  getCachedData(key, cacheType) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const maxAge = this.cacheExpiry[cacheType] || this.cacheExpiry.hourly;
    if (Date.now() - cached.timestamp > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  setCachedData(key, data, cacheType) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      type: cacheType
    });

    // Implement cache size limit
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Invalidate cache entries related to a table update
   */
  invalidateRelatedCache(table, eventType) {
    const keysToDelete = [];
    
    for (const [key] of this.cache) {
      if (key.includes('kpi_overview') || key.includes('recent_activity') || key.includes(table)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Preload critical KPIs for fast dashboard loading
   */
  async preloadCriticalKPIs() {
    try {
      // Preload the most important KPIs
      const criticalKPIs = ['active_pickups', 'pending_requests', 'collectors_online', 'illegal_dumping_open'];
      
      const preloadPromises = criticalKPIs.map(async (kpiKey) => {
        const config = this.kpiDefinitions[kpiKey];
        if (config) {
          const { data, error } = await supabaseAdmin.rpc(config.query);
          if (!error) {
            this.setCachedData(`kpi_${kpiKey}`, data, config.type);
          }
        }
      });

      await Promise.all(preloadPromises);
    } catch (error) {
      console.error('Error preloading critical KPIs:', error);
    }
  }

  /**
   * Start background refresh process
   */
  startBackgroundRefresh() {
    // Refresh real-time KPIs every 30 seconds
    this.refreshInterval = setInterval(async () => {
      try {
        await this.refreshRealtimeMetrics();
        this.performanceMetrics.lastRefresh = new Date().toISOString();
      } catch (error) {
        console.error('Error during background refresh:', error);
      }
    }, 30 * 1000);
  }

  /**
   * Refresh real-time metrics in background
   */
  async refreshRealtimeMetrics() {
    const realtimeKPIs = Object.entries(this.kpiDefinitions)
      .filter(([_, config]) => config.type === 'realtime')
      .map(([key, config]) => ({ key, config }));

    const refreshPromises = realtimeKPIs.map(async ({ key, config }) => {
      try {
        const { data, error } = await supabaseAdmin.rpc(config.query);
        if (!error) {
          this.setCachedData(`kpi_${key}`, data, 'realtime');
        }
      } catch (error) {
        console.error(`Error refreshing ${key}:`, error);
      }
    });

    await Promise.all(refreshPromises);
  }

  /**
   * Utility functions
   */
  calculateTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  getMetricColor(metric, alpha = 1) {
    const colors = {
      'pickups': `rgba(34, 197, 94, ${alpha})`,
      'requests': `rgba(59, 130, 246, ${alpha})`,
      'revenue': `rgba(168, 85, 247, ${alpha})`,
      'efficiency': `rgba(245, 158, 11, ${alpha})`,
      'alerts': `rgba(239, 68, 68, ${alpha})`
    };
    
    return colors[metric] || `rgba(107, 114, 128, ${alpha})`;
  }

  formatUserError(error) {
    const errorMap = {
      'function_not_found': 'Analytics function not available',
      'permission_denied': 'Insufficient permissions for analytics data',
      'query_timeout': 'Analytics query took too long to execute'
    };

    const errorCode = error.code || error.message;
    return errorMap[errorCode] || 'Unable to fetch analytics data. Please try again.';
  }

  /**
   * Subscribe to analytics updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify subscribers of updates
   */
  notifySubscribers(event, data) {
    this.subscribers.forEach(callback => {
      try {
        callback({ event, data });
      } catch (error) {
        console.error('Error notifying analytics subscriber:', error);
      }
    });
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      cacheSize: this.cache.size,
      subscriberCount: this.subscribers.size,
      performanceMetrics: this.performanceMetrics,
      lastRefresh: this.performanceMetrics.lastRefresh
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
      }

      // Unsubscribe from all analytics subscriptions
      const tables = ['pickup_requests', 'digital_bins', 'illegal_dumping', 'collector_sessions', 'bags'];
      for (const table of tables) {
        await realtimeManager.unsubscribe(`analytics_${table}`);
      }

      this.cache.clear();
      this.subscribers.clear();
      this.isInitialized = false;

      return { success: true };
    } catch (error) {
      console.error('Error during dashboard analytics cleanup:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const dashboardAnalyticsService = new DashboardAnalyticsService();
export default dashboardAnalyticsService;
