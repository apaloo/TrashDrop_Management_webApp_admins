import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchCollectorsAdmin, createCollectorProfile, updateCollectorProfile, setCollectorActive, findCollectorClashes,
} from '../utils/collectorService';
import { fetchServiceZones } from '../services/serviceZoneService';
import { fetchSummaryRows, fetchUnassignedPending, assignCollector } from '../services/pickupAdminService';
import { withCollectorPosition } from '../utils/liveMapUtils';
import { collectorJobCounts, shortId, formatGhs } from '../utils/pickupRequestUtils';
import { IN_PROGRESS_STATUSES, canonicalStatus } from '../constants/pickupStatus';
import {
  DEFAULT_COLLECTOR_FILTERS, SORTS, UNASSIGNED, withCollectorStats, filterCollectors, sortCollectors,
  zoneOptions, vehicleSummary, vehicleTypeInfo, formatGhanaPhone, assignBlockedReason,
} from '../utils/collectorAdminUtils';
import { card, input, muted, border } from '../components/pickupRequests/theme';
import ConfirmDialog from '../components/pickupRequests/ConfirmDialog';
import CollectorFormModal from '../components/collectors/CollectorFormModal';
import CollectorDetailsModal from '../components/collectors/CollectorDetailsModal';
import AssignPickupsModal from '../components/collectors/AssignPickupsModal';
import DeactivateDialog from '../components/collectors/DeactivateDialog';
import ActionsMenu from '../components/collectors/ActionsMenu';
import PresenceBadge from '../components/collectors/PresenceBadge';

const SkeletonBlock = ({ className }) => <div className={`animate-pulse rounded bg-gray-300 opacity-40 ${className}`} />;

const VIEW_KEY = 'td.collectors.view';
const readView = () => {
  try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'; } catch (e) { return 'cards'; }
};

const readFilters = (params) => {
  const f = { ...DEFAULT_COLLECTOR_FILTERS };
  Object.keys(f).forEach(k => { if (params.get(k) !== null) f[k] = params.get(k); });
  if (!SORTS.some(s => s.key === f.sort)) f.sort = DEFAULT_COLLECTOR_FILTERS.sort;
  if (f.dir !== 'asc' && f.dir !== 'desc') f.dir = 'asc';
  return f;
};

const SKIPPED_HINT = {
  vehicle_capacity_bags: 'vehicle capacity',
  deactivation_reason: 'deactivation reason',
};
const skippedNote = (skipped) => {
  const named = skipped.map(s => SKIPPED_HINT[s]).filter(Boolean);
  return named.length ? ` (${named.join(', ')} not stored yet: run the 20261016 migration)` : '';
};

const Avatar = ({ c }) => {
  const initials = `${c.firstName?.[0] || c.name?.[0] || '?'}${c.lastName?.[0] || ''}`.toUpperCase();
  return (
    <div className="relative flex-shrink-0">
      {c.avatar
        ? <img src={c.avatar} alt="" className="w-12 h-12 rounded-full object-cover border" style={border} />
        : <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold bg-green-100 text-green-800" aria-hidden="true">{initials}</div>}
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: c.presence.color }} aria-hidden="true"></span>
    </div>
  );
};

/** Disabled buttons don't show tooltips in every browser, so the reason sits on a wrapper */
const AssignButton = ({ c, onClick, compact = false }) => {
  const blocked = assignBlockedReason(c);
  return (
    <span title={blocked || 'Assign pending pickups'} className="inline-flex">
      <button type="button" disabled={!!blocked} onClick={onClick} aria-label={`Assign pickups to ${c.name}`}
        className="px-3 py-1.5 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
        <i className="fas fa-tasks mr-1" aria-hidden="true"></i>{compact ? 'Assign' : 'Assign pickups'}
      </button>
    </span>
  );
};

