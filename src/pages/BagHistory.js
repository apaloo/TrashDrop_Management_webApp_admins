import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { fetchBatchPage, fetchAllBatches, fetchHistoryStats } from '../services/bagAdminService';
import { logAudit } from '../services/auditLogService';
import { BAG_STAGES, ARCHIVED_STAGE } from '../constants/bagStatus';
import { typeSizeLabel, orDash, filtersFromParams, paramsFromFilters, formatMinutes, batchesToCsv, formatCedis } from '../utils/bagUtils';
import { fullDate, relativeAge } from '../utils/pickupRequestUtils';
import BagStageBadge from '../components/bags/BagStageBadge';
import CopyId from '../components/bags/CopyId';
import BatchHistoryModal from '../components/bags/BatchHistoryModal';

const RANGES = [7, 30, 90];
const NO_DATA = 'No data yet';

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);

const Card = ({ label, value, sub, testid }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border border-td-border" data-testid={testid}>
    <p className="text-sm text-td-sage">{label}</p>
    <p className={value === NO_DATA ? 'text-lg font-semibold text-td-sage mt-1' : 'text-2xl font-bold text-td-ink mt-1'}>{value}</p>
    {sub && <p className="text-xs text-td-sage mt-1">{sub}</p>}
  </div>
);

/** Bars for bags scanned per day; tooltips give the exact numbers */
const ScansChart = ({ series, days, onDays }) => {
  const max = Math.max(1, ...series.map(d => d.scans));
  const total = series.reduce((s, d) => s + d.scans, 0);
  const label = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const every = Math.ceil(series.length / 7);
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-td-border" data-testid="scans-chart">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-td-ink">Bags scanned per day</h3>
        <span className="text-xs text-td-sage">{total} in the last {days} days</span>
        <div className="ml-auto inline-flex rounded-md border border-td-border-strong overflow-hidden" role="group" aria-label="Chart range">
          {RANGES.map(r => (
            <button key={r} type="button" onClick={() => onDays(r)} aria-pressed={days === r}
              className={`px-2.5 py-1 text-xs ${days === r ? 'bg-green-600 text-white' : 'bg-white text-td-ink hover:bg-td-cream'}`}>{r} days</button>
          ))}
        </div>
      </div>
      {total === 0 ? <p className="h-28 flex items-center justify-center text-sm text-td-sage">{NO_DATA}</p> : (
        <div>
          <div className="h-28 flex items-end gap-px" role="img" aria-label={`Bags scanned per day, last ${days} days, ${total} in total`}>
            {series.map(d => (
              <div key={d.day} className="flex-1 h-full flex items-end" title={`${label(d.day)}: ${d.scans} bag${d.scans === 1 ? '' : 's'} scanned`}>
                <div className="w-full bg-green-600 rounded-t-sm" style={{ height: d.scans ? `${Math.max(4, (d.scans / max) * 100)}%` : '1px', opacity: d.scans ? 1 : 0.25 }} />
              </div>
            ))}
          </div>
          <div className="flex gap-px mt-1 text-xs text-td-sage">
            {series.map((d, i) => <div key={d.day} className="flex-1 text-center truncate">{i % every === 0 ? label(d.day) : ''}</div>)}
          </div>
        </div>
      )}
    </div>
  );
};

