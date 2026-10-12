/**
 * The one list of bag / batch steps, used by Generate Bag, Bag Management and
 * Bag History. The database works out each bag's step the same way
 * (supabase/migrations/20261019_bag_batches_admin.sql, admin_bag_items):
 *
 *   generated   batch not yet scanned by a household
 *   distributed batch scanned; the bag belongs to a household
 *   filled      the household asked for a pickup that uses this bag
 *   collected   that pickup was collected
 *   processed   recorded by no app yet
 *
 * A batch's step is the furthest step every one of its bags has reached.
 * batches.status itself ('active' / 'used') belongs to the household app and
 * is never shown or written as a step.
 */
export const BAG_STAGES = [
  { key: 'generated', label: 'Generated', className: 'bg-gray-100 text-gray-800', bar: 'bg-gray-400' },
  { key: 'distributed', label: 'Distributed', className: 'bg-blue-100 text-blue-800', bar: 'bg-blue-500' },
  { key: 'filled', label: 'Filled', className: 'bg-yellow-100 text-yellow-800', bar: 'bg-yellow-500' },
  { key: 'collected', label: 'Collected', className: 'bg-green-100 text-green-800', bar: 'bg-green-600' },
  { key: 'processed', label: 'Processed', className: 'bg-purple-100 text-purple-800', bar: 'bg-purple-500' },
];

export const ARCHIVED_STAGE = { key: 'archived', label: 'Archived', className: 'bg-gray-200 text-gray-600', bar: 'bg-gray-300' };

/** Steps a batch can be filtered by (archived last: archived batches are hidden otherwise) */
export const BATCH_STAGE_FILTERS = [...BAG_STAGES, ARCHIVED_STAGE];

/** The step a newly generated batch starts at */
export const INITIAL_BAG_STAGE = 'generated';

/** Values of batches.status the household app writes once a batch is scanned */
export const HOUSEHOLD_SCANNED_STATUSES = ['used', 'activated', 'scanned', 'completed', 'distributed'];

const ALL = [...BAG_STAGES, ARCHIVED_STAGE];

/** 'Used', 'ACTIVE', 'Generated'… → a step key; the household app's raw values map to their step */
export const normalizeBagStage = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return INITIAL_BAG_STAGE;
  if (ALL.some(s => s.key === v)) return v;
  if (v === 'active' || v === 'pending' || v === 'new') return 'generated';
  if (HOUSEHOLD_SCANNED_STATUSES.includes(v)) return 'distributed';
  if (['picked_up', 'disposed', 'completed'].includes(v)) return 'collected';
  return INITIAL_BAG_STAGE;
};

export const bagStageInfo = (value) => {
  const key = normalizeBagStage(value);
  return ALL.find(s => s.key === key) || BAG_STAGES[0];
};

/** 1 (generated) … 5 (processed); archived = 0 */
export const bagStageRank = (value) => BAG_STAGES.findIndex(s => s.key === normalizeBagStage(value)) + 1;

/* ── Generate Bags ──────────────────────────────────────────────────────── */

/** Trash types and their QR prefix code (same codes as the database, td_bag_type_code) */
export const TRASH_TYPES = [
  { key: 'Organic', code: 'ORG' },
  { key: 'Recyclable', code: 'REC' },
  { key: 'General', code: 'GEN' },
  { key: 'Hazardous', code: 'HAZ' },
  { key: 'Electronic', code: 'ELE' },
  { key: 'Other', code: 'OTH' },
];
export const BAG_SIZES = ['Small', 'Medium', 'Large'];

/**
 * Volume limits per submission. The database enforces the same limits
 * (admin_generate_batches) and never more than 5,000 bags at once;
 * REACT_APP_MAX_BAGS_PER_SUBMISSION can only lower that.
 */
export const BAG_LIMITS = {
  maxBagsPerBatch: 1000,
  maxBatches: 1000,
  maxTotalBags: Math.min(5000, Number(process.env.REACT_APP_MAX_BAGS_PER_SUBMISSION) || 5000),
};