const CollectorsManagement = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const [searchText, setSearchText] = useState(filters.q);
  const [view, setViewState] = useState(readView);

  const [collectors, setCollectors] = useState([]);
  const [zones, setZones] = useState([]);
  const [summaryRows, setSummaryRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Only one modal at a time; closing any of them clears it (and the form)
  const [modal, setModal] = useState(null); // { type: 'add'|'edit'|'details'|'assign'|'deactivate'|'reactivate', id, key }
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [assignRows, setAssignRows] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, tone = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ── URL-backed filters ─────────────────────────────────────────────── */
  const setFilters = useCallback((patch) => {
    const next = { ...filters, ...patch };
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined && String(v) !== String(DEFAULT_COLLECTOR_FILTERS[k])) sp.set(k, String(v));
    });
    setParams(sp, { replace: true });
  }, [filters, setParams]);

  useEffect(() => { setSearchText(filters.q); }, [filters.q]);
  useEffect(() => {
    if (searchText === filters.q) return undefined;
    const t = setTimeout(() => setFilters({ q: searchText }), 250);
    return () => clearTimeout(t);
  }, [searchText, filters.q, setFilters]);

  const setView = (v) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch (e) { /* private mode */ }
  };

  /* ── data ───────────────────────────────────────────────────────────── */
  const loadSummary = useCallback(async (list) => {
    try {
      setSummaryRows(await fetchSummaryRows(list));
    } catch (error) {
      console.error('Collectors: request stats failed to load', error);
      setSummaryRows(prev => prev || []);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, zoneResult] = await Promise.all([fetchCollectorsAdmin(), fetchServiceZones()]);
      setCollectors(list);
      setZones(zoneResult.zones);
      setLoadError(null);
      setLoading(false);
      await loadSummary(list);
    } catch (error) {
      console.error('Collectors: failed to load', error);
      setLoadError(error.message || 'Could not load collectors');
      setLoading(false);
    }
  }, [loadSummary]);

  useEffect(() => { load(); }, [load]);
  // Presence ("online", "last seen 3 h ago") moves with the clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  /* ── derived ────────────────────────────────────────────────────────── */
  const jobCounts = useMemo(() => collectorJobCounts(summaryRows || []), [summaryRows]);
  const enriched = useMemo(
    () => collectors.map(c => withCollectorStats(withCollectorPosition(c), jobCounts, now)),
    [collectors, jobCounts, now],
  );
  const visible = useMemo(
    () => sortCollectors(filterCollectors(enriched, filters), filters.sort, filters.dir),
    [enriched, filters],
  );
  const allZones = useMemo(() => zoneOptions(zones, collectors), [zones, collectors]);
  const counts = useMemo(() => ({
    total: enriched.length,
    active: enriched.filter(c => c.status === 'active').length,
    online: enriched.filter(c => c.presence.key === 'online').length,
    activeJobs: enriched.reduce((s, c) => s + c.jobs.active, 0),
    unassigned: enriched.filter(c => !c.zone).length,
  }), [enriched]);
  const filtered = filters.q || filters.status !== 'all' || filters.zone !== 'all' || filters.presence !== 'all';

  const current = modal?.id ? enriched.find(c => c.id === modal.id) : null;

  // Deep link from the Logs page (?open=<collector id>)
  const openParam = useRef(params.get('open'));
  useEffect(() => {
    const id = openParam.current;
    if (!id || !collectors.length) return;
    openParam.current = null;
    if (collectors.some(c => c.id === id)) setModal({ type: 'details', id, key: Date.now() });
  }, [collectors]);
  const activeJobsOf = (c) => (summaryRows || []).filter(r => r.collectorProfileId === c.id && IN_PROGRESS_STATUSES.includes(canonicalStatus(r.status)));

  /* ── actions ────────────────────────────────────────────────────────── */
  const open = (type, c = null) => {
    setFormError(null);
    setAssignRows(null);
    setModal({ type, id: c?.id || null, key: Date.now() });
    if (type === 'assign' && c) {
      fetchUnassignedPending(collectors)
        .then(setAssignRows)
        .catch(error => { notify(`Couldn't load pending requests: ${error.message}`, 'error'); setAssignRows([]); });
    }
  };
  const close = useCallback(() => {
    if (busy) return;
    setModal(null);
    setFormError(null);
    setAssignRows(null);
  }, [busy]);

  const copyId = (id) => {
    navigator.clipboard?.writeText(id).then(() => notify('Collector ID copied')).catch(() => notify(id));
  };

  const replaceCollector = (saved) => setCollectors(prev => {
    const exists = prev.some(c => c.id === saved.id);
    return exists ? prev.map(c => (c.id === saved.id ? saved : c)) : [...prev, saved];
  });

  const saveCollector = async (values) => {
    const editing = modal.type === 'edit' ? current : null;
    setBusy(true);
    setFormError(null);
    try {
      const clashes = await findCollectorClashes(values, editing?.id);
      if (clashes.length) {
        const c = clashes[0];
        throw new Error(`${[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Another collector'} already uses this ${values.email && c.email?.toLowerCase() === values.email ? 'email' : 'phone number'}`);
      }
      const { collector: saved, skipped } = editing
        ? await updateCollectorProfile(editing.id, values)
        : await createCollectorProfile(values);
      replaceCollector(saved);
      setModal(null);
      notify(`${editing ? 'Saved' : 'Added'} ${saved.name}${skippedNote(skipped)}`);
    } catch (error) {
      setFormError(error.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const assignPickups = async (rows) => {
    const c = current;
    setBusy(true);
    const failed = [];
    for (const row of rows) {
      try {
        await assignCollector(row, c);
      } catch (error) {
        failed.push(`#${shortId(row.id)}: ${error.message}`);
      }
    }
    setBusy(false);
    setModal(null);
    const ok = rows.length - failed.length;
    if (failed.length) notify(`Assigned ${ok} of ${rows.length} to ${c.name}. ${failed.join('; ')}`, 'error');
    else notify(`Assigned ${ok} pickup${ok === 1 ? '' : 's'} to ${c.name}. They've been notified.`);
    loadSummary(collectors);
  };

  const deactivate = async (reason) => {
    const c = current;
    setBusy(true);
    try {
      // Re-check active jobs against fresh data before switching them off
      const fresh = await fetchSummaryRows(collectors);
      setSummaryRows(fresh);
      const stillActive = fresh.filter(r => r.collectorProfileId === c.id && IN_PROGRESS_STATUSES.includes(canonicalStatus(r.status)));
      if (stillActive.length) throw new Error(`${c.name} has ${stillActive.length} active job${stillActive.length === 1 ? '' : 's'}; reassign them first`);
      const { collector: saved, skipped } = await setCollectorActive(c.id, false, { reason, userId: user?.id });
      replaceCollector(saved);
      setModal(null);
      notify(`${c.name} deactivated${skippedNote(skipped)}`);
    } catch (error) {
      notify(error.message || 'Could not deactivate', 'error');
    } finally {
      setBusy(false);
    }
  };

  const reactivate = async () => {
    const c = current;
    setBusy(true);
    try {
      const { collector: saved } = await setCollectorActive(c.id, true, { userId: user?.id });
      replaceCollector(saved);
      setModal(null);
      notify(`${c.name} reactivated`);
    } catch (error) {
      notify(error.message || 'Could not reactivate', 'error');
    } finally {
      setBusy(false);
    }
  };

  const menuItems = (c) => [
    { label: 'View details', icon: 'fas fa-eye', onClick: () => open('details', c) },
    { label: 'Edit', icon: 'fas fa-pen', onClick: () => open('edit', c) },
    { label: 'Copy ID', icon: 'far fa-copy', onClick: () => copyId(c.id) },
    c.status === 'active'
      ? { label: 'Deactivate', icon: 'fas fa-user-slash', danger: true, onClick: () => open('deactivate', c) }
      : { label: 'Reactivate', icon: 'fas fa-user-check', onClick: () => open('reactivate', c) },
  ];

  const toggleSort = (key) => {
    const def = SORTS.find(s => s.key === key);
    setFilters({ sort: key, dir: filters.sort === key ? (filters.dir === 'asc' ? 'desc' : 'asc') : def.dir });
  };
  const sortArrow = (key) => (filters.sort === key ? (filters.dir === 'asc' ? ' ↑' : ' ↓') : '');

  const statsReady = summaryRows !== null;
  const ratingText = (c) => (!statsReady ? '…' : c.jobs.rating !== null ? `★ ${c.jobs.rating.toFixed(1)}` : 'No ratings yet');

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 space-y-4" style={{ color: 'var(--td-text-primary)' }}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Collectors</h1>
        <button type="button" onClick={load} disabled={loading} className="ml-auto px-3 py-2 rounded border text-sm" style={{ ...border, ...muted }}>
          <i className={`fas fa-sync-alt mr-1.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true"></i>Refresh
        </button>
        <button type="button" onClick={() => open('add')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium">
          <i className="fas fa-plus mr-2" aria-hidden="true"></i>Add collector
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Collectors', value: counts.total, onClick: () => setFilters({ status: 'all', presence: 'all', zone: 'all' }) },
          { label: 'Active', value: counts.active, onClick: () => setFilters({ status: 'active' }) },
          { label: 'Online now', value: counts.online, color: '#16A34A', onClick: () => setFilters({ presence: 'online' }) },
          { label: 'Active jobs', value: statsReady ? counts.activeJobs : '…', color: '#8B5CF6' },
          { label: 'No service zone', value: counts.unassigned, onClick: () => setFilters({ zone: UNASSIGNED }) },
        ].map(s => (
          loading ? <SkeletonBlock key={s.label} className="h-[68px]" /> : (
            <button type="button" key={s.label} onClick={s.onClick} disabled={!s.onClick}
              className="text-left rounded-lg border px-4 py-3 transition-shadow hover:shadow disabled:cursor-default disabled:hover:shadow-none" style={card}>
              <p className="text-xs flex items-center gap-1.5" style={muted}>{s.color && <span className="w-2 h-2 rounded-full" style={{ background: s.color }}></span>}{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </button>
          )
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-lg border px-4 py-3 flex flex-wrap gap-3 items-end" style={card}>
        <label className="flex-1 min-w-[200px]">
          <span className="block text-xs mb-1" style={muted}>Search</span>
          <input type="search" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Name, phone (024…, +233…), email or ID"
            className="w-full border rounded px-3 py-1.5 text-sm" style={input} />
        </label>
        <label className="w-full sm:w-auto">
          <span className="block text-xs mb-1" style={muted}>Status</span>
          <select value={filters.status} onChange={e => setFilters({ status: e.target.value })} className="w-full sm:w-auto border rounded px-2 py-1.5 text-sm" style={input} aria-label="Status filter">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="w-full sm:w-auto">
          <span className="block text-xs mb-1" style={muted}>Service zone</span>
          <select value={filters.zone} onChange={e => setFilters({ zone: e.target.value })} className="w-full sm:w-auto sm:max-w-[14rem] border rounded px-2 py-1.5 text-sm" style={input} aria-label="Zone filter">
            <option value="all">All zones</option>
            <option value={UNASSIGNED}>Unassigned</option>
            {allZones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        <label className="w-full sm:w-auto">
          <span className="block text-xs mb-1" style={muted}>Online</span>
          <select value={filters.presence} onChange={e => setFilters({ presence: e.target.value })} className="w-full sm:w-auto border rounded px-2 py-1.5 text-sm" style={input} aria-label="Online filter">
            <option value="all">Everyone</option>
            <option value="online">Online now (10 min)</option>
            <option value="recent">Seen in last 24 h</option>
            <option value="offline">Offline (24 h+)</option>
          </select>
        </label>
        <label>
          <span className="block text-xs mb-1" style={muted}>Sort</span>
          <div className="flex">
            <select value={filters.sort} onChange={e => setFilters({ sort: e.target.value, dir: SORTS.find(s => s.key === e.target.value).dir })}
              className="border rounded-l px-2 py-1.5 text-sm" style={input} aria-label="Sort by">
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button type="button" onClick={() => setFilters({ dir: filters.dir === 'asc' ? 'desc' : 'asc' })} className="border border-l-0 rounded-r px-2.5 text-sm" style={input}
              aria-label={filters.dir === 'asc' ? 'Ascending' : 'Descending'} title={filters.dir === 'asc' ? 'Ascending' : 'Descending'}>
              <span aria-hidden="true">{filters.dir === 'asc' ? '↑' : '↓'}</span>
            </button>
          </div>
        </label>
        <div className="flex rounded border overflow-hidden" style={border} role="group" aria-label="Layout">
          {[['cards', 'fas fa-th-large', 'Cards'], ['table', 'fas fa-list', 'Table']].map(([v, icon, label]) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              className={`px-3 py-1.5 text-sm ${view === v ? 'bg-green-600 text-white' : ''}`} style={view === v ? undefined : muted}>
              <i className={`${icon} mr-1.5`} aria-hidden="true"></i>{label}
            </button>
          ))}
        </div>
        {filtered && (
          <button type="button" className="text-sm underline" style={muted} onClick={() => { setSearchText(''); setParams(new URLSearchParams(), { replace: true }); }}>
            Clear filters
          </button>
        )}
      </div>

      {loadError && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm flex items-center gap-3" role="alert">
          <span>Couldn't load collectors: {loadError}</span>
          <button type="button" className="ml-auto underline" onClick={load}>Try again</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-56" />)}</div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border p-8 text-center" style={card}>
          <i className="fas fa-user-slash text-3xl mb-3" style={muted} aria-hidden="true"></i>
          <h3 className="font-medium">No collectors found</h3>
          <p className="text-sm mt-1" style={muted}>{filtered ? 'Try other filters or search terms' : 'Add a collector to get started'}</p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="collector-grid">
          {visible.map(c => {
            const type = vehicleTypeInfo(c.vehicleType);
            return (
              <article key={c.id} className="rounded-lg border flex flex-col hover:shadow-md transition-shadow" style={card} data-testid="collector-card">
                <div className="flex items-start gap-3 p-4 border-b" style={border}>
                  <Avatar c={c} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-tight truncate" title={c.name}>
                      <button type="button" className="hover:underline text-left truncate max-w-full" onClick={() => open('details', c)}>{c.name}</button>
                    </h3>
                    <p className="text-sm truncate" style={muted}>{c.zone || 'Unassigned'}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <PresenceBadge presence={c.presence} showLastSeen />
                      {c.status !== 'active' && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 capitalize">{c.status}</span>}
                      {type && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-800 whitespace-nowrap"><i className={`${type.icon} mr-1`} aria-hidden="true"></i>{type.label}</span>}
                    </div>
                  </div>
                </div>

                <dl className="p-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm flex-1">
                  <div>
                    <dt className="text-xs" style={muted}>ID</dt>
                    <dd className="flex items-center gap-1.5">
                      <span className="font-mono" title={c.id}>{shortId(c.id)}</span>
                      <button type="button" onClick={() => copyId(c.id)} aria-label="Copy collector ID" title="Copy full ID" className="text-xs" style={muted}><i className="far fa-copy" aria-hidden="true"></i></button>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs" style={muted}>Phone</dt>
                    <dd className="truncate">{c.phone ? formatGhanaPhone(c.phone) : '—'}</dd>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <dt className="text-xs" style={muted}>Vehicle</dt>
                    <dd className="truncate">{vehicleSummary(c) || <span style={muted}>No vehicle info</span>}</dd>
                  </div>
                </dl>

                <dl className="px-4 py-3 border-t grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm" style={border}>
                  <div className="flex justify-between gap-2"><dt style={muted}>Pickups</dt><dd className="font-semibold" data-testid="stat-pickups">{statsReady ? c.jobs.completed : '…'}</dd></div>
                  <div className="flex justify-between gap-2"><dt style={muted}>Active</dt><dd className="font-semibold">{statsReady ? c.jobs.active : '…'}</dd></div>
                  <div className="flex justify-between gap-2"><dt style={muted}>Rating</dt><dd className={`whitespace-nowrap ${c.jobs.rating === null ? 'text-xs self-center' : 'font-semibold'}`} style={c.jobs.rating === null ? muted : undefined}>{ratingText(c)}</dd></div>
                  <div className="flex justify-between gap-2"><dt style={muted}>Earnings</dt><dd className="font-semibold whitespace-nowrap">{statsReady ? formatGhs(c.jobs.earnings) : '…'}</dd></div>
                </dl>

                <div className="px-4 py-3 border-t flex items-center gap-2" style={border}>
                  <button type="button" onClick={() => open('details', c)} className="px-3 py-1.5 rounded border text-sm whitespace-nowrap" style={border}>
                    <i className="fas fa-eye mr-1" aria-hidden="true"></i>Details
                  </button>
                  <AssignButton c={c} onClick={() => open('assign', c)} />
                  <div className="ml-auto"><ActionsMenu items={menuItems(c)} label={`More actions for ${c.name}`} /></div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto" style={card}>
          <table className="w-full text-sm min-w-[760px]" data-testid="collector-table">
            <thead className="text-xs text-left" style={muted}>
              <tr className="border-b" style={border}>
                <th className="px-3 py-2"><button type="button" onClick={() => toggleSort('name')}>Name{sortArrow('name')}</button></th>
                <th className="px-3 py-2"><button type="button" onClick={() => toggleSort('lastSeen')}>Last seen{sortArrow('lastSeen')}</button></th>
                <th className="px-3 py-2 hidden 2xl:table-cell">Vehicle</th>
                <th className="px-3 py-2 text-right"><button type="button" onClick={() => toggleSort('pickups')}>Pickups{sortArrow('pickups')}</button></th>
                <th className="px-3 py-2 text-right">Active</th>
                <th className="px-3 py-2 text-right"><button type="button" onClick={() => toggleSort('rating')}>Rating{sortArrow('rating')}</button></th>
                <th className="px-3 py-2 text-right">Earnings</th>
                <th className="px-3 py-2 text-right sticky right-0" style={card}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(c => (
                <tr key={c.id} className="border-b align-middle" style={border}>
                  <td className="px-3 py-2 max-w-[13rem]">
                    <button type="button" className="font-medium hover:underline truncate block max-w-full text-left" title={c.name} onClick={() => open('details', c)}>{c.name}</button>
                    <span className="text-xs block truncate" style={muted} title={`ID ${c.id}`}>{c.phone ? formatGhanaPhone(c.phone) : 'No phone'} · {c.zone || 'Unassigned'}{c.status !== 'active' ? ' · inactive' : ''}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap"><PresenceBadge presence={c.presence} showLastSeen /></td>
                  <td className="px-3 py-2 max-w-[10rem] truncate hidden 2xl:table-cell" title={vehicleSummary(c) || ''}>{vehicleSummary(c) || <span style={muted}>—</span>}</td>
                  <td className="px-3 py-2 text-right">{statsReady ? c.jobs.completed : '…'}</td>
                  <td className="px-3 py-2 text-right">{statsReady ? c.jobs.active : '…'}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${c.jobs.rating === null ? 'text-xs' : ''}`} style={c.jobs.rating === null ? muted : undefined}>{ratingText(c)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{statsReady ? formatGhs(c.jobs.earnings) : '…'}</td>
                  <td className="px-3 py-2 sticky right-0" style={card}>
                    <div className="flex justify-end items-center gap-1.5">
                      <AssignButton c={c} compact onClick={() => open('assign', c)} />
                      <button type="button" className="px-2.5 py-1.5 rounded border text-sm" style={border} aria-label={`Edit ${c.name}`} onClick={() => open('edit', c)}>Edit</button>
                      {c.status === 'active'
                        ? <button type="button" className="px-2.5 py-1.5 rounded border text-sm text-red-600" style={border} aria-label={`Deactivate ${c.name}`} onClick={() => open('deactivate', c)}>Deactivate</button>
                        : <button type="button" className="px-2.5 py-1.5 rounded border text-sm text-green-700" style={border} aria-label={`Reactivate ${c.name}`} onClick={() => open('reactivate', c)}>Reactivate</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <p className="text-sm" style={muted}>
          Showing {visible.length} of {enriched.length} collectors{filtered ? ' (filtered)' : ''}.
          {' '}Online = location update in the last 10 minutes, same as the <Link to="/request-pickup/live-map" className="underline">Live Map</Link>.
        </p>
      )}

      {/* Modals (keyed so each opening starts from a clean form) */}
      {(modal?.type === 'add' || (modal?.type === 'edit' && current)) && (
        <CollectorFormModal key={modal.key} collector={modal.type === 'edit' ? current : null} collectors={collectors} zones={allZones}
          busy={busy} serverError={formError} onSave={saveCollector} onClose={close} />
      )}
      {modal?.type === 'details' && current && (
        <CollectorDetailsModal collector={current} requests={summaryRows} onClose={close} onCopy={copyId}
          actions={(
            <>
              <button type="button" className="px-4 py-2 rounded text-sm border" style={border} onClick={() => open('edit', current)}>Edit</button>
              {current.status === 'active'
                ? <button type="button" className="px-4 py-2 rounded text-sm border border-red-300 text-red-700" onClick={() => open('deactivate', current)}>Deactivate</button>
                : <button type="button" className="px-4 py-2 rounded text-sm border border-green-300 text-green-700" onClick={() => open('reactivate', current)}>Reactivate</button>}
              <AssignButton c={current} onClick={() => open('assign', current)} />
            </>
          )} />
      )}
      {modal?.type === 'assign' && current && (
        <AssignPickupsModal key={modal.key} collector={current} requests={assignRows} loading={assignRows === null} busy={busy} onAssign={assignPickups} onClose={close} />
      )}
      {modal?.type === 'deactivate' && current && (
        <DeactivateDialog key={modal.key} collector={current} activeJobs={activeJobsOf(current)} busy={busy} onConfirm={deactivate} onClose={close} />
      )}
      {modal?.type === 'reactivate' && current && (
        <ConfirmDialog title={`Reactivate ${current.name}?`} confirmLabel="Reactivate" busy={busy} onConfirm={reactivate} onClose={close}>
          <p>They'll be able to take pickups again. This is logged.</p>
          {current.deactivationReason && <p style={muted}>Deactivated because: {current.deactivationReason}</p>}
        </ConfirmDialog>
      )}

      {toast && (
        <div className={`fixed top-20 right-4 z-[4000] max-w-md rounded-lg shadow-xl px-4 py-3 text-sm text-white ${toast.tone === 'error' ? 'bg-red-700' : 'bg-gray-800'}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default CollectorsManagement;
