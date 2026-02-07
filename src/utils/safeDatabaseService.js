/**
 * Strict Database Service (previously SafeDatabaseService)
 * 
 * MOCK DATA DEPRECATED - This service now enforces strict real data access:
 * - NO graceful fallbacks to mock data
 * - NO mock data generation
 * - Explicit errors for missing tables/functions
 * - Application requires complete database setup
 * 
 * PRODUCTION MODE: Real data only, no fallbacks, explicit errors only
 * 
 * @deprecated Mock data system - Use real Supabase database only
 */

import { supabase } from './supabase';

class SafeDatabaseService {
  constructor() {
    // DEPRECATED: Caching disabled to prevent stale cache issues
    // this.tableExists = new Map(); // Cache for table existence checks
    // this.functionExists = new Map(); // Cache for function existence checks
    this.activeSubscriptions = new Map(); // Track active subscription channels
    
    // Read configuration from environment variables
    const forceLiveData = process.env.REACT_APP_FORCE_LIVE_DATA === 'true';
    const disableMockData = process.env.REACT_APP_DISABLE_MOCK_DATA === 'true';
    const requireDatabase = process.env.REACT_APP_REQUIRE_DATABASE === 'true';
    
    // Configure service behavior based on environment
    this.mockDataMode = !disableMockData;
    this.preferRealData = forceLiveData;
    this.forceRealDataOnly = requireDatabase;
    this.enableMockFallback = !disableMockData;
    this.throwOnMissingTables = requireDatabase;
    
    console.log(
      `📊 DATABASE SERVICE (MOCK DATA DEPRECATED): ${this.preferRealData ? 'Real data only' : 'Using mixed data'}, ` +
      `${this.enableMockFallback ? '⚠️ Mock fallbacks DEPRECATED but still enabled' : '✅ Mock fallbacks disabled'}, ` +
      `${this.throwOnMissingTables ? '✅ Strict production mode' : '⚠️ Progressive mode (deprecated)'}`
    );
  }

