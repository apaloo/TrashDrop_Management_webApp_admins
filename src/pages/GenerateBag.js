import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faQrcode,
  faCheck,
  faExclamationTriangle,
  faMagic,
  faSpinner,
  faDownload,
  faTimes,
  faEye
} from '@fortawesome/free-solid-svg-icons';
import { saveAs } from 'file-saver';
import { useAuth } from '../context/AuthContext';
import { generateBatches, fetchRecentBatches } from '../services/bagAdminService';
import { TRASH_TYPES, BAG_SIZES, BAG_LIMITS } from '../constants/bagStatus';
import {
  validateGenerateForm, generateSummary, defaultQrPrefix, formatCedis, orDash, sampleBagCode,
} from '../utils/bagUtils';
import CopyId from '../components/bags/CopyId';
import ConfirmDialog from '../components/pickupRequests/ConfirmDialog';

const SCAN_BASE = 'https://trashdrops.com/scan';
const SAMPLE_ID = '00000000-0000-0000-0000-000000000000';

const TYPE_COLORS = {
  Organic: 'bg-green-100 text-green-800',
  Recyclable: 'bg-blue-100 text-blue-800',
  Hazardous: 'bg-red-100 text-red-800',
  General: 'bg-gray-800 text-white',
};

const inputClass = (bad) => `block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${bad ? 'border-red-500' : 'border-gray-300'}`;

const FieldError = ({ id, text }) => (text ? <p id={id} className="mt-1 text-xs text-red-600">{text}</p> : null);

