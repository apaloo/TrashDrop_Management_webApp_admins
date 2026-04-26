import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';

/**
 * Generate mock pickup requests data for development
 */
const generateMockPickupRequests = () => [
  {
    id: '1',
    requester_id: 'customer-001',
    collector_id: null,
    customer: 'Kwame Nkrumah Hotel',
    phone: '+233244567890',
    location: {
      lat: 5.5800,
      lng: -0.2300,
      address: '123 Liberation Road, Accra Metropolitan'
    },
    address: '123 Liberation Road, Accra Metropolitan',
    latitude: 5.5800,
    longitude: -0.2300,
    status: 'pending',
    priority: 'high',
    wasteType: 'Commercial',
    waste_type: 'Commercial',
    specialInstructions: 'Large volume, requires truck',
    notes: 'Large volume, requires truck',
    scheduledDate: null,
    scheduled_date: null,
    bags: 15,
    bag_count: 15,
    requestTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    wasteTypes: ['plastic', 'organic', 'paper'],
    // Database-like structure for compatibility
    requester: {
      id: 'customer-001',
      name: 'Kwame Nkrumah Hotel',
      email: 'manager@nkrumahhotel.com',
      phone: '+233244567890'
    },
    collector: null
  },
  {
    id: '2',
    requester_id: 'customer-002',
    collector_id: 'collector-002',
    customer: 'Achimota School',
    phone: '+233234567891',
    location: {
      lat: 5.7000,
      lng: -0.2000,
      address: '45 Achimota Road, Ga North Municipal'
    },
    address: '45 Achimota Road, Ga North Municipal',
    latitude: 5.7000,
    longitude: -0.2000,
    status: 'assigned',
    priority: 'medium',
    wasteType: 'Educational',
    waste_type: 'Educational',
    specialInstructions: 'Access through main gate',
    notes: 'Access through main gate',
    scheduledDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    scheduled_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    bags: 8,
    bag_count: 8,
    requestTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    wasteTypes: ['paper', 'plastic'],
    // Database-like structure for compatibility
    requester: {
      id: 'customer-002',
      name: 'Achimota School',
      email: 'admin@achimotaschool.edu.gh',
      phone: '+233234567891'
    },
    collector: {
      id: 'collector-002',
      first_name: 'Akosua',
      last_name: 'Mensah',
      email: 'akosua.mensah@trashdrop.com'
    },
    collectorName: 'Akosua Mensah'
  },
  {
    id: '3',
    requester_id: 'customer-003',
    collector_id: 'collector-001',
    customer: 'East Legon Residential',
    phone: '+233245567892',
    location: {
      lat: 5.6000,
      lng: -0.1500,
      address: '12 Tema Station Road, Ga East Municipal'
    },
    address: '12 Tema Station Road, Ga East Municipal',
    latitude: 5.6000,
    longitude: -0.1500,
    status: 'completed',
    priority: 'low',
    wasteType: 'Residential',
    waste_type: 'Residential',
    specialInstructions: 'Household waste only',
    notes: 'Household waste only',
    scheduledDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    scheduled_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    bags: 5,
    bag_count: 5,
    requestTime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    wasteTypes: ['organic', 'plastic'],
    // Database-like structure for compatibility
    requester: {
      id: 'customer-003',
      name: 'East Legon Residential',
      email: 'contact@eastlegon.com',
      phone: '+233245567892'
    },
    collector: {
      id: 'collector-001',
      first_name: 'Kwame',
      last_name: 'Asante',
      email: 'kwame.asante@trashdrop.com'
    },
    collectorName: 'Kwame Asante'
  }
];

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
  limit = 100 
} = {}) => {
  try {
    // Normalize status to lowercase to match database values
    const normalizedStatus = status ? status.toLowerCase() : null;
    console.log('fetchPickupRequests called with:', { status, normalizedStatus, collectorId, limit });

    const parsePointString = (value) => {
      if (!value || typeof value !== 'string') return null;
      const match = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
      if (!match) return null;
      const a = Number(match[1]);
      const b = Number(match[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

      // In PostGIS, POINT(x y) is typically (lng lat).
      // However, some schemas store it reversed. For the admin portal/live map,
      // we prefer values that look like a valid (lat,lng) pair for Ghana.
      // Heuristic: pick the interpretation whose latitude is within [-90,90]
      // and longitude within [-180,180]; if both are valid, prefer lat=a, lng=b
      // since the DB screenshot shows POINT(5.67 -0.28) which matches (lat,lng).
      const asLngLat = { lng: a, lat: b };
      const asLatLng = { lat: a, lng: b };

      const isValid = (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180;

      if (isValid(asLatLng)) return asLatLng;
      if (isValid(asLngLat)) return asLngLat;
      return null;
    };
    
    // Check if both pickup_requests and profiles tables exist before making query
    const pickupTableExists = await safeDatabaseService.checkTableExists('pickup_requests');
    const profilesTableExists = await safeDatabaseService.checkTableExists('profiles');
    const collectorsTableExists = await safeDatabaseService.checkTableExists('collector_profiles');
    
    console.log('Table existence check:', { 
      pickupTableExists, 
      profilesTableExists, 
      collectorsTableExists 
    });
    
    if (!pickupTableExists) {
      console.warn('Pickup requests table does not exist, using mock data');
      let mockData = generateMockPickupRequests();
      console.log('Generated mock data:', mockData.length, 'items');
      
      // Apply filters to mock data with comprehensive null safety
      if (status) {
        console.log('Filtering mock data by status:', status);
        mockData = mockData.filter(request => {
          if (!request) {
            console.warn('Found null/undefined request in mock data');
            return false;
          }
          if (typeof request !== 'object') {
            console.warn('Found non-object request in mock data:', typeof request, request);
            return false;
          }
          if (!request.hasOwnProperty('status') || request.status == null) {
            console.warn('Found request without status property:', request);
            return false;
          }
          return request.status.toLowerCase() === normalizedStatus;
        });
        console.log('Filtered mock data result:', mockData.length, 'items');
      }
      
      if (collectorId) {
        mockData = mockData.filter(request => request.collector_id === collectorId);
      }
      
      return mockData.slice(0, limit);
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
      mockDataFn: generateMockPickupRequests,
      mockDataParams: { status: normalizedStatus, limit }
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
          console.log(`✅ Found ${dbResult.data.length} rows in 'digital_bins'`);
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
          console.log(`✅ Found ${spResult.data.length} rows in 'scheduled_pickups'`);
          const tagged = spResult.data.map(r => ({ ...r, _source: 'scheduled_pickups' }));
          result.data = [...(result.data || []), ...tagged];
        }
      }
    } catch (altError) {
      console.warn('⚠️ Error fetching from alternative pickup tables:', altError);
    }
    
    if (result.fromFallback) {
      let mockData = result.data || [];
      
      // Apply filters to mock data with comprehensive null safety
      if (status) {
        console.log('Filtering fallback data by status:', status);
        mockData = mockData.filter(request => {
          if (!request) {
            console.warn('Found null/undefined request in fallback data');
            return false;
          }
          if (typeof request !== 'object') {
            console.warn('Found non-object request in fallback data:', typeof request, request);
            return false;
          }
          if (!request.hasOwnProperty('status') || request.status == null) {
            console.warn('Found request without status property in fallback data:', request);
            return false;
          }
          return request.status.toLowerCase() === normalizedStatus;
        });
        console.log('Filtered fallback data result:', mockData.length, 'items');
      }
      
      return mockData.slice(0, limit);
    }
    
    // If we have real data, fetch related profiles, collector names, and locations
    if (result.data && result.data.length > 0) {
      try {
        // 1. Fetch requester profiles from 'profiles' table
        // profiles.id = auth.users.id = digital_bins.user_id = pickup_requests.user_id
        const allUserIds = [...new Set(result.data.map(r => r.user_id).filter(Boolean))];
        console.log('📋 Fetching profiles for user IDs:', allUserIds);
        const profileMap = {};

        if (profilesTableExists && allUserIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone, avatar_url, address')
            .in('id', allUserIds);
          
          if (profileError) {
            console.warn('❌ Error fetching profiles:', profileError);
          } else {
            console.log('✅ Fetched profiles:', profiles?.length || 0);
            if (profiles) {
              profiles.forEach(profile => {
                profileMap[profile.id] = profile;
              });
            }
          }

          // Log any user_ids that had no matching profile
          const missingIds = allUserIds.filter(uid => !profileMap[uid]);
          if (missingIds.length > 0) {
            console.warn('⚠️ No profiles found for user_ids:', missingIds);
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
              console.log('✅ Found contacts fallback:', contacts.length);
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
            console.log('ℹ️ Contacts fallback skipped:', contactErr.message);
          }

          // Try get_user_emails RPC for remaining missing profiles
          missingProfileIds = allUserIds.filter(uid => !profileMap[uid]);
          if (missingProfileIds.length > 0) {
            try {
              const { data: authUsers, error: rpcErr } = await supabase
                .rpc('get_user_emails', { user_ids: missingProfileIds });
              if (!rpcErr && authUsers && authUsers.length > 0) {
                console.log('✅ Found auth emails via RPC:', authUsers.length);
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
              console.log('ℹ️ get_user_emails RPC not available:', rpcErr.message);
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
          console.log('� Resolving collector names for user_ids:', collectorUserIds);
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
              // First try: use RPC with ST_X/ST_Y for reliable coordinate extraction
              let binLocs = null;
              try {
                const idsLiteral = binLocIds.map(id => `'${id}'`).join(',');
                const { data: rpcResult, error: rpcErr } = await supabase.rpc('exec_sql', {
                  query: `SELECT id, location_name, address, ST_Y(coordinates) as latitude, ST_X(coordinates) as longitude FROM bin_locations WHERE id IN (${idsLiteral})`
                });
                if (!rpcErr && rpcResult) {
                  binLocs = rpcResult;
                  console.log('✅ Got bin_locations via RPC:', binLocs.length);
                }
              } catch (rpcErr) {
                console.log('ℹ️ RPC exec_sql not available, falling back to standard query');
              }

              // Fallback: standard query (coordinates may be PostGIS blob)
              if (!binLocs) {
                const { data: stdResult } = await supabase
                  .from('bin_locations')
                  .select('id, location_name, address, coordinates')
                  .in('id', binLocIds);
                binLocs = stdResult;
                console.log('ℹ️ Got bin_locations via standard query:', binLocs?.length, 'coords type:', binLocs?.[0]?.coordinates ? typeof binLocs[0].coordinates : 'N/A');
              }
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
                  console.log('🔍 bin_locations coordinates type:', typeof loc.coordinates, loc.coordinates);
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
                          console.log('✅ Parsed WKB hex → lat:', parsedLat, 'lng:', parsedLng);
                        }
                      } catch (wkbErr) {
                        console.warn('⚠️ Failed to parse WKB hex:', wkbErr);
                      }
                    }
                  }
                  if (parsedLat != null) {
                    console.log(`✅ Parsed location: lat=${parsedLat}, lng=${parsedLng}`);
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
      console.log('ℹ️ No data to enrich');
    }

    if (result.error) {
      console.warn('Error fetching pickup requests, using mock data:', result.error);
      let mockData = generateMockPickupRequests();
      
      // Apply filters to mock data with comprehensive null safety
      if (status) {
        console.log('Filtering error fallback data by status:', status);
        mockData = mockData.filter(request => {
          if (!request) {
            console.warn('Found null/undefined request in error fallback data');
            return false;
          }
          if (typeof request !== 'object') {
            console.warn('Found non-object request in error fallback data:', typeof request, request);
            return false;
          }
          if (!request.hasOwnProperty('status') || request.status == null) {
            console.warn('Found request without status property in error fallback data:', request);
            return false;
          }
          return request.status.toLowerCase() === normalizedStatus;
        });
        console.log('Filtered error fallback data result:', mockData.length, 'items');
      }
      
      return mockData.slice(0, limit);
    }

    // Transform the data to match the expected format with comprehensive null safety
    const rawData = result.data || [];
    console.log('Processing raw data:', rawData.length, 'items');
    
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
          lat: (point?.lat ?? locationData.latitude ?? locationData.lat ?? request.latitude ?? (request.location ? request.location.lat : null) ?? 5.6037),
          lng: (point?.lng ?? locationData.longitude ?? locationData.lng ?? request.longitude ?? (request.location ? request.location.lng : null) ?? -0.1870)
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
    
    console.log('Final transformed data:', transformedData.length, 'items');
    return transformedData;
    
  } catch (error) {
    console.error('Error in fetchPickupRequests:', error);
    let mockData = generateMockPickupRequests();
    
    // Apply filters to mock data with comprehensive null safety
    if (status) {
      console.log('Filtering catch block data by status:', status);
      mockData = mockData.filter(request => {
        if (!request) {
          console.warn('Found null/undefined request in catch block data');
          return false;
        }
        if (typeof request !== 'object') {
          console.warn('Found non-object request in catch block data:', typeof request, request);
          return false;
        }
        if (!request.hasOwnProperty('status') || request.status == null) {
          console.warn('Found request without status property in catch block data:', request);
          return false;
        }
        return (request.status || '').toLowerCase() === (status || '').toLowerCase();
      });
      console.log('Filtered catch block data result:', mockData.length, 'items');
    }
    
    return mockData.slice(0, limit);
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

/**
 * Updates the status of a pickup request
 * @param {string} requestId - The ID of the pickup request
 * @param {Object} updateData - Data to update (status, collector_id, etc.)
 * @returns {Promise<Object>} The updated pickup request
 */
export const updatePickupStatus = async (requestId, updateData = {}) => {
  if (!requestId) {
    console.error('No request ID provided for status update');
    return {
      error: 'Missing request ID',
      success: false
    };
  }
  
  console.log(`Updating pickup request ${requestId} with data:`, updateData);
  
  try {
    // Extract common parameters
    const status = updateData.status;
    
    // Check if pickup_requests table exists
    const tableExists = await safeDatabaseService.checkTableExists('pickup_requests');
    if (!tableExists) {
      console.warn(`Table pickup_requests does not exist. Simulating update for request ${requestId}`);
      // Return a mock success response with the data that would have been updated
      return {
        id: requestId,
        ...updateData,
        updated_at: new Date().toISOString(),
        success: true,
        mock: true
      };
    }
    
    // Prepare the update data with appropriate timestamps
    let dbUpdateData = { ...updateData };
    
    // Only set timestamps if not explicitly provided in updateData
    if (status) {
      // Handle different status mappings and set appropriate timestamps
      if ((status === 'assigned' || status === 'accepted') && !dbUpdateData.assigned_at) {
        dbUpdateData.assigned_at = new Date().toISOString();
      }
      
      // If status is 'in_progress' or 'picked_up', set collection timestamp
      if ((status === 'in_progress' || status === 'picked_up') && !dbUpdateData.picked_up_at) {
        dbUpdateData.picked_up_at = new Date().toISOString();
      }
      
      // If status is 'completed' or 'disposed', set completion timestamp
      if ((status === 'completed' || status === 'disposed') && !dbUpdateData.completed_at) {
        dbUpdateData.completed_at = new Date().toISOString();
      }
    }
    
    // Always set updated_at timestamp
    if (!dbUpdateData.updated_at) {
      dbUpdateData.updated_at = new Date().toISOString();
    }
    
    // Execute the update with error handling for database errors
    try {
      const { data, error } = await supabase
        .from('pickup_requests')
        .update(dbUpdateData)
        .eq('id', requestId)
        .select()
        .single();
        
      if (error) {
        // Detect specific PostgreSQL error codes
        if (error.code === 'PGRST116' || error.code === '42P01' || error.code === 'PGRST204') {
          console.warn(`Table not found when updating pickup request ${requestId}:`, error);
        } else if (error.code === '42703') {
          console.warn(`Column not found when updating pickup request ${requestId}:`, error);
        } else {
          console.warn(`Error updating pickup request ${requestId}:`, error);
        }
        
        // Return a mock success response with the input data
        return {
          id: requestId,
          ...updateData,
          updated_at: new Date().toISOString(),
          success: true,
          mock: true,
          error_code: error.code
        };
      }
      
      return {
        ...data,
        success: true
      };
    } catch (dbError) {
      console.error(`Database error updating pickup request ${requestId}:`, dbError);
      // Return a mock success response for any other database errors
      return {
        id: requestId,
        ...updateData,
        updated_at: new Date().toISOString(),
        success: true,
        mock: true,
        error: dbError.message
      };
    }
  } catch (error) {
    console.error(`Error in updatePickupStatus for request ${requestId}:`, error);
    // Return a structured error response rather than throwing
    return {
      id: requestId,
      error: error.message,
      success: false
    };
  }
};

/**
 * Subscribes to real-time updates for pickup requests
 * @param {Function} callback - Callback function to handle updates
 * @param {Object} options - Subscription options
 * @param {string} options.event - Event type ('INSERT', 'UPDATE', 'DELETE', '*')
 * @param {Object} options.filter - Filter conditions
 * @returns {Object} Subscription object with unsubscribe method
 */
export const subscribeToPickupUpdates = async (callback, options = {}) => {
  if (!callback || typeof callback !== 'function') {
    console.error('Invalid callback provided to subscribeToPickupUpdates');
    return {
      unsubscribe: () => {}
    };
  }
  
  // Check if pickup_requests table exists before subscribing
  const tableExists = await safeDatabaseService.checkTableExists('pickup_requests');
  
  if (!tableExists) {
    console.warn('Pickup requests table does not exist, returning mock subscription');
    // Return a mock subscription that does nothing
    return {
      unsubscribe: () => console.log('Unsubscribing from mock pickup updates subscription'),
      mock: true
    };
  }
  
  try {
    // Set default options
    const event = options.event || '*';
    const filter = options.filter || {};
    
    // Set up the subscription with the specified options
    const subscription = supabase
      .channel(`pickup_requests_changes_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: event,
          schema: 'public',
          table: 'pickup_requests',
          ...filter
        },
        (payload) => {
          try {
            callback(payload);
          } catch (callbackError) {
            console.error('Error in pickup updates callback:', callbackError);
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(subscription);
      }
    };
  } catch (error) {
    console.warn('Error setting up real-time subscription:', error);
    // Return a mock subscription that does nothing
    return {
      unsubscribe: () => console.log('Unsubscribing from failed pickup updates subscription')
    };
  }
};

// Alias for backward compatibility
/**
 * Updates a pickup request with the specified data
 * @param {string} requestId - The ID of the pickup request to update
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object>} The updated pickup request
 */
export const updatePickupRequest = updatePickupStatus;
