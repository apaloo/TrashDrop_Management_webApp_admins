import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchLogsPage, fetchLogStats, fetchAllLogs, logAudit, LOG_PAGE_SIZE } from '../services/auditLogService';
import { DEFAULT_LOG_FILTERS, formatAccra, relativeFromNow, recordLink, logsToCsv } from '../utils/logUtils';
import { LOG_LEVELS, LOG_SOURCES, ACTOR_ROLES, LOG_ACTIONS, LOG_ENTITY_TYPES } from '../constants/alerts';
import { card, input, muted, border } from '../components/pickupRequests/theme';
import { LogLevelBadge, actorRoleLabel } from '../components/logs/LogBadges';
import LogDetailsModal from '../components/logs/LogDetailsModal';

const SkeletonBlock = ({ className }) => <div className={`animate-pulse rounded bg-gray-300 opacity-40 ${className}`} />;

const readFilters = (params) => {
  const f = { ...DEFAULT_LOG_FILTERS };
  Object.keys(f).forEach(k => { if (params.get(k) !== null) f[k] = params.get(k); });
  f.page = Math.max(1, Number(f.page) || 1);
  return f;
};

const RANGES = [['today', 'Today'], ['24h', 'Last 24 h'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['all', 'All time'], ['custom', 'Custom…']];

const Select = ({ label, value, onChange, children }) => (
  <label className="w-full sm:w-auto">
    <span className="block text-xs mb-1" style={muted}>{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
      className="w-full sm:min-w-[10rem] border rounded px-2 py-1.5 text-sm" style={input}>{children}</select>
  </label>
);

const shortRef = (id) => (id ? String(id).slice(0, 8) : '');

const RecordCell = ({ log, onOpen }) => {
  if (!log.entityId) return <span style={muted}>—</span>;
  const link = recordLink(log.entityType, log.entityId);
  const label = LOG_ENTITY_TYPES.find(t => t.key === log.entityType)?.label || log.entityType || '';
  return (
    <span className="whitespace-nowrap">
      {link
        ? <button type="button" className="font-mono text-xs text-td-forest hover:underline" title={`${label} ${log.entityId}`} onClick={e => { e.stopPropagation(); onOpen(link); }}>#{shortRef(log.entityId)}</button>
        : <span className="font-mono text-xs" title={log.entityId}>#{shortRef(log.entityId)}</span>}
      <span className="block text-xs" style={muted}>{label}</span>
    </span>
  );
};

/** The admin audit trail: every change, sign-in and failure, newest first */
const LogsManagement = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const [searchText, setSearchText] = useState(filters.q);
  const [entityText, setEntityText] = useState(filters.entity);

  const [page, setPage] = useState(null);   // { rows, total }
  const [stats, setStats] = useState(null); // { total, errors, warnings, last24h }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, tone = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ── URL-backed filters ─────────────────────────────────────────────── */
  const setFilters = useCallback((patch) => {
    const next = { ...filters, ...patch };
    if (!('page' in patch)) next.page = 1;
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v !== '' && v != null && String(v) !== String(DEFAULT_LOG_FILTERS[k])) sp.set(k, String(v)); });
    setParams(sp, { replace: true });
  }, [filters, setParams]);

  useEffect(() => { setSearchText(filters.q); }, [filters.q]);
  useEffect(() => { setEntityText(filters.entity); }, [filters.entity]);
  useEffect(() => {
    if (searchText === filters.q && entityText === filters.entity) return undefined;
    const t = setTimeout(() => setFilters({ q: searchText, entity: entityText }), 300);
    return () => clearTimeout(t);
  }, [searchText, entityText, filters.q, filters.entity, setFilters]);

  /* ── data ───────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([fetchLogsPage(filters), fetchLogStats(filters)]);
      setPage(p);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllLogs(filters);
      const blob = new Blob([`﻿${logsToCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trashdrop-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      logAudit({ source: 'logs', action: 'logs.exported', message: `Exported ${rows.length} log rows to CSV`,
        metadata: { rows: rows.length, filters: Object.fromEntries(params.entries()) } });
      notify(`Exported ${rows.length} rows`);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const rows = page?.rows || [];
  const total = page?.total || 0;
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE));
  const filtered = Object.keys(DEFAULT_LOG_FILTERS).some(k => k !== 'page' && String(filters[k]) !== String(DEFAULT_LOG_FILTERS[k]));
  const openRecord = (link) => navigate(link);

  return (
    <div className="p-4 space-y-4" style={{ color: 'var(--td-text-primary)' }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Logs &amp; audit trail</h1>
          <p className="text-sm" style={muted}>Every change, sign-in and failure across the admin. Times are Accra time.</p>
        </div>
        <button type="button" onClick={load} className="px-3 py-2 rounded border text-sm" style={border}>Refresh</button>
        <button type="button" onClick={exportCsv} disabled={exporting || !total} className="px-3 py-2 rounded border text-sm disabled:opacity-40" style={border}>
          {exporting ? 'Exporting…' : `Export CSV (${total})`}
        </button>
      </div>

      {/* Counters for the current filters and date range */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="log-counters">
        {[
          ['Entries', stats?.total, null, 'counter-total'],
          ['Errors', stats?.errors, '#DC2626', 'counter-errors'],
          ['Warnings', stats?.warnings, '#D97706', 'counter-warnings'],
          ['Last 24 h', stats?.last24h, '#2563EB', 'counter-24h'],
        ].map(([label, value, color, id]) => (
          <div key={label} className="rounded-xl border px-4 py-3" style={card}>
            <p className="text-xs flex items-center gap-1.5" style={muted}>{color && <span className="w-2 h-2 rounded-full" style={{ background: color }}></span>}{label}</p>
            <p className="text-2xl font-bold" data-testid={id}>{value ?? '…'}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border px-4 py-3 flex flex-wrap gap-3 items-end" style={card}>
        <label className="flex-1 min-w-[220px]">
          <span className="block text-xs mb-1" style={muted}>Search</span>
          <input type="search" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Message, action, source, person or record ID"
            className="w-full border rounded px-3 py-1.5 text-sm" style={input} />
        </label>
        <Select label="Level" value={filters.level} onChange={v => setFilters({ level: v })}>
          <option value="">All levels</option>
          {LOG_LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
        </Select>
        <Select label="Source" value={filters.source} onChange={v => setFilters({ source: v })}>
          <option value="">All sources</option>
          {LOG_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select>
        <Select label="Actor" value={filters.actor} onChange={v => setFilters({ actor: v })}>
          <option value="">Anyone</option>
          {ACTOR_ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </Select>
        <Select label="Action" value={filters.action} onChange={v => setFilters({ action: v })}>
          <option value="">All actions</option>
          {LOG_ACTIONS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
        </Select>
        <Select label="Record type" value={filters.entityType} onChange={v => setFilters({ entityType: v })}>
          <option value="">Any record</option>
          {LOG_ENTITY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </Select>
        <label className="w-full sm:w-auto">
          <span className="block text-xs mb-1" style={muted}>Record ID</span>
          <input value={entityText} onChange={e => setEntityText(e.target.value)} placeholder="Full or first 8 characters"
            className="w-full sm:w-44 border rounded px-2 py-1.5 text-sm font-mono" style={input} aria-label="Record ID" />
        </label>
        <Select label="When" value={filters.range} onChange={v => setFilters({ range: v })}>
          {RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        {filters.range === 'custom' && (
          <div className="flex gap-2 w-full sm:w-auto">
            <label className="flex-1"><span className="block text-xs mb-1" style={muted}>From</span>
              <input type="date" value={filters.from} onChange={e => setFilters({ from: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" style={input} /></label>
            <label className="flex-1"><span className="block text-xs mb-1" style={muted}>To</span>
              <input type="date" value={filters.to} onChange={e => setFilters({ to: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" style={input} /></label>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm pb-1.5">
          <input type="checkbox" checked={filters.sample === '1'} onChange={e => setFilters({ sample: e.target.checked ? '1' : '0' })} />
          Show sample data
        </label>
        {filtered && (
          <button type="button" className="text-sm underline pb-1.5" style={muted}
            onClick={() => { setSearchText(''); setEntityText(''); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</button>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm flex gap-3" role="alert">
          <span>Couldn't load logs: {error}</span><button type="button" className="ml-auto underline" onClick={load}>Try again</button>
        </div>
      )}

      <div className={`rounded-xl border ${loading && page ? 'opacity-60' : ''}`} style={card}>
        {!page && loading ? (
          <div className="p-4 space-y-2">{[0, 1, 2, 3, 4, 5].map(i => <SkeletonBlock key={i} className="h-9" />)}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10" data-testid="logs-empty">
            <p className="font-medium">No log entries found</p>
            <p className="text-sm" style={muted}>{filtered ? 'Try a wider date range or other filters.' : 'Nothing has been logged yet.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <table className="hidden md:table w-full text-sm table-fixed" data-testid="logs-table">
              <colgroup><col className="w-[9.5rem]" /><col className="w-[6rem]" /><col className="w-[11rem]" /><col className="w-[12rem]" /><col className="w-[7.5rem]" /><col /></colgroup>
              <thead className="text-xs text-left" style={muted}>
                <tr className="border-b" style={border}>
                  <th className="px-3 py-2">Time</th><th className="px-2 py-2">Level</th><th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Action</th><th className="px-2 py-2">Record</th><th className="px-2 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(l => (
                  <tr key={l.id} className="border-b align-top cursor-pointer hover:bg-black hover:bg-opacity-5" style={border} onClick={() => setSelected(l)} data-testid="log-row">
                    <td className="px-3 py-2 whitespace-nowrap" title={relativeFromNow(l.createdAt)}>{formatAccra(l.createdAt)}</td>
                    <td className="px-2 py-2"><LogLevelBadge level={l.level} /></td>
                    <td className="px-2 py-2 truncate" title={`${l.actorName || 'System'} (${actorRoleLabel(l.actorRole)})`}>
                      {l.actorName || 'System'}<span className="block text-xs" style={muted}>{actorRoleLabel(l.actorRole)}</span>
                    </td>
                    <td className="px-2 py-2 truncate" title={l.action || ''}>{l.actionLabel}{l.isSample && <span className="ml-1 text-xs px-1 rounded bg-gray-200 text-td-ink">sample</span>}</td>
                    <td className="px-2 py-2"><RecordCell log={l} onOpen={openRecord} /></td>
                    <td className="px-2 py-2 truncate" title={l.message}>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile */}
            <div className="md:hidden divide-y" style={border}>
              {rows.map(l => (
                <button key={l.id} type="button" className="w-full text-left p-3 block" onClick={() => setSelected(l)} data-testid="log-card">
                  <div className="flex items-center gap-2"><LogLevelBadge level={l.level} /><span className="font-medium">{l.actionLabel}</span></div>
                  <p className="text-xs mt-1" style={muted}>{formatAccra(l.createdAt)} · {l.actorName || 'System'} ({actorRoleLabel(l.actorRole)}){l.entityId ? ` · #${shortRef(l.entityId)}` : ''}</p>
                  <p className="text-sm mt-1 line-clamp-2">{l.message}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t text-sm" style={border}>
              <span style={muted} data-testid="logs-page-info">
                {(filters.page - 1) * LOG_PAGE_SIZE + 1}–{Math.min(filters.page * LOG_PAGE_SIZE, total)} of {total}
              </span>
              <div className="ml-auto flex gap-2">
                <button type="button" disabled={filters.page <= 1} onClick={() => setFilters({ page: filters.page - 1 })} className="px-3 py-1 rounded border disabled:opacity-40" style={border}>Previous</button>
                <span className="px-2 py-1" style={muted}>Page {filters.page} of {pages}</span>
                <button type="button" disabled={filters.page >= pages} onClick={() => setFilters({ page: filters.page + 1 })} className="px-3 py-1 rounded border disabled:opacity-40" style={border}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && <LogDetailsModal log={selected} onOpenRecord={openRecord} onClose={() => setSelected(null)} />}

      {toast && (
        <div className={`fixed top-20 right-4 z-[4000] max-w-md rounded-lg shadow-xl px-4 py-3 text-sm text-white ${toast.tone === 'error' ? 'bg-red-700' : 'bg-gray-800'}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default LogsManagement;
