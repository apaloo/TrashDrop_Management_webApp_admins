/**
 * Environment-specific Configuration
 * Loads and validates environment variables for the TrashDrop Management WebApp Admin Portal
 */

/**
 * Gets environment-specific configuration from process.env
 * @returns {Object} Environment configuration object
 */
export const getEnvConfig = () => {
  return {
    // Core application settings
    NODE_ENV: process.env.NODE_ENV || 'development',
    APP_DOMAIN: process.env.REACT_APP_DOMAIN,
    BASE_URL: process.env.REACT_APP_BASE_URL,
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
    
    // Supabase configuration
    SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.REACT_APP_SUPABASE_ANON_KEY,
    
    // Authentication settings
    USE_DEV_AUTH: process.env.REACT_APP_USE_DEV_AUTH,
    DEV_USER_EMAIL: process.env.REACT_APP_DEV_USER_EMAIL,
    ADMIN_EMAIL: process.env.REACT_APP_ADMIN_EMAIL,
    SUPPORT_EMAIL: process.env.REACT_APP_SUPPORT_EMAIL,
    
    // Feature flags
    ENABLE_LIVE_MAP: process.env.REACT_APP_ENABLE_LIVE_MAP,
    ENABLE_REALTIME_ALERTS: process.env.REACT_APP_ENABLE_REALTIME_ALERTS,
    ENABLE_BATCH_OPERATIONS: process.env.REACT_APP_ENABLE_BATCH_OPERATIONS,
  };
};

/**
 * Validates required environment variables
 * @throws {Error} If required variables are missing
 */
export const validateEnvConfig = () => {
  const requiredVars = [
    'REACT_APP_SUPABASE_URL',
    'REACT_APP_SUPABASE_ANON_KEY'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      'Please check your .env file or environment configuration.'
    );
  }
};

const envConfig = { getEnvConfig, validateEnvConfig };

export default envConfig;
