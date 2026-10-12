/**
 * Bag Management data: batches and bags with their worked-out step
 * (views admin_bag_batches / admin_bag_items), the cards (admin_bag_stats)
 * and archive / restore. Everything is filtered, sorted and paged in the
 * database. See supabase/migrations/20261019_bag_batches_admin.sql.
 */
import { supabase } from '../utils/supabase';
import { logFailure } from './auditLogService';
import { normalizeBatch, normalizeBag, cleanBatchSearch, dateBounds, groupBagEvents } from '../utils/bagUtils';

const MIGRATION = 'supabase/migrations/20261019_bag_batches_admin.sql, 20261020_bag_history.sql and 20261021_generate_batches.sql';

const isMissingSchema = (error) => ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code)
  || /does not exist|could not find/i.test(error?.message || '');

const fail = (error, what) => {
  if (isMissingSchema(error)) {
    const e = new Error(`${what}: the database is missing the Bag Management update. Run ${MIGRATION} in Supabase.`);
    e.code = 'MISSING_SCHEMA';
    return e;
  }
  return new Error(`${what}: ${error?.message || 'unknown error'}`);
};

const applyBatchFilters = (query, f) => {
  if (!f.stage) query = query.neq('stage', 'archived');
  else query = query.eq('stage', f.stage);
  const q = cleanBatchSearch(f.q);
  if (q) query = query.ilike('search_text', `%${q}%`);
  const { from, to } = dateBounds(f);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lt('created_at', to);
  if (f.min > 0) query = query.gte('scanned_pct', f.min);
  return query;
};

/** One page of batches for the filters (q, stage, from, to, sort, dir, page, size) */
export const fetchBatchPage = async (f) => {
  const size = f.size || 10;
  const start = (Math.max(1, f.page || 1) - 1) * size;
  const { data, error, count } = await applyBatchFilters(supabase.from('admin_bag_batches').select('*', { count: 'exact' }), f)
    .order(f.sort || 'created_at', { ascending: f.dir === 'asc', nullsFirst: false })
    .order('id', { ascending: true })
    .range(start, start + size - 1);
  if (error) throw fail(error, 'Could not load batches');
  return { rows: (data || []).map(normalizeBatch), total: count || 0 };
};

export const fetchBatch = async (id) => {
  const { data, error } = await supabase.from('admin_bag_batches').select('*').eq('id', id).maybeSingle();
  if (error) throw fail(error, 'Could not load the batch');
  return data ? normalizeBatch(data) : null;
};

/** One page of a batch's bags, in bag-number order */
export const fetchBatchBags = async (batchId, { page = 1, size = 10 } = {}) => {
  const start = (Math.max(1, page) - 1) * size;
  const { data, error, count } = await supabase.from('admin_bag_items').select('*', { count: 'exact' })
    .eq('batch_id', batchId).order('bag_no', { ascending: true }).range(start, start + size - 1);
  if (error) throw fail(error, 'Could not load the bags');
  return { rows: (data || []).map(normalizeBag), total: count || 0 };
};

/** Every batch matching the filters (CSV export), up to 5000 */
export const fetchAllBatches = async (f) => {
  const { data, error } = await applyBatchFilters(supabase.from('admin_bag_batches').select('*'), f)
    .order(f.sort || 'created_at', { ascending: f.dir === 'asc', nullsFirst: false }).order('id').limit(5000);
  if (error) throw fail(error, 'Could not export batches');
  return (data || []).map(normalizeBatch);
};

/**
 * A batch's history: its bags (with scan counts) and each bag's timeline.
 * Read from views, so no join through scans.scanned_by is needed.
 */
export const fetchBatchHistory = async (batchId) => {
  const [bags, events] = await Promise.all([
    supabase.from('admin_bag_items').select('*').eq('batch_id', batchId).order('bag_no', { ascending: true }).limit(1000),
    supabase.from('admin_bag_events').select('*').eq('batch_id', batchId).order('at', { ascending: true }).limit(5000),
  ]);
  if (bags.error) throw fail(bags.error, 'Could not load the bags');
  if (events.error) throw fail(events.error, 'Could not load the scan history');
  return { bags: (bags.data || []).map(normalizeBag), events: groupBagEvents(events.data) };
};

/** Bag History cards: totals, scanned / collected, scans per day for the last `days` days */
export const fetchHistoryStats = async (days = 30) => {
  const { data, error } = await supabase.rpc('admin_bag_history_stats', { p_days: days });
  if (error) throw fail(error, 'Could not load history numbers');
  return data || {};
};

/** The newest batches (Generate Bags page) */
export const fetchRecentBatches = async (limit = 10) => {
  const { data, error } = await supabase.from('admin_bag_batches').select('*')
    .order('created_at', { ascending: false }).order('id').limit(limit);
  if (error) throw fail(error, 'Could not load recent batches');
  return (data || []).map(normalizeBatch);
};

/**
 * Create batches and their bags in one database transaction (all or nothing).
 * values come from validateGenerateForm; the database checks them again.
 */
export const generateBatches = async ({ type, size, bags, batches, price, prefix }, maxTotal) => {
  const { data, error } = await supabase.rpc('admin_generate_batches', {
    p_type: type, p_size: size, p_bags_per_batch: bags, p_batches: batches,
    p_price_per_batch: price, p_qr_prefix: prefix || null, p_max_total: maxTotal,
  });
  if (error) {
    logFailure('batch.update_failed', { source: 'bags', entityType: 'batch', error, context: { operation: 'generate', type, size, bags, batches } });
    if (error.code === '23514' || error.code === 'P0001' || error.code === '23505') throw new Error(error.message);
    throw fail(error, 'Batches not generated');
  }
  return data;
};

/** Numbers for the Live Bag Requests and Performance cards */
export const fetchBagStats = async () => {
  const { data, error } = await supabase.rpc('admin_bag_stats');
  if (error) throw fail(error, 'Could not load bag numbers');
  return data || {};
};

/** Archive (hide) or restore a batch. Does not change the household app's status. */
export const setBatchArchived = async (batchId, archived) => {
  const { error } = await supabase.rpc('admin_set_batch_archived', { p_batch_id: batchId, p_archived: archived });
  if (error) {
    logFailure('batch.update_failed', { source: 'bags', entityType: 'batch', entityId: batchId, error, context: { operation: archived ? 'archive' : 'restore' } });
    throw fail(error, archived ? 'Batch not archived' : 'Batch not restored');
  }
};
