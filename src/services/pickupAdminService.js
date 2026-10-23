/**
 * Data layer for the Pickup Requests page.
 *
 * Reads go through the admin_pickup_requests view (supabase/migrations/
 * 20261015_pickup_requests_admin.sql): server-side paging, sorting, filters
 * and exact counts over pickup_requests, digital_bins and scheduled_pickups.
 * Until that migration is run, everything falls back to the existing loader
 * and is filtered in the browser.
 *
 * Writes go to the row's own table and throw on any error; nothing is ever
 * reported as saved when it wasn't.
 */
import { supabase } from '../utils/supabase';
import { logFailure } from './auditLogService';
import { fetchPickupRequests } from '../utils/pickupService';
import {
  PAGE_SIZE, normalizeViewRow, normalizeLoaderRow, applyFilters, sortRows, statusFilterValues, requestDateBounds,
} from '../utils/pickupRequestUtils';
import { canTransition, canonicalStatus, dbStatusFor, statusLabel, rawValuesForGroup, IN_PROGRESS_STATUSES } from '../constants/pickupStatus';

const VIEW = 'admin_pickup_requests';
const TABLES = { pickup_requests: 'pickup_requests', digital_bins: 'digital_bins', scheduled_pickups: 'scheduled_pickups' };

let viewAvailable = null; // null = unknown, then true/false for this session

const isMissingView = (error) => {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return /42P01|PGRST205|PGRST200|does not exist|Could not find the table/i.test(text) && text.includes(VIEW);
};

/* ── fallback: load everything once, filter in the browser ─────────────── */
let fallbackCache = { at: 0, rows: [] };
const loadAllFallback = async (collectors, { force = false } = {}) => {
  if (!force && Date.now() - fallbackCache.at < 15000) return fallbackCache.rows;
  const raw = await fetchPickupRequests({ limit: 1000, strict: true });
  fallbackCache = { at: Date.now(), rows: raw.map(r => normalizeLoaderRow(r, collectors)) };
  return fallbackCache.rows;
};

const SORT_COLUMNS = { created_at: 'created_at', status: 'status_rank', fee: 'fee', priority: 'priority_rank' };
const cleanSearch = (q) => String(q || '').trim().replace(/[,()*%\\]/g, ' ').trim();

const applyServerFilters = (query, f) => {
  const statuses = statusFilterValues(f.status);
  if (statuses) query = query.in('status', statuses);
  if (f.priority) query = query.eq('priority', f.priority);
  if (f.collector) query = query.eq('collector_profile_id', f.collector);
  if (f.source) query = query.eq('source', f.source);
  if (f.unassigned) query = query.is('collector_ref', null);
  const { from, to } = requestDateBounds(f);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lt('created_at', to);
  const q = cleanSearch(f.q);
  if (q) query = query.or(['id', 'customer_name', 'customer_email', 'customer_phone', 'address', 'collector_name'].map(c => `${c}.ilike.*${q}*`).join(','));
  return query;
};

/**
 * One page of requests.
 * @returns {Promise<{ rows: object[], total: number, mode: 'server'|'browser' }>}
 */
export const fetchRequestPage = async (filters, collectors = [], { force = false } = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  if (viewAvailable !== false) {
    let query = supabase.from(VIEW).select('*', { count: 'exact' });
    query = applyServerFilters(query, filters);
    const col = SORT_COLUMNS[filters.sort] || 'created_at';
    query = query.order(col, { ascending: filters.dir === 'asc', nullsFirst: false }).order('created_at', { ascending: false });
    const { data, error, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (!error) {
      viewAvailable = true;
      return { rows: (data || []).map(normalizeViewRow), total: count ?? 0, mode: 'server' };
    }
    if (!isMissingView(error)) throw error;
    viewAvailable = false;
  }
  const all = await loadAllFallback(collectors, { force });
  const filtered = sortRows(applyFilters(all, filters), filters.sort, filters.dir);
  return { rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: filtered.length, mode: 'browser' };
};

/** Every row matching the filters (CSV export) */
export const fetchAllMatching = async (filters, collectors = []) => {
  if (viewAvailable) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      let query = applyServerFilters(supabase.from(VIEW).select('*'), filters);
      const { data, error } = await query.order('created_at', { ascending: false }).range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []).map(normalizeViewRow));
      if (!data || data.length < 1000) break;
    }
    return sortRows(out, filters.sort, filters.dir);
  }
  return sortRows(applyFilters(await loadAllFallback(collectors), filters), filters.sort, filters.dir);
};