const SortHeader = ({ label, field, filters, onSort, className = '' }) => {
  const active = filters.sort === field;
  return (
    <th className={`px-3 py-3 text-left text-xs font-medium text-td-sage uppercase tracking-wider ${className}`}
      aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 uppercase hover:text-td-ink">
        {label}<span aria-hidden="true">{active ? (filters.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
};

const ScannedCell = ({ b }) => {
  const total = Math.max(b.bagRows, b.bagCount);
  return (
    <div title={`${b.scannedCount} of ${total} bags scanned`}>
      <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-600 h-2 rounded-full" style={{ width: `${b.scannedPct}%` }} /></div>
      <span className="text-xs text-td-sage">{b.scannedCount} of {total} ({b.scannedPct}%)</span>
    </div>
  );
};

const BagHistory = () => {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const filterKey = JSON.stringify(filters);

  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(filters.q);
  const [minScanned, setMinScanned] = useState(filters.min);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const setFilters = useCallback((patch) => {
    const next = { ...filtersFromParams(params), ...patch };
    if (!('page' in patch)) next.page = 1;
    setParams(paramsFromFilters(next), { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchBatchPage(JSON.parse(filterKey))
      .then(r => { if (live) { setBatches(r.rows); setTotal(r.total); setError(null); setUpdatedAt(new Date()); } })
      .catch(e => { if (live) { setBatches([]); setTotal(0); setError(e.message); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [filterKey, reloadKey]);

  useEffect(() => {
    let live = true;
    fetchHistoryStats(days)
      .then(s => { if (live) { setStats(s); setStatsError(null); } })
      .catch(e => { if (live) setStatsError(e.message); });
    return () => { live = false; };
  }, [days, reloadKey]);

  // Search and the % slider apply 300 ms after the last change (server-side)
  useEffect(() => {
    if (search === filters.q && minScanned === filters.min) return undefined;
    const t = setTimeout(() => setFilters({ q: search, min: minScanned }), 300);
    return () => clearTimeout(t);
  }, [search, minScanned]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSort = (field) => setFilters({ sort: field, dir: filters.sort === field && filters.dir === 'desc' ? 'asc' : 'desc' });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllBatches(filters);
      saveAs(new Blob([batchesToCsv(rows)], { type: 'text/csv;charset=utf-8' }), `bag-history-${new Date().toISOString().slice(0, 10)}.csv`);
      logAudit({ source: 'bags', action: 'bags.exported', message: `Bag History exported (${rows.length} batches)`, metadata: { filters: paramsFromFilters(filters), rows: rows.length } });
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const totalBags = stats?.total_bags || 0;
  const scannedPct = pct(stats?.bags_scanned || 0, totalBags);
  const collectedPct = pct(stats?.bags_collected || 0, totalBags);
  const avg = formatMinutes(stats?.avg_distributed_to_collected_minutes);
  const totalPages = Math.max(1, Math.ceil(total / filters.size));
  const page = Math.min(filters.page, totalPages);
  const hasFilters = filters.q || filters.stage || filters.from || filters.to || filters.min > 0;

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-[28px] leading-tight font-bold text-td-ink">Bag History</h1>
        <span className="text-sm text-td-sage" data-testid="last-updated">
          Last updated: {updatedAt ? updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setReloadKey(k => k + 1)} className="px-3 py-2 text-sm border border-td-border-strong rounded-lg hover:bg-td-cream">Refresh</button>
          <button type="button" onClick={exportCsv} disabled={exporting || total === 0} className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {exporting ? 'Exporting…' : `Export CSV (${total})`}
          </button>
        </div>
      </div>

      {statsError ? <div className="mb-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">{statsError}</div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <Card testid="card-batches" label="Batches" value={stats ? stats.total_batches : '…'} sub="not archived" />
            <Card testid="card-bags" label="Bags" value={stats ? totalBags : '…'} />
            <Card testid="card-scanned" label="Bags scanned" value={stats ? (scannedPct === null ? NO_DATA : `${scannedPct}%`) : '…'} sub={stats ? `${stats.bags_scanned} of ${totalBags}` : ''} />
            <Card testid="card-collected" label="Bags collected" value={stats ? (collectedPct === null ? NO_DATA : `${collectedPct}%`) : '…'} sub={stats ? `${stats.bags_collected} of ${totalBags}` : ''} />
            <Card testid="card-avg" label="Distributed → collected" value={stats ? (avg || NO_DATA) : '…'} sub="average time" />
          </div>
          <div className="mb-6">
            <ScansChart series={stats?.scans_per_day || []} days={days} onDays={setDays} />
          </div>
        </>
      )}

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1.3fr_auto] gap-3 items-end">
        <label className="text-sm text-td-sage">Search
          <input type="search" placeholder="Batch ID, number, type or QR prefix" className="mt-1 w-full p-2 border border-td-border-strong rounded-lg"
            value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <label className="text-sm text-td-sage">Status
          <select id="filterStatus" className="mt-1 w-full p-2 border border-td-border-strong rounded-lg" value={filters.stage} onChange={e => setFilters({ stage: e.target.value })}>
            <option value="">All (not archived)</option>
            {BAG_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            <option value={ARCHIVED_STAGE.key}>{ARCHIVED_STAGE.label}</option>
          </select>
        </label>
        <label className="text-sm text-td-sage">Created from
          <input type="date" className="mt-1 w-full p-2 border border-td-border-strong rounded-lg" value={filters.from} max={filters.to || undefined} onChange={e => setFilters({ from: e.target.value })} />
        </label>
        <label className="text-sm text-td-sage">Created to
          <input type="date" className="mt-1 w-full p-2 border border-td-border-strong rounded-lg" value={filters.to} min={filters.from || undefined} onChange={e => setFilters({ to: e.target.value })} />
        </label>
        <label className="text-sm text-td-sage">Scanned at least: <strong>{minScanned}%</strong>
          <input type="range" min="0" max="100" step="10" value={minScanned} onChange={e => setMinScanned(Number(e.target.value))}
            className="mt-2 w-full accent-green-600" aria-label="Minimum % of bags scanned" />
        </label>
        <button type="button" disabled={!hasFilters} onClick={() => { setSearch(''); setMinScanned(0); setFilters({ q: '', stage: '', from: '', to: '', min: 0 }); }}
          className="px-3 py-2 text-sm border border-td-border-strong rounded-lg text-td-ink hover:bg-td-cream disabled:opacity-40">Clear</button>
      </div>

      {error && <div className="mb-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">{error}</div>}

      <div className="bg-white rounded-xl shadow">
        <table className="w-full table-fixed divide-y divide-td-border hidden md:table" data-testid="history-table">
          <thead className="bg-td-cream">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-td-sage uppercase tracking-wider w-[14%]">Batch</th>
              <SortHeader label="Created" field="created_at" filters={filters} onSort={onSort} className="w-[13%]" />
              <th className="px-3 py-3 text-left text-xs font-medium text-td-sage uppercase tracking-wider w-[16%]">Type · Size</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-td-sage uppercase tracking-wider w-[10%]">QR prefix</th>
              <SortHeader label="Bags" field="bag_count" filters={filters} onSort={onSort} className="w-[8%]" />
              <th className="px-3 py-3 text-left text-xs font-medium text-td-sage uppercase tracking-wider w-[11%]">Status</th>
              <SortHeader label="% Scanned" field="scanned_pct" filters={filters} onSort={onSort} className="w-[15%]" />
              <th className="px-3 py-3 text-left text-xs font-medium text-td-sage uppercase tracking-wider w-[13%]">Last scan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-td-border">
            {loading ? (
              <tr><td colSpan="8" className="py-10 text-center text-td-sage">Loading…</td></tr>
            ) : batches.length === 0 ? (
              <tr><td colSpan="8" className="py-10 text-center text-td-sage">{error ? 'Batches could not be loaded.' : hasFilters ? 'No batches match these filters.' : 'No batches yet.'}</td></tr>
            ) : batches.map(b => (
              <tr key={b.id} className="hover:bg-td-cream cursor-pointer" onClick={() => setSelected(b)} data-testid="history-row">
                <td className="px-3 py-3 text-sm"><CopyId id={b.id} />{b.batchNumber && <span className="block text-xs text-td-sage truncate">#{b.batchNumber}</span>}</td>
                <td className="px-3 py-3 text-sm text-td-sage" title={fullDate(b.createdAt)}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td className="px-3 py-3 text-sm text-td-ink truncate" title={typeSizeLabel(b.type, b.size)}>{typeSizeLabel(b.type, b.size)}</td>
                <td className="px-3 py-3 text-sm font-mono text-td-ink truncate">{orDash(b.qrPrefix)}</td>
                <td className="px-3 py-3 text-sm text-td-ink">{b.bagCount}{b.unitPrice != null && <span className="block text-xs text-td-sage" title="Price per bag">{formatCedis(b.unitPrice)}</span>}</td>
                <td className="px-3 py-3"><BagStageBadge stage={b.stage} /></td>
                <td className="px-3 py-3"><ScannedCell b={b} /></td>
                <td className="px-3 py-3 text-sm text-td-sage">
                  <span title={b.lastScanAt ? fullDate(b.lastScanAt) : ''}>{b.lastScanAt ? relativeAge(b.lastScanAt) : 'Not scanned'}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSelected(b); }} className="block text-xs text-green-700 hover:underline mt-0.5">View history</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="md:hidden divide-y divide-td-border">
          {loading ? <p className="py-8 text-center text-td-sage">Loading…</p> : batches.length === 0 ? (
            <p className="py-8 text-center text-td-sage">{error ? 'Batches could not be loaded.' : 'No batches match.'}</p>
          ) : batches.map(b => (
            <div key={b.id} className="p-4 space-y-2" data-testid="history-card">
              <div className="flex items-center gap-2"><CopyId id={b.id} /><BagStageBadge stage={b.stage} /><span className="ml-auto text-sm text-td-sage">{b.bagCount} bags</span></div>
              <div className="text-sm text-td-ink">{typeSizeLabel(b.type, b.size)} · <span className="font-mono">{orDash(b.qrPrefix)}</span></div>
              <ScannedCell b={b} />
              <button type="button" onClick={() => setSelected(b)} className="text-sm text-green-700">View history</button>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-td-border bg-td-cream rounded-b-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-td-sage">
          <div className="flex items-center gap-3">
            <label htmlFor="bhRowsPerPage">Rows per page:</label>
            <select id="bhRowsPerPage" value={filters.size} onChange={e => setFilters({ size: Number(e.target.value) })} className="border border-td-border-strong rounded-md py-1 px-2 bg-white">
              {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>{total === 0 ? 'No entries' : `Showing ${(page - 1) * filters.size + 1}–${Math.min(page * filters.size, total)} of ${total}`}</span>
          </div>
          <nav className="inline-flex items-center gap-2" aria-label="Pagination">
            <button type="button" disabled={page <= 1} onClick={() => setFilters({ page: page - 1 })} className="px-3 py-1 rounded-md border border-td-border-strong bg-white disabled:opacity-40">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setFilters({ page: page + 1 })} className="px-3 py-1 rounded-md border border-td-border-strong bg-white disabled:opacity-40">Next</button>
          </nav>
        </div>
      </div>

      {selected && <BatchHistoryModal batch={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default BagHistory;
