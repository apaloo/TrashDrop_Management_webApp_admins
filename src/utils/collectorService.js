import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';
import { STATUS } from '../config/constants';
import { cleanEmail, zoneOf } from './collectorAdminUtils';
import { logFailure } from '../services/auditLogService';
import { secureUrl } from './secureUrl';

/**
 * Transform collector profile rows into the structure expected by the UI
 */
const transformCollectorData = (profile) => {
  if (!profile) {
    return null;
  }

  const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
  const status = (profile.status ?? STATUS.COLLECTOR.INACTIVE).toLowerCase();

  const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    id: profile.id,
    userId: profile.user_id,
    name: fullName || profile.email || 'Unknown Collector',
    email: profile.email ?? 'No email provided',
    phone: profile.phone ?? 'No phone provided',
    contactNumber: profile.phone ?? null,
    status,
    region: profile.region ?? profile.assigned_region ?? 'Unassigned',
    rating: safeNumber(profile.rating, 0),
    total_collections: safeNumber(profile.total_collections, 0),
    last_active: profile.updated_at,
    lastUpdated: profile.updated_at ?? profile.last_active_at ?? profile.last_active ?? null,
    joined_date: profile.created_at,
    profilePic: secureUrl(profile.profile_image_url) ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'Collector')}&background=random`,
    vehicle: {
      type: profile.vehicle_type ?? 'Truck',
      plate: profile.vehicle_plate ?? profile.license_plate ?? 'N/A',
      capacity: profile.vehicle_capacity ?? 'N/A'
    },
    activeRequests: safeNumber(profile.active_requests, 0),
    completedToday: safeNumber(profile.completed_today, 0),
    // null when not reported (Number(null) is 0, which would read as 0,0)
    currentLocation: {
      lat: profile.current_latitude == null || profile.current_latitude === '' ? null : safeNumber(profile.current_latitude, null),
      lng: profile.current_longitude == null || profile.current_longitude === '' ? null : safeNumber(profile.current_longitude, null)
    },
    stats: {
      completedToday: safeNumber(profile.completed_today, 0),
      pendingPickups: safeNumber(profile.active_requests, 0),
      totalDistance: profile.total_distance ?? '0',
      avgResponseTime: safeNumber(profile.avg_response_time, 0)
    },
    capacityRemaining: safeNumber(profile.capacity_remaining, 0),
    // How full the vehicle is (0–100). No column for this is read yet, so it is 0.
    capacityUsed: safeNumber(profile.capacity_used ?? profile.capacity_percent, 0),
    notes: profile.notes ?? '',
    assignedRegion: profile.assigned_region ?? profile.region ?? 'Unassigned'
  };
};

/**
 * Fetches all collectors with their profile information
 * @param {Object} options - Optional parameters
 * @param {string} options.status - Filter by collector status
 * @param {string} options.region - Filter by region
 * @param {number} options.limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of collector objects with profile data
 */
export const fetchCollectors = async ({ status = null, region = null, limit = 100 } = {}) => {
  const { data } = await safeDatabaseService.safeQuery({
    tableName: 'collector_profiles',
    throwOnMissing: true, // MOCK DATA DEPRECATED - Strict mode only
    enableMock: false, // DEPRECATED: Mock data system removed
    queryFn: async () => {
      let query = supabase
        .from('collector_profiles')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          status,
          vehicle_type,
          vehicle_plate,
          vehicle_capacity,
          company_name,
          created_at,
          updated_at,
          rating,
          total_collections,
          completed_today,
          active_requests,
          current_latitude,
          current_longitude,
          assigned_region,
          profile_image_url,
          notes
        `)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      if (region) {
        query = query.eq('assigned_region', region);
      }

      return query;
    }
  });

  return (data ?? [])
    .map(transformCollectorData)
    .filter(Boolean);
};

/**
 * Fetches a single collector by ID with their profile information
 * @param {string} collectorId - The ID of the collector to fetch
 * @returns {Promise<Object>} Collector object with profile data
 */