/**
 * Light rows for the overall stats cards, collector job counts and
 * duplicate checks (all requests, unfiltered).
 */
const SUMMARY_COLUMNS = [
  // fee, payout and rating feed collectorJobCounts(); customer_rating needs the latest view
  'id, source, status, created_at, user_id, customer_name, address, lat, lng, bag_count, fee, priority, is_urgent, collector_ref, collector_profile_id, collector_user_id, completed_at, collector_total_payout, customer_rating',
  'id, source, status, created_at, user_id, customer_name, address, lat, lng, bag_count, fee, priority, is_urgent, collector_ref, collector_profile_id, collector_user_id, completed_at, collector_total_payout',
];

export const fetchSummaryRows = async (collectors = []) => {
  if (viewAvailable === null) {
    // Not probed yet (the Collectors page has no table query): check the view exists
    const { error } = await supabase.from(VIEW).select('id').limit(1);
    if (error && !isMissingView(error)) throw error;
    viewAvailable = !error;
  }
  if (viewAvailable) {
    for (const columns of SUMMARY_COLUMNS) {
      const out = [];
      let failed = null;
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from(VIEW)
          .select(columns)
          .order('created_at', { ascending: false })
          .range(from, from + 999);
        if (error) { failed = error; break; }
        out.push(...(data || []).map(normalizeViewRow));
        if (!data || data.length < 1000) break;
      }
      if (!failed) return out;
      if (columns === SUMMARY_COLUMNS[SUMMARY_COLUMNS.length - 1]) throw failed;
    }
  }
  return loadAllFallback(collectors);
};

/** Pending requests with no collector, for assigning */
export const fetchUnassignedPending = async (collectors = []) => {
  const rows = await fetchSummaryRows(collectors);
  return rows.filter(r => canonicalStatus(r.status) === 'pending' && !r.collectorRef);
};

/** Unit price of a bag batch (pickup request fees) */
export const fetchBatchPrice = async (batchId) => {
  if (!batchId) return null;
  const { data, error } = await supabase.from('batches').select('unit_price').eq('id', batchId).maybeSingle();
  if (error || !data) return null;
  return data.unit_price ?? null;
};

/**
 * The pricing zone price for a bin size at a location (digital bin fees), as
 * the household app prices it: get_covering_pricing_zone, column price_<size>l.
 * @returns {Promise<{ price: number, name: string|null }|null>} null when unknown
 */
export const fetchZoneBinPrice = async (lat, lng, binSizeLiters) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { data, error } = await supabase.rpc('get_covering_pricing_zone', { p_latitude: lat, p_longitude: lng });
  const zone = Array.isArray(data) ? data[0] : data;
  if (error || !zone) return null;
  const price = parseFloat(zone[`price_${binSizeLiters || 120}l`]);
  if (!Number.isFinite(price) || price <= 0) return null;
  return { price, name: zone.suburb || zone.name || zone.zone_name || null };
};

/* ── actions ────────────────────────────────────────────────────────────── */

