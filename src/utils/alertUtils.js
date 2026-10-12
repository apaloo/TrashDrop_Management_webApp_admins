/**
 * Helpers for the Alerts page: turn alerts rows into one shape, resolve the
 * related record, filter, sort, count and export.
 */
import {
  ALERT_STATUSES, ALERT_PRIORITIES, ALERT_TYPES, alertStatus, alertPriority, alertType, isOpenAlert,
} from '../constants/alerts';
import { shortId, shortAddress } from './pickupRequestUtils';
import { statusLabel } from '../constants/pickupStatus';

const ENTITY_FROM_SOURCE = {
  pickup_requests: 'pickup_request', digital_bins: 'pickup_request', scheduled_pickups: 'pickup_request',
  collector_profiles: 'collector', service_zones: 'region',
};

/** alerts row → page shape (works for rows from before the 20261017 migration too) */
export const normalizeAlert = (row) => {
  const status = alertStatus(row.status);
  const priority = alertPriority(row.severity ?? row.priority);
  const type = alertType(row.type);
  const entityRef = row.entity_ref ?? (row.entity_id != null ? String(row.entity_id) : null);
  let entityType = String(row.entity_type || '').toLowerCase();
  if (row.entity_source && ENTITY_FROM_SOURCE[row.entity_source]) entityType = ENTITY_FROM_SOURCE[row.entity_source];
  if (['request', 'pickup', 'pickup_requests'].includes(entityType)) entityType = 'pickup_request';
  if (!entityRef || !['pickup_request', 'collector', 'region'].includes(entityType)) entityType = 'system';
  return {
    id: String(row.id),
    title: row.title || 'Untitled alert',
    description: row.description || row.message || '',
    status: status.key,
    priority: priority.key,
    priorityRank: priority.rank,
    type: type.key,
    ruleKey: row.rule_key || null,
    entity: entityType === 'system' ? null : {
      type: entityType,
      ref: entityRef,
      source: row.entity_source || (entityType === 'pickup_request' ? 'pickup_requests' : entityType === 'collector' ? 'collector_profiles' : 'service_zones'),
    },
    assignedTo: row.assigned_to || null,
    createdBy: row.created_by || null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    location: row.location_lat != null && row.location_lng != null
      ? { lat: Number(row.location_lat), lng: Number(row.location_lng), address: row.location_address || null }
      : (row.location_address ? { lat: null, lng: null, address: row.location_address } : null),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    resolvedAt: row.resolved_at || null,
    closedAt: row.closed_at || null,
    resolutionNote: row.resolution_note || null,
    autoResolved: !!row.auto_resolved,
    hasStatusColumn: Object.prototype.hasOwnProperty.call(row, 'status'),
  };
};

/**
 * What the alert is about, for the table and modal.
 * requests: summary rows (normalizeViewRow); collectors: Collectors page shape.
 * @returns {{ kind, short, name, detail, record } | null} null = System
 */
export const relatedRecord = (alert, { requests = [], collectors = [] } = {}) => {
  const e = alert.entity;
  if (!e) return null;
  const meta = alert.metadata || {};
  if (e.type === 'pickup_request') {
    const r = requests.find(x => String(x.id) === String(e.ref));
    return {
      kind: 'pickup_request',
      short: `#${shortId(e.ref)}`,
      name: r?.customer?.name || meta.customer || 'Customer unknown',
      detail: [shortAddress(r?.address || meta.address), r ? statusLabel(r.status) : (meta.status ? statusLabel(meta.status) : null)].filter(Boolean).join(' · '),
      record: r || null,
    };
  }
  if (e.type === 'collector') {
    const c = collectors.find(x => String(x.id) === String(e.ref));
    const lastSeen = c?.presence?.lastSeen ?? meta.last_seen ?? null;
    return {
      kind: 'collector',
      short: shortId(e.ref),
      name: c?.name || meta.name || 'Collector',
      detail: lastSeen ? `Last seen ${ageLabel(lastSeen)}` : 'Never reported a location',
      record: c || null,
    };
  }
  return { kind: 'region', short: 'Region', name: e.ref, detail: 'Service zone', record: null };
};

/* ── filters and sorting ────────────────────────────────────────────────── */

export const DEFAULT_ALERT_FILTERS = { status: 'all', priority: 'all', type: 'all', assignee: 'all', q: '', range: 'all', from: '', to: '' };

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

