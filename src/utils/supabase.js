import { createClient } from '@supabase/supabase-js';

// Read environment configuration
const FORCE_REAL_DATA_ONLY = process.env.REACT_APP_FORCE_LIVE_DATA === 'true';
const DISABLE_MOCK_DATA = process.env.REACT_APP_DISABLE_MOCK_DATA === 'true';
const REQUIRE_DATABASE = process.env.REACT_APP_REQUIRE_DATABASE === 'true';

// Required environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

// Environment variable validation
if (REQUIRE_DATABASE) {
  // Only validate environment variables in strict database mode
  if (!supabaseUrl) {
    throw new Error('ERROR: Missing REACT_APP_SUPABASE_URL environment variable. Real data mode requires valid Supabase configuration.');
  }
  if (!supabaseAnonKey) {
    throw new Error('ERROR: Missing REACT_APP_SUPABASE_ANON_KEY environment variable. Real data mode requires valid Supabase configuration.');
  }
  
  console.log('🔒 STRICT MODE: Real Supabase data only, no mock data fallbacks');
} else {
  console.log(`📊 DATABASE CONFIG: Force live data: ${FORCE_REAL_DATA_ONLY}, Disable mock: ${DISABLE_MOCK_DATA}, Require DB: ${REQUIRE_DATABASE}`);
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

// Singleton pattern to avoid multiple client instances
let supabaseInstance = null;
let supabaseAdminInstance = null;

// Initialize main Supabase client once
if (!supabaseInstance) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);
  console.log('✅ Supabase client initialized (singleton)');
}

// Initialize admin client once (if service key available)
if (!supabaseAdminInstance && supabaseServiceKey) {
  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });
  console.log('✅ Supabase admin client initialized (singleton)');
}

// Export singleton instances
export const supabase = supabaseInstance;
export const supabaseAdmin = supabaseAdminInstance;

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
        console.warn('Database connection issues detected - will use mock data fallbacks');
        return { connected: false, error };
      }
    }
    
    console.log('✅ Supabase connection verified successfully');
    return { connected: true, error: null };
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    
    // Only throw if we require database
    if (REQUIRE_DATABASE) {
      throw new Error(`Database connection failed: ${error.message}`);
    } else {
      console.warn('Database connection issues detected - will use mock data fallbacks');
      return { connected: false, error };
    }
  }
};

// Strict error handler - no silent failures or fallbacks
export const handleDatabaseError = (error, operation = 'database operation') => {
  console.error(`❌ ERROR during ${operation}:`, error);
  
  // Map common Supabase errors to user-friendly messages
  const errorMap = {
    '23505': 'This record already exists. Please check for duplicates.',
    '23503': 'This record is referenced by other data and cannot be deleted.',
    '23502': 'Required field is missing.',
    'PGRST301': 'Insufficient permissions to perform this operation.',
    'PGRST204': 'Table or record not found. Required database table is missing.',
    'PGRST116': 'No data found matching your criteria.',
    '42P01': 'Required database table does not exist.',
    '42703': 'Required database column does not exist.',
    '42883': 'Required database function does not exist.',
  };
  
  const userMessage = errorMap[error.code] || error.message || 'An unexpected database error occurred';
  
  // In strict mode, we throw all database errors to prevent silent failures
  const enhancedError = new Error(userMessage);
  enhancedError.code = error.code;
  enhancedError.details = error.details;
  enhancedError.hint = error.hint;
  enhancedError.originalError = error;
  
  // Throw error to prevent continuing with invalid/missing data
  throw enhancedError;
};

// Performance monitoring wrapper
export const withPerformanceMonitoring = (fn, operationName) => {
  return async (...args) => {
    const startTime = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      if (duration > 5000) { // Log slow queries (> 5 seconds)
        console.warn(`Slow database operation detected: ${operationName} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Database operation failed: ${operationName} (${duration}ms)`, error);
      throw handleDatabaseError(error, operationName);
    }
  };
};

// Additional exports for real data mode
export const STRICT_MODE_ENABLED = FORCE_REAL_DATA_ONLY;

// Database validation on module import with graceful fallback
if (!REQUIRE_DATABASE) {
  // In non-strict mode, just log the connection attempt but don't fail
  checkConnection()
    .then(result => {
      if (result.connected) {
        console.log('✅ Initial database connection validated');
      } else {
        console.warn('⚠️ Database connection issues - will use mock data fallbacks');
      }
    })
    .catch(error => console.warn('⚠️ Database connection issues - will use mock data fallbacks:', error));
} else {
  // In strict mode, log validation results but still allow errors to propagate
  checkConnection()
    .then(() => console.log('✅ Initial database connection validated'))
    .catch(error => console.error('❌ Initial database validation failed:', error));
}

export default supabase;