const update = async (row, payload) => {
  const table = TABLES[row.source];
  if (!table) throw new Error(`Unknown request source: ${row.source}`);
  const { data, error } = await supabase.from(table).update(payload).eq('id', row.id).select('id, status');
  if (error || !data || data.length === 0) {
    const failure = error || new Error('Request not found, or you do not have permission to change it');
    // Successful changes are logged by the td_audit_request trigger; failures only reach us here
    logFailure('request.update_failed', { source: 'requests', entityType: 'pickup_request', entityId: row.id, error: failure,
      context: { table, attempted: payload } });
    throw new Error(failure.message || 'Update failed');
  }
  fallbackCache.at = 0;
  return data[0];
};

/** Assign a collector: status → accepted, collector_id = the collector's auth user id */
export const assignCollector = async (row, collector) => {
  if (canonicalStatus(row.status) !== 'pending') throw new Error(`Only pending requests can be assigned (this one is ${statusLabel(row.status)})`);
  if (!collector?.userId) throw new Error('This collector has no linked user account');
  const payload = { status: 'accepted', collector_id: collector.userId, updated_at: new Date().toISOString() };
  if (row.source === 'pickup_requests') payload.accepted_at = payload.updated_at;
  const saved = await update(row, payload);
  // The status trigger logs the change; tell the collector (best effort, never undoes the assignment)
  await notifyCollector(collector, {
    title: 'New pickup assigned',
    message: `You have a new pickup${row.address ? ` at ${row.address}` : ''} (#${String(row.id).slice(0, 8)}).`,
    type: 'pickup_assigned',
  });
  return saved;
};

/**
 * Put a collector on a job that is already under way but has none (e.g. en
 * route with no collector_id). Pending requests use assignCollector instead.
 */
export const setCollectorOnActiveRequest = async (row, collector) => {
  if (!collector?.userId) throw new Error('This collector has no linked user account');
  if (canonicalStatus(row.status) === 'pending') return assignCollector(row, collector);
  if (!IN_PROGRESS_STATUSES.includes(canonicalStatus(row.status))) throw new Error(`A ${statusLabel(row.status)} request can't be given a collector`);
  const saved = await update(row, { collector_id: collector.userId, updated_at: new Date().toISOString() });
  await notifyCollector(collector, {
    title: 'Pickup assigned to you',
    message: `You have been put on pickup #${String(row.id).slice(0, 8)}${row.address ? ` at ${row.address}` : ''}.`,
    type: 'pickup_assigned',
  });
  return saved;
};

/** In-app notification for a collector (notifications table). Returns false when it could not be sent. */
export const notifyCollector = async (collector, { title, message, type }) => {
  if (!collector?.userId) return false;
  try {
    const { error } = await supabase.from('notifications').insert({ user_id: collector.userId, title, message, type, read: false });
    if (error) {
      console.warn('Collector notification not sent:', error.message);
      logFailure('notification.failed', { source: 'requests', entityType: 'collector', entityId: collector.id, error, context: { title, type } });
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Collector notification not sent:', error);
    return false;
  }
};

/** Move to the next status (en_route, arrived, collecting, disposed) */
export const changeStatus = async (row, to) => {
  if (!canTransition(row.status, to)) throw new Error(`Can't change from ${statusLabel(row.status)} to ${statusLabel(to)}`);
  if (to !== 'cancelled' && !row.collectorRef) throw new Error('Assign a collector first');
  return update(row, { status: dbStatusFor(to, row.source), updated_at: new Date().toISOString() });
};

export const cancelRequest = async (row, { reason, note, userId }) => {
  if (!canTransition(row.status, 'cancelled')) throw new Error(`A ${statusLabel(row.status)} request can't be cancelled`);
  if (!reason) throw new Error('Choose a cancellation reason');
  const now = new Date().toISOString();
  return update(row, {
    status: 'cancelled',
    cancelled_at: now,
    cancelled_by: userId || null,
    cancellation_reason: note ? `${reason}: ${note}` : reason,
    updated_at: now,
  });
};

/** Raw status values in a group (exported for tests) */
export const groupValues = rawValuesForGroup;
