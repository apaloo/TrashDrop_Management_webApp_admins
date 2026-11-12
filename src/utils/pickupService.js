import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';
import { parsePoint } from './mapCoordinates';
import logger from './logger';

/**
 * Fetches pickup requests with optional filters
 * @param {Object} options - Filtering and pagination options
 * @param {string} options.status - Filter by status ('pending', 'assigned', 'completed', etc.)
 * @param {string} options.collectorId - Filter by assigned collector ID
 * @param {number} options.limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of pickup request objects
 */
export const fetchPickupRequests = async ({ 
  status = null, 
  collectorId = null, 
  limit = 100,
} = {}) => {
  // Real data only: errors are thrown (never made-up rows), and a request
  // without coordinates gets lat/lng null, never a made-up position.
  try {
    // Normalize status to lowercase to match database values
    const normalizedStatus = status ? status.toLowerCase() : null;
    logger.log('fetchPickupRequests called with:', { status, normalizedStatus, collectorId, limit });

    // PostGIS points are (x y) = (lng lat). Swapped data is detected and
    // reported by the Live Map's coordinate check, not guessed here.
    const parsePointString = (value) => parsePoint(value);
    
    // Check if both pickup_requests and profiles tables exist before making query
    const pickupTableExists = await safeDatabaseService.checkTableExists('pickup_requests');
    const profilesTableExists = await safeDatabaseService.checkTableExists('profiles');
    const collectorsTableExists = await safeDatabaseService.checkTableExists('collector_profiles');
    
    logger.log('Table existence check:', { 
      pickupTableExists, 
      profilesTableExists, 
      collectorsTableExists 
    });
    
    if (!pickupTableExists) {
      throw new Error('pickup_requests table is not available');
    }

    // Build the query - just select all fields without joins
    // Foreign key relationships not configured in database yet
    let query = supabase
      .from('pickup_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters (always use lowercase for DB comparison)
    if (normalizedStatus) {
      query = query.eq('status', normalizedStatus);
    }
    
    if (collectorId) {
      query = query.eq('collector_id', collectorId);
    }

    const result = await safeDatabaseService.safeQuery({
      tableName: 'pickup_requests',
      queryFn: async () => query,
    });

    // ALSO fetch from digital_bins and scheduled_pickups tables
    // The mobile app writes pickup data to these tables, not pickup_requests
    try {
      // --- digital_bins ---
      // Note: digital_bins.collector_id maps to collector_profiles.user_id (auth UID)
      const digitalBinsExists = await safeDatabaseService.checkTableExists('digital_bins');
      if (digitalBinsExists) {
        let dbQuery = supabase
          .from('digital_bins')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (normalizedStatus) {
          dbQuery = dbQuery.eq('status', normalizedStatus);
        }
        if (collectorId) {
          // collectorId from the UI may be collector_profiles.id
          // but digital_bins.collector_id is the auth user_id
          // Try to resolve the mapping
          const { data: colProfile } = await supabase
            .from('collector_profiles')
            .select('user_id')
            .eq('id', collectorId)
            .single();
          if (colProfile?.user_id) {
            dbQuery = dbQuery.eq('collector_id', colProfile.user_id);
          } else {
            dbQuery = dbQuery.eq('collector_id', collectorId);
          }
        }
        const dbResult = await dbQuery;
        if (dbResult.data && dbResult.data.length > 0) {
          logger.log(`✅ Found ${dbResult.data.length} rows in 'digital_bins'`);
          // Tag each row with its source table for the transformer
          const tagged = dbResult.data.map(r => ({ ...r, _source: 'digital_bins' }));
          result.data = [...(result.data || []), ...tagged];
        }
      }

      // --- scheduled_pickups ---
      const scheduledExists = await safeDatabaseService.checkTableExists('scheduled_pickups');
      if (scheduledExists) {
        let spQuery = supabase
          .from('scheduled_pickups')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (normalizedStatus) {
          spQuery = spQuery.eq('status', normalizedStatus);
        }
        const spResult = await spQuery;
        if (spResult.data && spResult.data.length > 0) {
          logger.log(`✅ Found ${spResult.data.length} rows in 'scheduled_pickups'`);
          const tagged = spResult.data.map(r => ({ ...r, _source: 'scheduled_pickups' }));
          result.data = [...(result.data || []), ...tagged];
        }
      }
    } catch (altError) {
      console.warn('⚠️ Error fetching from alternative pickup tables:', altError);
    }
    
    if (result.fromFallback) {
      throw result.error || new Error('Could not load pickup requests');
    }
    
    // If we have real data, fetch related profiles, collector names, and locations
    if (result.data && result.data.length > 0) {
      try {
        // 1. Fetch requester profiles from 'profiles' table
        // profiles.id = auth.users.id = digital_bins.user_id = pickup_requests.user_id
        const allUserIds = [...new Set(result.data.map(r => r.user_id).filter(Boolean))];
        logger.log('📋 Fetching profiles for user IDs:', allUserIds);
        const profileMap = {};

        if (profilesTableExists && allUserIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone, avatar_url, address')
            .in('id', allUserIds);
          
          if (profileError) {
            console.warn('❌ Error fetching profiles:', profileError);
          } else {
            logger.log('✅ Fetched profiles:', profiles?.length || 0);
            if (profiles) {
              profiles.forEach(profile => {
                profileMap[profile.id] = profile;
              });
            }
          }

          // Log any user_ids that had no matching profile
          const missingIds = allUserIds.filter(uid => !profileMap[uid]);
          if (missingIds.length > 0) {
            console.warn(`⚠️ No profiles found for ${missingIds.length} user(s)`);
          }
        }

        // Fallback chain for users without a profile:
        // 1. contacts table (primary contact)
        // 2. get_user_emails RPC (auth.users email)
        // 3. bin_locations (address as identifier)
        let missingProfileIds = allUserIds.filter(uid => !profileMap[uid]);
        if (missingProfileIds.length > 0) {
          // Try contacts table first
          try {
            const { data: contacts } = await supabase
              .from('contacts')
              .select('user_id, name, email, phone')
              .in('user_id', missingProfileIds)
              .eq('primary_contact', true);
            if (contacts && contacts.length > 0) {
              logger.log('✅ Found contacts fallback:', contacts.length);
              contacts.forEach(c => {
                if (!profileMap[c.user_id]) {
                  profileMap[c.user_id] = {
                    id: c.user_id,
                    first_name: c.name?.split(' ')[0] || null,
                    last_name: c.name?.split(' ').slice(1).join(' ') || null,
                    email: c.email,
                    phone: c.phone
                  };
                }
              });
            }
          } catch (contactErr) {
            logger.log('ℹ️ Contacts fallback skipped:', contactErr.message);
          }

          // Try get_user_emails RPC for remaining missing profiles
          missingProfileIds = allUserIds.filter(uid => !profileMap[uid]);
          if (missingProfileIds.length > 0) {
            try {
              const { data: authUsers, error: rpcErr } = await supabase
                .rpc('get_user_emails', { user_ids: missingProfileIds });
              if (!rpcErr && authUsers && authUsers.length > 0) {
                logger.log('✅ Found auth emails via RPC:', authUsers.length);
                authUsers.forEach(u => {
                  if (!profileMap[u.id]) {
                    profileMap[u.id] = {
                      id: u.id,
                      first_name: null,
                      last_name: null,
                      email: u.email,
                      phone: null
                    };
                  }
                });
              }
            } catch (rpcErr) {
              logger.log('ℹ️ get_user_emails RPC not available:', rpcErr.message);
            }
          }
        }

        // Attach profile data to each request
        result.data = result.data.map(request => {
          const profile = profileMap[request.user_id] || null;
          return {
            ...request,
            requester: profile,
            requester_id: request.user_id
          };
        });

        // 2. For digital_bins rows, resolve collector_id (auth user_id) → collector name
        const digitalBinRows = result.data.filter(r => r._source === 'digital_bins' && r.collector_id);
        if (digitalBinRows.length > 0 && collectorsTableExists) {
          const collectorUserIds = [...new Set(digitalBinRows.map(r => r.collector_id).filter(Boolean))];
          logger.log('� Resolving collector names for user_ids:', collectorUserIds);
          const { data: collectorProfiles } = await supabase
            .from('collector_profiles')
            .select('id, user_id, first_name, last_name, phone, email')
            .in('user_id', collectorUserIds);
          
          const collectorMap = {};
          if (collectorProfiles) {
            collectorProfiles.forEach(cp => {
              collectorMap[cp.user_id] = cp;
            });
          }
          
          result.data = result.data.map(request => {
            if (request._source !== 'digital_bins' || !request.collector_id) return request;
            const cp = collectorMap[request.collector_id];
            return {
              ...request,
              collector: cp || null,
              collectorName: cp ? `${cp.first_name || ''} ${cp.last_name || ''}`.trim() : null,
              // Remap collector_id to the collector_profiles.id for UI consistency
              _collector_profile_id: cp?.id || null
            };
          });
        }

        // 3. Resolve location_id → address/coordinates
        // digital_bins.location_id → bin_locations table
        // scheduled_pickups.location_id → locations table
        const rowsWithLocationId = result.data.filter(r => r.location_id && !r.address);
        if (rowsWithLocationId.length > 0) {
          try {
            const locationMap = {};

            // digital_bins rows → bin_locations table
            const binLocIds = [...new Set(
              rowsWithLocationId
                .filter(r => r._source === 'digital_bins')
                .map(r => r.location_id)
                .filter(Boolean)
            )];
            if (binLocIds.length > 0) {
              // Coordinates come back as PostGIS values and are parsed below.
              // (There is deliberately no SQL-running RPC: never add one.)
              const { data: binLocs } = await supabase
                .from('bin_locations')
                .select('id, location_name, address, coordinates')
                .in('id', binLocIds);
              if (binLocs) {
                binLocs.forEach(loc => { locationMap[loc.id] = loc; });
              }
            }

            // scheduled_pickups rows → locations table
            const schedLocIds = [...new Set(
              rowsWithLocationId
                .filter(r => r._source === 'scheduled_pickups')
                .map(r => r.location_id)
                .filter(Boolean)
            )];
            if (schedLocIds.length > 0) {
              const { data: locs } = await supabase
                .from('locations')
                .select('id, location_name, address, latitude, longitude')
                .in('id', schedLocIds);
              if (locs) {
                locs.forEach(loc => { locationMap[loc.id] = loc; });
              }
            }

            // Also try remaining unmatched IDs against both tables
            const unmatchedIds = rowsWithLocationId
              .filter(r => !locationMap[r.location_id])
              .map(r => r.location_id)
              .filter(Boolean);
            if (unmatchedIds.length > 0) {
              const { data: fallbackLocs } = await supabase
                .from('bin_locations')
                .select('id, location_name, address, coordinates')
                .in('id', unmatchedIds);
              if (fallbackLocs) {
                fallbackLocs.forEach(loc => { locationMap[loc.id] = loc; });
              }
            }

            if (Object.keys(locationMap).length > 0) {
              result.data = result.data.map(request => {
                if (!request.location_id) return request;
                const loc = locationMap[request.location_id];
                if (!loc) return request;

                // Parse coordinates from PostGIS point — multiple formats:
                // 1. GeoJSON: { type: "Point", coordinates: [lng, lat] }
                // 2. WKT text: "POINT(lng lat)" or "SRID=4326;POINT(lng lat)"
                // 3. Object: { x, y } or { lng, lat }
                // 4. Direct numeric columns: latitude, longitude
                let parsedLat = loc.latitude ?? null;
                let parsedLng = loc.longitude ?? null;
                if (parsedLat == null && loc.coordinates != null) {
                  logger.log('🔍 bin_locations coordinates type:', typeof loc.coordinates, loc.coordinates);
                  const coords = loc.coordinates;
                  if (typeof coords === 'object' && coords !== null) {
                    // GeoJSON: { type: "Point", coordinates: [lng, lat] }
                    if (coords.type === 'Point' && Array.isArray(coords.coordinates) && coords.coordinates.length >= 2) {
                      parsedLng = parseFloat(coords.coordinates[0]);
                      parsedLat = parseFloat(coords.coordinates[1]);
                    } else {
                      // Object: { x, y } or { lng, lat } or { longitude, latitude }
                      parsedLng = coords.x ?? coords.lng ?? coords.longitude ?? null;
                      parsedLat = coords.y ?? coords.lat ?? coords.latitude ?? null;
                    }
                  } else if (typeof coords === 'string') {
                    // WKT: "POINT(lng lat)" or "SRID=4326;POINT(lng lat)"
                    const pointMatch = coords.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
                    if (pointMatch) {
                      parsedLng = parseFloat(pointMatch[1]);
                      parsedLat = parseFloat(pointMatch[2]);
                    } else if (/^[0-9a-f]+$/i.test(coords) && coords.length >= 42) {
                      // WKB hex string from PostGIS (e.g. "0101000020E6100000...")
                      try {
                        const isLE = coords.substring(0, 2) === '01';
                        let off = 2;
                        const typeHex = coords.substring(off, off + 8);
                        off += 8;
                        const hasSRID = (isLE && typeHex === '01000020') || (!isLE && typeHex === '20000001');
                        const isPoint = hasSRID || typeHex === '01000000' || typeHex === '00000001';
                        if (isPoint) {
                          if (hasSRID) off += 8; // skip 4-byte SRID
                          const hexToDouble = (h, le) => {
                            const buf = new ArrayBuffer(8);
                            const dv = new DataView(buf);
                            for (let i = 0; i < 8; i++) {
                              const idx = le ? i : 7 - i;
                              dv.setUint8(idx, parseInt(h.substring(i * 2, i * 2 + 2), 16));
                            }
                            return dv.getFloat64(0, true);
                          };
                          parsedLng = hexToDouble(coords.substring(off, off + 16), isLE);
                          off += 16;
                          parsedLat = hexToDouble(coords.substring(off, off + 16), isLE);
                          logger.log('✅ Parsed WKB hex → lat:', parsedLat, 'lng:', parsedLng);
                        }
                      } catch (wkbErr) {
                        console.warn('⚠️ Failed to parse WKB hex:', wkbErr);
                      }
                    }
                  }
                  if (parsedLat != null) {
                    logger.log(`✅ Parsed location: lat=${parsedLat}, lng=${parsedLng}`);
                  } else {
                    console.warn('⚠️ Could not parse bin_locations coordinates:', coords);
                  }
                }

                return {
                  ...request,
                  address: request.address || loc.address || loc.location_name || null,
                  latitude: request.latitude || parsedLat || null,
                  longitude: request.longitude || parsedLng || null
                };
              });
            }
          } catch (locErr) {
            console.warn('⚠️ Error fetching locations:', locErr);
          }
        }
      } catch (enrichError) {
        console.warn('❌ Failed to enrich data with profiles/locations:', enrichError);
      }
    } else {
      logger.log('ℹ️ No data to enrich');
    }

    if (result.error) {
      throw result.error;
    }

    // Transform the data to match the expected format with comprehensive null safety
    const rawData = result.data || [];
    logger.log('Processing raw data:', rawData.length, 'items');
    
    const filteredData = rawData.filter(request => {
      if (request == null) {
        console.warn('Found null/undefined request in raw data');
        return false;
      }
      return true;
    });
    
    const transformedData = filteredData.map(request => {
      try {
        // Comprehensive null safety check at the start
        if (!request || typeof request !== 'object') {
          console.warn('Invalid request object encountered:', request);
          return null;
        }
        
        // Handle requestor/requester with null safety
        // Note: request.requester is populated by the profile fetch above
        const requestor = request.requestor || request.requester || null;
        const requesterFullName = requestor 
          ? `${requestor.first_name || ''} ${requestor.last_name || ''}`.trim() 
          : '';
        const requesterEmail = requestor?.email || null;
        const requesterPhone = requestor?.phone || request.phone || null;
        const requesterAddress = requestor?.address || null;

        const requestedBy = {
          id: request.user_id || 
              request.requester_id || 
              request.requested_by || 
              (requestor ? requestor.id : null) || 
              'customer-unknown',
          name: request.customer || 
                requesterFullName || 
                (requesterEmail ? requesterEmail.split('@')[0] : '') ||
                'Unknown Customer',
          email: requesterEmail || 'unknown@example.com',
          phone: requesterPhone || 'N/A',
          address: requesterAddress || null
        };
        
        // Handle collector data with fallbacks for all schema variations
        // For digital_bins: collector_id is auth user_id; _collector_profile_id is the profile id
        const collector = request.collector || {};
        const collectorId = request._collector_profile_id || 
                          request.collector_id || 
                          (collector ? collector.id : null) || 
                          (request.collector ? request.collector.id : null);
        
        // Only create assignedTo if there's a collector assigned
        const assignedTo = collectorId ? {
          id: collectorId,
          name: request.collectorName || 
                (collector ? `${collector.first_name || ''} ${collector.last_name || ''}`.trim() : '') || 
                (request.collector ? 
                  `${request.collector.first_name || ''} ${request.collector.last_name || ''}`.trim() || 
                  request.collector.name : '') || 
                'Unknown Collector',
          email: (collector ? collector.email : null) || 
                 (request.collector ? request.collector.email : null) || 
                 null,
          phone: (collector ? collector.phone : null) || 
                 (request.collector ? request.collector.phone : null) || 
                 null
        } : null;
        
        // Handle location data with fallbacks
        const locationData = request.location || {};

        const point =
          parsePointString(request.location) ||
          parsePointString(request.coordinates) ||
          (typeof locationData === 'object' ? (parsePointString(locationData.coordinates) || parsePointString(locationData.location)) : null);

        const location = {
          address: locationData.address || 
                   request.address || 
                   (request.location ? request.location.address : null) ||
                   (requestor ? requestor.address : null) || // Use profile address as fallback
                   'Unknown Location',
          lat: (point?.lat ?? locationData.latitude ?? locationData.lat ?? request.latitude ?? (request.location ? request.location.lat : null) ?? null),
          lng: (point?.lng ?? locationData.longitude ?? locationData.lng ?? request.longitude ?? (request.location ? request.location.lng : null) ?? null)
        };
        
        // Transform the request to match the expected format with safe property access
        const safeStatus = request.status || 'pending';
        const source = request._source || 'pickup_requests';
        return {
          id: request.id || `request-${Date.now()}`,
          status: safeStatus,
          source: source,
          requestedBy: requestedBy,
          assignedTo: assignedTo,
          requestTime: request.created_at || request.requestTime || new Date().toISOString(),
          scheduledDate: request.scheduled_date || request.scheduledDate || request.pickup_date || null,
          priority: request.is_urgent ? 'High' : getPriority(safeStatus, request.priority || 'medium'),
          wasteType: request.waste_type || request.wasteType || 'General',
          bags: request.bag_count || request.bags || 0,
          notes: request.notes || request.special_instructions || request.specialInstructions || '',
          location: location,
          phone: requestedBy.phone,
          collectorId: collectorId || null,
          collectorName: assignedTo ? assignedTo.name : null,
          wasteTypes: request.wasteTypes || [request.waste_type || 'general'],
          // digital_bins specific fields
          fee: request.fee || null,
          collectorPayout: request.collector_total_payout || null,
          isUrgent: request.is_urgent || false,
          qrCodeUrl: request.qr_code_url || null,
          frequency: request.frequency || null,
          binSizeLiters: request.bin_size_liters || null,
          collectedAt: request.collected_at || null,
          acceptedAt: request.accepted_at || null
        };
      } catch (transformError) {
        console.error('Error transforming request:', transformError, 'Request data:', request);
        return null;
      }
    }).filter(transformed => transformed !== null);
    
    logger.log('Final transformed data:', transformedData.length, 'items');
    return transformedData;
    
  } catch (error) {
    console.error('Error in fetchPickupRequests:', error);
    throw error;
  }
};


/**
 * Determines priority based on status and priority
 * @private
 */
const getPriority = (status, priority) => {
  // If status is 'available' and no priority is set, default to 'Normal'
  if (status === 'available' && !priority) return 'Normal';
  
  // Map database priority to display priority
  const priorityMap = {
    'high': 'High',
    'medium': 'Normal',
    'low': 'Low'
  };
  
  return priorityMap[priority] || 'Normal';
};
