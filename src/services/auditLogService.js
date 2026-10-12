/**
 * The audit trail (public.logs).
 *
 * Writing: logAudit() is the one helper the app uses. It calls the log_audit
 * database function, which fills in who is signed in (id, name, role) and the
 * browser's user agent (from the request headers). Data changes (request
 * status / collector, collector edits, alert timeline) are written by database
 * triggers through the same function, so the app does not log them twice;
 * logAudit() covers what the database can't see: sign-in / sign-out, failed
 * calls, exports. It never throws: logging must not break the action itself.
 *
 * Reading: server-side filters, search, counts and paging for the Logs page
 * and the History panels.
 */
import { supabase } from '../utils/supabase';
import { normalizeLog, rangeBounds, cleanLogSearch } from '../utils/logUtils';

/**
 * Write one audit row.
 * @param {{ level?: string, source: string, action: string, message: string,
 *   entityType?: string, entityId?: string, before?: object, after?: object, metadata?: object }} entry
 * @returns {Promise<string|null>} the log id, or null when it could not be written
 */
export const logAudit = async ({ level = 'info', source, action, message, entityType = null, entityId = null, before = null, after = null, metadata = {} }) => {
  try {
    const { data, error } = await supabase.rpc('log_audit', {
      p_level: level, p_source: source, p_action: action, p_message: message,
      p_entity_type: entityType, p_entity_id: entityId != null ? String(entityId) : null,
      p_before: before, p_after: after, p_metadata: metadata || {},
    });
    if (error) {
      console.warn('Audit log not written:', error.message);
      return null;
    }
    return data ?? null;
  } catch (error) {
    console.warn('Audit log not written:', error?.message || error);
    return null;
  }
};

/** A failed database/API call from an admin action, logged as an error */
export const logFailure = (action, { source, entityType = null, entityId = null, error, context = {} }) =>
  logAudit({
    level: 'error', source, action, entityType, entityId,
    message: `${action.replace(/[._]/g, ' ')}: ${error?.message || String(error || 'unknown error')}`.slice(0, 500),
    metadata: { error: error?.message || String(error || ''), code: error?.code || null, ...context },
  });

/* ── reading ────────────────────────────────────────────────────────────── */

const applyFilters = (query, f, { skipLevel = false } = {}) => {
  if (f.sample !== '1') query = query.eq('is_sample', false);
  if (f.level && !skipLevel) query = query.ilike('level', f.level === 'warn' ? 'warn%' : f.level);
  if (f.source) query = query.ilike('source', f.source);
  if (f.actor) query = query.eq('actor_role', f.actor);
  if (f.action) query = query.eq('action', f.action);
  if (f.entityType) query = query.eq('entity_type', f.entityType);
  if (f.entity) query = query.ilike('entity_id', `${cleanLogSearch(f.entity)}%`);
  const { from, to } = rangeBounds(f);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lt('created_at', to);
  const q = cleanLogSearch(f.q);
  if (q) query = query.or(['message', 'action', 'source', 'actor_name', 'entity_id'].map(c => `${c}.ilike.*${q}*`).join(','));
  return query;
};

export const LOG_PAGE_SIZE = 25;

/** One page, newest first, with the total for the current filters */
export const fetchLogsPage = async (filters, { pageSize = LOG_PAGE_SIZE } = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const query = applyFilters(supabase.from('logs').select('*', { count: 'exact' }), filters)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message || 'Could not load logs');
  return { rows: (data || []).map(normalizeLog), total: count ?? 0 };
};

const countWhere = async (filters, extra) => {
  let query = applyFilters(supabase.from('logs').select('id', { count: 'exact', head: true }), filters, { skipLevel: !!extra.levels });
  if (extra.levels) query = query.in('level', extra.levels);
  if (extra.since) query = query.gte('created_at', extra.since);
  const { count, error } = await query;
  if (error) throw new Error(error.message || 'Could not count logs');
  return count ?? 0;
};

/** Counters for the current filters and date range, counted in the database */
export const fetchLogStats = async (filters) => {
  const [total, errors, warnings, last24h] = await Promise.all([
    countWhere(filters, {}),
    countWhere(filters, { levels: ['error', 'critical'] }),
    countWhere(filters, { levels: ['warn'] }),
    countWhere(filters, { since: new Date(Date.now() - 24 * 3600e3).toISOString() }),
  ]);
  return { total, errors, warnings, last24h };
};

/** Every row for the current filters (CSV export), up to `limit` */
export const fetchAllLogs = async (filters, { limit = 10000 } = {}) => {
  const out = [];
  for (let from = 0; from < limit; from += 1000) {
    const { data, error } = await applyFilters(supabase.from('logs').select('*'), filters)
      .order('created_at', { ascending: false }).range(from, Math.min(from + 999, limit - 1));
    if (error) throw new Error(error.message || 'Could not export logs');
    out.push(...(data || []).map(normalizeLog));
    if (!data || data.length < 1000) break;
  }
  return out;
};

/**
 * History of one record (History panels): every log row with this entity_id.
 * For a collector, pass includeAssignments to also list the pickups assigned to them.
 */
export const fetchEntityHistory = async (entityId, { limit = 50, includeAssignments = false } = {}) => {
  if (!entityId) return [];
  const id = cleanLogSearch(entityId);
  let query = supabase.from('logs').select('*').eq('is_sample', false);
  query = includeAssignments
    ? query.or(`entity_id.eq.${id},and(action.in.(request.assigned,request.reassigned),metadata->>collector_profile_id.eq.${id})`)
    : query.eq('entity_id', String(entityId));
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message || 'Could not load history');
  return (data || []).map(normalizeLog);
};
