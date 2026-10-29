import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { assignScopeFor, sameRegion } from '../constants/accessControl';
import { fetchCollectorsForMap } from '../utils/collectorService';
import { withCollectorPosition, relativeTime, collectorLastSeen } from '../utils/liveMapUtils';
import { reverseGeocodeWithCache } from '../utils/geocoding';
import {
  fetchRequestPage, fetchSummaryRows, fetchAllMatching, assignCollector, changeStatus, cancelRequest,
} from '../services/pickupAdminService';
import {
  PAGE_SIZE, FAR_COLLECTOR_KM, DEFAULT_FILTERS, shortId, bagsLabel, shortAddress, formatGhs, relativeAge, fullDate,
  isOverdue, findDuplicates, isOutsideServiceArea, collectorsByDistance, distanceKm, computeStats, collectorJobCounts, toCsv,
} from '../utils/pickupRequestUtils';
import {
  PICKUP_STATUSES, STATUS_GROUPS, PRIORITIES, CANCEL_REASONS, canonicalStatus, canCancel, statusLabel,
} from '../constants/pickupStatus';
import { StatusBadge, PriorityBadge } from '../components/pickupRequests/StatusBadge';
import ConfirmDialog from '../components/pickupRequests/ConfirmDialog';
import CollectorPicker from '../components/pickupRequests/CollectorPicker';
import RequestDetailsModal from '../components/pickupRequests/RequestDetailsModal';
import { card, input, muted, border } from '../components/pickupRequests/theme';

const keyOf = (row) => `${row.source}:${row.id}`;
const SORTABLE = { created_at: 'Requested', status: 'Status', fee: 'Fee', priority: 'Priority' };

const readFilters = (params) => ({
  q: params.get('q') || '',
  status: params.get('status') || '',
  priority: params.get('priority') || '',
  collector: params.get('collector') || '',
  from: params.get('from') || '',
  to: params.get('to') || '',
  source: params.get('source') || '',
  unassigned: params.get('unassigned') || '',
  sort: SORTABLE[params.get('sort')] ? params.get('sort') : 'created_at',
  dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
  page: Math.max(1, Number(params.get('page')) || 1),
});

const SkeletonBlock = ({ className }) => <div className={`animate-pulse rounded bg-gray-300 opacity-40 ${className}`} />;

