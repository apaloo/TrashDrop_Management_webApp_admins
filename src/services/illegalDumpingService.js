/**
 * Illegal Dumping Service
 * 
 * Manages illegal dumping reports with real-time synchronization between
 * mobile app reports and admin portal management. Handles report lifecycle,
 * verification, assignment, and resolution tracking.
 */

import { supabase, supabaseAdmin } from '../utils/supabase';
import { safeDatabaseService } from '../utils/safeDatabaseService';
import { realtimeManager } from './realtimeManager';
import { performanceMonitor } from './performanceMonitor';
import { assignCleanupTeam } from '../utils/databaseUtils';

class IllegalDumpingService {
  constructor() {
    this.subscribers = new Set();
    this.isInitialized = false;
    
    // Status workflow configuration
    this.statusWorkflow = {
      'reported': ['verified', 'dismissed'],
      'verified': ['assigned', 'dismissed'],
      'assigned': ['in_progress'],
      'in_progress': ['resolved', 'escalated'],
      'escalated': ['resolved', 'assigned'],
      'resolved': [], // Final state
      'dismissed': [] // Final state
    };

    // Priority levels for severity assessment
    this.priorityMatrix = {
      'low': { multiplier: 1, urgencyHours: 168 }, // 7 days
      'medium': { multiplier: 1.5, urgencyHours: 72 }, // 3 days
      'high': { multiplier: 2, urgencyHours: 24 }, // 1 day
      'critical': { multiplier: 3, urgencyHours: 4 } // 4 hours
    };

    this.performanceMetrics = {
      averageResolutionTime: 0,
      reportsProcessedToday: 0,
      highPriorityPending: 0,
      mobileAppSyncStatus: 'healthy'
    };
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      if (this.isInitialized) return { success: true };

      // Set up real-time subscriptions for illegal dumping reports
      const subscription = await realtimeManager.subscribe('illegal_dumping', {
        table: 'illegal_dumping',
        callback: this.handleRealtimeUpdate.bind(this),
        conflictResolution: true
      });

      if (!subscription.success) {
        throw new Error('Failed to establish real-time subscription for illegal dumping');
      }

      // Start periodic tasks for metrics only
      this.startPeriodicTasks();

      this.isInitialized = true;
      performanceMonitor.recordMetric('illegal_dumping_service_init', Date.now(), 'success');

      return { success: true };
    } catch (error) {
      console.error('Failed to initialize illegal dumping service:', error);
      performanceMonitor.recordMetric('illegal_dumping_service_init', Date.now(), 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Create new illegal dumping report (typically from mobile app)
   */
  async createReport(reportData) {
    const startTime = Date.now();
    
    try {
      // Validate required fields
      const validation = this.validateReportData(reportData);
      if (!validation.isValid) {
        throw new Error(`Invalid report data: ${validation.errors.join(', ')}`);
      }

      // Calculate initial priority and urgency
      const priority = this.calculatePriority(reportData);
      
      // Prepare report data with metadata
      const enrichedData = {
        ...reportData,
        id: reportData.id || crypto.randomUUID(),
        status: 'reported',
        priority: priority.level,
        urgency_score: priority.urgencyScore,
        estimated_resolution_time: new Date(Date.now() + priority.estimatedHours * 3600000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: reportData.source || 'mobile_app',
        verification_required: true
      };

      // Use atomic function for creation with duplicate detection via Safe DB Service
      const data = await safeDatabaseService.safeRPC({
        functionName: 'create_illegal_dumping_report',
        params: {
          p_report_data: enrichedData,
          p_location_radius_meters: 50 // Check for duplicates within 50m
        },
        throwOnMissing: true
      });

      // Notify subscribers
      this.notifySubscribers('report_created', data);

      // Record performance metrics
      performanceMonitor.recordMetric('illegal_dumping_create', Date.now() - startTime, 'success');
      this.performanceMetrics.reportsProcessedToday++;

      return { success: true, data };

    } catch (error) {
      console.error('Error creating illegal dumping report:', error);
      performanceMonitor.recordMetric('illegal_dumping_create', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'REPORT_CREATE_FAILED'
      };
    }
  }

  /**
   * Update report status with workflow validation
   */
  async updateReportStatus(reportId, newStatus, updateData = {}) {
    const startTime = Date.now();

    try {
      // Get current report
      const currentReport = await this.getReportById(reportId);
      if (!currentReport.success) {
        throw new Error('Report not found');
      }

      // Validate status transition
      const canTransition = this.validateStatusTransition(
        currentReport.data.status, 
        newStatus
      );

      if (!canTransition) {
        throw new Error(`Invalid status transition from ${currentReport.data.status} to ${newStatus}`);
      }

      // Prepare update data
      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...updateData
      };

      // Add status-specific metadata
      if (newStatus === 'verified') {
        updates.verified_at = new Date().toISOString();
        updates.verification_required = false;
      } else if (newStatus === 'assigned') {
        updates.assigned_at = new Date().toISOString();
        if (!updateData.assigned_to) {
          throw new Error('assigned_to is required when assigning a report');
        }
        // Validate scheduled cleanup date if provided by UI
        if (!updateData.scheduled_cleanup_date && !updateData.scheduledDate) {
          throw new Error('scheduled_cleanup_date is required when assigning a report');
        }
      } else if (newStatus === 'resolved') {
        // resolved_at column doesn't exist in database schema
        // Use updated_at to track resolution time
        updates.resolution_time_hours = this.calculateResolutionTime(currentReport.data);
      }

      // Get authenticated user for audit trail
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      // If assigning, first call assign_cleanup_team RPC to persist team assignment and schedule
      if (newStatus === 'assigned') {
        const teamId = updateData.assigned_to;
        const scheduledDate = updateData.scheduled_cleanup_date || updateData.scheduledDate;
        const { error: assignError } = await assignCleanupTeam(reportId, teamId, scheduledDate);
        if (assignError) {
          throw new Error(assignError.message || 'Failed to assign cleanup team');
        }
      }

      // Use atomic update function via Safe DB Service - aligned with SQL signature
      const rpcResult = await safeDatabaseService.safeRPC({
        functionName: 'update_illegal_dumping_status',
        params: {
          p_dumping_id: reportId,
          p_status: newStatus,
          p_updated_by: userId
        },
        throwOnMissing: true
      });

      // Fetch the updated report since RPC returns only an ID
      const refreshed = await this.getReportById(reportId);
      if (!refreshed.success) {
        throw new Error(refreshed.error || 'Failed to fetch updated report');
      }
      const updatedReport = refreshed.data;

      // Update cache and metrics
      this.updateCache(reportId, updatedReport);
      this.updateResolutionMetrics(updatedReport);
      this.notifySubscribers('report_updated', updatedReport);

      performanceMonitor.recordMetric('illegal_dumping_update', Date.now() - startTime, 'success');

      return { success: true, data: updatedReport };

    } catch (error) {
      console.error('Error updating illegal dumping report status:', error);
      performanceMonitor.recordMetric('illegal_dumping_update', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'REPORT_UPDATE_FAILED'
      };
    }
  }

  /**
   * Get reports with advanced filtering and pagination
   */
  async getReports(options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        page = 1,
        limit = 20,
        status,
        priority,
        source,
        dateFrom,
        dateTo,
        location,
        assignedTo,
        search,
        sortBy = 'created_at',
        sortDirection = 'desc'
      } = options;

      // Optional location filter via RPC to get IDs within radius
      let locationIds = null;
      if (location && location.lat && location.lng && location.radius) {
        const locResults = await safeDatabaseService.safeRPC({
          functionName: 'reports_within_radius',
          params: {
            center_lat: location.lat,
            center_lng: location.lng,
            radius_meters: location.radius
          },
          throwOnMissing: true
        });
        locationIds = Array.isArray(locResults) ? locResults.map(r => r.id) : [];
      }

      // Execute query via Safe DB Service
      const { data, error, count } = await safeDatabaseService.safeQuery({
        tableName: 'illegal_dumping_mobile',
        queryFn: async () => {
          let query = supabase
            .from('illegal_dumping_mobile')
            .select(`*`, { count: 'exact' });

          // Apply filters
          if (status) query = query.eq('status', status);
          if (priority) query = query.eq('priority', priority);
          if (source) query = query.eq('source', source);
          if (assignedTo) query = query.eq('assigned_to', assignedTo);
          if (dateFrom) query = query.gte('created_at', dateFrom);
          if (dateTo) query = query.lte('created_at', dateTo);
          if (locationIds && locationIds.length > 0) query = query.in('id', locationIds);

          // Search functionality
          if (search) {
            query = query.or(`
              description.ilike.%${search}%,
              location_description.ilike.%${search}%,
              reporter_name.ilike.%${search}%
            `);
          }

          // Sorting and pagination
          const from = (page - 1) * limit;
          query = query
            .order(sortBy, { ascending: sortDirection === 'asc' })
            .range(from, from + limit - 1);

          return query;
        }
      });
      if (error) throw error;

      // Normalize coordinates and images for UI consumption
      const normalizedData = Array.isArray(data) ? data.map(r => {
        const latitude = r.latitude ?? (Array.isArray(r.location?.coordinates) ? r.location.coordinates[1] : null);
        const longitude = r.longitude ?? (Array.isArray(r.location?.coordinates) ? r.location.coordinates[0] : null);
        
        // Map photos_text column to images array (parse if string)
        let images = [];
        if (r.photos_text) {
          try {
            images = typeof r.photos_text === 'string' ? JSON.parse(r.photos_text) : r.photos_text;
            // Filter out blob URLs as they're invalid when retrieved from database
            images = Array.isArray(images) ? images.filter(url => !url.startsWith('blob:')) : [];
          } catch (e) {
            console.warn('Failed to parse photos_text for report', r.id, e);
            images = [];
          }
        }
        
        return { ...r, latitude, longitude, images };
      }) : [];

      const result = {
        data: normalizedData,
        totalCount: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        hasNext: page < Math.ceil(count / limit),
        hasPrev: page > 1
      };

      performanceMonitor.recordMetric('illegal_dumping_fetch', Date.now() - startTime, 'success');

      return { success: true, ...result };

    } catch (error) {
      console.error('Error fetching illegal dumping reports:', error);
      performanceMonitor.recordMetric('illegal_dumping_fetch', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'REPORTS_FETCH_FAILED'
      };
    }
  }

