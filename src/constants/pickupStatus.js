/**
 * One status model for pickup requests, digital bins and scheduled pickups.
 *
 * Statuses written today (household + collector apps):
 *   pending → accepted → en_route → arrived → collecting → disposed
 * plus cancelled, expired, and legacy values (available, assigned, picked_up,
 * in_progress, in_transit, completed, canceled). Each maps to one canonical
 * status below. Colours match the Live Map.
 */

export const PICKUP_STATUSES = [
  { key: 'pending',    label: 'Pending',    group: 'open',        color: '#F59E0B', aliases: ['pending', 'available', 'new', 'requested', 'scheduled', 'open'] },
  { key: 'accepted',   label: 'Assigned',   group: 'in_progress', color: '#3B82F6', aliases: ['accepted', 'assigned', 'confirmed', 'reserved'] },
  { key: 'en_route',   label: 'En route',   group: 'in_progress', color: '#8B5CF6', aliases: ['en_route', 'in_transit', 'started', 'in_progress'] },
  { key: 'arrived',    label: 'Arrived',    group: 'in_progress', color: '#8B5CF6', aliases: ['arrived'] },
  { key: 'collecting', label: 'Collecting', group: 'in_progress', color: '#8B5CF6', aliases: ['collecting', 'picked_up'] },
  { key: 'disposed',   label: 'Completed',  group: 'done',        color: '#10B981', aliases: ['disposed', 'completed', 'collected', 'done'] },
  { key: 'cancelled',  label: 'Cancelled',  group: 'cancelled',   color: '#9CA3AF', aliases: ['cancelled', 'canceled', 'rejected', 'declined', 'failed'] },
  { key: 'expired',    label: 'Expired',    group: 'cancelled',   color: '#9CA3AF', aliases: ['expired'] },
];

export const STATUS_GROUPS = [
  { key: 'open',        label: 'Open',        color: '#F59E0B' },
  { key: 'in_progress', label: 'In progress', color: '#8B5CF6' },
  { key: 'done',        label: 'Done',        color: '#10B981' },
  { key: 'cancelled',   label: 'Cancelled',   color: '#9CA3AF' },
];

const UNKNOWN = { key: 'unknown', label: 'Unknown', group: 'open', color: '#64748B', aliases: [] };

const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Canonical status entry for any raw status value */
export const statusInfo = (raw) => {
  const s = normalize(raw);
  return PICKUP_STATUSES.find(st => st.aliases.includes(s)) || { ...UNKNOWN, label: s ? s.replace(/_/g, ' ') : 'Unknown' };
};
export const canonicalStatus = (raw) => statusInfo(raw).key;
export const statusLabel = (raw) => statusInfo(raw).label;
export const statusColor = (raw) => statusInfo(raw).color;
export const statusGroup = (raw) => statusInfo(raw).group;

/** Every raw database value belonging to a canonical status or a group (for server-side filters) */
export const rawValuesForStatus = (key) => PICKUP_STATUSES.find(s => s.key === key)?.aliases || [key];
export const rawValuesForGroup = (group) => PICKUP_STATUSES.filter(s => s.group === group).flatMap(s => s.aliases);

/** Statuses where a collector is working on the request (needs collector_id) */
export const IN_PROGRESS_STATUSES = PICKUP_STATUSES.filter(s => s.group === 'in_progress').map(s => s.key);

/**
 * Status changes the admin dashboard may make. The database trigger in
 * supabase/migrations/20261015_pickup_requests_admin.sql enforces the same
 * rules (plus the collector app's own steps, e.g. accepted → arrived).
 *   pending → accepted → en_route → arrived → collecting → disposed
 *   cancel only before collecting; complete only from arrived/collecting.
 */
export const ADMIN_TRANSITIONS = {
  pending: ['accepted', 'cancelled'],
  accepted: ['en_route', 'cancelled'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['collecting', 'disposed', 'cancelled'],
  collecting: ['disposed'],
  disposed: [],
  cancelled: [],
  expired: [],
};
export const canTransition = (fromRaw, to) => (ADMIN_TRANSITIONS[canonicalStatus(fromRaw)] || []).includes(to);
export const canCancel = (raw) => canTransition(raw, 'cancelled');

/** Database value to write for each canonical status, per table */
// "Mark as completed" from the dashboard writes 'completed' (the collector
// app writes 'disposed' after recording a disposal site); both are Done.
export const dbStatusFor = (key) => (key === 'disposed' ? 'completed' : key);

export const CANCEL_REASONS = [
  'Customer requested cancellation',
  'Duplicate request',
  'Outside service area',
  'No collector available',
  'Wrong or missing location',
  'Customer unreachable',
  'Other',
];

/* ── Priority ───────────────────────────────────────────────────────────────
 * pickup_requests rarely carry a priority (the household form's 'normal' is
 * not saved); digital bins use is_urgent. 'normal' / 'medium' / empty → Medium,
 * urgent / high / critical / is_urgent → High.
 */
export const PRIORITIES = [
  { key: 'high', label: 'High', className: 'bg-red-100 text-red-800', rank: 3 },
  { key: 'medium', label: 'Medium', className: 'bg-amber-100 text-amber-800', rank: 2 },
  { key: 'low', label: 'Low', className: 'bg-gray-100 text-gray-700', rank: 1 },
];
export const normalizePriority = (priority, isUrgent) => {
  if (isUrgent === true || isUrgent === 'true') return 'high';
  const p = normalize(priority);
  if (['high', 'urgent', 'critical'].includes(p)) return 'high';
  if (p === 'low') return 'low';
  return 'medium';
};
export const priorityInfo = (key) => PRIORITIES.find(p => p.key === key) || PRIORITIES[1];
