/**
 * Helpers for the Pickup Requests page (/request-pickup/requests).
 * Rows are normalised to one shape whether they come from the
 * admin_pickup_requests view (server paging) or the fallback loader.
 */
import {
  canonicalStatus, statusGroup, statusLabel, normalizePriority, priorityInfo, rawValuesForStatus,
  rawValuesForGroup, IN_PROGRESS_STATUSES, PICKUP_STATUSES,
} from '../constants/pickupStatus';
import { validateCoordinates } from './mapCoordinates';

export const PAGE_SIZE = 20;
export const OVERDUE_HOURS = 24;
export const DUPLICATE_WINDOW_HOURS = 48;
export const DUPLICATE_RADIUS_M = 50;
export const SERVICE_RADIUS_KM = 25;
export const FAR_COLLECTOR_KM = 20;

const num = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

/** Row from the admin_pickup_requests view */
export const normalizeViewRow = (r) => {
  const pos = validateCoordinates(r.lat, r.lng);
  return {
    id: String(r.id),
    source: r.source || 'pickup_requests',
    status: r.status || 'pending',
    createdAt: r.created_at || null,
    updatedAt: r.updated_at || null,
    customer: { id: r.user_id || null, name: r.customer_name || null, email: r.customer_email || null, phone: r.customer_phone || null },
    address: r.address || null,
    lat: pos.valid ? pos.lat : null,
    lng: pos.valid ? pos.lng : null,
    locationIssue: pos.valid ? null : pos.reason,
    wasteType: r.waste_type || 'general',
    bags: num(r.bag_count),
    binSizeLiters: num(r.bin_size_liters),
    fee: num(r.fee),
    isUrgent: !!r.is_urgent,
    priority: normalizePriority(r.priority ?? r.raw_priority, r.is_urgent),
    collectorRef: r.collector_ref || null,
    collectorUserId: r.collector_user_id || null,
    collectorProfileId: r.collector_profile_id || null,
    collectorName: r.collector_name || null,
    acceptedAt: r.accepted_at || null,
    completedAt: r.completed_at || null,
    cancelledAt: r.cancelled_at || null,
    cancellationReason: r.cancellation_reason || null,
    notes: r.notes || null,
    scheduledDate: r.scheduled_date || null,
    batchId: r.batch_id || null,
    customerRating: num(r.customer_rating),
    promotionalFee: num(r.promotional_fee),
    payouts: {
      core: num(r.collector_core_payout), urgent: num(r.collector_urgent_payout),
      distance: num(r.collector_distance_payout), total: num(r.collector_total_payout), platform: num(r.platform_share),
    },
  };
};

/** Row from fetchPickupRequests({ strict: true }) (used until the view exists) */
export const normalizeLoaderRow = (req, collectors = []) => {
  const ref = req.collectorId || req.assignedTo?.id || null;
  const collector = ref ? collectors.find(c => String(c.userId) === String(ref) || String(c.id) === String(ref)) : null;
  const pos = validateCoordinates(req.location?.lat, req.location?.lng);
  const address = req.location?.address && req.location.address !== 'Unknown Location' ? req.location.address : null;
  return {
    id: String(req.id),
    source: req.source || 'pickup_requests',
    status: req.status || 'pending',
    createdAt: req.requestTime || null,
    updatedAt: null,
    customer: {
      id: req.requestedBy?.id && req.requestedBy.id !== 'customer-unknown' ? req.requestedBy.id : null,
      name: req.requestedBy?.name && req.requestedBy.name !== 'Unknown Customer' ? req.requestedBy.name : null,
      email: req.requestedBy?.email && req.requestedBy.email !== 'unknown@example.com' ? req.requestedBy.email : null,
      phone: req.requestedBy?.phone && req.requestedBy.phone !== 'N/A' ? req.requestedBy.phone : null,
    },
    address,
    lat: pos.valid ? pos.lat : null,
    lng: pos.valid ? pos.lng : null,
    locationIssue: pos.valid ? null : pos.reason,
    wasteType: req.wasteType || 'general',
    bags: num(req.bags),
    binSizeLiters: num(req.binSizeLiters),
    fee: num(req.fee),
    isUrgent: !!req.isUrgent,
    priority: normalizePriority(req.isUrgent ? 'high' : null, req.isUrgent),
    collectorRef: ref,
    collectorUserId: collector?.userId || null,
    collectorProfileId: collector?.id || null,
    collectorName: collector?.name || req.collectorName || null,
    acceptedAt: req.acceptedAt || null,
    completedAt: req.collectedAt || null,
    cancelledAt: null,
    cancellationReason: null,
    notes: req.notes || null,
    scheduledDate: req.scheduledDate || null,
    batchId: null,
    customerRating: num(req.collectorRating),
    promotionalFee: null,
    payouts: { core: null, urgent: null, distance: null, total: num(req.collectorPayout), platform: null },
  };
};

