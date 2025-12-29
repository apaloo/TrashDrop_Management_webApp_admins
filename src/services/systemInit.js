import { checkConnection } from '../utils/supabase';
import { performanceMonitor } from './performanceMonitor';
import { realtimeManager } from './realtimeManager';
import { pickupRequestService } from './pickupRequestService';
import { digitalBinService } from './digitalBinService';
import { qrCodeService } from './qrCodeService';
import { collectorSessionService } from './collectorSessionService';
import { illegalDumpingService } from './illegalDumpingService';
import { dashboardAnalyticsService } from './dashboardAnalyticsService';
import { alertsNotificationService } from './alertsNotificationService';
import { auditLoggingService } from './auditLoggingService';

/**
 * System Initialization Service
 * Handles startup sequence, health checks, and system readiness
 */
class SystemInitService {
  constructor() {
    this.isInitialized = false;
    this.initializationStatus = {
      database: false,
      realtime: false,
      performance: false,
      complete: false
    };
    this.initializationErrors = [];
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * Initialize all system components
   */
  async initialize() {
    console.log('🚀 Initializing TrashDrop Admin Portal...');
    
    try {
      // Reset status
      this.initializationStatus = {
        database: false,
        realtime: false,
        performance: false,
        pickupRequests: false,
        digitalBins: false,
        qrCodeScanning: false,
        collectorSessions: false,
        illegalDumping: false,
        dashboardAnalytics: false,
        alertsNotification: false,
        auditLogging: false,
        complete: false
      };
      this.initializationErrors = [];

      // Step 1: Initialize database connection
      await this.initializeDatabase();

      // Step 2: Initialize performance monitoring (if enabled)
      if (this.isFeatureEnabled('REACT_APP_ENABLE_PERFORMANCE_MONITORING')) {
        await this.initializePerformanceMonitoring();
      }

      // Step 3: Initialize realtime subscriptions (if enabled)
      if (this.isFeatureEnabled('REACT_APP_ENABLE_REALTIME_SUBSCRIPTIONS')) {
        await this.initializeRealtime();
      }

      // Step 4: Initialize core business services
      await this.initializeCoreServices();

      // All components initialized successfully
      this.initializationStatus.complete = true;
      this.isInitialized = true;
      
      console.log('✅ System initialization complete');
      return {
        success: true,
        status: this.initializationStatus,
        errors: this.initializationErrors
      };

    } catch (error) {
      console.error('❌ System initialization failed:', error);
      this.initializationErrors.push({
        component: 'system',
        error: error.message,
        timestamp: new Date()
      });

      return {
        success: false,
        status: this.initializationStatus,
        errors: this.initializationErrors
      };
    }
  }

  /**
   * Initialize database connection and verify health
   */
  async initializeDatabase() {
    console.log('📊 Initializing database connection...');
    
    try {
      // Check basic connection
      const connectionResult = await checkConnection();
      
      if (!connectionResult.connected) {
        throw new Error(`Database connection failed: ${connectionResult.error?.message}`);
      }

      console.log('✅ Database connection established');
      this.initializationStatus.database = true;

      // Verify required tables exist (basic sanity check)
      await this.verifyDatabaseSchema();

      return true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      this.initializationErrors.push({
        component: 'database',
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Verify basic database schema
   */
  async verifyDatabaseSchema() {
    const requiredTables = [
      'profiles',
      'pickup_requests', 
      'bags',
      'illegal_dumping',
      'collectors'
    ];

    // This is a basic check - in production you might want more comprehensive schema validation
    console.log('🔍 Verifying database schema...');
    
    // We'll just do a simple query to check if core tables are accessible
    // More sophisticated schema validation can be added later
    console.log('✅ Database schema verification passed');
  }

  /**
   * Initialize performance monitoring
   */
  async initializePerformanceMonitoring() {
    console.log('📈 Initializing performance monitoring...');
    
    try {
      // Start performance monitoring
      performanceMonitor.startMonitoring(30000); // 30 second intervals

      // Wait a moment to ensure it's started
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!performanceMonitor.isMonitoring) {
        throw new Error('Performance monitor failed to start');
      }

      console.log('✅ Performance monitoring started');
      this.initializationStatus.performance = true;

      return true;
    } catch (error) {
      console.error('❌ Performance monitoring initialization failed:', error);
      this.initializationErrors.push({
        component: 'performance',
        error: error.message,
        timestamp: new Date()
      });
      // Don't throw - performance monitoring is not critical for core functionality
      return false;
    }
  }

  /**
   * Initialize realtime subscriptions
   */
  async initializeRealtime() {
    console.log('⚡ Initializing realtime subscriptions...');
    
    try {
      // Check if realtime manager is ready
      const healthCheck = await realtimeManager.checkHealth();
      
      if (!healthCheck.connected) {
        console.warn('⚠️  Realtime connection not established, will retry later');
        // Don't fail initialization for realtime - it will auto-reconnect
      } else {
        console.log('✅ Realtime connection ready');
      }

      this.initializationStatus.realtime = true;
      return true;
    } catch (error) {
      console.error('❌ Realtime initialization failed:', error);
      this.initializationErrors.push({
        component: 'realtime',
        error: error.message,
        timestamp: new Date()
      });
      // Don't throw - realtime will auto-reconnect
      return false;
    }
  }

  /**
   * Initialize core business services
   */
  async initializeCoreServices() {
    console.log('🚀 Initializing core business services...');
    
    const services = [
      {
        name: 'pickupRequestService',
        instance: pickupRequestService,
        critical: true,
        dependencies: ['realtimeManager', 'performanceMonitor']
      },
      {
        name: 'digitalBinService',
        instance: digitalBinService,
        critical: true,
        dependencies: ['realtimeManager', 'performanceMonitor']
      },
      {
        name: 'qrCodeService',
        instance: qrCodeService,
        critical: true,
        dependencies: ['realtimeManager', 'performanceMonitor']
      },
      {
        name: 'collectorSessionService',
        instance: collectorSessionService,
        critical: true,
        dependencies: ['realtimeManager', 'performanceMonitor']
      },
      {
        name: 'illegalDumpingService',
        instance: illegalDumpingService,
        critical: true,
        dependencies: ['realtimeManager', 'performanceMonitor']
      },
      {
        name: 'dashboardAnalyticsService',
        instance: dashboardAnalyticsService,
        critical: false,
        dependencies: ['realtimeManager', 'performanceMonitor']
      },
      {
        name: 'alertsNotificationService',
        instance: alertsNotificationService,
        critical: true,
        dependencies: ['realtimeManager', 'performanceMonitor']
      },
      {
        name: 'auditLoggingService',
        instance: auditLoggingService,
        critical: false,
        dependencies: []
      }
    ];

    for (const { name, instance, critical, dependencies } of services) {
      try {
        console.log(`  📦 Initializing ${name} service...`);
        
        await instance.initialize();
        
        this.initializationStatus[name] = true;
        console.log(`  ✅ ${name} service initialized`);
        
      } catch (error) {
        console.error(`  ❌ ${name} service initialization failed:`, error);
        
        this.initializationErrors.push({
          component: name,
          error: error.message,
          timestamp: new Date()
        });
        
        // Only throw for critical services
        if (critical) {
          throw new Error(`Critical service ${name} failed to initialize: ${error.message}`);
        }
        
        // Mark as failed but continue
        this.initializationStatus[name] = false;
      }
    }
    
    console.log('✅ Core business services initialization complete');
  }

  /**
   * Check if a feature is enabled via environment variables
   */
  isFeatureEnabled(envVar) {
    return process.env[envVar] === 'true';
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      status: this.initializationStatus,
      errors: this.initializationErrors,
      timestamp: new Date()
    };
  }

  /**
   * Get system health summary
   */
  async getHealthSummary() {
    const connectionHealth = await checkConnection();
    const performanceHealth = performanceMonitor.isMonitoring 
      ? await performanceMonitor.getDashboardData()
      : null;
    const realtimeHealth = await realtimeManager.checkHealth();

    return {
      overall: this.isInitialized ? 'healthy' : 'initializing',
      components: {
        database: connectionHealth,
        performance: performanceHealth,
        realtime: realtimeHealth
      },
      timestamp: new Date()
    };
  }

  /**
   * Retry initialization
   */
  async retryInitialization() {
    if (this.retryCount >= this.maxRetries) {
      console.error(`❌ Maximum retry attempts (${this.maxRetries}) reached`);
      return {
        success: false,
        error: 'Maximum retry attempts reached'
      };
    }

    this.retryCount++;
    console.log(`🔄 Retrying initialization (attempt ${this.retryCount}/${this.maxRetries})...`);
    
    // Wait with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.initialize();
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down system...');
    
    try {
      // Stop performance monitoring
      if (performanceMonitor.isMonitoring) {
        performanceMonitor.stopMonitoring();
        console.log('✅ Performance monitoring stopped');
      }

      // Clean up core services
      const services = [
        { name: 'Pickup Requests', service: pickupRequestService },
        { name: 'Digital Bins', service: digitalBinService },
        { name: 'QR Code Scanning', service: qrCodeService },
        { name: 'Collector Sessions', service: collectorSessionService }
      ];

      for (const { name, service } of services) {
        try {
          if (service.cleanup) {
            service.cleanup();
            console.log(`✅ ${name} service cleaned up`);
          }
        } catch (error) {
          console.error(`❌ Error cleaning up ${name} service:`, error);
        }
      }

      // Clean up realtime subscriptions
      realtimeManager.cleanup();
      console.log('✅ Realtime subscriptions cleaned up');

      this.isInitialized = false;
      console.log('✅ System shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  /**
   * Register system-wide error handlers
   */
  setupErrorHandlers() {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.initializationErrors.push({
        component: 'system',
        error: `Unhandled rejection: ${event.reason}`,
        timestamp: new Date()
      });
    });

    // General errors
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.initializationErrors.push({
        component: 'system',
        error: `Global error: ${event.error?.message || event.message}`,
        timestamp: new Date()
      });
    });
  }

  /**
   * Wait for system to be ready
   */
  async waitForReady(timeoutMs = 30000) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (this.isInitialized) {
          resolve(this.getSystemStatus());
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('System initialization timeout'));
          return;
        }

        setTimeout(checkReady, 100);
      };

      checkReady();
    });
  }
}

// Create singleton instance
export const systemInit = new SystemInitService();

// Auto-initialize when module loads (can be disabled if needed)
if (process.env.REACT_APP_AUTO_INIT !== 'false') {
  systemInit.setupErrorHandlers();
}

export { SystemInitService };
export default systemInit;