const inRange = (createdAt, f, now = new Date()) => {
  if (f.range === 'all') return true;
  const t = new Date(createdAt);
  if (Number.isNaN(t.getTime())) return false;
  const today = startOfDay(now);
  switch (f.range) {
    case 'today': return t >= today;
    case 'last24h': return now - t <= 24 * 3600e3;
    case 'last7Days': return now - t <= 7 * 24 * 3600e3;
    case 'last30Days': return now - t <= 30 * 24 * 3600e3;
    case 'custom': {
      if (f.from && t < startOfDay(f.from)) return false;
      if (f.to) { const end = startOfDay(f.to); end.setDate(end.getDate() + 1); if (t >= end) return false; }
      return true;
    }
    default: return true;
  }
};

/** status filter: 'all' | 'active' (open + acknowledged + in progress) | a status key */
export const filterAlerts = (alerts, f, ctx = {}, now = new Date()) => {
  const q = String(f.q || '').trim().toLowerCase();
  return alerts.filter(a => {
    if (f.status === 'active' && !isOpenAlert(a.status)) return false;
    if (f.status !== 'all' && f.status !== 'active' && a.status !== f.status) return false;
    if (f.priority !== 'all' && a.priority !== f.priority) return false;
    if (f.type !== 'all' && a.type !== f.type) return false;
    if (f.assignee === 'none' && a.assignedTo) return false;
    if (f.assignee !== 'all' && f.assignee !== 'none' && a.assignedTo !== f.assignee) return false;
    if (!inRange(a.createdAt, f, now)) return false;
    if (q) {
      const rel = relatedRecord(a, ctx);
      const hay = [a.title, a.description, a.id, a.entity?.ref, rel?.name, rel?.detail, alertType(a.type).label, a.location?.address]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
};

/** Open problems first, then priority (critical first), then newest */
export const sortAlerts = (alerts, { key = 'priority', dir = 'desc' } = {}) => {
  const sign = dir === 'asc' ? -1 : 1;
  const time = (a) => new Date(a.createdAt).getTime() || 0;
  return [...alerts].sort((a, b) => {
    if (key === 'created') return sign * (time(b) - time(a));
    if (key === 'status') {
      const ia = ALERT_STATUSES.findIndex(s => s.key === a.status);
      const ib = ALERT_STATUSES.findIndex(s => s.key === b.status);
      return sign * (ia - ib) || b.priorityRank - a.priorityRank || time(b) - time(a);
    }
    const openA = isOpenAlert(a.status) ? 1 : 0;
    const openB = isOpenAlert(b.status) ? 1 : 0;
    return (openB - openA) || sign * (b.priorityRank - a.priorityRank) || time(b) - time(a);
  });
};

/* ── counts ─────────────────────────────────────────────────────────────── */

export const alertStats = (alerts) => {
  const byStatus = Object.fromEntries(ALERT_STATUSES.map(s => [s.key, 0]));
  const openByPriority = Object.fromEntries(ALERT_PRIORITIES.map(p => [p.key, 0]));
  const byType = {};
  alerts.forEach(a => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    if (isOpenAlert(a.status)) openByPriority[a.priority] += 1;
    byType[a.type] = byType[a.type] || { total: 0, open: 0 };
    byType[a.type].total += 1;
    if (isOpenAlert(a.status)) byType[a.type].open += 1;
  });
  const types = Object.entries(byType)
    .map(([key, v]) => ({ key, label: alertType(key).label, ...v }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  return {
    total: alerts.length,
    byStatus,
    active: byStatus.open + byStatus.acknowledged + byStatus.in_progress,
    openByPriority,
    types,
  };
};

/* ── export ─────────────────────────────────────────────────────────────── */

export const EXPORT_COLUMNS = ['ID', 'Created', 'Priority', 'Status', 'Type', 'Title', 'Related', 'Related details', 'Assigned to', 'Rule', 'Resolution'];

export const exportRows = (alerts, ctx = {}, staffName = () => '') => alerts.map(a => {
  const rel = relatedRecord(a, ctx);
  return [
    a.id,
    a.createdAt ? new Date(a.createdAt).toLocaleString() : '',
    alertPriority(a.priority).label,
    alertStatus(a.status).label,
    alertType(a.type).label,
    a.title,
    rel ? `${rel.short} ${rel.name}` : 'System',
    rel?.detail || '',
    a.assignedTo ? staffName(a.assignedTo) : 'Unassigned',
    a.ruleKey || 'Manual',
    a.resolutionNote || '',
  ];
});

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toAlertsCsv = (rows) => [EXPORT_COLUMNS, ...rows].map(r => r.map(csvCell).join(',')).join('\n');

export const TYPE_OPTIONS = ALERT_TYPES;

/** "just now", "5m ago", "2h ago", "3d ago" */
export const ageLabel = (value, now = Date.now()) => {
  const t = new Date(value).getTime();
  if (!value || !Number.isFinite(t)) return '—';
  const min = Math.max(0, Math.floor((now - t) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