  /**
   * Get report by ID - Always fresh from database
   */
  async getReportById(reportId) {
    const startTime = Date.now();

    try {
      // Fetch from database with Safe DB Service
      const { data, error } = await safeDatabaseService.safeQuery({
        tableName: 'illegal_dumping_mobile',
        queryFn: async () => {
          return supabase
            .from('illegal_dumping_mobile')
            .select(`*`)
            .eq('id', reportId)
            .single();
        }
      });

      if (error) throw error;

      performanceMonitor.recordMetric('illegal_dumping_get_by_id', Date.now() - startTime, 'success');

      return { success: true, data };

    } catch (error) {
      console.error('Error fetching illegal dumping report:', error);
      performanceMonitor.recordMetric('illegal_dumping_get_by_id', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'REPORT_FETCH_FAILED'
      };
    }
  }

  /**
   * Upload resolution images
   */
  async uploadResolutionImages(reportId, images) {
    const startTime = Date.now();

    try {
      const uploadPromises = images.map(async (image, index) => {
        const fileName = `illegal_dumping/${reportId}/resolution_${Date.now()}_${index}.${image.type.split('/')[1]}`;
        
        const { data, error } = await supabaseAdmin.storage
          .from('images')
          .upload(fileName, image);

        if (error) throw error;

        // resolution_images table doesn't exist in database schema
        // Store image metadata in the main illegal_dumping record instead
        console.log('Image uploaded successfully:', data.path);

        return {
          id: `img_${Date.now()}`,
          path: data.path,
          url: supabaseAdmin.storage.from('images').getPublicUrl(data.path).data.publicUrl
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);

      performanceMonitor.recordMetric('illegal_dumping_image_upload', Date.now() - startTime, 'success');

      return { success: true, data: uploadedImages };

    } catch (error) {
      console.error('Error uploading resolution images:', error);
      performanceMonitor.recordMetric('illegal_dumping_image_upload', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'IMAGE_UPLOAD_FAILED'
      };
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    const startTime = Date.now();

    try {
      const data = await safeDatabaseService.safeRPC({
        functionName: 'get_illegal_dumping_stats',
        params: {},
        throwOnMissing: true
      });

      const stats = {
        ...data,
        ...this.performanceMetrics,
        lastUpdated: new Date().toISOString()
      };

      performanceMonitor.recordMetric('illegal_dumping_stats', Date.now() - startTime, 'success');

      return { success: true, data: stats };

    } catch (error) {
      console.error('Error fetching illegal dumping statistics:', error);
      performanceMonitor.recordMetric('illegal_dumping_stats', Date.now() - startTime, 'error');
      return { 
        success: false, 
        error: this.formatUserError(error),
        code: 'STATS_FETCH_FAILED'
      };
    }
  }

  /**
   * Handle real-time updates
   */
  handleRealtimeUpdate(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    try {
      switch (eventType) {
        case 'INSERT':
          this.notifySubscribers('report_created', newRecord);
          break;

        case 'UPDATE':
          this.notifySubscribers('report_updated', newRecord);
          break;

        case 'DELETE':
          this.notifySubscribers('report_deleted', oldRecord);
          break;
      }

      // Update performance metrics based on real-time events
      if (newRecord?.priority === 'high' || newRecord?.priority === 'critical') {
        this.performanceMetrics.highPriorityPending++;
      }

    } catch (error) {
      console.error('Error handling real-time update:', error);
    }
  }

  /**
   * Validate report data
   */
  validateReportData(reportData) {
    const errors = [];

    if (!reportData.location?.lat || !reportData.location?.lng) {
      errors.push('Location coordinates are required');
    }

    if (!reportData.description || reportData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters');
    }

    if (!reportData.images || !Array.isArray(reportData.images) || reportData.images.length === 0) {
      errors.push('At least one image is required');
    }

    if (reportData.waste_type && !['household', 'construction', 'electronic', 'hazardous', 'other'].includes(reportData.waste_type)) {
      errors.push('Invalid waste type');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate priority based on report data
   */
  calculatePriority(reportData) {
    let urgencyScore = 0;

    // Base priority factors
    const factors = {
      waste_type: {
        'hazardous': 3,
        'construction': 2,
        'electronic': 1.5,
        'household': 1,
        'other': 1
      },
      size: {
        'large': 2,
        'medium': 1.5,
        'small': 1
      },
      location_type: {
        'school_zone': 2.5,
        'residential': 2,
        'commercial': 1.5,
        'industrial': 1,
        'remote': 0.8
      }
    };

    // Calculate base score
    urgencyScore += factors.waste_type[reportData.waste_type] || 1;
    urgencyScore += factors.size[reportData.estimated_size] || 1;
    urgencyScore += factors.location_type[reportData.location_type] || 1;

    // Additional factors
    if (reportData.health_hazard) urgencyScore += 2;
    if (reportData.blocking_access) urgencyScore += 1.5;
    if (reportData.repeat_offender) urgencyScore += 1;

    // Determine priority level
    let level, estimatedHours;
    if (urgencyScore >= 6) {
      level = 'critical';
      estimatedHours = 4;
    } else if (urgencyScore >= 4.5) {
      level = 'high';
      estimatedHours = 24;
    } else if (urgencyScore >= 3) {
      level = 'medium';
      estimatedHours = 72;
    } else {
      level = 'low';
      estimatedHours = 168;
    }

    return { level, urgencyScore, estimatedHours };
  }

  /**
   * Validate status transition
   */
  validateStatusTransition(currentStatus, newStatus) {
    const allowedTransitions = this.statusWorkflow[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Calculate resolution time in hours
   */
  calculateResolutionTime(report) {
    const createdAt = new Date(report.created_at);
    const resolvedAt = new Date();
    return Math.round((resolvedAt - createdAt) / (1000 * 60 * 60));
  }

  /**
   * Start periodic maintenance tasks
   */
  startPeriodicTasks() {
    // Update performance metrics every hour
    this.metricsUpdateInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 60 * 60 * 1000);
  }

  /**
   * Update performance metrics
   */
  async updatePerformanceMetrics() {
    try {
      const data = await safeDatabaseService.safeRPC({
        functionName: 'get_illegal_dumping_performance_metrics',
        params: {},
        throwOnMissing: true
      });
      if (data) {
        this.performanceMetrics = { ...this.performanceMetrics, ...data };
      }
    } catch (error) {
      console.error('Error updating performance metrics:', error);
    }
  }

  /**
   * Update resolution metrics when reports are resolved
   */
  updateResolutionMetrics(reportData) {
    if (reportData.status === 'resolved' && reportData.resolution_time_hours) {
      // Update running average (simplified)
      this.performanceMetrics.averageResolutionTime = 
        (this.performanceMetrics.averageResolutionTime + reportData.resolution_time_hours) / 2;
    }
  }

  /**
   * Subscribe to service updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify subscribers
   */
  notifySubscribers(event, data) {
    this.subscribers.forEach(callback => {
      try {
        callback({ event, data });
      } catch (error) {
        console.error('Error notifying subscriber:', error);
      }
    });
  }

  /**
   * Format user-friendly error messages
   */
  formatUserError(error) {
    const errorMap = {
      'duplicate_key_value': 'A similar report already exists in this location',
      'foreign_key_violation': 'Invalid reference data provided',
      'check_violation': 'Data validation failed',
      'not_null_violation': 'Required information is missing'
    };

    const errorCode = error.code || error.message;
    return errorMap[errorCode] || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      subscriberCount: this.subscribers.size,
      performanceMetrics: this.performanceMetrics,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Clear intervals
      if (this.metricsUpdateInterval) {
        clearInterval(this.metricsUpdateInterval);
      }

      // Unsubscribe from real-time updates
      await realtimeManager.unsubscribe('illegal_dumping');

      // Clear subscribers
      this.subscribers.clear();

      this.isInitialized = false;

      return { success: true };
    } catch (error) {
      console.error('Error during illegal dumping service cleanup:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const illegalDumpingService = new IllegalDumpingService();
export default illegalDumpingService;
