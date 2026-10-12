import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { useAuth } from '../context/AuthContext';
import { createBagBatch, fetchCollectorStatsReal } from '../utils/databaseUtils';
import { fetchBatchPage, fetchBatch, fetchBagStats, setBatchArchived } from '../services/bagAdminService';
import { BAG_STAGES, ARCHIVED_STAGE } from '../constants/bagStatus';
import {
  typeSizeLabel, batchProgress, filtersFromParams, paramsFromFilters, weekCollectedPct, formatMinutes,
} from '../utils/bagUtils';
import { fullDate } from '../utils/pickupRequestUtils';
import BagStageBadge from '../components/bags/BagStageBadge';
import CopyId from '../components/bags/CopyId';
import BatchDetailsModal from '../components/bags/BatchDetailsModal';
import ConfirmDialog from '../components/pickupRequests/ConfirmDialog';

const SCAN_BASE = 'https://trashdrops.com/scan';
const NO_DATA = 'No data yet';

const Spinner = ({ color = 'border-green-500' }) => (
  <div className="flex justify-center items-center h-24"><div className={`animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 ${color}`} /></div>
);

const SortHeader = ({ label, field, filters, onSort, className = '' }) => {
  const active = filters.sort === field;
  return (
    <th className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
      aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 uppercase hover:text-gray-800">
        {label}<span aria-hidden="true">{active ? (filters.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
};

const ProgressCell = ({ batch }) => {
  const p = batchProgress(batch);
  return (
    <div title={`${p.distributed} distributed · ${p.filled} filled · ${p.collected} collected of ${p.total}`}>
      <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ width: `${p.distributedPct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-yellow-500" style={{ width: `${p.filledPct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-green-600" style={{ width: `${p.collectedPct}%` }} />
      </div>
      <div className="text-xs text-gray-500 mt-1">{p.collected} of {p.total} collected</div>
    </div>
  );
};

const BagManagement = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const filterKey = JSON.stringify(filters);

  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState(filters.q);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [confirm, setConfirm] = useState(null); // { batch, archive }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ type: 'Recyclable', size: 'Medium', quantity: 50 });

  const [bagStats, setBagStats] = useState(null);
  const [collectorStats, setCollectorStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // QR ZIP download state and worker
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [downloadingBatch, setDownloadingBatch] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({ progress: 0, stage: 'Preparing...', isProcessing: false, showProgress: false });
  const workerRef = useRef(null);
  const batchPayloadRef = useRef(null);

  const setFilters = useCallback((patch, { resetPage = true } = {}) => {
    const next = { ...filtersFromParams(params), ...patch };
    if (resetPage && !('page' in patch)) next.page = 1;
    const out = paramsFromFilters(next);
    const open = params.get('batch');
    if (open) out.batch = open;
    setParams(out, { replace: true });
  }, [params, setParams]);

  const showToast = useCallback((text, kind = 'ok') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── data ─────────────────────────────────────────────────────────────── */

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchBatchPage(JSON.parse(filterKey))
      .then(r => { if (live) { setBatches(r.rows); setTotal(r.total); setError(null); } })
      .catch(e => { if (live) { setBatches([]); setTotal(0); setError(e.message); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [filterKey, reloadKey]);

  // Search runs on the server, 300 ms after typing stops
  useEffect(() => {
    if (search === filters.q) return undefined;
    const t = setTimeout(() => setFilters({ q: search }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    const [b, c] = await Promise.allSettled([fetchBagStats(), fetchCollectorStatsReal()]);
    if (b.status === 'fulfilled') { setBagStats(b.value); setStatsError(null); } else setStatsError(b.reason?.message);
    if (c.status === 'fulfilled') setCollectorStats(c.value);
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    refreshStats();
    const t = setInterval(refreshStats, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [refreshStats]);

  // ?batch=<id> opens that batch (links from the Logs page)
  const openParam = params.get('batch');
  useEffect(() => {
    if (!openParam || selectedBatch?.id === openParam) return;
    let live = true;
    fetchBatch(openParam).then(b => { if (live && b) setSelectedBatch(b); }).catch(() => {});
    return () => { live = false; };
  }, [openParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetails = (batch) => {
    setSelectedBatch(batch);
    const out = paramsFromFilters(filters);
    out.batch = batch.id;
    setParams(out, { replace: true });
  };
  const closeDetails = useCallback(() => {
    setSelectedBatch(null);
    setParams(paramsFromFilters(filtersFromParams(params)), { replace: true });
  }, [params, setParams]);

  /* ── QR ZIP (worker) ──────────────────────────────────────────────────── */

  const handleWorkerError = useCallback((message) => {
    console.error('QR Code Worker Error:', message);
    setDownloadProgress(prev => ({ ...prev, isProcessing: false }));
    showToast(message || 'Failed to generate QR ZIP', 'error');
  }, [showToast]);

  const initWorker = useCallback(() => {
    try {
      const worker = new Worker(new URL('../workers/QRCodeWorker.js', import.meta.url), { type: 'module' });
      worker.postMessage({ type: 'WORKER_READY' });
      worker.onmessage = (e) => {
        const { type, progress, stage, content, filename, error: err } = e.data || {};
        if (type === 'WORKER_READY') { setIsWorkerReady(true); return; }
        if (type === 'PROGRESS') {
          setDownloadProgress(prev => ({ ...prev, progress, stage: stage || prev.stage, isProcessing: progress < 100 }));
          return;
        }
        if (type === 'CHUNKS_READY') {
          workerRef.current?.postMessage({
            type: 'CREATE_ZIP',
            payload: { chunks: e.data.chunks, batch: batchPayloadRef.current || { id: downloadingBatch }, baseUrl: SCAN_BASE, email: user?.email || 'admin@trashdrop.com' },
          });
          return;
        }
        if (type === 'ZIP_READY') {
          try {
            const safeFilename = (filename && filename.endsWith('.zip')) ? filename : `QR_Codes_${downloadingBatch || 'batch'}.zip`;
            const blob = (content instanceof Blob) ? content : new Blob([content], { type: 'application/zip' });
            saveAs(blob, safeFilename);
            setDownloadProgress(prev => ({ ...prev, progress: 100, stage: 'Download complete!', isProcessing: false }));
          } catch (saveErr) {
            handleWorkerError('Failed to save the ZIP file');
          } finally {
            batchPayloadRef.current = null;
          }
          return;
        }
        if (type === 'ERROR') {
          handleWorkerError(err || 'An error occurred while generating QR codes');
          batchPayloadRef.current = null;
        }
      };
      worker.onerror = () => handleWorkerError('Failed to initialize QR code generator');
      workerRef.current = worker;
    } catch (err) {
      handleWorkerError('Failed to initialize QR code generator');
    }
  }, [downloadingBatch, handleWorkerError, user?.email]);

  useEffect(() => {
    initWorker();
    return () => { if (workerRef.current) workerRef.current.terminate(); };
  }, [initWorker]);

  const handleDownloadQRs = async (batch) => {
    if (!isWorkerReady) { showToast('QR code generator is not ready yet', 'error'); return; }
    setDownloadingBatch(batch.id);
    setDownloadProgress({ progress: 0, stage: 'Preparing...', isProcessing: true, showProgress: true });
    const payloadBatch = { id: batch.id, bag_count: batch.bagCount, quantity: batch.bagCount, startNumber: 1, size: batch.size || '' };
    batchPayloadRef.current = payloadBatch;
    await new Promise(r => setTimeout(r, 50));
    workerRef.current.postMessage({
      type: 'GENERATE_QR_CODES',
      payload: { batch: payloadBatch, email: user?.email || 'admin@trashdrop.com', baseUrl: SCAN_BASE, chunkSize: 20 },
    });
  };

  /* ── actions ──────────────────────────────────────────────────────────── */

  const runArchive = async () => {
    const { batch, archive } = confirm;
    setBusy(true);
    try {
      await setBatchArchived(batch.id, archive);
      showToast(archive ? `Batch ${batch.id.slice(0, 8)} archived` : `Batch ${batch.id.slice(0, 8)} restored`);
      setConfirm(null);
      if (selectedBatch?.id === batch.id) setSelectedBatch(await fetchBatch(batch.id));
      setReloadKey(k => k + 1);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { batch } = await createBagBatch({ quantity: parseInt(formData.quantity, 10), type: formData.type, size: formData.size });
      setShowModal(false);
      setFormData({ type: 'Recyclable', size: 'Medium', quantity: 50 });
      showToast(`Batch ${String(batch.id).slice(0, 8)} created with ${batch.bag_count} bags`);
      setReloadKey(k => k + 1);
      refreshStats();
    } catch (err) {
      showToast(`Batch not created: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onSort = (field) => setFilters({ sort: field, dir: filters.sort === field && filters.dir === 'desc' ? 'asc' : 'desc' });

  const totalPages = Math.max(1, Math.ceil(total / filters.size));
  const page = Math.min(filters.page, totalPages);
  const thisWeek = weekCollectedPct(bagStats?.this_week);
  const lastWeek = weekCollectedPct(bagStats?.last_week);
  const avgCollect = formatMinutes(bagStats?.avg_fill_to_collect_minutes);
  const hasFilters = filters.q || filters.stage || filters.from || filters.to;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-semibold text-gray-800">Bag Management</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Create New Batch</button>
      </div>

      {toast && (
        <div role="status" className={`fixed bottom-4 right-4 z-[60] px-4 py-2 rounded shadow-lg text-white ${toast.kind === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>{toast.text}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" data-testid="card-requests">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Live Bag Requests</h3>
          {statsLoading && !bagStats ? <Spinner /> : statsError ? <p className="text-sm text-red-600">{statsError}</p> : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-green-600">{bagStats.requests_today ?? 0}</div>
                <div className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">requests today</div>
              </div>
              <div className="text-sm text-gray-500 mt-2">{bagStats.pending_collection ?? 0} pending collection</div>
              <div className="flex justify-between text-xs text-gray-500 mt-3">
                <span>{bagStats.collected_today ?? 0} collected today</span>
                <span title="Bags households hold but haven't requested a pickup for">{bagStats.bags_awaiting ?? 0} bags awaiting use</span>
              </div>
            </>
          )}
        </div>

        {/* Kept here: Bag History shows the same card, and the Dashboard already shows active collectors */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Collector Status</h3>
          {statsLoading && !collectorStats.total ? <Spinner color="border-blue-500" /> : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-blue-600">{collectorStats.active || 0}/{collectorStats.total || 0}</div>
                <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {collectorStats.total > 0 ? Math.round((collectorStats.active / collectorStats.total) * 100) : 0}% Active
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-2">{collectorStats.inactive || 0} collectors inactive</div>
            </>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" data-testid="card-performance">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Performance Timeline</h3>
          {statsLoading && !bagStats ? <Spinner color="border-indigo-500" /> : statsError ? <p className="text-sm text-red-600">{statsError}</p> : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className={thisWeek === null ? 'text-xl font-semibold text-gray-400' : 'text-3xl font-bold text-indigo-600'}>
                  {thisWeek === null ? NO_DATA : `${thisWeek}%`}
                </div>
                <div className="text-sm bg-indigo-100 text-indigo-800 px-2 py-1 rounded whitespace-nowrap">
                  Last week: {lastWeek === null ? NO_DATA : `${lastWeek}%`}
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-2">of bags requested this week were collected</div>
              <div className="text-sm text-gray-500 mt-1">Avg. request → collected: {avgCollect || NO_DATA}</div>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end">
        <label className="text-sm text-gray-600">Search
          <input type="search" placeholder="Batch ID, number, type or QR prefix" className="mt-1 w-full p-2 border border-gray-300 rounded-lg"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="text-sm text-gray-600">Status
          <select className="mt-1 w-full p-2 border border-gray-300 rounded-lg" value={filters.stage} onChange={(e) => setFilters({ stage: e.target.value })}>
            <option value="">All (not archived)</option>
            {BAG_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            <option value={ARCHIVED_STAGE.key}>{ARCHIVED_STAGE.label}</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">Created from
          <input type="date" className="mt-1 w-full p-2 border border-gray-300 rounded-lg" value={filters.from} max={filters.to || undefined}
            onChange={(e) => setFilters({ from: e.target.value })} />
        </label>
        <label className="text-sm text-gray-600">Created to
          <input type="date" className="mt-1 w-full p-2 border border-gray-300 rounded-lg" value={filters.to} min={filters.from || undefined}
            onChange={(e) => setFilters({ to: e.target.value })} />
        </label>
        <button type="button" disabled={!hasFilters} onClick={() => { setSearch(''); setFilters({ q: '', stage: '', from: '', to: '' }); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40">Clear</button>
      </div>

      {error && <div className="mb-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">{error}</div>}

      <div className="bg-white rounded-lg shadow">
        {/* Desktop / laptop table: fixed columns, no sideways scrolling */}
        <table className="w-full table-fixed divide-y divide-gray-200 hidden md:table" data-testid="batch-table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">Batch</th>
              <SortHeader label="Created" field="created_at" filters={filters} onSort={onSort} className="w-[14%]" />
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[17%]">Type · Size</th>
              <SortHeader label="Qty" field="bag_count" filters={filters} onSort={onSort} className="w-[8%]" />
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">Status</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[18%]">Progress</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[16%]">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="7"><Spinner /></td></tr>
            ) : batches.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-10 text-center text-gray-500">{hasFilters ? 'No batches match these filters.' : 'No batches yet.'}</td></tr>
            ) : batches.map(batch => (
              <tr key={batch.id} className="hover:bg-gray-50" data-testid="batch-row">
                <td className="px-3 py-3 text-sm">
                  <CopyId id={batch.id} />
                  {batch.batchNumber && <span className="block text-xs text-gray-500 truncate" title={batch.batchNumber}>#{batch.batchNumber}</span>}
                </td>
                <td className="px-3 py-3 text-sm text-gray-600" title={fullDate(batch.createdAt)}>{batch.createdAt ? new Date(batch.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td className="px-3 py-3 text-sm text-gray-700 truncate" title={typeSizeLabel(batch.type, batch.size)}>{typeSizeLabel(batch.type, batch.size)}</td>
                <td className="px-3 py-3 text-sm text-gray-700">{batch.bagCount}</td>
                <td className="px-3 py-3"><BagStageBadge stage={batch.stage} /></td>
                <td className="px-3 py-3"><ProgressCell batch={batch} /></td>
                <td className="px-3 py-3 text-sm text-right whitespace-nowrap">
                  <button type="button" onClick={() => openDetails(batch)} className="text-green-700 hover:underline mr-3">View</button>
                  {batch.archived ? (
                    <button type="button" onClick={() => setConfirm({ batch, archive: false })} className="text-gray-600 hover:underline">Restore</button>
                  ) : (
                    <button type="button" onClick={() => setConfirm({ batch, archive: true })} className="text-gray-600 hover:underline">Archive</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Phones: cards */}
        <div className="md:hidden divide-y divide-gray-200">
          {loading ? <Spinner /> : batches.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-500">{hasFilters ? 'No batches match these filters.' : 'No batches yet.'}</p>
          ) : batches.map(batch => (
            <div key={batch.id} className="p-4 space-y-2" data-testid="batch-card">
              <div className="flex items-center gap-2"><CopyId id={batch.id} /><BagStageBadge stage={batch.stage} /><span className="ml-auto text-sm text-gray-600">{batch.bagCount} bags</span></div>
              <div className="text-sm text-gray-700">{typeSizeLabel(batch.type, batch.size)}<span className="text-gray-500"> · {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString('en-GB') : '—'}</span></div>
              <ProgressCell batch={batch} />
              <div className="flex gap-4 text-sm">
                <button type="button" onClick={() => openDetails(batch)} className="text-green-700">View</button>
                <button type="button" onClick={() => setConfirm({ batch, archive: !batch.archived })} className="text-gray-600">{batch.archived ? 'Restore' : 'Archive'}</button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <label htmlFor="bmRowsPerPage">Rows per page:</label>
            <select id="bmRowsPerPage" value={filters.size} onChange={(e) => setFilters({ size: Number(e.target.value) })} className="border border-gray-300 rounded-md py-1 px-2 bg-white">
              {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>{total === 0 ? 'No entries' : `Showing ${(page - 1) * filters.size + 1}–${Math.min(page * filters.size, total)} of ${total}`}</span>
          </div>
          <nav className="inline-flex items-center gap-2" aria-label="Pagination">
            <button type="button" disabled={page <= 1} onClick={() => setFilters({ page: page - 1 })} className="px-3 py-1 rounded-md border border-gray-300 bg-white disabled:opacity-40">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setFilters({ page: page + 1 })} className="px-3 py-1 rounded-md border border-gray-300 bg-white disabled:opacity-40">Next</button>
          </nav>
        </div>
      </div>

      {/* Create batch */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" role="dialog" aria-modal="true" aria-labelledby="create-batch-title">
            <h2 id="create-batch-title" className="text-xl font-semibold mb-4">Create New Bag Batch</h2>
            <form onSubmit={handleCreateBatch}>
              <label className="block text-gray-700 text-sm font-bold mb-4">Type
                <select name="type" value={formData.type} onChange={(e) => setFormData(f => ({ ...f, type: e.target.value }))} className="mt-2 w-full p-2 border border-gray-300 rounded font-normal" required>
                  {['Recyclable', 'Organic', 'General', 'Hazardous', 'Electronic', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-gray-700 text-sm font-bold mb-4">Size
                <select name="size" value={formData.size} onChange={(e) => setFormData(f => ({ ...f, size: e.target.value }))} className="mt-2 w-full p-2 border border-gray-300 rounded font-normal" required>
                  {['Small', 'Medium', 'Large'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block text-gray-700 text-sm font-bold mb-6">Quantity
                <input type="number" name="quantity" value={formData.quantity} onChange={(e) => setFormData(f => ({ ...f, quantity: e.target.value }))} className="mt-2 w-full p-2 border border-gray-300 rounded font-normal" min="1" max="1000" required />
              </label>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{busy ? 'Creating…' : 'Create Batch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedBatch && (
        <BatchDetailsModal batch={selectedBatch} email={user?.email} busy={busy} paused={!!confirm}
          onDownloadAll={handleDownloadQRs}
          onArchive={(b) => setConfirm({ batch: b, archive: true })}
          onRestore={(b) => setConfirm({ batch: b, archive: false })}
          onClose={closeDetails} />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.archive ? `Archive batch ${confirm.batch.id.slice(0, 8)}?` : `Restore batch ${confirm.batch.id.slice(0, 8)}?`}
          confirmLabel={confirm.archive ? 'Archive' : 'Restore'} danger={confirm.archive} busy={busy}
          onConfirm={runArchive} onClose={() => setConfirm(null)}>
          {confirm.archive ? (
            <p>The batch is hidden from the list (choose <strong>Archived</strong> in the status filter to see it again). Its bags and QR codes keep working, and households can still scan it.</p>
          ) : (
            <p>The batch goes back into the main list.</p>
          )}
        </ConfirmDialog>
      )}

      {/* Download progress */}
      {downloadProgress.showProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md" role="dialog" aria-modal="true" aria-label="Generating QR codes">
            <h3 className="text-lg font-medium mb-4">Generating QR Codes</h3>
            <div className="flex justify-between text-sm text-gray-600 mb-1"><span>{downloadProgress.stage}</span><span>{Math.round(downloadProgress.progress)}%</span></div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${downloadProgress.progress}%` }} />
            </div>
            <p className="text-sm text-gray-500 text-center mt-4">
              {downloadProgress.progress < 100 ? 'Generating enhanced QR codes (600×700px)…' : '✓ Download complete!'}
            </p>
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={downloadProgress.isProcessing} onClick={() => setDownloadProgress(prev => ({ ...prev, showProgress: false }))}
                className="px-4 py-2 text-sm rounded-md border bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300 disabled:opacity-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BagManagement;
