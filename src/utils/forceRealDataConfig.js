/**
 * Force Real Data Configuration
 * 
 * This module enforces the application to only use real data from Supabase
 * and completely disables all mock data fallbacks. The application will fail to start
 * if any required database tables or RPC functions are missing.
 * 
 * STRICT MODE: No fallbacks, no mock data, explicit errors only.
 */

import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';

// Configuration constants - Read from environment variables
export const FORCE_REAL_DATA_ONLY = process.env.REACT_APP_FORCE_LIVE_DATA === 'true';
export const DISABLE_MOCK_DATA = process.env.REACT_APP_DISABLE_MOCK_DATA === 'true';
export const REQUIRE_DATABASE = process.env.REACT_APP_REQUIRE_DATABASE === 'true';

// Required database tables that must exist for the application to function
export const REQUIRED_TABLES = [
  'batches',
  'bags',
  'scans',
  'collectors',
  'pickup_requests',
  'service_areas',
  'illegal_dumping_mobile'
];

// Required RPC functions that must exist
export const REQUIRED_FUNCTIONS = [
  'fetch_dashboard_stats',
  'fetch_illegal_dumping_reports',
  'update_illegal_dumping_status',
  'assign_cleanup_team'
];

/**
 * Initialize real data only mode
 * This function must be called at application startup
 * @returns {Promise<boolean>} - True if initialization successful, throws error otherwise
 */
export async function initializeRealDataOnly() {
  // Only enforce strict mode if environment variables are set accordingly
  const isStrictMode = FORCE_REAL_DATA_ONLY && DISABLE_MOCK_DATA && REQUIRE_DATABASE;
  
  if (isStrictMode) {
    console.log('🔒 STRICT MODE: Enforcing real Supabase data only, no mock data fallbacks');
    
    // Completely disable all mock data options
    safeDatabaseService.mockDataMode = false;
    safeDatabaseService.preferRealData = true;
    safeDatabaseService.forceRealDataOnly = true;
    safeDatabaseService.enableMockFallback = false;
  } else {
    console.log('🔧 DEVELOPMENT MODE: Using environment configuration for data sources');
    
    // Use environment variable configuration
    safeDatabaseService.mockDataMode = !DISABLE_MOCK_DATA;
    safeDatabaseService.preferRealData = FORCE_REAL_DATA_ONLY;
    safeDatabaseService.forceRealDataOnly = REQUIRE_DATABASE;
    safeDatabaseService.enableMockFallback = !DISABLE_MOCK_DATA;
  }
  
  // Only override safeQuery method if in strict mode
  if (REQUIRE_DATABASE) {
    const originalSafeQuery = safeDatabaseService.safeQuery;
    safeDatabaseService.safeQuery = async function(options) {
      // Handle case where options might be a string (tableName passed directly)
      if (typeof options === 'string') {
        options = { tableName: options };
      }
      
      const { tableName, queryFn, mockDataFn, isRpc = false } = options;
      
      // Explicitly disable all mock data options in strict mode
      if (typeof options === 'object' && options !== null) {
        options.enableMock = false;
        options.useMockFallback = false;
        options.forceRealData = true;
      }
    
    try {
      // Check if table exists
      const tableExists = isRpc 
        ? await this.checkFunctionExists(tableName)
        : await this.checkTableExists(tableName);
        
      if (!tableExists) {
        const errorMsg = `CRITICAL ERROR: Required ${isRpc ? 'function' : 'table'} '${tableName}' not found in Supabase database.`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Call the original function with mock disabled
      const result = await originalSafeQuery.call(this, options);
      
      // Additional validation to ensure we didn't silently fall back to mock data
      if (result && result._isMockData) {
        throw new Error(`MOCK DATA DETECTED: ${tableName} is returning mock data despite strict mode. This is not allowed.`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ DATABASE ERROR in ${tableName}:`, error);
      // Always throw errors to prevent any fallbacks
      throw error;
    }
    };
  }
  
  // Same for safeRPC - only override if in strict mode
  if (REQUIRE_DATABASE) {
    const originalSafeRPC = safeDatabaseService.safeRPC;
    safeDatabaseService.safeRPC = async function(options) {
      const { functionName, params = {}, mockDataFn } = options;
      
      // Force disable mock data in strict mode
      options.enableMock = false;
      options.useMockFallback = false;
      options.forceRealData = true;
    
    try {
      // Check if function exists
      const functionExists = await this.checkFunctionExists(functionName);
      
      if (!functionExists) {
        const errorMsg = `CRITICAL ERROR: Required function '${functionName}' not found in Supabase database.`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Call the original function with mock disabled
      const result = await originalSafeRPC.call(this, options);
      
      // Additional validation to ensure we didn't silently fall back to mock data
      if (result && result._isMockData) {
        throw new Error(`MOCK DATA DETECTED: ${functionName} is returning mock data despite strict mode. This is not allowed.`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ DATABASE ERROR in RPC function ${functionName}:`, error);
      // Always throw errors to prevent any fallbacks
      throw error;
    }
    };
  }
  
  try {
    // First verify database connection if required
    if (REQUIRE_DATABASE) {
      await verifyDatabaseConnection();
      
      // Then verify required schema elements exist
      await verifyRequiredSchema();
    } else {
      // In development mode, just log database status without enforcing
      try {
        await verifyDatabaseConnection();
        console.log('✅ Database connection available - using real data where possible');
      } catch (error) {
        console.warn('⚠️ Database connection unavailable - using mock data fallbacks');
      }
      
      try {
        await verifyRequiredSchema(true); // true = report only mode, don't throw errors
      } catch (error) {
        // Just log the schema issues without failing
        console.warn('⚠️ Some database schema elements are missing - using mock data fallbacks');
      }
    }
    
    return true;
  } catch (error) {
    if (REQUIRE_DATABASE) {
      console.error('❌ INITIALIZATION FAILED:', error.message);
      throw error; // Re-throw to prevent app startup only in strict mode
    } else {
      console.warn('⚠️ Using mock data fallbacks due to:', error.message);
      return false; // Allow startup with warnings in development mode
    }
  }
}

/**
 * Verify that we have a valid database connection
 * @returns {Promise<boolean>} - True if connection successful, throws error otherwise
 */
async function verifyDatabaseConnection() {
  try {
    console.log('🔄 Verifying Supabase database connection...');
    
    // Simple query to verify connection
    const { data, error } = await supabase.from('batches').select('count').limit(1);
    
    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        throw new Error(`Database table 'batches' not found. Required database table is missing.`);
      } else {
        throw new Error(`Database connection failed: ${error.message}`);
      }
    }
    
    console.log('✅ Supabase database connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ DATABASE CONNECTION ERROR:', error.message);
    throw error;
  }
}

