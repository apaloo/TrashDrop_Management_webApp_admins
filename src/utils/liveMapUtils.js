/**
 * Helpers for the Live Map page (/request-pickup/live-map): status groups and
 * colours, collector online state, relative times, filters and counts.
 */
import { validateCoordinates, parsePoint } from './mapCoordinates';
import { PICKUP_STATUSES, statusColor } from '../constants/pickupStatus';

// Live Map colour groups, derived from the shared status model
// (src/constants/pickupStatus.js) so both pages use the same colours.
const LIVE_GROUP_OF = { pending: 'pending', accepted: 'assigned', en_route: 'in_progress', arrived: 'in_progress', collecting: 'in_progress', disposed: 'completed', cancelled: 'cancelled', expired: 'cancelled' };
const statusesIn = (group) => PICKUP_STATUSES.filter(s => LIVE_GROUP_OF[s.key] === group).flatMap(s => s.aliases);
export const STATUS_GROUPS = [
  { key: 'pending', label: 'Pending', color: statusColor('pending'), statuses: statusesIn('pending') },
  { key: 'assigned', label: 'Assigned / Accepted', color: statusColor('accepted'), statuses: statusesIn('assigned') },
  { key: 'in_progress', label: 'In progress', color: statusColor('en_route'), statuses: statusesIn('in_progress') },
  { key: 'completed', label: 'Completed', color: statusColor('disposed'), statuses: statusesIn('completed') },
  { key: 'cancelled', label: 'Cancelled', color: statusColor('cancelled'), statuses: statusesIn('cancelled') },
];
export const OTHER_STATUS_GROUP = { key: 'other', label: 'Other', color: '#525C52', statuses: [] };

const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export const statusGroupOf = (status) => {
  const s = normalize(status);
  return STATUS_GROUPS.find(g => g.statuses.includes(s)) || OTHER_STATUS_GROUP;
};

export const statusText = (status) => {
  const s = normalize(status);
  return s ? s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Unknown';
};

export const COLLECTOR_ONLINE_COLOR = '#16A34A';
export const COLLECTOR_OFFLINE_COLOR = '#9CA3AF';
export const ONLINE_WINDOW_MS = 10 * 60 * 1000;

/** Last time the collector's location was reported */
export const collectorLastSeen = (collector) =>
  collector.locationUpdatedAt || collector.lastActive || collector.lastUpdated || null;

const locationIsFresh = (collector, now) => {
  const t = new Date(collectorLastSeen(collector)).getTime();
  return Number.isFinite(t) && now - t <= ONLINE_WINDOW_MS;
};

/**
 * The collector app checks in (collector_profiles.last_active) every minute
 * while On-Duty, and on every location update. No check-in for this long
 * means the phone is offline, or the app is closed or in the background.
 */
export const HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;

const latest = (...values) => values
  .filter(v => v && Number.isFinite(new Date(v).getTime()))
  .sort((x, y) => new Date(y) - new Date(x))[0] || null;

/** Last time the collector app was heard from: a check-in, a location or a duty switch */
export const collectorHeartbeat = (collector) =>
  latest(collector.lastActive, collector.locationUpdatedAt, collector.onDutySince);

const isRecent = (value, now, windowMs) => {
  const t = new Date(value).getTime();
  return !!value && Number.isFinite(t) && now - t <= windowMs;
};

/**
 * Online = On-Duty in the collector app (collector_profiles.on_duty, which the
 * database requires to accept requests) AND the app checked in within the last
 * 5 minutes. on_duty stays true when a phone loses its connection or the app
 * is closed, so On-Duty alone doesn't mean the collector is reachable.
 * Where duty isn't recorded (onDuty null), a location update in the last 10
 * minutes.
 */
export const isCollectorOnline = (collector, now = Date.now()) => {
  if (collector.onDuty === true) return isRecent(collectorHeartbeat(collector), now, HEARTBEAT_WINDOW_MS);
  if (collector.onDuty === false) return false;
  return locationIsFresh(collector, now);
};

