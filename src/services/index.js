/**
 * Services Index - Central export for all services
 * Provides easy access to all TrashDrop Management System services
 */

// Core Infrastructure Services
export { default as realtimeManager } from './realtimeManager';
export { default as performanceMonitor } from './performanceMonitor';
export { default as systemInit } from './systemInit';

// Business Logic Services
export { default as pickupRequestService } from './pickupRequestService';
export { default as digitalBinService } from './digitalBinService';
export { default as qrCodeService } from './qrCodeService';
export { default as collectorSessionService } from './collectorSessionService';

// Phase 3 Services
export { default as illegalDumpingService } from './illegalDumpingService';
export { default as dashboardAnalyticsService } from './dashboardAnalyticsService';
export { default as alertsNotificationService } from './alertsNotificationService';
export { default as auditLoggingService } from './auditLoggingService';

// Service Status Helper
export const getServicesHealthStatus = async () => {
  const services = {
    system: systemInit.getSystemStatus(),
    realtime: await realtimeManager.checkHealth(),
    performance: performanceMonitor.getDashboardData(),
    pickupRequests: pickupRequestService.getHealthStatus(),
    digitalBins: digitalBinService.getHealthStatus(),
    qrCodeScanning: qrCodeService.getHealthStatus(),
    collectorSessions: collectorSessionService.getHealthStatus()
  };

  const overall = Object.values(services).every(service => 
    service.isInitialized !== false && service.connected !== false
  );

  return {
    overall: overall ? 'healthy' : 'degraded',
    services,
    timestamp: new Date()
  };
};

// Service initialization helper
export const initializeAllServices = async () => {
  console.log('🚀 Starting TrashDrop Management System...');
  
  try {
    const result = await systemInit.initialize();
    
    if (result.success) {
      console.log('✅ All services initialized successfully');
      
      // Optional: Start periodic health checks
      if (process.env.REACT_APP_ENABLE_HEALTH_CHECKS === 'true') {
        startHealthChecks();
      }
    } else {
      console.error('❌ Some services failed to initialize:', result.errors);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Critical failure during service initialization:', error);
    throw error;
  }
};

// Periodic health check system
let healthCheckInterval = null;

export const startHealthChecks = (intervalMs = 60000) => { // Default 1 minute
  if (healthCheckInterval) {
    console.warn('Health checks already running');
    return;
  }

  console.log('🏥 Starting periodic health checks...');
  
  healthCheckInterval = setInterval(async () => {
    try {
      const health = await getServicesHealthStatus();
      
      if (health.overall !== 'healthy') {
        console.warn('⚠️ System health degraded:', {
          status: health.overall,
          issues: Object.entries(health.services)
            .filter(([name, service]) => 
              service.isInitialized === false || service.connected === false
            )
            .map(([name]) => name)
        });
      }
    } catch (error) {
      console.error('Error during health check:', error);
    }
  }, intervalMs);
};

export const stopHealthChecks = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('🏥 Health checks stopped');
  }
};

// Graceful system shutdown
export const shutdownAllServices = async () => {
  console.log('🛑 Shutting down TrashDrop Management System...');
  
  try {
    // Stop health checks
    stopHealthChecks();
    
    // Shutdown system
    await systemInit.shutdown();
    
    console.log('✅ System shutdown complete');
  } catch (error) {
    console.error('❌ Error during system shutdown:', error);
  }
};

// Development helpers
export const devTools = process.env.NODE_ENV === 'development' ? {
  // Expose services for debugging in development
  services: {
    systemInit,
    realtimeManager,
    performanceMonitor,
    pickupRequestService,
    digitalBinService,
    qrCodeService,
    collectorSessionService
  },
  
  // Quick health check
  health: getServicesHealthStatus,
  
  // Force reinitialize
  reinitialize: async () => {
    await shutdownAllServices();
    return await initializeAllServices();
  },
  
  // Get performance metrics
  getMetrics: () => performanceMonitor.exportMetrics(),
  
  // Clear all caches
  clearCaches: () => {
    digitalBinService.cache?.clear();
    console.log('🧹 All service caches cleared');
  }
} : {};

// Make dev tools available globally in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  window.trashDropDevTools = devTools;
  console.log('🛠️ TrashDrop dev tools available at window.trashDropDevTools');
}

export default {
  realtimeManager,
  performanceMonitor,
  systemInit,
  pickupRequestService,
  digitalBinService,
  qrCodeService,
  collectorSessionService,
  
  // Utilities
  getServicesHealthStatus,
  initializeAllServices,
  shutdownAllServices,
  startHealthChecks,
  stopHealthChecks,
  
  // Dev tools (only in development)
  ...(process.env.NODE_ENV === 'development' ? { devTools } : {})
};
