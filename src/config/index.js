/**
 * Configuration Module Index
 * Exports all configuration-related modules for easier imports
 */

import appConfig from './appConfig';
import { getEnvConfig, validateEnvConfig } from './envConfig';
import APP_CONSTANTS from './constants';

// Initialize by validating environment variables when importing config
try {
  validateEnvConfig();
} catch (error) {
  // Only throw in production, in development show a warning
  if (process.env.NODE_ENV === 'production') {
    throw error;
  } else {
    console.warn('Environment validation warning:', error.message);
  }
}

export { appConfig, APP_CONSTANTS, getEnvConfig, validateEnvConfig };
export default appConfig;