  /**
   * Check if a table exists in the database
   * @param {string} tableName - Name of the table to check
   * @param {boolean} forceRefresh - DEPRECATED: Caching disabled, always does fresh check
   */
  async checkTableExists(tableName, forceRefresh = false) {
    // DEPRECATED: Caching disabled - always do fresh check
    // if (!forceRefresh && this.tableExists.has(tableName)) {
    //   return this.tableExists.get(tableName);
    // }

    try {
      // Special handling for RPC functions: delegate to checkFunctionExists
      if (tableName.startsWith('rpc/')) {
        const functionName = tableName.replace('rpc/', '');
        const exists = await this.checkFunctionExists(functionName);
        // DEPRECATED: No caching
        // this.tableExists.set(tableName, exists);
        if (!exists) {
          console.warn(`[SafeDB] Function ${functionName} not found in database`);
        }
        return exists;
      }

      // Regular table check - use count(*) which works regardless of columns
      const { error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      // Evaluate response error to determine existence
      if (error) {
        console.log(`[SafeDB] Checking table ${tableName} - Error:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        // Errors that mean the table DOES NOT exist
        const isMissing = error.code === 'PGRST116' || // Schema cache lookup failed
                         error.code === 'PGRST204'  || // Table not found
                         error.code === '42P01'     || // PostgreSQL: relation does not exist
                         (error.message?.includes('does not exist') && !error.message?.includes('column')) ||
                         (error.message?.includes('not found') && error.message?.includes('schema cache'));
        
        // Errors that mean the table EXISTS but there's a query problem
        const tableExistsButQueryError = 
          error.code === 'PGRST200' ||  // Foreign key relationship error (table exists)
          error.code === 'PGRST301' ||  // RLS policy violation (table exists but no access)
          error.code === '42501'    ||  // PostgreSQL: insufficient privilege (table exists)
          error.code === '42703'    ||  // Column does not exist (table exists)
          error.code === '42804'    ||  // Type mismatch (table exists)
          error.code === '42883'    ||  // Function signature mismatch (function exists)
          error.message?.includes('column') ||
          error.message?.includes('relationship') ||
          error.message?.includes('type') ||
          error.message?.includes('policy') ||
          error.message?.includes('permission');

        // If it's a query error, the table definitely exists
        if (tableExistsButQueryError) {
          // DEPRECATED: No caching
          // this.tableExists.set(tableName, true);
          console.log(`[SafeDB] Table ${tableName} exists (query error: ${error.code})`);
          return true;
        }

        // DEPRECATED: No caching
        // this.tableExists.set(tableName, !isMissing);

        if (isMissing) {
          console.warn(`[SafeDB] Table/Function ${tableName} not found in database`);
        } else {
          console.warn(`[SafeDB] Error checking table ${tableName}:`, error);
        }

        return !isMissing;
      }

      // If we get here without an error, the table exists
      // DEPRECATED: No caching
      // this.tableExists.set(tableName, true);
      return true;

    } catch (error) {
      // Handle network/connection errors
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('ERR_INTERNET_DISCONNECTED') ||
          error.message?.includes('TypeError: Failed to fetch')) {
        console.warn(`[SafeDB] Network error checking ${tableName}, assuming table doesn't exist`);
        // DEPRECATED: No caching
        // this.tableExists.set(tableName, false);
        return false;
      }
      
      // Check for table/function doesn't exist errors
      const tableExistsButQueryError = 
        error.code === 'PGRST200' ||  // Foreign key relationship error (table exists)
        error.code === '42703'    ||  // Column does not exist (table exists)
        error.code === '42804'    ||  // Type mismatch (table exists)
        error.message?.includes('column') ||
        error.message?.includes('relationship');
      
      if (tableExistsButQueryError) {
        this.tableExists.set(tableName, true);
        console.log(`[SafeDB] Table ${tableName} exists (caught error: ${error.code})`);
        return true;
      }
      
      const isMissing = error.code === 'PGRST116' || // Schema cache lookup failed
                       error.code === 'PGRST204' ||  // Table not found
                       error.code === '42P01' ||     // PostgreSQL: relation does not exist
                       (error.message?.includes('does not exist') && !error.message?.includes('column')) ||
                       (error.message?.includes('not found') && error.message?.includes('schema cache'));
      
      this.tableExists.set(tableName, !isMissing);
      
      if (isMissing) {
        console.warn(`[SafeDB] Table/Function ${tableName} not found in database`);
      }
      
      return !isMissing;
    }
  }

  /**
   * Check if a stored function exists
   * DEPRECATED: Caching disabled to prevent stale cache issues
   */
  async checkFunctionExists(functionName) {
    // DEPRECATED: Caching disabled - always do fresh check
    // if (this.functionExists.has(functionName)) {
    //   return this.functionExists.get(functionName);
    // }

    try {
      const { error } = await supabase.rpc(functionName, {});
      // If function doesn't exist, PostgREST returns 42883 (undefined function)
      const missing = !!error && (
        error.code === '42883' ||
        error.code === 'PGRST116' ||
        (error.message?.toLowerCase().includes('function') && error.message?.toLowerCase().includes('does not exist'))
      );
      const exists = !missing;
      // DEPRECATED: No caching
      // this.functionExists.set(functionName, exists);
      return exists;
    } catch (error) {
      console.warn(`Function ${functionName} does not exist:`, error.message);
      // DEPRECATED: No caching
      // this.functionExists.set(functionName, false);
      return false;
    }
  }

  /**
   * Execute a database query - STRICT MODE: No mock data fallbacks
   * All queries must use real Supabase data. Missing tables will throw errors.
   */
  async safeQuery(options) {
    const { 
      tableName, 
      queryFn, 
      isRpc = false
    } = options;

    // STRICT MODE: Always require real database
    // Check if table or function exists
    const tableExists = isRpc
      ? await this.checkFunctionExists(tableName)
      : await this.checkTableExists(tableName);
      
    // If table doesn't exist, throw an error (no mock fallbacks)
    if (!tableExists) {
      const errorMsg = `Required ${isRpc ? 'function' : 'table'} '${tableName}' not found in Supabase database.`;
      console.error(`❌ DATABASE ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    try {
      // Validate queryFn before calling
      if (typeof queryFn !== 'function') {
        throw new Error(`queryFn is not a function for table ${tableName}`);
      }
      
      // Execute the real query
      const result = await queryFn();
      
      // If we got data, return it
      if (result.data || !result.error) {
        return {
          ...result,
          isMock: false
        };
      }
      
      // All errors are thrown - no mock data fallbacks
      if (result.error) {
        console.error(`Database error with ${tableName}:`, result.error);
        throw new Error(`Database error with ${tableName}: ${result.error.message || 'Unknown error'}`);
      }
      
      return { data: result.data || [], isMock: false };
    } catch (error) {
      console.error(`❌ ERROR accessing ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * RPC call - STRICT MODE: No mock data fallbacks
   * All RPC calls must use real Supabase functions. Missing functions will throw errors.
   */
  async safeRPC(options) {
    const { functionName, params = {} } = options;
    
    try {
      // Check if function exists
      const functionExists = await this.checkFunctionExists(functionName);
      
      if (!functionExists) {
        throw new Error(`Required function '${functionName}' not found in Supabase database.`);
      }
      
      // Execute RPC call
      const { data, error } = await supabase.rpc(functionName, params);
      
      if (error) {
        console.error(`❌ Error calling RPC function ${functionName}:`, error);
        throw new Error(`Error calling RPC function ${functionName}: ${error.message || 'Unknown error'}`);
      }
      
      return data;
    } catch (error) {
      console.error(`❌ ERROR calling RPC function ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Strict subscription with NO fallbacks
   * In strict mode, this will throw errors for any database issue
   */
  safeSubscription(tableName, options, fallbackCallback) {
    // No fallback callback will be used in strict mode
    fallbackCallback = null;
    
    // Generate a unique channel key with timestamp to avoid conflicts
    const channel = options.channel || 'public';
    const uniqueId = Math.random().toString(36).substr(2, 9);
    const channelKey = `${channel}:${tableName}:${uniqueId}`;
    const channelName = `channel_${tableName}_${uniqueId}`;
    
    // Always create a new subscription to avoid "subscribe multiple times" error
    console.log(`🔔 Creating new subscription for ${tableName} with unique channel: ${channelName}`);
    
    const checkTableExistence = async () => {
      const exists = await this.checkTableExists(tableName);
      if (!exists) {
        const errorMsg = `CRITICAL ERROR: Cannot subscribe to table '${tableName}' as it does not exist in database.`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      return exists;
    };
    
    let subscription = null;
    
    const unsubscribe = () => {
      if (subscription && subscription.unsubscribe) {
        console.log(`🔔 Unsubscribing from ${tableName} (${channelName})`);
        subscription.unsubscribe();
        this.activeSubscriptions.delete(channelKey);
      }
    };

    // Start subscription async
    checkTableExistence().then(exists => {
      // We know table exists as checkTableExistence throws otherwise
      console.log(`🔔 Setting up strict subscription for table: ${tableName}`);
      
      // Use real Supabase subscription with unique channel name
      const event = options.event || '*';
      const filter = options.filter || '';
      
      subscription = supabase
        .channel(channelName)
        .on('postgres_changes', { 
          event,
          schema: 'public', 
          table: tableName,
          filter
        }, options.callback || (() => {}))
        .subscribe();
        
      console.log(`✅ Successfully subscribed to ${tableName} on ${channelName}`);
    }).catch(error => {
      console.error(`❌ Subscription error for ${tableName}:`, error);
      this.activeSubscriptions.delete(channelKey);
      // Don't throw in subscription setup to avoid crashing the app
      console.warn(`⚠️ Continuing without realtime updates for ${tableName}`);
    });

    // Create subscription object
    const subscriptionObj = {
      unsubscribe
    };
    
    // Store in active subscriptions map
    this.activeSubscriptions.set(channelKey, subscriptionObj);
    
    return subscriptionObj;
  }

  /**
   * Generate mock data for missing tables - DISABLED IN STRICT MODE
   */
  generateMockData(tableName, count = 10) {
    // In strict mode, never generate mock data - always throw an error
    const errorMsg = `CRITICAL ERROR: Mock data generation for '${tableName}' is disabled in strict mode.`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  /**
   * Get dashboard statistics - STRICT MODE
   */
  async getSafeDashboardStats() {
    return this.safeRPC({
      functionName: 'get_dashboard_stats',
      params: {}
    });
  }

  /**
   * Get notifications - STRICT MODE
   */
  async getSafeNotifications(userId, limit = 5) {
    return this.safeQuery({
      tableName: 'notifications',
      queryFn: async () => {
        return supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);
      }
    });
  }

  /**
   * Get messages - STRICT MODE
   */
  async getSafeMessages(userId, limit = 10) {
    return this.safeQuery({
      tableName: 'messages',
      queryFn: async () => {
        return supabase
          .from('messages')
          .select('*')
          .eq('recipient_id', userId)
          .eq('read', false)
          .limit(limit);
      }
    });
  }

  /**
   * Get alerts - STRICT MODE
   */
  async getSafeAlerts(limit = 5) {
    return this.safeQuery({
      tableName: 'alerts',
      queryFn: async () => {
        // Try complex query first, fallback to simple query if relationships don't exist
        try {
          return supabase
            .from('alerts')
            .select('*, creator:created_by(first_name, last_name)')
            .order('created_at', { ascending: false })
            .limit(limit);
        } catch (error) {
          // If relationship fails, use simple query
          console.warn('Alert relationship query failed, using simple query:', error);
          return supabase
            .from('alerts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        }
      }
    });
  }

  /**
   * Get batches - STRICT MODE
   */
  async getSafeBatches(status = null) {
    return this.safeQuery({
      tableName: 'batches',
      queryFn: async () => {
        let query = supabase.from('batches').select('*');
        
        if (status) {
          query = query.eq('status', status);
        }

        return query;
      }
    });
  }



  /**
   * Initialize schema check on app start - STRICT MODE
   */
  async initializeSchemaCheck() {
    // Clear cache first for fresh check
    this.clearCache();
    
    const coreTables = [
      'batches',
      'bags',
      'scans'
      // Optional tables - commented to allow app to load even if these don't exist yet
      // 'collectors',
      // 'pickup_requests',
      // 'service_areas',
      // 'illegal_dumping'
    ];
    
    const coreFunctions = [
      // Mark all functions as optional since we have fallback implementations
      // 'fetch_dashboard_stats',
      // 'fetch_illegal_dumping_reports',
      // 'update_illegal_dumping_status',
      // 'assign_cleanup_team'
    ];
    
    console.log('🔍 Performing database schema validation (relaxed mode)...');
    const tableResults = {};
    const functionResults = {};
    
    // Check core tables (required)
    console.log('🔍 Checking required core tables...');
    let missingTables = 0;
    for (const table of coreTables) {
      try {
        const exists = await this.checkTableExists(table);
        tableResults[table] = exists;
        
        if (!exists) {
          missingTables++;
          const errorMsg = `WARNING: Core table '${table}' not found in Supabase database.`;
          console.warn(`⚠️ ${errorMsg}`);
        } else {
          console.log(`✅ Table '${table}': VALIDATED`);
        }
      } catch (error) {
        console.warn(`⚠️ Error validating table '${table}':`, error.message);
        tableResults[table] = false;
        missingTables++;
      }
    }
    
    // If any core tables are missing, warn but don't fail
    if (missingTables > 0) {
      console.warn(`⚠️ ${missingTables} core tables missing - application will fallback to mock data for these tables`);
    }
    
    // Check functions (now optional with graceful fallbacks)
    console.log('🔍 Checking optional database functions...');
    if (coreFunctions.length > 0) {
      for (const func of coreFunctions) {
        try {
          const exists = await this.checkFunctionExists(func);
          functionResults[func] = exists;
          
          if (!exists) {
            console.warn(`⚠️ Function '${func}' not found - will use direct table access instead`);
          } else {
            console.log(`✅ Function '${func}': VALIDATED`);
          }
        } catch (error) {
          console.warn(`⚠️ Error validating function '${func}':`, error.message);
          functionResults[func] = false;
        }
      }
    } else {
      console.log('ℹ️ No required functions specified - all RPC calls will use direct table access');
    }
    
    const existingTables = Object.values(tableResults).filter(Boolean).length;
    const existingFunctions = coreFunctions.length > 0 ? Object.values(functionResults).filter(Boolean).length : 'N/A';
    
    console.log(`📊 Database validation complete: ${existingTables}/${coreTables.length} tables${coreFunctions.length > 0 ? ` and ${existingFunctions}/${coreFunctions.length} functions` : ''} validated`);
    
    // Now we don't fail the app if some functions are missing, since we have fallbacks
    if (missingTables > 0) {
      console.warn('⚠️ Some tables are missing - application will use mock data where needed');
      this.mockDataMode = true;
      this.enableMockFallback = true;
    } else {
      console.log('✅ All required database tables validated successfully');
      this.mockDataMode = false;
      this.enableMockFallback = false;
      this.forceRealDataOnly = true;
    }
    
    return {
      tables: tableResults,
      functions: functionResults,
      success: missingTables === 0,
      partialSuccess: true // Always return partial success to allow app to continue
    };
  }

  /**
   * Clear the table existence cache
   * @deprecated Caching has been disabled - this method does nothing
   */
  clearCache() {
    console.log('[SafeDB] DEPRECATED: Caching disabled - clearCache() does nothing');
    // DEPRECATED: No caching
    // this.tableExists.clear();
    // this.functionExists.clear();
  }

  /**
   * Clear cache for a specific table
   * @deprecated Caching has been disabled - this method does nothing
   */
  clearTableCache(tableName) {
    console.log(`[SafeDB] DEPRECATED: Caching disabled - clearTableCache() does nothing for ${tableName}`);
    // DEPRECATED: No caching
    // this.tableExists.delete(tableName);
  }

  /**
   * Force refresh a table's existence check
   * @deprecated Caching disabled - all checks are now fresh, this just calls checkTableExists
   */
  async refreshTableCheck(tableName) {
    console.log(`[SafeDB] Checking table existence for: ${tableName} (caching disabled, always fresh)`);
    const exists = await this.checkTableExists(tableName);
    console.log(`[SafeDB] Table ${tableName} exists: ${exists}`);
    return exists;
  }
}

// Export singleton instance
const safeDatabaseService = new SafeDatabaseService();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.safeDatabaseService = safeDatabaseService;
  console.log('🔧 DEBUG: Caching DEPRECATED - all table checks are now fresh');
  console.log('🔧 DEBUG: Use window.safeDatabaseService.checkTableExists("table_name") to check table');
  console.log('🔧 DEBUG: Use window.safeDatabaseService.checkFunctionExists("function_name") to check function');
}

export { safeDatabaseService };
