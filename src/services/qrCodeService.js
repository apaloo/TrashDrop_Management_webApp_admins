import { supabase, handleDatabaseError } from '../utils/supabase';
import { realtimeManager } from './realtimeManager';
import { trackDatabaseOperation } from './performanceMonitor';

/**
 * QR Code Service with Atomic Scanning and Validation
 * Handles all QR code operations with conflict resolution and audit trails
 */
class QRCodeService {
  constructor() {
    this.scanHistory = new Map();
    this.pendingScans = new Map();
    this.subscribers = new Map();
    this.isInitialized = false;
    this.duplicateScanWindow = 30000; // 30 seconds
  }

  /**
   * Initialize service with real-time subscriptions
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Subscribe to QR scanning events
      realtimeManager.subscribeToQRScanning((payload) => {
        this.handleRealtimeChange(payload);
      });

      // Start cleanup for old scan history
      this.startScanHistoryCleanup();

      this.isInitialized = true;
      console.log('✅ QR Code Service initialized with atomic scanning');
    } catch (error) {
      console.error('❌ Failed to initialize QR Code Service:', error);
      throw error;
    }
  }

  /**
   * Handle real-time changes from Supabase
   */
  handleRealtimeChange(payload) {
    const { eventType, new: newRecord, old: oldRecord, tableName } = payload;

    switch (tableName) {
      case 'scans':
        this.handleScanChange(eventType, newRecord, oldRecord);
        break;
      case 'bags':
        this.handleBagChange(eventType, newRecord, oldRecord);
        break;
      case 'batches':
        this.handleBatchChange(eventType, newRecord, oldRecord);
        break;
    }

    // Notify subscribers
    this.notifySubscribers('qr_change', {
      eventType,
      newRecord,
      oldRecord,
      tableName,
      timestamp: new Date()
    });
  }

  /**
   * Handle scan record changes
   */
  handleScanChange(eventType, newRecord, oldRecord) {
    if (eventType === 'INSERT') {
      const scanId = newRecord.id;
      const bagId = newRecord.bag_id;
      
      // Update scan history
      this.scanHistory.set(bagId, {
        scanId,
        collectorId: newRecord.scanned_by,
        scannedAt: newRecord.scanned_at,
        location: newRecord.location
      });

      // Remove from pending scans
      this.pendingScans.delete(`${bagId}_${newRecord.scanned_by}`);

      console.log(`Bag ${bagId} successfully scanned by collector ${newRecord.scanned_by}`);
      
      this.notifySubscribers('scan_completed', {
        bagId,
        scanId,
        collectorId: newRecord.scanned_by,
        scannedAt: newRecord.scanned_at
      });
    }
  }

  /**
   * Handle bag status changes
   */
  handleBagChange(eventType, newRecord, oldRecord) {
    if (eventType === 'UPDATE' && newRecord.scanned !== oldRecord?.scanned) {
      console.log(`Bag ${newRecord.bag_id} scan status changed: ${oldRecord?.scanned} → ${newRecord.scanned}`);
    }
  }

  /**
   * Handle batch changes
   */
  handleBatchChange(eventType, newRecord, oldRecord) {
    if (eventType === 'UPDATE' && newRecord.scanned !== oldRecord?.scanned) {
      console.log(`Batch ${newRecord.batch_id} scan count updated: ${oldRecord?.scanned} → ${newRecord.scanned}`);
    }
  }

  /**
   * Scan bag QR code with atomic validation
   */
  async scanBagQR({
    bagId,
    collectorId,
    location = null,
    timestamp = null,
    metadata = {}
  }) {
    return trackDatabaseOperation('scanBagQR', async () => {
      try {
        // Generate unique key for this scan attempt
        const pendingKey = `${bagId}_${collectorId}`;
        
        // Check for duplicate scan attempts
        if (this.pendingScans.has(pendingKey)) {
          throw new Error('Scan already in progress for this bag and collector');
        }

        // Check recent scan history to prevent duplicate scans
        const recentScan = this.scanHistory.get(bagId);
        if (recentScan && Date.now() - new Date(recentScan.scannedAt).getTime() < this.duplicateScanWindow) {
          throw new Error('Bag was recently scanned. Please wait before scanning again.');
        }

        // Mark as pending
        this.pendingScans.set(pendingKey, {
          bagId,
          collectorId,
          startedAt: new Date(),
          metadata
        });

        const scanTimestamp = timestamp || new Date().toISOString();
        const scanLocation = location || [0, 0]; // Default location if not provided

        try {
          // Use atomic database function for scanning
          const { data, error } = await supabase.rpc('atomic_bag_scan', {
            p_bag_id: bagId,
            p_collector_id: collectorId,
            p_scan_location: `(${scanLocation[0]}, ${scanLocation[1]})`,
            p_scan_timestamp: scanTimestamp
          });

          if (error) throw error;

          if (!data.success) {
            throw new Error(data.message || 'Failed to scan bag');
          }

          // Update local scan history
          this.scanHistory.set(bagId, {
            scanId: data.scan_id,
            collectorId,
            scannedAt: scanTimestamp,
            location: scanLocation
          });

          // Notify subscribers
          this.notifySubscribers('bag_scanned', {
            bagId,
            scanId: data.scan_id,
            collectorId,
            scannedAt: scanTimestamp,
            location: scanLocation
          });

          return {
            success: true,
            data: {
              scanId: data.scan_id,
              bagId,
              collectorId,
              scannedAt: scanTimestamp,
              message: data.message
            }
          };

        } finally {
          // Always remove from pending scans
          this.pendingScans.delete(pendingKey);
        }

      } catch (error) {
        console.error('Error scanning bag QR:', error);
        
        // Remove from pending scans on error
        const pendingKey = `${bagId}_${collectorId}`;
        this.pendingScans.delete(pendingKey);

        throw handleDatabaseError(error, 'scanBagQR');
      }
    });
  }