/**
 * Verify all required database tables and functions exist
 * @param {boolean} reportOnly - If true, will only report missing elements without throwing errors
 * @returns {Promise<boolean>} - True if all required elements exist, throws error otherwise
 */
async function verifyRequiredSchema(reportOnly = false) {
  console.log('🔄 Verifying required database schema elements...');
  
  const missingTables = [];
  const missingFunctions = [];
  
  // Check all required tables
  for (const tableName of REQUIRED_TABLES) {
    const exists = await safeDatabaseService.checkTableExists(tableName);
    if (!exists) {
      missingTables.push(tableName);
    }
  }
  
  // Check all required functions
  for (const functionName of REQUIRED_FUNCTIONS) {
    const exists = await safeDatabaseService.checkFunctionExists(functionName);
    if (!exists) {
      missingFunctions.push(functionName);
    }
  }
  
  // Report results
  const tablesFound = REQUIRED_TABLES.length - missingTables.length;
  const functionsFound = REQUIRED_FUNCTIONS.length - missingFunctions.length;
  
  console.log(`📊 Database schema validation: ${tablesFound}/${REQUIRED_TABLES.length} tables found, ` + 
              `${functionsFound}/${REQUIRED_FUNCTIONS.length} functions found`);
  
  // In strict mode (or report only mode), handle missing elements
  if (missingTables.length > 0 || missingFunctions.length > 0) {
    let errorMessage = 'Database schema validation has issues. ';
    
    if (missingTables.length > 0) {
      errorMessage += `Missing tables: ${missingTables.join(', ')}. `;
    }
    
    if (missingFunctions.length > 0) {
      errorMessage += `Missing functions: ${missingFunctions.join(', ')}. `;
    }
    
    // Only treat as critical error in strict mode
    if (REQUIRE_DATABASE && !reportOnly) {
      errorMessage = 'CRITICAL: ' + errorMessage;
      errorMessage += ' The application cannot start without all required database elements.';
      console.error('❌', errorMessage);
      throw new Error(errorMessage);
    } else {
      console.warn('⚠️', errorMessage, 'Using mock data fallbacks where needed.');
    }
  }
  
  console.log('✅ All required database schema elements verified successfully');
  return true;
}

export default {
  initializeRealDataOnly,
  verifyDatabaseConnection,
  verifyRequiredSchema,
  FORCE_REAL_DATA_ONLY,
  DISABLE_MOCK_DATA,
  REQUIRE_DATABASE,
  REQUIRED_TABLES,
  REQUIRED_FUNCTIONS
};