const GenerateBag = () => {
  const { user } = useAuth();

  // Form (kept as typed; checked with validateGenerateForm)
  const [form, setForm] = useState({
    trashType: 'Organic',
    bagSize: 'Medium',
    bagsPerBatch: '50',
    numberOfBatches: '1',
    pricePerBatch: '',
    qrPrefix: '',
  });
  const [touched, setTouched] = useState(false);
  const { errors, values } = validateGenerateForm(form);
  const summary = generateSummary(values);
  const hasErrors = Object.keys(errors).length > 0;

  const [previewVisible, setPreviewVisible] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null); // { batches: [{ id, number }], totalBags }

  // Newest batches from the database
  const [recent, setRecent] = useState(null);
  const [recentError, setRecentError] = useState(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingBatch, setDownloadingBatch] = useState(null);
  const [viewQRModal, setViewQRModal] = useState({ visible: false, batch: null });
  const workerRef = useRef(null);
  const pendingPosterRequestRef = useRef(null);

  const loadRecent = useCallback(() => {
    fetchRecentBatches(10)
      .then(rows => { setRecent(rows); setRecentError(null); })
      .catch(e => { setRecent([]); setRecentError(e.message); });
  }, []);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: name === 'qrPrefix' ? value.toUpperCase() : value }));
    setPreviewVisible(false);
  };

  /* ── poster PNG for large bags (QR code worker) ────────────────────────── */

  useEffect(() => {
    let worker;
    try {
      worker = new Worker(new URL('../workers/QRCodeWorker.js', import.meta.url), { type: 'module' });
      worker.postMessage({ type: 'WORKER_READY' });
      worker.onmessage = (e) => {
        const { type, content, filename, requestId } = e.data || {};
        if (type !== 'POSTER_READY' && type !== 'POSTER_ERROR') return;
        if (pendingPosterRequestRef.current && pendingPosterRequestRef.current !== requestId) return;
        pendingPosterRequestRef.current = null;
        if (type === 'POSTER_READY' && content && filename) {
          try {
            saveAs(content instanceof Blob ? content : new Blob([content], { type: 'image/png' }), filename);
          } catch (err) {
            console.error('Error saving poster PNG:', err);
          }
        }
      };
      worker.onerror = (err) => console.error('QR worker error:', err);
      workerRef.current = worker;
    } catch (err) {
      console.error('Error initializing QR worker:', err);
    }
    return () => { if (worker) worker.terminate(); };
  }, []);

  // Batch QR download: the QR holds the batch id, exactly as before (household app scans it)
  const handleDownloadClick = async (batch) => {
    try {
      setDownloadingBatch(batch.id);
      setIsDownloading(true);
      setError(null);
      const svgElement = document.getElementById(`qrcode-${batch.id}`)?.querySelector('svg');
      if (!svgElement) throw new Error('QR code not found');
      const svgData = new XMLSerializer().serializeToString(svgElement);
      saveAs(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }), `batch-${batch.batchNumber || batch.id.slice(0, 8)}-qr.svg`);

      const size = String(batch.size || '').toLowerCase();
      if ((size.includes('240') || size === 'large') && workerRef.current) {
        const requestId = `${batch.id}-${Date.now()}`;
        pendingPosterRequestRef.current = requestId;
        workerRef.current.postMessage({
          type: 'GENERATE_POSTER_PNG',
          payload: { requestId, batch: { id: batch.id, size: batch.size || '' }, baseUrl: SCAN_BASE, email: user?.email || 'admin@trashdrop.com' },
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to download QR code');
    } finally {
      setIsDownloading(false);
      setDownloadingBatch(null);
    }
  };

  /* ── preview and generate ──────────────────────────────────────────────── */

  const handlePreview = () => {
    setTouched(true);
    setError(null);
    if (!hasErrors) setPreviewVisible(true); // nothing is saved
  };

  const askGenerate = () => {
    setTouched(true);
    setError(null);
    if (!hasErrors) setConfirmOpen(true);
  };

  const runGenerate = async () => {
    if (isGenerating) return; // no double submit
    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await generateBatches(values, BAG_LIMITS.maxTotalBags);
      const ids = res?.batch_ids || [];
      const numbers = res?.batch_numbers || [];
      setSuccess({ batches: ids.map((id, i) => ({ id, number: numbers[i] })), totalBags: res?.total_bags, prefix: res?.qr_prefix });
      setConfirmOpen(false);
      setPreviewVisible(false);
      loadRecent();
    } catch (err) {
      setError(`Nothing was generated: ${err.message || 'unknown error'}`);
      setConfirmOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const showErr = (f) => (touched ? errors[f] : null);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Generate Bags</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-start mb-4" role="alert" data-testid="generate-error">
          <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2 mt-1" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded mb-4" role="status" data-testid="generate-success">
          <p className="font-medium"><FontAwesomeIcon icon={faCheck} className="mr-2" />
            Generated {success.batches.length} batch{success.batches.length === 1 ? '' : 'es'} with {success.totalBags} bags (prefix {success.prefix}).</p>
          <ul className="mt-1 text-sm flex flex-wrap gap-x-4">
            {success.batches.map(b => (
              <li key={b.id}><Link to={`/bin-management/manage?batch=${b.id}`} className="underline">Batch {b.number || b.id.slice(0, 8)}</Link></li>
            ))}
          </ul>
        </div>
      )}

      {/* Form */}
      <div className="bg-white shadow-sm rounded-lg mb-6">
        <div className="p-6">
          <h5 className="text-xl font-semibold mb-4 text-gray-700">Bag Batch Configuration</h5>
          <form onSubmit={(e) => { e.preventDefault(); askGenerate(); }} noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="trashType" className="block text-sm font-medium text-gray-700 mb-1">Trash Type</label>
                <select id="trashType" name="trashType" className={inputClass(showErr('trashType'))} value={form.trashType} onChange={onChange}>
                  {TRASH_TYPES.map(t => <option key={t.key} value={t.key}>{t.key}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="bagSize" className="block text-sm font-medium text-gray-700 mb-1">Bag Size</label>
                <select id="bagSize" name="bagSize" className={inputClass(showErr('bagSize'))} value={form.bagSize} onChange={onChange}>
                  {BAG_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="bagsPerBatch" className="block text-sm font-medium text-gray-700 mb-1">Bags per Batch</label>
                <input type="number" id="bagsPerBatch" name="bagsPerBatch" min="1" max={BAG_LIMITS.maxBagsPerBatch} step="1" inputMode="numeric"
                  className={inputClass(showErr('bagsPerBatch'))} value={form.bagsPerBatch} onChange={onChange} aria-describedby="bagsPerBatch-err" />
                <FieldError id="bagsPerBatch-err" text={showErr('bagsPerBatch')} />
              </div>
              <div>
                <label htmlFor="numberOfBatches" className="block text-sm font-medium text-gray-700 mb-1">Number of Batches</label>
                <input type="number" id="numberOfBatches" name="numberOfBatches" min="1" max={BAG_LIMITS.maxBatches} step="1" inputMode="numeric"
                  className={inputClass(showErr('numberOfBatches'))} value={form.numberOfBatches} onChange={onChange} aria-describedby="numberOfBatches-err" />
                <FieldError id="numberOfBatches-err" text={showErr('numberOfBatches')} />
              </div>
              <div>
                <label htmlFor="pricePerBatch" className="block text-sm font-medium text-gray-700 mb-1">Price per Batch (GH₵)</label>
                <input type="number" id="pricePerBatch" name="pricePerBatch" min="0" step="0.01" inputMode="decimal" placeholder="e.g. 50.00" aria-required="true"
                  className={inputClass(showErr('pricePerBatch'))} value={form.pricePerBatch} onChange={onChange} aria-describedby="pricePerBatch-err" />
                <FieldError id="pricePerBatch-err" text={showErr('pricePerBatch')} />
              </div>
              <div>
                <label htmlFor="qrPrefix" className="block text-sm font-medium text-gray-700 mb-1">QR Prefix <span className="font-normal text-gray-500">(optional)</span></label>
                <input type="text" id="qrPrefix" name="qrPrefix" maxLength={30} placeholder={defaultQrPrefix(form.trashType)}
                  className={`${inputClass(showErr('qrPrefix') || errors.qrPrefix)} font-mono`} value={form.qrPrefix} onChange={onChange} aria-describedby="qrPrefix-help" />
                {errors.qrPrefix ? <FieldError id="qrPrefix-help" text={errors.qrPrefix} /> : (
                  <p id="qrPrefix-help" className="mt-1 text-xs text-gray-500">Letters, numbers and dashes. Empty = {defaultQrPrefix(form.trashType)}</p>
                )}
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md bg-gray-50 border border-gray-200 p-4 text-sm" data-testid="generate-totals">
              <div>
                <dt className="text-gray-500">Unit price per bag</dt>
                <dd className="font-semibold text-gray-800">{formatCedis(summary.unitPrice)}</dd>
                <dd className="text-xs text-gray-500">Price per batch ÷ {Number.isInteger(values.bags) ? values.bags : '?'} bags</dd>
              </div>
              <div>
                <dt className="text-gray-500">Total for all batches</dt>
                <dd className="font-semibold text-gray-800">{formatCedis(summary.totalForAll)}</dd>
                <dd className="text-xs text-gray-500">Price per batch × {Number.isInteger(values.batches) ? values.batches : '?'} batches</dd>
              </div>
              <div>
                <dt className="text-gray-500">Bags to create</dt>
                <dd className={`font-semibold ${summary.totalBags > BAG_LIMITS.maxTotalBags ? 'text-red-600' : 'text-gray-800'}`}>
                  {summary.totalBags === null ? '—' : summary.totalBags.toLocaleString()}
                </dd>
                <dd className="text-xs text-gray-500">Limit {BAG_LIMITS.maxTotalBags.toLocaleString()} per submission</dd>
              </div>
            </dl>

            <div className="flex justify-end mt-6 space-x-4">
              <button type="button" onClick={handlePreview}
                className="py-2 px-4 border border-blue-500 rounded-md shadow-sm text-sm font-medium text-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <FontAwesomeIcon icon={faMagic} className="mr-2" /> Preview
              </button>
              <button type="submit" disabled={isGenerating}
                className="py-2 px-4 bg-green-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">
                {isGenerating
                  ? <><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Generating…</>
                  : <><FontAwesomeIcon icon={faQrcode} className="mr-2" />Generate</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Preview: summary + sample QR / label. Nothing is saved. */}
      {previewVisible && !hasErrors && (
        <div className="bg-white shadow-sm rounded-lg mb-6" data-testid="generate-preview">
          <div className="p-6">
            <h5 className="text-xl font-semibold mb-4 text-gray-700">Preview</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm content-start">
                <dt className="text-gray-500">Trash type</dt><dd className="font-medium">{values.type}</dd>
                <dt className="text-gray-500">Bag size</dt><dd className="font-medium">{values.size}</dd>
                <dt className="text-gray-500">Batches</dt><dd className="font-medium">{values.batches}</dd>
                <dt className="text-gray-500">Bags per batch</dt><dd className="font-medium">{values.bags}</dd>
                <dt className="text-gray-500">Total bags</dt><dd className="font-semibold">{summary.totalBags}</dd>
                <dt className="text-gray-500">Price per batch</dt><dd className="font-medium">{formatCedis(values.price)}</dd>
                <dt className="text-gray-500">Unit price per bag</dt><dd className="font-medium text-green-700">{formatCedis(summary.unitPrice)}</dd>
                <dt className="text-gray-500">Total for all batches</dt><dd className="font-semibold">{formatCedis(summary.totalForAll)}</dd>
                <dt className="text-gray-500">QR prefix</dt><dd className="font-mono">{values.prefix}</dd>
              </dl>
              <div className="flex flex-col items-center">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center" aria-label="Sample label">
                  <QRCodeSVG value={SAMPLE_ID} size={140} level="H" includeMargin />
                  <p className="mt-2 text-sm font-semibold">TrashDrop · {values.type} · {values.size}</p>
                  <p className="text-xs font-mono text-gray-600">{sampleBagCode(values.prefix, 1)}</p>
                  {summary.unitPrice !== null && <p className="text-xs text-gray-600">{formatCedis(summary.unitPrice)} per bag</p>}
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center max-w-xs">Sample only. Each batch gets its own ID in the QR code when generated; nothing has been saved yet.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={askGenerate} disabled={isGenerating}
                className="py-2 px-4 bg-green-600 rounded-md text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                <FontAwesomeIcon icon={faCheck} className="mr-2" /> Confirm &amp; Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title={`Generate ${summary.totalBags?.toLocaleString()} bags?`}
          confirmLabel="Generate" busy={isGenerating} onConfirm={runGenerate} onClose={() => setConfirmOpen(false)}>
          <p>
            {values.batches} batch{values.batches === 1 ? '' : 'es'} × {values.bags} bags of <strong>{values.type} · {values.size}</strong>,
            prefix <span className="font-mono">{values.prefix}</span>.
          </p>
          {values.price !== null && <p>{formatCedis(values.price)} per batch ({formatCedis(summary.unitPrice)} per bag), {formatCedis(summary.totalForAll)} in total.</p>}
          <p className="text-xs">Everything is created together: if anything fails, nothing is saved.</p>
        </ConfirmDialog>
      )}

      {/* Newest batches */}
      <div className="mt-8 bg-white shadow-sm rounded-lg">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <h5 className="text-xl font-semibold text-gray-700">Generated Batches</h5>
            <span className="ml-2 text-sm text-gray-500">newest 10</span>
            <Link to="/bin-management/history" className="ml-auto text-sm text-green-700 hover:underline">See all in Bag History →</Link>
          </div>
          {recentError && <p className="text-red-600 text-sm mb-2">{recentError}</p>}
          {recent === null ? <p className="text-gray-500 text-sm">Loading…</p> : recent.length === 0 ? (
            <p className="text-gray-500 text-sm">{recentError ? 'Batches could not be loaded.' : 'No batches have been generated yet.'}</p>
          ) : (
            <table className="w-full table-fixed text-sm" data-testid="recent-batches">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase text-left">
                <tr>
                  <th className="px-3 py-2 w-[14%]">Batch</th>
                  <th className="px-3 py-2 w-[13%]">Type</th>
                  <th className="px-3 py-2 w-[9%]">Size</th>
                  <th className="px-3 py-2 w-[7%]">Bags</th>
                  <th className="px-3 py-2 w-[14%]">Price</th>
                  <th className="px-3 py-2 w-[14%]">Created by</th>
                  <th className="px-3 py-2 w-[11%]">Date</th>
                  <th className="px-3 py-2 w-[18%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50" data-testid="recent-row">
                    <td className="px-3 py-2"><CopyId id={b.id} />{b.batchNumber && <span className="block text-xs text-gray-500 truncate">#{b.batchNumber}</span>}</td>
                    <td className="px-3 py-2">{b.type ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[b.type] || 'bg-gray-100 text-gray-800'}`}>{b.type}</span> : '—'}</td>
                    <td className="px-3 py-2">{orDash(b.size)}</td>
                    <td className="px-3 py-2">{b.bagCount}</td>
                    <td className="px-3 py-2">{formatCedis(b.totalBatchPrice)}{b.unitPrice != null && <span className="block text-xs text-gray-500">{formatCedis(b.unitPrice)}/bag</span>}</td>
                    <td className="px-3 py-2 truncate" title={b.generatedByName || ''}>{orDash(b.generatedByName)}</td>
                    <td className="px-3 py-2 text-gray-600">{b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button type="button" onClick={() => setViewQRModal({ visible: true, batch: b })} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 mr-1">
                        <FontAwesomeIcon icon={faEye} /> View
                      </button>
                      <button type="button" onClick={() => handleDownloadClick(b)} disabled={isDownloading && downloadingBatch === b.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                        <FontAwesomeIcon icon={isDownloading && downloadingBatch === b.id ? faSpinner : faDownload} className={isDownloading && downloadingBatch === b.id ? 'animate-spin' : ''} /> QR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Hidden batch QR codes used by Download (the QR holds the batch id) */}
        <div style={{ display: 'none' }}>
          {(recent || []).map(b => (
            <div key={`qrcode-${b.id}`} id={`qrcode-${b.id}`}>
              <QRCodeSVG value={b.id} size={256} level="H" includeMargin fgColor="#000000" bgColor="#ffffff" />
            </div>
          ))}
        </div>
      </div>

      {/* QR code viewer */}
      {viewQRModal.visible && viewQRModal.batch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setViewQRModal({ visible: false, batch: null })}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Batch QR code" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-2xl font-semibold text-gray-900">Batch QR Code</h3>
              <button onClick={() => setViewQRModal({ visible: false, batch: null })} className="text-gray-400 hover:text-gray-600" title="Close" aria-label="Close">
                <FontAwesomeIcon icon={faTimes} className="text-xl" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col items-center">
                <div className="bg-white border-2 border-gray-300 rounded-lg p-4 shadow-sm">
                  <QRCodeSVG value={viewQRModal.batch.id} size={260} level="H" includeMargin fgColor="#000000" bgColor="#ffffff" />
                </div>
                <p className="mt-4 text-sm text-gray-600 text-center">Scan this QR code with the TrashDrop mobile app</p>
              </div>
              <dl className="text-sm space-y-2">
                {[
                  ['Batch ID', <CopyId id={viewQRModal.batch.id} />],
                  ['Batch number', orDash(viewQRModal.batch.batchNumber)],
                  ['Type', orDash(viewQRModal.batch.type)],
                  ['Size', orDash(viewQRModal.batch.size)],
                  ['QR prefix', <span className="font-mono">{orDash(viewQRModal.batch.qrPrefix)}</span>],
                  ['Bags', viewQRModal.batch.bagCount],
                  ['Price per batch', formatCedis(viewQRModal.batch.totalBatchPrice)],
                  ['Price per bag', formatCedis(viewQRModal.batch.unitPrice)],
                  ['Created by', orDash(viewQRModal.batch.generatedByName)],
                  ['Created', viewQRModal.batch.createdAt ? new Date(viewQRModal.batch.createdAt).toLocaleString('en-GB') : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-gray-200 pb-2"><dt className="text-gray-600">{k}</dt><dd className="text-gray-900 text-right">{v}</dd></div>
                ))}
                <div className="pt-3 space-y-2">
                  <button onClick={() => { handleDownloadClick(viewQRModal.batch); setViewQRModal({ visible: false, batch: null }); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    <FontAwesomeIcon icon={faDownload} /> Download QR Code
                  </button>
                  <Link to={`/bin-management/manage?batch=${viewQRModal.batch.id}`} className="block text-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                    Open in Bag Management
                  </Link>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateBag;