export const fetchCollectorById = async (collectorId) => {
  if (!collectorId) {
    throw new Error('Collector ID is required');
  }

  const { data } = await safeDatabaseService.safeQuery({
    tableName: 'collector_profiles',
    throwOnMissing: true, // MOCK DATA DEPRECATED - Strict mode only
    enableMock: false, // DEPRECATED: Mock data system removed
    queryFn: async () =>
      supabase
        .from('collector_profiles')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          status,
          vehicle_type,
          vehicle_plate,
          vehicle_capacity,
          company_name,
          created_at,
          updated_at,
          rating,
          total_collections,
          completed_today,
          active_requests,
          current_latitude,
          current_longitude,
          assigned_region,
          profile_image_url,
          notes
        `)
        .eq('id', collectorId)
        .single()
  });

  return transformCollectorData(data);
};

/**
 * Updates a collector's status
 * @param {string} collectorId - The ID of the collector to update
 * @param {string} status - The new status ('active', 'inactive', 'on_break', etc.)
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object>} The updated collector object
 */
export const updateCollectorStatus = async (collectorId, status, additionalData = {}) => {
  if (!collectorId) {
    throw new Error('Collector ID is required to update status');
  }

  const payload = {
    status,
    updated_at: new Date().toISOString(),
    ...additionalData
  };

  const { data } = await safeDatabaseService.safeQuery({
    tableName: 'collector_profiles',
    throwOnMissing: true, // MOCK DATA DEPRECATED - Strict mode only
    enableMock: false, // DEPRECATED: Mock data system removed
    queryFn: async () =>
      supabase
        .from('collector_profiles')
        .update(payload)
        .eq('id', collectorId)
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          status,
          vehicle_type,
          vehicle_plate,
          vehicle_capacity,
          company_name,
          created_at,
          updated_at,
          rating,
          total_collections,
          completed_today,
          active_requests,
          current_latitude,
          current_longitude,
          assigned_region,
          profile_image_url,
          notes
        `)
  });

  const updatedRow = Array.isArray(data) ? data[0] : data;
  return transformCollectorData(updatedRow);
};

/**
 * Collectors for the Live Map: fetchCollectors() plus when each collector's
 * location was last reported and the PostGIS current_location point (the
 * collector app's update_collector_location RPC writes both). Read in a
 * separate, best-effort query so a missing column can't break the list.
 */
export const fetchCollectorsForMap = async () => {
  const collectors = await fetchCollectors();
  const ids = collectors.map(c => c.id);
  if (!ids.length) return collectors;

  const attempts = [
    'id, location_updated_at, last_active, current_location, license_plate',
    'id, location_updated_at, last_active, current_location',
    'id, location_updated_at, last_active',
    'id, location_updated_at',
  ];
  let extras = [];
  for (const columns of attempts) {
    const { data, error } = await supabase.from('collector_profiles').select(columns).in('id', ids);
    if (!error) { extras = data || []; break; }
  }
  const byId = Object.fromEntries(extras.map(e => [e.id, e]));
  return collectors.map(c => ({
    ...c,
    locationUpdatedAt: byId[c.id]?.location_updated_at || null,
    lastActive: byId[c.id]?.last_active || null,
    currentLocationPoint: byId[c.id]?.current_location || null,
    // The collector app stores the registration in license_plate
    vehicleRegistration: [byId[c.id]?.license_plate, c.vehicle?.plate].find(v => v && v !== 'N/A') || null,
  }));
};

// Add other collector-related functions as needed

/* ── Collectors page ────────────────────────────────────────────────────── */

const blankToNull = (v) => (v === null || v === undefined || String(v).trim() === '' || String(v).trim().toUpperCase() === 'N/A' ? null : v);

/** collector_profiles row → Collectors page shape (raw values: no 'Truck' / 'N/A' / 5.0 defaults) */
export const toAdminCollector = (profile) => {
  const base = transformCollectorData(profile);
  const has = (k) => Object.prototype.hasOwnProperty.call(profile, k);
  const lastActive = profile.last_active || profile.last_active_at || null;
  // updated_at changes on any admin edit, so it only stands in for "last seen"
  // when the table has no location timestamp columns at all
  const hasLocationClock = has('location_updated_at') || has('last_active') || has('last_active_at');
  const capacity = blankToNull(profile.vehicle_capacity_bags) ?? (Number.isFinite(Number(profile.vehicle_capacity)) && blankToNull(profile.vehicle_capacity) !== null ? Number(profile.vehicle_capacity) : null);
  return {
    ...base,
    firstName: profile.first_name || '',
    lastName: profile.last_name || '',
    // The collector app copies the phone number into email; that is not an email
    email: cleanEmail(profile.email),
    phone: blankToNull(profile.phone),
    zone: zoneOf(profile.assigned_region),
    signupRegion: blankToNull(profile.region),
    vehicleType: blankToNull(profile.vehicle_type),
    vehicleRegistration: blankToNull(profile.license_plate) ?? blankToNull(profile.vehicle_plate),
    vehicleCapacityBags: capacity,
    avatar: secureUrl(profile.profile_image_url) || null,
    joinDate: profile.created_at || null,
    locationUpdatedAt: profile.location_updated_at || null,
    lastActive,
    lastUpdated: hasLocationClock ? null : base.lastUpdated,
    currentLocationPoint: profile.current_location || null,
    deactivationReason: profile.deactivation_reason || null,
    deactivatedAt: profile.deactivated_at || null,
  };
};

/** Every collector with all stored columns (select * never fails on a missing column) */
export const fetchCollectorsAdmin = async () => {
  const { data, error } = await supabase
    .from('collector_profiles')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message || 'Could not load collectors');
  return (data || []).map(toAdminCollector);
};

