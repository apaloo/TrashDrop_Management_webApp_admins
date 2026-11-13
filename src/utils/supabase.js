import { createClient } from '@supabase/supabase-js';
import logger from './logger';

// Read environment configuration
const FORCE_REAL_DATA_ONLY = process.env.REACT_APP_FORCE_LIVE_DATA === 'true';
const DISABLE_MOCK_DATA = process.env.REACT_APP_DISABLE_MOCK_DATA === 'true';
const REQUIRE_DATABASE = process.env.REACT_APP_REQUIRE_DATABASE === 'true';

// Required environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// SECURITY: Service key should NEVER be used in frontend code
// It bypasses RLS and has full database access
// Use Edge Functions or a backend API for admin operations
// const supabaseServiceKey - REMOVED FOR SECURITY

// Environment variable validation
if (REQUIRE_DATABASE) {
  // Only validate environment variables in strict database mode
  if (!supabaseUrl) {
    throw new Error('ERROR: Missing REACT_APP_SUPABASE_URL environment variable. Real data mode requires valid Supabase configuration.');
  }
  if (!supabaseAnonKey) {
    throw new Error('ERROR: Missing REACT_APP_SUPABASE_ANON_KEY environment variable. Real data mode requires valid Supabase configuration.');
  }
  
  logger.log('🔒 STRICT MODE: Real Supabase data only, no mock data fallbacks');
} else {
  logger.log(`📊 DATABASE CONFIG: Force live data: ${FORCE_REAL_DATA_ONLY}, Disable mock: ${DISABLE_MOCK_DATA}, Require DB: ${REQUIRE_DATABASE}`);
}

// Client configuration with performance optimizations
const supabaseConfig = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'trashdrop-admin-portal@1.0.0',
    },
  },
};

// Singleton pattern using global window storage to persist across hot reloads
// This prevents multiple client instances during development hot module reloading
const SUPABASE_CLIENT_KEY = '__trashdrop_supabase_client__';

// Get or create Supabase client - persists across hot reloads
const getSupabaseClient = () => {
  // Check if client already exists in global scope
  if (typeof window !== 'undefined' && window[SUPABASE_CLIENT_KEY]) {
    logger.log('♻️ Reusing existing Supabase main client from global cache');
    return window[SUPABASE_CLIENT_KEY];
  }
  
  // Create new client
  logger.log('🔧 Creating Supabase main client singleton...');
  const client = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);
  
  // Store in global scope to persist across hot reloads
  if (typeof window !== 'undefined') {
    window[SUPABASE_CLIENT_KEY] = client;
  }
  
  logger.log('✅ Supabase main client initialized and cached globally');
  return client;
};

// Export singleton instances
// Call getters once - they handle window caching internally
export const supabase = getSupabaseClient();

// Connection health check - configurable error handling based on environment
export const checkConnection = async () => {
  try {
    // Check connection with a query to a core table
    const { data, error } = await supabase.from('batches').select('count').limit(1);
    
    // Any error means the connection failed or table doesn't exist
    if (error) {
      console.error('❌ Supabase connection check failed:', error);
      
      // Only throw if we require database
      if (REQUIRE_DATABASE) {
        throw new Error(`Database connection failed: ${error.message}`);
      } else {
        logger.warn('Database connection issues detected - will use mock data fallbacks');
        return { connected: false, error };
      }
    }
    
    logger.log('✅ Supabase connection verified successfully');
    return { connected: true, error: null };
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    
    // Only throw if we require database
    if (REQUIRE_DATABASE) {
      throw new Error(`Database connection failed: ${error.message}`);
    } else {
      logger.warn('Database connection issues detected - will use mock data fallbacks');
      return { connected: false, error };
    }
  }
};

// Database validation on module import with graceful fallback.
// Signed-in users only: anonymous visitors (public pages) must not probe internal tables.
const validateInitialConnection = () => {
if (!REQUIRE_DATABASE) {
  // In non-strict mode, just log the connection attempt but don't fail
  checkConnection()
    .then(result => {
      if (result.connected) {
        logger.log('✅ Initial database connection validated');
      } else {
        logger.warn('⚠️ Database connection issues - will use mock data fallbacks');
      }
    })
    .catch(error => logger.warn('⚠️ Database connection issues - will use mock data fallbacks:', error));
} else {
  // In strict mode, log validation results but still allow errors to propagate
  checkConnection()
    .then(() => logger.log('✅ Initial database connection validated'))
    .catch(error => console.error('❌ Initial database validation failed:', error));
}
};
supabase.auth.getSession()
  .then(({ data }) => { if (data?.session) validateInitialConnection(); })
  .catch(() => {});

export default supabase;