/* ── display ────────────────────────────────────────────────────────────── */

export const shortId = (id) => String(id || '').slice(0, 8);

export const bagsLabel = (n) => {
  if (n === null || n === undefined) return '—';
  const v = Number(n);
  return `${v} bag${v === 1 ? '' : 's'}`;
};

const NOISE = /^(ghana|\d{3,}.*|.*\bregion\b.*|.*\bmunicipal(ity)?\b.*|.*\bdistrict\b.*|.*\bmetropolitan\b.*)$/i;
/** "Vitin Estate, Tamale" from a long geocoded address; full text otherwise */
export const shortAddress = (address) => {
  if (!address) return null;
  const parts = String(address).split(',').map(p => p.trim()).filter(Boolean);
  const useful = parts.filter(p => !NOISE.test(p));
  if (useful.length <= 2) return useful.join(', ') || parts[0];
  return `${useful[0]}, ${useful[useful.length - 1]}`;
};

export const formatGhs = (v) => (v === null || v === undefined ? '—' : `GHS ${Number(v).toFixed(2)}`);

export const relativeAge = (value, now = Date.now()) => {
  const t = new Date(value).getTime();
  if (!value || !Number.isFinite(t)) return '—';
  const min = Math.max(0, Math.floor((now - t) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? '' : 's'} ago`;
};

export const fullDate = (value) => {
  const d = new Date(value);
  return !value || Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export const isOverdue = (row, now = Date.now()) =>
  canonicalStatus(row.status) === 'pending' && Number.isFinite(new Date(row.createdAt).getTime())
  && now - new Date(row.createdAt).getTime() > OVERDUE_HOURS * 3600 * 1000;

/* ── geography ─────────────────────────────────────────────────────────── */

export const distanceKm = (aLat, aLng, bLat, bLng) => {
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

/** Collectors with distance to the request (km, null if unknown), nearest first; no-location collectors last */
export const collectorsByDistance = (row, collectors) => collectors
  .map(c => ({ ...c, distanceKm: c.position && row.lat !== null ? distanceKm(row.lat, row.lng, c.position[0], c.position[1]) : null }))
  .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || String(a.name).localeCompare(String(b.name)));

/**
 * Outside the service area when no collector with a known position is within
 * SERVICE_RADIUS_KM. Unknown (false) when the request or no collector has a position.
 */
export const isOutsideServiceArea = (row, collectors) => {
  if (row.lat === null) return false;
  const placed = collectors.filter(c => c.position);
  if (!placed.length) return false;
  return placed.every(c => distanceKm(row.lat, row.lng, c.position[0], c.position[1]) > SERVICE_RADIUS_KM);
};

/* ── duplicates ─────────────────────────────────────────────────────────── */

const OPEN_FOR_DUPLICATES = ['pending', 'accepted', 'en_route', 'arrived'];
const sameText = (a, b) => a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** Other open requests from the same customer at the same place within 48 h */
export const findDuplicates = (row, candidates) => {
  if (!row.customer?.id || !OPEN_FOR_DUPLICATES.includes(canonicalStatus(row.status))) return [];
  const t = new Date(row.createdAt).getTime();
  return candidates.filter(o => {
    if (o.id === row.id && o.source === row.source) return false;
    if (o.customer?.id !== row.customer.id || !OPEN_FOR_DUPLICATES.includes(canonicalStatus(o.status))) return false;
    const dt = Math.abs(new Date(o.createdAt).getTime() - t);
    if (!(dt <= DUPLICATE_WINDOW_HOURS * 3600 * 1000)) return false;
    if (sameText(o.address, row.address)) return true;
    const d = distanceKm(row.lat, row.lng, o.lat, o.lng);
    return d !== null && d * 1000 <= DUPLICATE_RADIUS_M;
  });
};

/* ── fees ───────────────────────────────────────────────────────────────── */

// Digital bin surcharges, from the household app (src/utils/costCalculator.js).
// The base price per bin comes from the pricing zone covering the bin's
// location (get_covering_pricing_zone); the app has no default price list.
export const URGENT_SURCHARGE = 0.3;
export const REQUEST_FEE = 1.0;

/**
 * Fee breakdown and whether the stored fee matches the pricing logic.
 * - Digital bin: zone price (by bin size) × bags, + 30% urgent, + GHS 1 request
 *   fee; zone is { price, name } from fetchZoneBinPrice, null while unknown.
 * - Pickup request: the unit price of the customer's oldest active bag batch
 *   (create_pickup_request RPC); batchPrice is that price when known.
 * @returns {{ lines: Array<[string, number]>, expected: number|null, mismatch: boolean, note: string|null }}
 */
export const feeBreakdown = (row, { batchPrice = null, zone = null } = {}) => {
  if (row.source === 'digital_bins') {
    if (row.promotionalFee !== null) {
      return { lines: [['Promotional price', row.promotionalFee]], expected: row.promotionalFee, mismatch: row.fee !== null && Math.abs(row.fee - row.promotionalFee) > 0.01, note: 'Promotion' };
    }
    if (!zone || !Number.isFinite(zone.price)) {
      return { lines: [], expected: null, mismatch: false, note: 'Priced by the pricing zone covering the bin\'s location.' };
    }
    const size = row.binSizeLiters || 120;
    const bags = row.bags || 1;
    const base = zone.price * bags;
    const urgent = row.isUrgent ? base * URGENT_SURCHARGE : 0;
    const lines = [[`Base: ${size} L × ${bagsLabel(bags)} @ GHS ${zone.price.toFixed(2)}${zone.name ? ` (${zone.name} zone)` : ''}`, base]];
    if (urgent) lines.push(['Urgent surcharge (30%)', urgent]);
    lines.push(['Request fee', REQUEST_FEE]);
    const expected = Math.round((base + urgent + REQUEST_FEE) * 100) / 100;
    return {
      lines, expected,
      mismatch: row.fee !== null && Math.abs(row.fee - expected) > 0.01,
      note: 'Uses today\'s zone price. A price change since booking, a discount, or an on-site or distance charge can explain a difference.',
    };
  }
  if (row.source === 'pickup_requests') {
    if (batchPrice === null) return { lines: [], expected: null, mismatch: false, note: 'Price of the customer\'s oldest active bag batch (not multiplied by bags).' };
    const expected = Math.trunc(Number(batchPrice)); // stored as an integer
    return {
      lines: [['Bag batch price (oldest active batch)', Number(batchPrice)]],
      expected,
      mismatch: row.fee !== null && Math.abs(row.fee - expected) > 0.01,
      note: 'Not multiplied by the number of bags.',
    };
  }
  return { lines: [], expected: null, mismatch: false, note: null };
};

/* ── filters, sorting, CSV (fallback mode and export) ─────────────────── */

export const DEFAULT_FILTERS = { q: '', status: '', priority: '', collector: '', from: '', to: '', source: '', unassigned: '', sort: 'created_at', dir: 'desc', page: 1 };

/** from / to (yyyy-mm-dd, inclusive, Accra = UTC) → ISO bounds; used by links from the Dashboard */
export const requestDateBounds = ({ from, to } = {}) => ({
  from: /^\d{4}-\d{2}-\d{2}$/.test(from || '') ? `${from}T00:00:00Z` : null,
  to: /^\d{4}-\d{2}-\d{2}$/.test(to || '') ? new Date(Date.parse(`${to}T00:00:00Z`) + 864e5).toISOString() : null,
});

/** status filter value: '' | 'group:<group>' | 'status:<canonical>' */
export const statusFilterValues = (value) => {
  if (!value) return null;
  const [kind, key] = value.split(':');
  // several keys may be given: 'status:en_route,arrived,collecting'
  const keys = String(key || '').split(',').filter(Boolean);
  return keys.flatMap(k => (kind === 'group' ? rawValuesForGroup(k) : rawValuesForStatus(k)));
};

export const matchesSearch = (row, q) => {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  return [row.id, row.customer?.name, row.customer?.email, row.customer?.phone, row.address, row.collectorName]
    .some(v => v && String(v).toLowerCase().includes(s));
};

export const applyFilters = (rows, f) => {
  const statuses = statusFilterValues(f.status);
  return rows.filter(r =>
    (!statuses || statuses.includes(String(r.status).toLowerCase())) &&
    (!f.priority || r.priority === f.priority) &&
    (!f.collector || r.collectorProfileId === f.collector) &&
    (!f.source || r.source === f.source) &&
    (!f.unassigned || !r.collectorRef) &&
    inDateRange(r.createdAt, f) &&
    matchesSearch(r, f.q));
};

const inDateRange = (value, f) => {
  const { from, to } = requestDateBounds(f);
  if (!from && !to) return true;
  const t = Date.parse(value);
  return Number.isFinite(t) && (!from || t >= Date.parse(from)) && (!to || t < Date.parse(to));
};

const STATUS_ORDER = Object.fromEntries(PICKUP_STATUSES.map((s, i) => [s.key, i]));
const SORTERS = {
  created_at: (r) => new Date(r.createdAt).getTime() || 0,
  status: (r) => STATUS_ORDER[canonicalStatus(r.status)] ?? 99,
  fee: (r) => (r.fee === null ? -Infinity : r.fee),
  priority: (r) => priorityInfo(r.priority).rank,
};
export const sortRows = (rows, sort = 'created_at', dir = 'desc') => {
  const key = SORTERS[sort] || SORTERS.created_at;
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => (key(a) > key(b) ? sign : key(a) < key(b) ? -sign : 0));
};

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => {
  const header = ['ID', 'Source', 'Status', 'Priority', 'Requested', 'Customer', 'Phone', 'Address', 'Latitude', 'Longitude', 'Waste type', 'Bags', 'Fee (GHS)', 'Collector', 'Cancellation reason'];
  const lines = rows.map(r => [
    r.id, r.source, statusLabel(r.status), priorityInfo(r.priority).label, r.createdAt, r.customer?.name, r.customer?.phone,
    r.address, r.lat, r.lng, r.wasteType, r.bags, r.fee, r.collectorName, r.cancellationReason,
  ].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\n');
};

/* ── stats ──────────────────────────────────────────────────────────────── */

/** Overall cards: total, pending, in progress (assigned..collecting), done, cancelled */
export const computeStats = (rows) => rows.reduce((acc, r) => {
  acc.total += 1;
  const g = statusGroup(r.status);
  if (g === 'open') acc.pending += 1;
  if (g === 'in_progress') acc.inProgress += 1;
  if (g === 'done') acc.done += 1;
  if (g === 'cancelled') acc.cancelled += 1;
  return acc;
}, { total: 0, pending: 0, inProgress: 0, done: 0, cancelled: 0 });

/**
 * Per-collector counts from the requests themselves.
 * Keyed by collector_profiles.id; active = accepted..collecting, completed = done.
 */
/**
 * Per-collector numbers from the requests, keyed by collector profile id.
 * One calculation for the Pickup Requests page (Active Collectors) and the
 * Collectors page:
 *   active    requests assigned … collecting
 *   completed requests completed / disposed
 *   earnings  collector payout of completed jobs (the fee when no payout is stored)
 *   rating    average customer rating (null = no ratings yet), ratingCount
 */
export const collectorJobCounts = (rows) => {
  const acc = rows.reduce((out, r) => {
    const key = r.collectorProfileId;
    if (!key) return out;
    const c = out[key] || (out[key] = { active: 0, completed: 0, earnings: 0, ratingSum: 0, ratingCount: 0 });
    if (IN_PROGRESS_STATUSES.includes(canonicalStatus(r.status))) c.active += 1;
    if (statusGroup(r.status) === 'done') {
      c.completed += 1;
      c.earnings += r.payouts?.total ?? r.fee ?? 0;
    }
    const rating = Number(r.customerRating);
    if (r.customerRating !== null && r.customerRating !== undefined && rating >= 1 && rating <= 5) {
      c.ratingSum += rating;
      c.ratingCount += 1;
    }
    return out;
  }, {});
  Object.values(acc).forEach(c => {
    c.earnings = Math.round(c.earnings * 100) / 100;
    c.rating = c.ratingCount ? Math.round((c.ratingSum / c.ratingCount) * 10) / 10 : null;
    delete c.ratingSum;
  });
  return acc;
};

/** Stats for one collector, zeros when they have no requests */
export const EMPTY_JOB_COUNTS = Object.freeze({ active: 0, completed: 0, earnings: 0, ratingCount: 0, rating: null });