const RequestPickupManagement = () => {
  const { user, role, access } = useAuth();
  // Admin: any request, any collector. Waste Management Manager: only in their region (the database enforces the same)
  const assignScope = useMemo(() => assignScopeFor(role, access), [role, access]);
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);

  const [collectors, setCollectors] = useState([]);
  const [summaryRows, setSummaryRows] = useState(null);
  const [pageData, setPageData] = useState(null); // { rows, total, mode }
  const [tableLoading, setTableLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchText, setSearchText] = useState(filters.q);
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null);
  const openParam = useRef(params.get('open'));
  const [dialog, setDialog] = useState(null); // { type, rows, collectorId, reason, note, other }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [addresses, setAddresses] = useState({});
  const collectorsRef = useRef([]);

  const notify = useCallback((message, tone = 'ok') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /* ── URL-backed filters ─────────────────────────────────────────────── */
  const setFilters = useCallback((patch) => {
    const next = { ...filters, ...patch };
    if (!('page' in patch)) next.page = 1;
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined && String(v) !== String(DEFAULT_FILTERS[k])) sp.set(k, String(v));
    });
    setParams(sp, { replace: true });
  }, [filters, setParams]);

  // Debounced search → URL
  useEffect(() => { setSearchText(filters.q); }, [filters.q]);
  useEffect(() => {
    if (searchText === filters.q) return undefined;
    const t = setTimeout(() => setFilters({ q: searchText }), 300);
    return () => clearTimeout(t);
  }, [searchText, filters.q, setFilters]);

  /* ── data ───────────────────────────────────────────────────────────── */
  const loadCollectors = useCallback(async () => {
    try {
      const rows = (await fetchCollectorsForMap()).map(withCollectorPosition);
      collectorsRef.current = rows;
      setCollectors(rows);
      return rows;
    } catch (error) {
      console.error('Pickup requests: collectors failed to load', error);
      return collectorsRef.current;
    }
  }, []);

  const loadPage = useCallback(async (opts = {}) => {
    setTableLoading(true);
    try {
      const result = await fetchRequestPage(filters, collectorsRef.current, opts);
      setPageData(result);
      setLoadError(null);
    } catch (error) {
      console.error('Pickup requests: page failed to load', error);
      setLoadError(error.message || 'Could not load requests');
    } finally {
      setTableLoading(false);
    }
  }, [filters]);

  const loadSummary = useCallback(async () => {
    try {
      setSummaryRows(await fetchSummaryRows(collectorsRef.current));
    } catch (error) {
      console.error('Pickup requests: summary failed to load', error);
    }
  }, []);

  // First load: collectors (needed to name collectors), then table and summary
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      loadCollectors().then(() => loadPage()).then(loadSummary);
    } else {
      loadPage(); // filters changed: refresh the table only
    }
    setSelected(new Set());
  }, [loadPage, loadCollectors, loadSummary]);

  const refreshAll = async () => {
    await loadCollectors();
    await Promise.all([loadPage({ force: true }), loadSummary()]);
  };

  // Deep link from the Logs page (?open=<request id>): open its details once loaded
  useEffect(() => {
    const id = openParam.current;
    if (!id || !pageData) return;
    openParam.current = null;
    const row = pageData.rows.find(r => String(r.id) === id);
    if (row) setDetail(row);
  }, [pageData]);

  /* ── derived ────────────────────────────────────────────────────────── */
  const rows = pageData?.rows || [];
  const stats = useMemo(() => computeStats(summaryRows || []), [summaryRows]);
  const jobCounts = useMemo(() => collectorJobCounts(summaryRows || []), [summaryRows]);
  const collectorsWithJobs = useMemo(
    () => collectors.map(c => ({ ...c, jobs: jobCounts[c.id] || { active: 0, completed: 0 } })),
    [collectors, jobCounts]
  );
  const duplicatesOf = useCallback((row) => findDuplicates(row, summaryRows || []), [summaryRows]);
  // Collectors this account may assign to
  const assignCollectors = useMemo(
    () => (assignScope.region ? collectorsWithJobs.filter(c => sameRegion(c.region, assignScope.region)) : collectorsWithJobs),
    [collectorsWithJobs, assignScope.region]
  );
  const outside = useCallback((row) => isOutsideServiceArea(row, collectors), [collectors]);
  const addressOf = (row) => row.address || addresses[keyOf(row)] || null;
  const totalPages = Math.max(1, Math.ceil((pageData?.total || 0) / PAGE_SIZE));
  const filterCollector = collectors.find(c => c.id === filters.collector);

  // Look up addresses for rows that only have coordinates (Nominatim: one at a time)
  useEffect(() => {
    let live = true;
    const todo = [...rows, ...(detail ? [detail] : [])].filter(r => !r.address && r.lat !== null && !(keyOf(r) in addresses));
    (async () => {
      for (const r of todo) {
        if (!live) return;
        let text = null;
        try { text = await reverseGeocodeWithCache(r.lat, r.lng); } catch (e) { text = null; }
        if (!live) return;
        setAddresses(prev => ({ ...prev, [keyOf(r)]: text || '' }));
        await new Promise(res => setTimeout(res, 1100));
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, detail]);

  /* ── actions ────────────────────────────────────────────────────────── */
  const runAction = async (label, targets, fn) => {
    setBusy(true);
    const failures = [];
    for (const row of targets) {
      try { await fn(row); } catch (error) { failures.push(`#${shortId(row.id)}: ${error.message}`); }
    }
    setBusy(false);
    setDialog(null);
    const ok = targets.length - failures.length;
    if (failures.length === 0) notify(`${label}: ${ok === 1 ? `#${shortId(targets[0].id)}` : `${ok} requests`}`);
    else notify(`${label} failed for ${failures.length} of ${targets.length}. ${failures.join(' · ')}`, 'error');
    setSelected(new Set());
    await refreshAll();
    if (detail) {
      const fresh = await fetchRequestPage({ ...DEFAULT_FILTERS, q: detail.id }, collectorsRef.current).catch(() => null);
      setDetail(fresh?.rows.find(r => r.id === detail.id && r.source === detail.source) || null);
    }
  };

  const openAssign = (targets, collectorId = '') => setDialog({ type: 'assign', rows: targets, collectorId });
  const openCancel = (targets) => setDialog({ type: 'cancel', rows: targets, reason: '', note: '' });
  const onStatus = (row, to) => {
    if (to === 'disposed') setDialog({ type: 'complete', rows: [row] });
    else runAction(`${statusLabel(to)}`, [row], r => changeStatus(r, to));
  };

  const exportCsv = async () => {
    try {
      const all = await fetchAllMatching(filters, collectorsRef.current);
      const blob = new Blob([toCsv(all)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pickup-requests-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      notify(`Exported ${all.length} request${all.length === 1 ? '' : 's'}`);
    } catch (error) {
      notify(`Export failed: ${error.message}`, 'error');
    }
  };

  const copyId = (id) => {
    navigator.clipboard?.writeText(id).then(() => notify('Request ID copied')).catch(() => {});
  };

  const toggleSort = (key) => setFilters({ sort: key, dir: filters.sort === key && filters.dir === 'desc' ? 'asc' : 'desc' });

  const selectedRows = rows.filter(r => selected.has(keyOf(r)));
  const assignable = selectedRows.filter(r => canonicalStatus(r.status) === 'pending');
  const cancellable = selectedRows.filter(r => canCancel(r.status));

  /* ── render helpers ─────────────────────────────────────────────────── */
  const SortHeader = ({ k, children, className = '' }) => (
    <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${className}`} style={muted} aria-sort={filters.sort === k ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase">
        {children}
        <span aria-hidden="true">{filters.sort === k ? (filters.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );

  const Flags = ({ row }) => {
    const dups = duplicatesOf(row);
    return (
      <span className="inline-flex flex-wrap gap-1">
        {isOverdue(row) && <span className="text-xs px-1.5 rounded bg-red-100 text-red-800" title="Pending for more than 24 hours">Overdue</span>}
        {dups.length > 0 && <span className="text-xs px-1.5 rounded bg-amber-100 text-amber-900" title={`Also: ${dups.map(d => '#' + shortId(d.id)).join(', ')}`}>Possible duplicate</span>}
        {outside(row) && <span className="text-xs px-1.5 rounded bg-orange-100 text-orange-900">Outside service area</span>}
      </span>
    );
  };

  const RowActions = ({ row }) => (
    <div className="flex justify-end gap-1.5">
      {assignScope.canAssign && canonicalStatus(row.status) === 'pending' && (
        <button type="button" onClick={() => openAssign([row])} className="px-2.5 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700">Assign</button>
      )}
      <button type="button" onClick={() => setDetail(row)} className="px-2.5 py-1 text-xs font-medium rounded border" style={border}>Details</button>
    </div>
  );

  const AreaCell = ({ row }) => {
    const full = addressOf(row);
    return full
      ? <span title={full}>{shortAddress(full)}</span>
      : <span style={muted} title={row.locationIssue || ''}>
          {row.lat === null ? 'No location' : keyOf(row) in addresses ? `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}` : 'Looking up address…'}
        </span>;
  };

  const statCards = [
    { label: 'Total requests', value: stats.total, filter: '', color: '#1F2937' },
    { label: 'Pending', value: stats.pending, filter: 'group:open', color: STATUS_GROUPS[0].color },
    { label: 'In progress', value: stats.inProgress, filter: 'group:in_progress', color: STATUS_GROUPS[1].color },
    { label: 'Completed', value: stats.done, filter: 'group:done', color: STATUS_GROUPS[2].color },
    { label: 'Cancelled', value: stats.cancelled, filter: 'group:cancelled', color: STATUS_GROUPS[3].color },
  ];

  /* ── dialogs ────────────────────────────────────────────────────────── */
  const renderDialog = () => {
    if (!dialog) return null;
    const close = () => setDialog(null);

    if (dialog.type === 'assign') {
      const targets = dialog.rows;
      const anchor = targets.find(r => r.lat !== null) || targets[0];
      const ranked = collectorsByDistance(anchor, assignCollectors);
      const chosen = ranked.find(c => c.id === dialog.collectorId);
      const distances = chosen ? targets.map(r => (chosen.position && r.lat !== null ? distanceKm(r.lat, r.lng, chosen.position[0], chosen.position[1]) : null)) : [];
      const farthest = distances.filter(d => d !== null).reduce((m, d) => Math.max(m, d), 0);
      return (
        <ConfirmDialog title={targets.length > 1 ? `Assign ${targets.length} requests` : `Assign request #${shortId(targets[0].id)}`}
          confirmLabel="Assign" busy={busy} confirmDisabled={!chosen} onClose={close}
          onConfirm={() => runAction(`Assigned to ${chosen.name}`, targets, r => assignCollector(r, chosen))}>
          {assignScope.region && (
            <p className="text-sm" data-testid="assign-region-note">You can assign requests in <strong>{assignScope.region}</strong> region only, to collectors in {assignScope.region}.</p>
          )}
          {ranked.length === 0 ? (
            <p className="text-sm" style={muted}>No collectors{assignScope.region ? ` in ${assignScope.region} region` : ''} yet.</p>
          ) : (
            <CollectorPicker collectors={ranked} value={dialog.collectorId} onChange={id => setDialog(d => ({ ...d, collectorId: id }))} className="w-full" />
          )}
          {chosen && (
            <>
              <p>
                {targets.length > 1 ? 'Farthest request: ' : 'Distance to the pickup: '}
                <strong>{chosen.position ? (distances.some(d => d !== null) ? `${farthest.toFixed(1)} km` : 'unknown (request has no location)') : 'unknown (collector has no location)'}</strong>
                {' · '}{chosen.online ? 'online' : `offline, last seen ${relativeTime(collectorLastSeen(chosen))}`}
                {' · '}{chosen.jobs.active} active job{chosen.jobs.active === 1 ? '' : 's'}
              </p>
              {farthest > FAR_COLLECTOR_KM && (
                <p className="rounded bg-amber-50 text-amber-900 border border-amber-300 p-2">This collector is more than {FAR_COLLECTOR_KM} km away.</p>
              )}
            </>
          )}
        </ConfirmDialog>
      );
    }

    if (dialog.type === 'cancel') {
      const needsNote = dialog.reason === 'Other';
      return (
        <ConfirmDialog title={dialog.rows.length > 1 ? `Cancel ${dialog.rows.length} requests` : `Cancel request #${shortId(dialog.rows[0].id)}`}
          confirmLabel="Cancel request" danger busy={busy} confirmDisabled={!dialog.reason || (needsNote && !dialog.note.trim())} onClose={close}
          onConfirm={() => runAction('Cancelled', dialog.rows, r => cancelRequest(r, { reason: dialog.reason, note: dialog.note.trim(), userId: user?.id }))}>
          <label className="block">
            <span className="block text-xs mb-1" style={muted}>Reason (required)</span>
            <select value={dialog.reason} onChange={e => setDialog(d => ({ ...d, reason: e.target.value }))} className="w-full border rounded px-2 py-1.5" style={input}>
              <option value="">Choose a reason…</option>
              {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs mb-1" style={muted}>Note{needsNote ? ' (required)' : ' (optional)'}</span>
            <textarea value={dialog.note} onChange={e => setDialog(d => ({ ...d, note: e.target.value }))} rows={2} className="w-full border rounded px-2 py-1.5" style={input} />
          </label>
          <p style={muted}>The customer's request will be cancelled. This can't be undone.</p>
        </ConfirmDialog>
      );
    }

    if (dialog.type === 'complete') {
      const row = dialog.rows[0];
      return (
        <ConfirmDialog title={`Mark #${shortId(row.id)} as completed?`} confirmLabel="Mark as completed" busy={busy} onClose={close}
          onConfirm={() => runAction('Completed', [row], r => changeStatus(r, 'disposed'))}>
          <p>Collector: <strong>{row.collectorName || 'assigned'}</strong>. Use this only when the waste has been collected.</p>
        </ConfirmDialog>
      );
    }

    if (dialog.type === 'duplicate') {
      const { rows: [row], other } = dialog;
      return (
        <ConfirmDialog title={`Merge #${shortId(row.id)} into #${shortId(other.id)}?`} confirmLabel="Cancel as duplicate" danger busy={busy} onClose={close}
          onConfirm={() => runAction('Merged', [row], r => cancelRequest(r, { reason: 'Duplicate request', note: `Duplicate of ${other.id}`, userId: user?.id }))}>
          <p>#{shortId(row.id)} will be cancelled with the reason "Duplicate of #{shortId(other.id)}". #{shortId(other.id)} stays open.</p>
        </ConfirmDialog>
      );
    }
    return null;
  };

  /* ── page ───────────────────────────────────────────────────────────── */
  const initialLoading = !pageData && !loadError;
  const activeFilterCount = ['q', 'status', 'priority', 'collector', 'from', 'to', 'source', 'unassigned'].filter(k => filters[k]).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Pickup Requests</h1>
          <p className="text-sm" style={muted}>Requests, digital bins and scheduled pickups{pageData?.mode === 'browser' ? ' · loaded in the browser (run migration 20261015 for server paging)' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refreshAll} className="px-3 py-2 rounded border text-sm" style={{ ...border, ...card }}>
            <i className={`fas fa-sync-alt mr-1.5 ${tableLoading ? 'fa-spin' : ''}`}></i>Refresh
          </button>
          <button type="button" onClick={exportCsv} className="px-3 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700">
            <i className="fas fa-file-csv mr-1.5"></i>Export CSV
          </button>
        </div>
      </div>

      {/* Stats: always all requests; click to filter */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={muted}>All requests</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map(s => (
            summaryRows === null ? <SkeletonBlock key={s.label} className="h-[72px]" /> : (
              <button type="button" key={s.label} onClick={() => setFilters({ status: s.filter })} aria-pressed={filters.status === s.filter}
                className={`text-left rounded-xl border px-4 py-3 transition-shadow hover:shadow ${filters.status === s.filter ? 'ring-2 ring-green-500' : ''}`} style={card}>
                <p className="text-xs flex items-center gap-1.5" style={muted}><span className="w-2 h-2 rounded-full" style={{ background: s.color }}></span>{s.label}</p>
                <p className="text-2xl font-bold" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>{s.value}</p>
              </button>
            )
          ))}
        </div>
      </div>

      {/* Collectors */}
      <div className="rounded-xl border p-4" style={card}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Active Collectors</h2>
          <span className="text-xs" style={muted}>{collectors.filter(c => c.online).length} online · click a collector to see their requests</span>
        </div>
        {collectors.length === 0 && summaryRows === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <SkeletonBlock key={i} className="h-20" />)}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {collectorsWithJobs.filter(c => c.status === 'active' || c.jobs.active > 0).map(c => (
              <button type="button" key={c.id} onClick={() => setFilters({ collector: filters.collector === c.id ? '' : c.id })}
                className={`text-left rounded border p-3 hover:shadow ${filters.collector === c.id ? 'ring-2 ring-green-500' : ''}`} style={border} data-testid="collector-card">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.online ? '#16A34A' : '#9CA3AF' }}></span>
                  <span className="font-medium text-sm truncate">{c.name}</span>
                  <span className={`ml-auto text-xs px-1.5 rounded ${c.online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-td-sage'}`}>{c.online ? 'Online' : 'Offline'}</span>
                </div>
                <p className="text-xs mt-1 truncate" style={muted}>{c.vehicleRegistration ? `${c.vehicle?.type || 'Vehicle'} · ${c.vehicleRegistration}` : 'No vehicle info'}</p>
                <p className="text-xs mt-1">
                  Active <strong>{c.jobs.active}</strong> · Completed <strong>{c.jobs.completed}</strong>
                  <span style={muted}> · {relativeTime(collectorLastSeen(c))}</span>
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border px-4 py-3 flex flex-wrap gap-3 items-end" style={card}>
        <label className="flex-1 min-w-[200px]">
          <span className="block text-xs mb-1" style={muted}>Search</span>
          <input type="search" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Request ID (full or partial), customer, address, collector"
            className="w-full border rounded px-3 py-1.5 text-sm" style={input} />
        </label>
        <label>
          <span className="block text-xs mb-1" style={muted}>Status</span>
          <select value={filters.status} onChange={e => setFilters({ status: e.target.value })} className="border rounded px-2 py-1.5 text-sm" style={input} aria-label="Status filter">
            <option value="">All statuses</option>
            <optgroup label="Groups">
              {STATUS_GROUPS.map(g => <option key={g.key} value={`group:${g.key}`}>{g.label}</option>)}
            </optgroup>
            <optgroup label="Statuses">
              {PICKUP_STATUSES.map(s => <option key={s.key} value={`status:${s.key}`}>{s.label}</option>)}
            </optgroup>
          </select>
        </label>
        <label>
          <span className="block text-xs mb-1" style={muted}>Priority</span>
          <select value={filters.priority} onChange={e => setFilters({ priority: e.target.value })} className="border rounded px-2 py-1.5 text-sm" style={input} aria-label="Priority filter">
            <option value="">All priorities</option>
            {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}{p.key === 'medium' ? ' (Normal)' : ''}</option>)}
          </select>
        </label>
        <label>
          <span className="block text-xs mb-1" style={muted}>Collector</span>
          <select value={filters.collector} onChange={e => setFilters({ collector: e.target.value })} className="border rounded px-2 py-1.5 text-sm max-w-[180px]" style={input} aria-label="Collector filter">
            <option value="">All collectors</option>
            {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {(filters.from || filters.to || filters.source || filters.unassigned) && (
          <span className="text-xs rounded-full px-2 py-1 mb-1 bg-blue-50 text-blue-800 border border-blue-200" data-testid="dashboard-filter-note">
            {[filters.unassigned && 'No collector', filters.source && (filters.source === 'digital_bins' ? 'Digital bins' : 'Pickup requests'),
              (filters.from || filters.to) && `Requested ${filters.from || '…'} to ${filters.to || '…'}`].filter(Boolean).join(' · ')}
          </span>
        )}
        {activeFilterCount > 0 && (
          <button type="button" onClick={() => { setSearchText(''); setParams(new URLSearchParams(), { replace: true }); }} className="text-sm underline pb-1.5" style={muted}>
            Clear filters ({activeFilterCount})
          </button>
        )}
      </div>

      {assignScope.reason && (
        <p className="text-sm rounded border px-3 py-2" style={border} data-testid="assign-scope-note">{assignScope.reason}</p>
      )}
      {assignScope.region && (
        <p className="text-sm" style={muted} data-testid="assign-scope-region">You can assign pickup requests in <strong>{assignScope.region}</strong> region to collectors in that region.</p>
      )}

      {filterCollector && (
        <p className="text-sm">Showing requests for <strong>{filterCollector.name}</strong> <button type="button" className="underline" style={muted} onClick={() => setFilters({ collector: '' })}>show all</button></p>
      )}

      {/* Bulk actions */}
      {selectedRows.length > 0 && (
        <div className="rounded-xl border px-4 py-2 flex flex-wrap items-center gap-3 text-sm" style={card} role="region" aria-label="Bulk actions">
          <strong>{selectedRows.length} selected</strong>
          {assignScope.canAssign && (
            <button type="button" disabled={!assignable.length} onClick={() => openAssign(assignable)} className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40">
              Assign {assignable.length !== selectedRows.length ? `(${assignable.length} pending)` : ''}
            </button>
          )}
          <button type="button" disabled={!cancellable.length} onClick={() => openCancel(cancellable)} className="px-3 py-1.5 rounded border border-red-300 text-red-700 disabled:opacity-40">
            Cancel {cancellable.length !== selectedRows.length ? `(${cancellable.length} can be cancelled)` : ''}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="underline" style={muted}>Clear</button>
        </div>
      )}

      {/* Table / cards */}
      {loadError && !pageData ? (
        <div className="rounded-xl border p-8 text-center" style={card} role="alert">
          <p className="font-semibold mb-1">Couldn't load requests</p>
          <p className="text-sm mb-3" style={muted}>{loadError}</p>
          <button type="button" onClick={() => loadPage({ force: true })} className="px-4 py-2 rounded bg-green-600 text-white">Retry</button>
        </div>
      ) : initialLoading ? (
        <div className="rounded-xl border p-4 space-y-3" style={card} aria-busy="true">{[...Array(8)].map((_, i) => <SkeletonBlock key={i} className="h-9" />)}</div>
      ) : (
        <div className={`rounded-xl border ${tableLoading ? 'opacity-60' : ''}`} style={card}>
          {loadError && <p className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200">Couldn't refresh: {loadError}</p>}

          {rows.length === 0 ? (
            <div className="p-10 text-center" data-testid="empty-state">
              <p className="font-medium">No requests match these filters</p>
              {activeFilterCount > 0 && <button type="button" className="mt-2 text-sm underline" style={muted} onClick={() => { setSearchText(''); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</button>}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead style={{ background: 'var(--td-page-bg)' }}>
                    <tr>
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox" aria-label="Select all on this page" checked={rows.length > 0 && rows.every(r => selected.has(keyOf(r)))}
                          onChange={e => setSelected(e.target.checked ? new Set(rows.map(keyOf)) : new Set())} />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={muted}>ID</th>
                      <SortHeader k="created_at">Requested</SortHeader>
                      <SortHeader k="status">Status</SortHeader>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={muted}>Customer / Area</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={muted}>Qty</th>
                      <SortHeader k="priority">Priority</SortHeader>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider" style={muted}>Collector</th>
                      <SortHeader k="fee">Fee</SortHeader>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider sticky right-0" style={{ ...muted, background: 'var(--td-page-bg)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={keyOf(row)} className="border-t align-top group" style={border} data-testid="request-row">
                        <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${shortId(row.id)}`} checked={selected.has(keyOf(row))}
                          onChange={e => setSelected(prev => { const n = new Set(prev); if (e.target.checked) n.add(keyOf(row)); else n.delete(keyOf(row)); return n; })} /></td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button type="button" className="font-mono text-xs underline decoration-dotted" title={row.id} onClick={() => setDetail(row)}>{shortId(row.id)}</button>
                          <button type="button" className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded align-middle hover:bg-td-cream" style={muted} onClick={() => copyId(row.id)} aria-label="Copy request ID" title="Copy full ID"><i className="far fa-copy text-xs" aria-hidden="true"></i></button>
                          <span className="block text-xs" style={muted}>{row.source === 'digital_bins' ? 'Digital Bin' : row.source === 'scheduled_pickups' ? 'Scheduled' : 'Request'}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" title={fullDate(row.createdAt)}>{relativeAge(row.createdAt)}</td>
                        <td className="px-3 py-2"><StatusBadge status={row.status} /><div className="mt-1"><Flags row={row} /></div></td>
                        <td className="px-3 py-2 max-w-[220px]">
                          <span className="block truncate font-medium">{row.customer?.name || 'Unknown customer'}</span>
                          <span className="block truncate text-xs" style={muted}><AreaCell row={row} /></span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{bagsLabel(row.bags)}</td>
                        <td className="px-3 py-2"><PriorityBadge priority={row.priority} /></td>
                        <td className="px-3 py-2 max-w-[140px] truncate">{row.collectorName || <span style={muted}>—</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatGhs(row.fee)}</td>
                        <td className="px-3 py-2 sticky right-0" style={{ background: 'var(--td-card-bg)' }}><RowActions row={row} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y" style={border}>
                {rows.map(row => (
                  <li key={keyOf(row)} className="p-3 space-y-1.5" style={border} data-testid="request-card">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" aria-label={`Select ${shortId(row.id)}`} checked={selected.has(keyOf(row))}
                        onChange={e => setSelected(prev => { const n = new Set(prev); if (e.target.checked) n.add(keyOf(row)); else n.delete(keyOf(row)); return n; })} />
                      <span className="font-mono text-xs">{shortId(row.id)}</span>
                      <StatusBadge status={row.status} />
                      <span className="ml-auto text-xs" style={muted} title={fullDate(row.createdAt)}>{relativeAge(row.createdAt)}</span>
                    </div>
                    <p className="font-medium">{row.customer?.name || 'Unknown customer'} <span className="font-normal text-xs" style={muted}>· <AreaCell row={row} /></span></p>
                    <p className="text-xs" style={muted}>{bagsLabel(row.bags)} · {formatGhs(row.fee)} · {row.collectorName || 'No collector'}</p>
                    <div className="flex items-center gap-2"><PriorityBadge priority={row.priority} /><Flags row={row} /><div className="ml-auto"><RowActions row={row} /></div></div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t text-sm" style={border}>
            <span style={muted} data-testid="page-info">
              {pageData?.total ? `Showing ${(filters.page - 1) * PAGE_SIZE + 1}–${Math.min(filters.page * PAGE_SIZE, pageData.total)} of ${pageData.total}` : '0 results'}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={filters.page <= 1} onClick={() => setFilters({ page: filters.page - 1 })} className="px-3 py-1 rounded border disabled:opacity-40" style={border}>Previous</button>
              <span>Page {filters.page} of {totalPages}</span>
              <button type="button" disabled={filters.page >= totalPages} onClick={() => setFilters({ page: filters.page + 1 })} className="px-3 py-1 rounded border disabled:opacity-40" style={border}>Next</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <RequestDetailsModal
          row={detail}
          address={addressOf(detail)}
          collectors={collectorsWithJobs}
          assignCollectors={assignCollectors}
          duplicates={duplicatesOf(detail)}
          outsideServiceArea={outside(detail)}
          busy={busy}
          onAssign={assignScope.canAssign ? (row, collector) => openAssign([row], collector?.id || '') : null}
          onStatus={onStatus}
          onCancel={openCancel}
          onCancelAsDuplicate={(row, other) => setDialog({ type: 'duplicate', rows: [row], other })}
          onOpenRequest={(other) => { setDetail(null); setFilters({ q: other.id }); }}
          onCopy={copyId}
          onClose={() => setDetail(null)}
        />
      )}

      {renderDialog()}

      {toast && (
        <div className={`fixed top-20 right-4 z-[4000] max-w-md rounded-lg shadow-xl px-4 py-3 text-sm text-white ${toast.tone === 'error' ? 'bg-red-700' : 'bg-gray-800'}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default RequestPickupManagement;
