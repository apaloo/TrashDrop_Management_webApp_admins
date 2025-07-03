/**
 * Application Configuration
 * Central configuration file for TrashDrop Management WebApp Admin Portal
 */

// Import environment-specific configurations
import { getEnvConfig } from './envConfig';

// Import constants
import { APP_CONSTANTS } from './constants';

// Get environment-specific configuration
const envConfig = getEnvConfig();

/**
 * Main application configuration
 */
const appConfig = {
  // Application metadata
  app: {
    name: 'TrashDrop Management WebApp Admin Portal',
    version: '1.0.0',
    domain: envConfig.APP_DOMAIN || 'trashdrop.com',
    baseUrl: envConfig.BASE_URL || 'https://admin.trashdrop.com',
    supportEmail: envConfig.SUPPORT_EMAIL || 'support@trashdrop.com',
    adminEmail: envConfig.ADMIN_EMAIL || 'admin@trashdrop.com',
  },

  // API configuration
  api: {
    baseUrl: envConfig.API_BASE_URL,
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
  },

  // Auth configuration
  auth: {
    useDevAuth: envConfig.USE_DEV_AUTH === 'true',
    devUser: {
      email: envConfig.DEV_USER_EMAIL || 'admin@trashdrop.com',
      name: 'Admin User',
      role: 'admin',
    },
  },

  // External services
  services: {
    maps: {
      defaultCenter: [37.7749, -122.4194], // San Francisco
      defaultZoom: 13,
      tileProviders: {
        openStreetMap: {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
        satellite: {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
        },
      },
      markers: {
        collector: {
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        },
        dumpingReport: {
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        },
      },
    },
    avatar: {
      apiUrl: 'https://ui-avatars.com/api/',
      fallbackUrl: 'https://via.placeholder.com/40',
      randomUserUrl: 'https://randomuser.me/api/portraits/',
    },
    qrCode: {
      apiUrl: 'https://api.qrserver.com/v1/create-qr-code/',
      size: '200x200',
    },
  },

  // Database query settings
  database: {
    queryLimits: {
      logs: 200,
      collectors: 100,
      illegalDumping: 100,
      bagBatches: 50,
      alerts: 50,
    },
  },

  // Feature flags
  features: {
    enableLiveMap: envConfig.ENABLE_LIVE_MAP === 'true',
    enableRealTimeAlerts: envConfig.ENABLE_REALTIME_ALERTS === 'true',
    enableBatchOperations: envConfig.ENABLE_BATCH_OPERATIONS === 'true',
  },
};

export default appConfig;