const missingColumn = (error) => {
  const m = /'([a-z_]+)' column|column "?([a-z_]+)"? (?:of relation \S+ )?does not exist/i.exec(error?.message || '');
  return m ? (m[1] || m[2]) : null;
};

/**
 * Insert/update that drops optional columns the table doesn't have yet
 * (before the 20261016 migration) instead of failing.
 * @returns {Promise<{ row: object, skipped: string[] }>}
 */
const writeProfile = async (run, payload, optional, auditContext = {}) => {
  try {
    return await writeProfileOnce(run, payload, optional);
  } catch (error) {
    // Successful changes are logged by the td_audit_collector trigger; failures only reach us here
    logFailure('collector.update_failed', { source: 'collectors', entityType: 'collector', entityId: auditContext.id || null, error,
      context: { attempted: Object.keys(payload), operation: auditContext.operation || 'update' } });
    throw error;
  }
};

const writeProfileOnce = async (run, payload, optional) => {
  const body = { ...payload };
  const skipped = [];
  for (let i = 0; i <= optional.length; i += 1) {
    const { data, error } = await run(body);
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Collector not found, or you do not have permission to change it');
      return { row, skipped };
    }
    const col = missingColumn(error);
    if (col && optional.includes(col) && col in body) {
      delete body[col];
      skipped.push(col);
      continue;
    }
    if (error.code === '23505' || /duplicate/i.test(error.message || '')) {
      throw new Error('Another collector already uses this phone number or email');
    }
    throw new Error(error.message || 'Save failed');
  }
  throw new Error('Save failed');
};

const OPTIONAL_COLUMNS = ['vehicle_capacity_bags', 'vehicle_plate', 'license_plate', 'deactivation_reason', 'deactivated_at', 'deactivated_by', 'region'];

const profilePayload = (v) => ({
  first_name: v.firstName,
  last_name: v.lastName || '',
  email: v.email,
  phone: v.phone,
  status: v.status,
  assigned_region: v.zone,
  vehicle_type: v.vehicleType,
  // The collector app reads license_plate; older admin code read vehicle_plate. Keep both.
  license_plate: v.vehicleRegistration,
  vehicle_plate: v.vehicleRegistration,
  vehicle_capacity_bags: v.vehicleCapacityBags,
  notes: v.notes,
});

/**
 * Collectors already using this phone (any format) or email, other than excludeId.
 * Checked on the server so it also covers rows not loaded on the page.
 */
export const findCollectorClashes = async ({ phone, email }, excludeId = null) => {
  const ors = [];
  if (phone) {
    const d = phone.replace(/\D/g, '').slice(-9);
    ['+233', '233', '0', ''].forEach(p => ors.push(`phone.eq.${p}${d}`));
  }
  if (email) ors.push(`email.eq.${email}`);
  if (!ors.length) return [];
  const { data, error } = await supabase.from('collector_profiles').select('id, first_name, last_name, phone, email').or(ors.join(','));
  if (error) return []; // the database trigger is the final check
  return (data || []).filter(r => r.id !== excludeId);
};

/** Add a collector (values from validateCollectorForm) */
export const createCollectorProfile = async (values) => {
  const payload = {
    ...profilePayload(values),
    // The collector app's signup region; use the zone until the collector signs in
    region: values.zone || 'Unassigned',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { row, skipped } = await writeProfile(
    (body) => supabase.from('collector_profiles').insert(body).select('*').single(),
    payload, OPTIONAL_COLUMNS, { operation: 'create' },
  );
  return { collector: toAdminCollector(row), skipped };
};

/** Edit a collector (values from validateCollectorForm). Status changes go through setCollectorActive. */
export const updateCollectorProfile = async (id, values) => {
  const payload = { ...profilePayload(values), updated_at: new Date().toISOString() };
  delete payload.status;
  const { row, skipped } = await writeProfile(
    (body) => supabase.from('collector_profiles').update(body).eq('id', id).select('*'),
    payload, OPTIONAL_COLUMNS, { id, operation: 'edit' },
  );
  return { collector: toAdminCollector(row), skipped };
};

/**
 * Deactivate (reason required) or reactivate a collector. The
 * log_collector_status_change trigger writes both to the logs table.
 */
export const setCollectorActive = async (id, active, { reason = null, userId = null } = {}) => {
  if (!active && !String(reason || '').trim()) throw new Error('Enter a reason for deactivating');
  const now = new Date().toISOString();
  const payload = active
    ? { status: 'active', deactivation_reason: null, deactivated_at: null, deactivated_by: null, updated_at: now }
    : { status: 'inactive', deactivation_reason: String(reason).trim(), deactivated_at: now, deactivated_by: userId, updated_at: now };
  const { row, skipped } = await writeProfile(
    (body) => supabase.from('collector_profiles').update(body).eq('id', id).select('*'),
    payload, OPTIONAL_COLUMNS, { id, operation: active ? 'reactivate' : 'deactivate' },
  );
  return { collector: toAdminCollector(row), skipped };
};
