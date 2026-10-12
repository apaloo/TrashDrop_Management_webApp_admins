/**
 * Helpers for Bag Management and Bag History: one row shape for batches and
 * bags, labels, filters ↔ URL, and the bag QR link.
 */
import { normalizeBagStage } from '../constants/bagStatus';

export const SCAN_BASE_URL = 'https://trashdrops.com/scan';

/** "Organic · Medium", "Organic", or "—" (never "()") */
export const typeSizeLabel = (type, size) => {
  const parts = [type, size].map(v => String(v ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
};

/** Value or "—" */
export const orDash = (v) => (v === null || v === undefined || String(v).trim() === '' ? '—' : v);

/** admin_bag_batches row → page shape */
export const normalizeBatch = (row) => {
  const bagCount = Number(row.bag_count ?? row.quantity ?? 0) || 0;
  return {
    id: String(row.id),
    batchNumber: row.batch_number || null,
    batchName: row.batch_name || null,
    createdAt: row.created_at || null,
    bagCount,
    type: row.type || null,
    size: row.size || null,
    qrPrefix: row.qr_prefix || null,
    stage: row.archived ? 'archived' : normalizeBagStage(row.stage ?? row.status),
    rawStatus: row.raw_status ?? row.status ?? null,
    archived: !!row.archived,
    archivedAt: row.archived_at || null,
    generatedByName: row.generated_by_name || null,
    householdName: row.household_name || null,
    scannedByHouseholdAt: row.scanned_by_household_at || null,
    bagRows: Number(row.bag_rows ?? 0) || 0,
    distributed: Number(row.distributed_count ?? row.distributed ?? 0) || 0,
    filled: Number(row.filled_count ?? 0) || 0,
    collected: Number(row.collected_count ?? 0) || 0,
    processed: Number(row.processed_count ?? 0) || 0,
    unitPrice: row.unit_price ?? null,
    lastActivityAt: row.last_activity_at || null,
  };
};

/** admin_bag_items row → page shape */
export const normalizeBag = (row) => ({
  id: String(row.id),
  batchId: String(row.batch_id),
  bagNo: Number(row.bag_no) || null,
  qrCode: row.qr_code || null,
  stage: normalizeBagStage(row.stage),
  householdName: row.household_name || null,
  address: row.pickup_address || null,
  collectorName: row.collector_name || null,
  lastActivityAt: row.last_activity_at || null,
});

/** Bar segments for a batch: how many bags reached each step (counts are "at least this step") */
export const batchProgress = (b) => {
  const total = Math.max(b.bagRows || 0, 0) || b.bagCount || 0;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    total,
    distributed: b.distributed, filled: b.filled, collected: b.collected,
    distributedPct: pct(b.distributed), filledPct: pct(b.filled), collectedPct: pct(b.collected),
  };
};

/**
 * The link in a bag's QR code. Same as the batch ZIP download
 * (src/workers/QRCodeWorker.js), so existing printed codes and new ones match;
 * the household app reads batch= from it.
 */
export const bagQrUrl = (batchId, bagNo, email) => {
  const params = new URLSearchParams({ batch: batchId, bag: String(bagNo) });
  if (email) params.set('email', email);
  return `${SCAN_BASE_URL}?${params.toString()}`;
};
export const batchQrUrl = (batchId) => `${SCAN_BASE_URL}?batch=${encodeURIComponent(batchId)}`;

/* ── filters ↔ URL ──────────────────────────────────────────────────────── */

export const BATCH_SORTS = { created_at: 'Created at', bag_count: 'Quantity' };

export const DEFAULT_BATCH_FILTERS = { q: '', stage: '', from: '', to: '', sort: 'created_at', dir: 'desc', page: 1, size: 10 };

export const filtersFromParams = (params) => {
  const get = (k) => params.get(k) || '';
  const f = { ...DEFAULT_BATCH_FILTERS, q: get('q'), stage: get('stage').toLowerCase(), from: get('from'), to: get('to') };
  if (BATCH_SORTS[get('sort')]) f.sort = get('sort');
  if (get('dir') === 'asc') f.dir = 'asc';
  f.page = Math.max(1, parseInt(get('page'), 10) || 1);
  const size = parseInt(get('size'), 10);
  if ([5, 10, 25, 50].includes(size)) f.size = size;
  return f;
};

export const paramsFromFilters = (f) => {
  const out = {};
  Object.entries(f).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined && String(v) !== String(DEFAULT_BATCH_FILTERS[k])) out[k] = String(v);
  });
  return out;
};

/** Characters that would break a PostgREST filter */
export const cleanBatchSearch = (q) => String(q || '').trim().toLowerCase().replace(/[,()*%\\]/g, ' ').trim();

/** Inclusive day range (yyyy-mm-dd, Accra = UTC) → ISO bounds */
export const dateBounds = ({ from, to }) => ({
  from: from ? `${from}T00:00:00Z` : null,
  to: to ? new Date(new Date(`${to}T00:00:00Z`).getTime() + 24 * 3600e3).toISOString() : null,
});

/* ── cards ──────────────────────────────────────────────────────────────── */

/** % of bags collected out of those requested; null = nothing to measure */
export const weekCollectedPct = (week) => {
  const requested = Number(week?.bags_requested || 0);
  if (!requested) return null;
  return Math.round((Number(week?.bags_collected || 0) / requested) * 100);
};

/** 105 → "1 h 45 min"; null → null */
export const formatMinutes = (m) => {
  if (m === null || m === undefined || Number.isNaN(Number(m))) return null;
  const min = Math.max(0, Math.round(Number(m)));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  return `${Math.round(h / 24)} days`;
};