export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PRESENCE = {
  online: { key: 'online', label: 'Online', color: COLLECTOR_ONLINE_COLOR, badge: 'bg-green-100 text-green-800' },
  recent: { key: 'recent', label: 'Seen today', color: '#F59E0B', badge: 'bg-amber-100 text-amber-800' },
  offline: { key: 'offline', label: 'Offline', color: COLLECTOR_OFFLINE_COLOR, badge: 'bg-gray-100 text-gray-700' },
};

/**
 * Presence (same rule as the Live Map): online when On-Duty and checking in
 * (see isCollectorOnline), otherwise recent if the app was last heard from
 * (check-in, location update or duty switch) within 24 h, offline when older
 * or never.
 * locationAt / gpsStale: when the last location came in, and whether an
 * online collector's location is older than 10 minutes.
 * noSignal: On-Duty in the app, but the app has stopped checking in.
 */
export const collectorPresence = (collector, now = Date.now()) => {
  const locationAt = collectorLastSeen(collector);
  const lastSeen = latest(locationAt, collectorHeartbeat(collector));
  if (isCollectorOnline(collector, now)) {
    return { ...PRESENCE.online, lastSeen, locationAt, gpsStale: !locationIsFresh(collector, now), noSignal: false };
  }
  const noSignal = collector.onDuty === true;
  if (!lastSeen) return { ...PRESENCE.offline, lastSeen: null, locationAt: null, gpsStale: false, noSignal };
  return { ...(isRecent(lastSeen, now, RECENT_WINDOW_MS) ? PRESENCE.recent : PRESENCE.offline), lastSeen, locationAt, gpsStale: false, noSignal };
};

/** "just now", "12 min ago", "3 h ago", "2 d ago", "—" */
export const relativeTime = (value, now = Date.now()) => {
  const t = new Date(value).getTime();
  if (!value || !Number.isFinite(t)) return '—';
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
};

/** Capacity badge: neutral normally, amber at 70%+, red at 90%+ */
export const capacityBadgeClass = (percent) => {
  const p = Number(percent) || 0;
  if (p >= 90) return 'bg-red-100 text-red-800';
  if (p >= 70) return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-700';
};

/** Request with its checked map position */
export const withRequestPosition = (request) => {
  const loc = request.location || {};
  const check = validateCoordinates(loc.lat, loc.lng);
  return { ...request, position: check.valid ? [check.lat, check.lng] : null, locationIssue: check.reason, swapped: check.swapped };
};

/** Collector with its checked map position (falls back to the PostGIS current_location point) */
export const withCollectorPosition = (collector) => {
  let check = validateCoordinates(collector.currentLocation?.lat, collector.currentLocation?.lng);
  if (!check.valid && collector.currentLocationPoint) {
    const p = parsePoint(collector.currentLocationPoint);
    if (p) {
      const fromPoint = validateCoordinates(p.lat, p.lng);
      if (fromPoint.valid) check = fromPoint;
    }
  }
  return {
    ...collector,
    position: check.valid ? [check.lat, check.lng] : null,
    locationIssue: check.valid ? (check.swapped ? check.reason : null) : check.reason,
    online: isCollectorOnline(collector),
  };
};

/** yyyy-mm-dd in local time */
export const localDateKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Request filter. statusGroups: [] = all; dateFrom/dateTo: yyyy-mm-dd inclusive
 * on the request time; collectorId: 'all' | collector profile id.
 */
export const matchesRequestFilters = (request, { statusGroups = [], dateFrom = '', dateTo = '', collectorId = 'all' } = {}) => {
  if (statusGroups.length && !statusGroups.includes(statusGroupOf(request.status).key)) return false;
  if (dateFrom || dateTo) {
    const day = localDateKey(request.requestTime);
    if (!day) return false;
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
  }
  if (collectorId !== 'all' && String(request.collectorId || '') !== String(collectorId)) return false;
  return true;
};

export const summarize = (requestsOnMap, collectors) => ({
  total: requestsOnMap.length,
  pending: requestsOnMap.filter(r => statusGroupOf(r.status).key === 'pending').length,
  inProgress: requestsOnMap.filter(r => statusGroupOf(r.status).key === 'in_progress').length,
  collectorsOnline: collectors.filter(c => c.online).length,
  collectorsTotal: collectors.length,
});
