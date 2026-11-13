import { supabase } from './supabase';

/**
 * Pickup requests for the Live Map (and the Pickup Requests page's old
 * browser-side fallback), read from the admin_pickup_requests view: pickup
 * requests and digital bins in one query, with the customer, address,
 * position and collector already joined in the database. The view is
 * security_invoker, so each table's access rules still apply.
 *
 * Until 2026-11-13 this read three tables, checked each one exists, then
 * looked up profiles, contacts, collectors and bin locations separately: up
 * to a dozen queries on every 30-second Live Map refresh.
 *
 * Real data only: a failed read throws (never made-up rows), and a request
 * without coordinates has lat/lng null, never a made-up position.
 */
const VIEW = 'admin_pickup_requests';
const COLUMNS = [
  'id', 'source', 'status', 'created_at', 'user_id', 'customer_name', 'customer_email', 'customer_phone',
  'address', 'lat', 'lng', 'waste_type', 'bag_count', 'bin_size_liters', 'fee', 'is_urgent', 'priority',
  'notes', 'scheduled_date', 'collector_ref', 'collector_profile_id', 'collector_name',
  'collector_total_payout', 'accepted_at', 'picked_up_at',
].join(', ');

const PRIORITY_LABELS = { high: 'High', medium: 'Normal', normal: 'Normal', low: 'Low' };
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Sign-in emails for customers the view has no name, email or phone for
 * (accounts without a profile row, such as WhatsApp guest bookings).
 * get_user_emails answers staff who manage requests only; anything else, or
 * a failure, leaves those customers unnamed.
 */
const emailsFor = async (userIds) => {
  if (userIds.length === 0) return {};
  try {
    const { data, error } = await supabase.rpc('get_user_emails', { user_ids: userIds });
    if (error || !Array.isArray(data)) return {};
    return Object.fromEntries(data.filter((u) => u?.id && u.email).map((u) => [String(u.id), u.email]));
  } catch {
    return {};
  }
};

/** One view row in the shape the Live Map shows */
export const toMapRequest = (row, signInEmail = null) => {
  const email = row.customer_email || signInEmail || null;
  const collectorId = row.collector_profile_id || row.collector_ref || null;
  const collectorName = row.collector_name || null;
  return {
    id: String(row.id),
    source: row.source || 'pickup_requests',
    status: row.status || 'pending',
    requestedBy: {
      id: row.user_id || null,
      name: row.customer_name || (email ? email.split('@')[0] : null),
      email,
      phone: row.customer_phone || null,
    },
    assignedTo: collectorId ? { id: collectorId, name: collectorName } : null,
    requestTime: row.created_at || null,
    scheduledDate: row.scheduled_date || null,
    priority: row.is_urgent ? 'High' : (PRIORITY_LABELS[String(row.priority || '').toLowerCase()] || 'Normal'),
    wasteType: row.waste_type || 'general',
    bags: num(row.bag_count) || 0,
    notes: row.notes || '',
    location: { address: row.address || null, lat: num(row.lat), lng: num(row.lng) },
    phone: row.customer_phone || null,
    collectorId,
    collectorName,
    fee: num(row.fee),
    collectorPayout: num(row.collector_total_payout),
    isUrgent: !!row.is_urgent,
    binSizeLiters: num(row.bin_size_liters),
    acceptedAt: row.accepted_at || null,
    collectedAt: row.picked_up_at || null,
  };
};

/**
 * Newest requests first.
 * @param {Object} [options]
 * @param {string} [options.status] - only this status ('pending', 'accepted', …)
 * @param {string} [options.collectorId] - only this collector (collector profile id)
 * @param {number} [options.limit=100] - most rows returned, across both sources
 * @returns {Promise<Array>} requests; throws when the read fails
 */
export const fetchPickupRequests = async ({ status = null, collectorId = null, limit = 100 } = {}) => {
  let query = supabase.from(VIEW).select(COLUMNS).order('created_at', { ascending: false }).limit(limit);
  if (status) query = query.eq('status', String(status).toLowerCase());
  if (collectorId) query = query.eq('collector_profile_id', collectorId);

  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Could not load pickup requests');
  const rows = data || [];

  const unnamed = [...new Set(rows
    .filter((r) => r.user_id && !r.customer_name && !r.customer_email && !r.customer_phone)
    .map((r) => String(r.user_id)))];
  const emails = await emailsFor(unnamed);
  return rows.map((r) => toMapRequest(r, r.user_id ? emails[String(r.user_id)] : null));
};
