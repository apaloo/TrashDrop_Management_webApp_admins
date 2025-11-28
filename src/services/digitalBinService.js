import { supabase, handleDatabaseError } from '../utils/supabase';
import { realtimeManager } from './realtimeManager';
import { trackDatabaseOperation } from './performanceMonitor';

/**
 * Digital Bin Service with High Volume Optimization
 * Handles digital bin operations with caching and batch processing
 */
class DigitalBinService {
  constructor() {
    this.cache = new Map();
    this.batchQueue = [];
    this.batchTimeout = null;
    this.subscribers = new Map();
    this.isInitialized = false;
    
    // Configuration
    this.config = {
      batchSize: 100,
      batchDelay: 5000, // 5 seconds
      cacheExpiry: 300000, // 5 minutes
      maxCacheSize: 1000
    };
  }

  /**
   * Initialize service with real-time subscriptions and caching
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Subscribe to real-time changes
      realtimeManager.subscribeToDigitalBins((payload) => {
        this.handleRealtimeChange(payload);
      });

      // Start periodic cache cleanup
      this.startCacheCleanup();

      // Process any pending batch operations
      this.processBatchQueue();

      this.isInitialized = true;
      console.log('✅ Digital Bin Service initialized with caching and batch processing');
    } catch (error) {
      console.error('❌ Failed to initialize Digital Bin Service:', error);
      throw error;
    }
  }

  /**
   * Handle real-time changes from Supabase
   */
  handleRealtimeChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
        this.updateCache(newRecord);
        this.notifySubscribers('bin_created', newRecord);
        break;
      case 'UPDATE':
        this.updateCache(newRecord);
        this.notifySubscribers('bin_updated', { newRecord, oldRecord });
        break;
      case 'DELETE':
        this.removeFromCache(oldRecord.id);
        this.notifySubscribers('bin_deleted', oldRecord);
        break;
    }
  }

  /**
   * Fetch digital bins with advanced caching and filtering
   */
  async fetchDigitalBins({
    page = 1,
    limit = 50,
    status = 'all',
    frequency = 'all',
    wasteType = 'all',
    userId = null,
    locationId = null,
    searchQuery = '',
    sortBy = 'created_at',
    sortOrder = 'desc',
    useCache = true,
    includeExpired = false
  } = {}) {
    return trackDatabaseOperation('fetchDigitalBins', async () => {
      try {
        // Create cache key
        const cacheKey = this.createCacheKey({
          page, limit, status, frequency, wasteType, userId, 
          locationId, searchQuery, sortBy, sortOrder, includeExpired
        });

        // Check cache first
        if (useCache && this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey);
          if (Date.now() - cached.timestamp < this.config.cacheExpiry) {
            return {
              ...cached.data,
              fromCache: true,
              cachedAt: new Date(cached.timestamp)
            };
          }
        }

        // Calculate pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Build query with bin_locations join to get coordinates
        let query = supabase
          .from('digital_bins')
          .select(`
            *,
            location:bin_locations!location_id (
              id,
              location_name,
              address,
              latitude,
              longitude,
              coordinates
            )
          `, { count: 'exact' })
          .range(from, to);

        // Apply filters
        if (!includeExpired) {
          query = query.gt('expires_at', new Date().toISOString());
        }

        if (status !== 'all') {
          if (status === 'active') {
            query = query.eq('is_active', true);
          } else if (status === 'inactive') {
            query = query.eq('is_active', false);
          } else if (status === 'expired') {
            query = query.lt('expires_at', new Date().toISOString());
          }
        }

        if (frequency !== 'all') {
          query = query.eq('frequency', frequency);
        }

        if (wasteType !== 'all') {
          query = query.eq('waste_type', wasteType);
        }

        if (userId) {
          query = query.eq('user_id', userId);
        }

        if (locationId) {
          query = query.eq('location_id', locationId);
        }

        // Search functionality
        if (searchQuery && searchQuery.trim()) {
          const searchTerm = searchQuery.trim();
          query = query.or(`
            qr_code_url.ilike.%${searchTerm}%,
            special_instructions.ilike.%${searchTerm}%,
            location.location_name.ilike.%${searchTerm}%,
            location.address.ilike.%${searchTerm}%
          `);
        }

        // Apply sorting
        const ascending = sortOrder === 'asc';
        query = query.order(sortBy, { ascending });

        // Execute query
        const { data, error, count } = await query;

        if (error) throw error;

        // Enhance data with computed fields
        const enhancedData = this.enhanceDigitalBinsData(data);

        const result = {
          data: enhancedData,
          totalCount: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
          hasNextPage: (page * limit) < count,
          hasPrevPage: page > 1,
          fromCache: false,
          syncedAt: new Date()
        };

        // Cache the result
        this.updateCache(cacheKey, result);

        return result;

      } catch (error) {
        console.error('Error fetching digital bins:', error);
        throw handleDatabaseError(error, 'fetchDigitalBins');
      }
    });
  }

  /**
   * Create digital bin with validation and batch processing
   */
  async createDigitalBin({
    userId,
    locationId,
    frequency,
    wasteType,
    bagCount,
    specialInstructions = null,
    processBatch = true
  }) {
    return trackDatabaseOperation('createDigitalBin', async () => {
      try {
        // Validate inputs
        this.validateDigitalBinData({
          userId, locationId, frequency, wasteType, bagCount
        });

        if (processBatch) {
          // Use database function for atomic creation
          const { data, error } = await supabase.rpc('create_digital_bin', {
            p_user_id: userId,
            p_location_id: locationId,
            p_frequency: frequency,
            p_waste_type: wasteType,
            p_bag_count: bagCount,
            p_special_instructions: specialInstructions
          });

          if (error) throw error;

          if (!data.success) {
            throw new Error(data.message || 'Failed to create digital bin');
          }

          // Update cache with new bin data
          const newBin = await this.fetchDigitalBinById(data.bin_id);
          
          // Clear relevant cache entries
          this.clearCacheByPattern(['fetchDigitalBins']);

          return {
            success: true,
            data: newBin
          };
        } else {
          // Queue for batch processing
          return this.queueForBatch({
            operation: 'create',
            userId,
            locationId,
            frequency,
            wasteType,
            bagCount,
            specialInstructions
          });
        }

      } catch (error) {
        console.error('Error creating digital bin:', error);
        throw handleDatabaseError(error, 'createDigitalBin');
      }
    });
  }

  /**
   * Update digital bin with optimistic updates
   */
  async updateDigitalBin(binId, updateData, optimistic = true) {
    return trackDatabaseOperation('updateDigitalBin', async () => {
      try {
        // Optimistic update - update cache immediately
        if (optimistic) {
          this.updateCacheOptimistically(binId, updateData);
        }

        // Prepare update data
        const cleanUpdateData = {
          ...updateData,
          updated_at: new Date()
        };

        // Remove computed fields that shouldn't be updated
        delete cleanUpdateData.user;
        delete cleanUpdateData.location;
        delete cleanUpdateData._computed;

        // Update in database
        const { data, error } = await supabase
          .from('digital_bins')
          .update(cleanUpdateData)
          .eq('id', binId)
          .select(`
            *,
            user:user_id(id, email, first_name, last_name),
            location:location_id(id, address, coordinates, location_name)
          `)
          .single();

        if (error) {
          // Revert optimistic update on error
          if (optimistic) {
            this.revertOptimisticUpdate(binId);
          }
          throw error;
        }

        // Update cache with real data
        this.updateCache(data);

        // Clear related cache entries
        this.clearCacheByPattern(['fetchDigitalBins']);

        return {
          success: true,
          data: this.enhanceDigitalBinData(data)
        };

      } catch (error) {
        console.error('Error updating digital bin:', error);
        throw handleDatabaseError(error, 'updateDigitalBin');
      }
    });
  }

  /**
   * Batch create multiple digital bins (high volume optimization)
   */
  async batchCreateDigitalBins(binsData) {
    return trackDatabaseOperation('batchCreateDigitalBins', async () => {
      try {
        const results = [];
        const errors = [];
        
        // Process in chunks to avoid overwhelming the database
        const chunkSize = this.config.batchSize;
        const chunks = this.chunkArray(binsData, chunkSize);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`Processing digital bin batch ${i + 1}/${chunks.length} (${chunk.length} items)`);

          try {
            // Prepare data for insertion
            const insertData = chunk.map(bin => {
              this.validateDigitalBinData(bin);
              
              const binId = crypto.randomUUID();
              const expiresAt = this.calculateExpiry(bin.frequency);
              
              return {
                id: binId,
                user_id: bin.userId,
                location_id: bin.locationId,
                qr_code_url: `https://trashdrop.com/bin/${binId}`,
                frequency: bin.frequency,
                waste_type: bin.wasteType,
                bag_count: bin.bagCount,
                special_instructions: bin.specialInstructions,
                is_active: true,
                expires_at: expiresAt,
                created_at: new Date(),
                updated_at: new Date()
              };
            });

            // Batch insert
            const { data, error } = await supabase
              .from('digital_bins')
              .insert(insertData)
              .select();

            if (error) throw error;

            results.push(...data);

            // Update cache
            data.forEach(bin => this.updateCache(bin));

          } catch (chunkError) {
            console.error(`Error processing batch ${i + 1}:`, chunkError);
            errors.push({
              chunkIndex: i,
              error: chunkError.message,
              items: chunk
            });
          }

          // Small delay between chunks to prevent overwhelming
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Clear cache
        this.clearCacheByPattern(['fetchDigitalBins']);

        return {
          success: errors.length === 0,
          results,
          errors,
          created: results.length,
          failed: errors.length
        };

      } catch (error) {
        console.error('Error in batch create digital bins:', error);
        throw handleDatabaseError(error, 'batchCreateDigitalBins');
      }
    });
  }

  /**
   * Get digital bins statistics for dashboard
   */
  async getDigitalBinStats(dateRange = null) {
    return trackDatabaseOperation('getDigitalBinStats', async () => {
      try {
        // Check cache first
        const cacheKey = `stats_${dateRange?.start}_${dateRange?.end}`;
        if (this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey);
          if (Date.now() - cached.timestamp < 60000) { // 1 minute cache for stats
            return cached.data;
          }
        }

        let query = supabase
          .from('digital_bins')
          .select('frequency, waste_type, bag_count, is_active, expires_at, created_at');

        // Apply date range if provided
        if (dateRange?.start && dateRange?.end) {
          query = query
            .gte('created_at', dateRange.start)
            .lte('created_at', dateRange.end);
        }

        const { data, error } = await query;
        if (error) throw error;

        const now = new Date();
        const stats = {
          total: data.length,
          active: 0,
          inactive: 0,
          expired: 0,
          byFrequency: {},
          byWasteType: {},
          averageBagCount: 0,
          totalBagCount: 0,
          dateRange: dateRange || { start: null, end: null }
        };

        let totalBags = 0;
        data.forEach(bin => {
          // Count by status
          if (new Date(bin.expires_at) < now) {
            stats.expired++;
          } else if (bin.is_active) {
            stats.active++;
          } else {
            stats.inactive++;
          }

          // Count by frequency
          stats.byFrequency[bin.frequency] = (stats.byFrequency[bin.frequency] || 0) + 1;
          
          // Count by waste type
          stats.byWasteType[bin.waste_type] = (stats.byWasteType[bin.waste_type] || 0) + 1;

          // Sum bag counts
          totalBags += bin.bag_count || 0;
        });

        stats.totalBagCount = totalBags;
        stats.averageBagCount = stats.total > 0 ? Math.round(totalBags / stats.total * 10) / 10 : 0;

        // Cache the result
        this.updateCache(cacheKey, stats, 60000); // 1 minute cache

        return stats;

      } catch (error) {
        console.error('Error getting digital bin stats:', error);
        throw handleDatabaseError(error, 'getDigitalBinStats');
      }
    });
  }

  /**
   * Clean up expired digital bins
   */
  async cleanupExpiredBins() {
    return trackDatabaseOperation('cleanupExpiredBins', async () => {
      try {
        const { data, error } = await supabase
          .from('digital_bins')
          .update({ is_active: false })
          .lt('expires_at', new Date().toISOString())
          .eq('is_active', true)
          .select('id');

        if (error) throw error;

        const cleanedCount = data.length;
        
        // Clear cache
        this.clearCacheByPattern(['fetchDigitalBins', 'stats_']);

        console.log(`Cleaned up ${cleanedCount} expired digital bins`);
        
        return {
          success: true,
          cleanedCount,
          cleanedIds: data.map(bin => bin.id)
        };

      } catch (error) {
        console.error('Error cleaning up expired bins:', error);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Helper Methods
   */

  validateDigitalBinData({ userId, locationId, frequency, wasteType, bagCount }) {
    if (!userId) throw new Error('User ID is required');
    if (!locationId) throw new Error('Location ID is required');
    if (!['weekly', 'biweekly', 'monthly'].includes(frequency)) {
      throw new Error('Invalid frequency. Must be weekly, biweekly, or monthly');
    }
    if (!['general', 'recycling', 'organic'].includes(wasteType)) {
      throw new Error('Invalid waste type');
    }
    if (!bagCount || bagCount < 1 || bagCount > 10) {
      throw new Error('Bag count must be between 1 and 10');
    }
  }

  calculateExpiry(frequency) {
    const now = new Date();
    switch (frequency) {
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'biweekly':
        return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  enhanceDigitalBinsData(bins) {
    if (!bins || !Array.isArray(bins)) return bins;
    return bins.map(bin => this.enhanceDigitalBinData(bin));
  }

  enhanceDigitalBinData(bin) {
    if (!bin) return bin;
    
    const now = new Date();
    const expiresAt = new Date(bin.expires_at);
    
    // Normalize location structure for map rendering
    const location = bin.location ? {
      ...bin.location,
      lat: bin.location.latitude,
      lng: bin.location.longitude,
      address: bin.location.address || bin.location.location_name
    } : null;
    
    return {
      ...bin,
      location,
      _computed: {
        isExpired: expiresAt < now,
        isActive: bin.is_active && expiresAt >= now,
        daysUntilExpiry: Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)),
        qrCodeShort: bin.qr_code_url?.split('/').pop(),
        statusText: expiresAt < now ? 'expired' : bin.is_active ? 'active' : 'inactive'
      }
    };
  }

  async fetchDigitalBinById(binId) {
    const { data, error } = await supabase
      .from('digital_bins')
      .select(`
        *,
        user:user_id(id, email, first_name, last_name),
        location:location_id(id, address, coordinates, location_name)
      `)
      .eq('id', binId)
      .single();

    if (error) throw error;
    return this.enhanceDigitalBinData(data);
  }

  createCacheKey(params) {
    return `fetchDigitalBins_${JSON.stringify(params)}`;
  }

  updateCache(key, data, expiry = null) {
    // Prevent cache from growing too large
    if (this.cache.size >= this.config.maxCacheSize) {
      this.clearOldestCache();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: expiry || this.config.cacheExpiry
    });
  }

  clearCacheByPattern(patterns) {
    const keysToDelete = [];
    this.cache.forEach((value, key) => {
      if (patterns.some(pattern => key.includes(pattern))) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clearOldestCache() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    this.cache.forEach((value, key) => {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];
      
      this.cache.forEach((value, key) => {
        if (now - value.timestamp > value.expiry) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => this.cache.delete(key));
      
      if (keysToDelete.length > 0) {
        console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
      }
    }, 60000); // Clean up every minute
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);

    return () => {
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  notifySubscribers(eventType, data) {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in digital bin subscriber callback:', error);
        }
      });
    }
  }

  removeFromCache(binId) {
    // Remove specific bin from cache
    this.cache.forEach((value, key) => {
      if (key.includes(binId)) {
        this.cache.delete(key);
      }
    });
  }

  updateCacheOptimistically(binId, updateData) {
    // Implementation for optimistic updates
    // This would update cached data immediately before database confirmation
  }

  revertOptimisticUpdate(binId) {
    // Implementation to revert optimistic updates on error
    // Would restore previous cached state
  }

  queueForBatch(operation) {
    // Implementation for batch queue processing
    // Would add operation to queue for later batch processing
  }

  processBatchQueue() {
    // Implementation for processing queued batch operations
    // Would periodically process queued operations
  }

  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      cacheSize: this.cache.size,
      subscribersCount: Array.from(this.subscribers.values())
        .reduce((total, callbacks) => total + callbacks.size, 0),
      batchQueueSize: this.batchQueue.length
    };
  }

  cleanup() {
    this.cache.clear();
    this.subscribers.clear();
    this.batchQueue = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    this.isInitialized = false;
    console.log('✅ Digital Bin Service cleaned up');
  }
}

// Create singleton instance
export const digitalBinService = new DigitalBinService();

export { DigitalBinService };
export default digitalBinService;