  /**
   * Batch scan multiple QR codes (for bulk operations)
   */
  async batchScanQR(scans) {
    return trackDatabaseOperation('batchScanQR', async () => {
      try {
        const results = [];
        const errors = [];

        console.log(`Starting batch scan of ${scans.length} QR codes`);

        // Process scans with controlled concurrency to prevent overwhelming the database
        const concurrencyLimit = 5;
        const chunks = this.chunkArray(scans, concurrencyLimit);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`Processing scan batch ${i + 1}/${chunks.length} (${chunk.length} items)`);

          // Process chunk in parallel
          const chunkPromises = chunk.map(async (scan) => {
            try {
              const result = await this.scanBagQR(scan);
              return { success: true, data: result.data, originalScan: scan };
            } catch (error) {
              return {
                success: false,
                error: error.message,
                bagId: scan.bagId,
                collectorId: scan.collectorId,
                originalScan: scan
              };
            }
          });

          const chunkResults = await Promise.all(chunkPromises);
          
          // Separate successful and failed scans
          chunkResults.forEach(result => {
            if (result.success) {
              results.push(result);
            } else {
              errors.push(result);
            }
          });

          // Small delay between chunks
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        const response = {
          success: errors.length === 0,
          total: scans.length,
          successful: results.length,
          failed: errors.length,
          results,
          errors
        };

        console.log(`Batch scan complete: ${response.successful}/${response.total} successful`);
        
        // Notify subscribers of batch completion
        this.notifySubscribers('batch_scan_completed', response);

        return response;

      } catch (error) {
        console.error('Error in batch QR scanning:', error);
        throw handleDatabaseError(error, 'batchScanQR');
      }
    });
  }

  /**
   * Validate QR code before scanning
   */
  async validateQRCode(qrCode) {
    return trackDatabaseOperation('validateQRCode', async () => {
      try {
        // Extract bag ID from QR code
        const bagId = this.extractBagIdFromQR(qrCode);
        if (!bagId) {
          throw new Error('Invalid QR code format');
        }

        // Check if bag exists and is valid for scanning
        const { data: bag, error } = await supabase
          .from('bags')
          .select(`
            bag_id,
            batch_id,
            type,
            status,
            scanned,
            picked_up_at,
            batches:batch_id(
              batch_id,
              batch_status,
              user_id
            )
          `)
          .eq('bag_id', bagId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error('QR code not found in system');
          }
          throw error;
        }

        // Validate bag status
        const validationResult = {
          valid: true,
          bagId,
          bag,
          issues: []
        };

        if (bag.scanned) {
          validationResult.valid = false;
          validationResult.issues.push('Bag has already been scanned');
        }

        if (bag.status && !['active', 'distributed'].includes(bag.status)) {
          validationResult.valid = false;
          validationResult.issues.push(`Bag status is ${bag.status}, cannot be scanned`);
        }

        if (bag.batches?.batch_status === 'cancelled') {
          validationResult.valid = false;
          validationResult.issues.push('Bag belongs to a cancelled batch');
        }

        return validationResult;

      } catch (error) {
        console.error('Error validating QR code:', error);
        throw handleDatabaseError(error, 'validateQRCode');
      }
    });
  }

  /**
   * Get scan history for a bag or batch
   */
  async getScanHistory({
    bagId = null,
    batchId = null,
    collectorId = null,
    dateRange = null,
    limit = 100,
    page = 1
  } = {}) {
    return trackDatabaseOperation('getScanHistory', async () => {
      try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
          .from('scans')
          .select(`
            *,
            bag:bag_id(
              bag_id,
              batch_id,
              type,
              status
            ),
            scanned_by
            )
          `, { count: 'exact' })
          .range(from, to)
          .order('scanned_at', { ascending: false });

        // Apply filters
        if (bagId) {
          query = query.eq('bag_id', bagId);
        }

        if (batchId) {
          query = query.eq('bag.batch_id', batchId);
        }

        if (collectorId) {
          query = query.eq('scanned_by', collectorId);
        }

        if (dateRange?.start && dateRange?.end) {
          query = query
            .gte('scanned_at', dateRange.start)
            .lte('scanned_at', dateRange.end);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        return {
          data,
          totalCount: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
          hasNextPage: (page * limit) < count,
          hasPrevPage: page > 1
        };

      } catch (error) {
        console.error('Error getting scan history:', error);
        throw handleDatabaseError(error, 'getScanHistory');
      }
    });
  }

  /**
   * Get scanning statistics for dashboard
   */
  async getScanStats(dateRange = null) {
    return trackDatabaseOperation('getScanStats', async () => {
      try {
        let query = supabase
          .from('scans')
          .select(`
            id,
            scanned_at,
            bag:bag_id(type),
            scanned_by
          `);

        if (dateRange?.start && dateRange?.end) {
          query = query
            .gte('scanned_at', dateRange.start)
            .lte('scanned_at', dateRange.end);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Calculate statistics
        const stats = {
          totalScans: data.length,
          uniqueCollectors: new Set(data.map(scan => scan.collector?.id)).size,
          byWasteType: {},
          byHour: {},
          byDay: {},
          averageScansPerCollector: 0,
          dateRange: dateRange || { start: null, end: null }
        };

        // Process scan data
        data.forEach(scan => {
          // Count by waste type
          const wasteType = scan.bag?.type || 'unknown';
          stats.byWasteType[wasteType] = (stats.byWasteType[wasteType] || 0) + 1;

          // Count by hour
          const hour = new Date(scan.scanned_at).getHours();
          stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

          // Count by day
          const day = new Date(scan.scanned_at).toISOString().split('T')[0];
          stats.byDay[day] = (stats.byDay[day] || 0) + 1;
        });

        stats.averageScansPerCollector = stats.uniqueCollectors > 0 
          ? Math.round(stats.totalScans / stats.uniqueCollectors * 10) / 10 
          : 0;

        return stats;

      } catch (error) {
        console.error('Error getting scan stats:', error);
        throw handleDatabaseError(error, 'getScanStats');
      }
    });
  }

  /**
   * Generate QR code for bag
   */
  generateBagQR(bagId, format = 'url') {
    const baseUrl = process.env.REACT_APP_BASE_URL || 'https://trashdrop.com';
    const qrUrl = `${baseUrl}/scan/${bagId}`;

    switch (format) {
      case 'url':
        return qrUrl;
      case 'data':
        return {
          type: 'bag',
          id: bagId,
          url: qrUrl,
          generated: new Date()
        };
      default:
        return qrUrl;
    }
  }

  /**
   * Helper Methods
   */

  extractBagIdFromQR(qrCode) {
    // Handle different QR code formats
    if (qrCode.includes('/scan/')) {
      return qrCode.split('/scan/')[1];
    }
    if (qrCode.includes('/bag/')) {
      return qrCode.split('/bag/')[1];
    }
    // Direct bag ID
    if (qrCode.match(/^BAG-\d+-\d+$/)) {
      return qrCode;
    }
    return null;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  startScanHistoryCleanup() {
    // Clean up old scan history every 5 minutes
    setInterval(() => {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      const keysToDelete = [];

      this.scanHistory.forEach((scan, bagId) => {
        if (new Date(scan.scannedAt).getTime() < cutoffTime) {
          keysToDelete.push(bagId);
        }
      });

      keysToDelete.forEach(key => this.scanHistory.delete(key));

      if (keysToDelete.length > 0) {
        console.log(`Cleaned up ${keysToDelete.length} old scan history entries`);
      }
    }, 5 * 60 * 1000);
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
          console.error('Error in QR code subscriber callback:', error);
        }
      });
    }
  }

  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      scanHistorySize: this.scanHistory.size,
      pendingScansSize: this.pendingScans.size,
      subscribersCount: Array.from(this.subscribers.values())
        .reduce((total, callbacks) => total + callbacks.size, 0)
    };
  }

  cleanup() {
    this.scanHistory.clear();
    this.pendingScans.clear();
    this.subscribers.clear();
    this.isInitialized = false;
    console.log('✅ QR Code Service cleaned up');
  }
}

// Create singleton instance
export const qrCodeService = new QRCodeService();

export { QRCodeService };
export default qrCodeService;
