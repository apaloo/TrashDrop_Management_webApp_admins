import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import { saveAs } from 'file-saver';
import BagStageBadge from './BagStageBadge';
import CopyId from './CopyId';
import EntityHistory from '../logs/EntityHistory';
import { fetchBatchBags } from '../../services/bagAdminService';
import { orDash, batchProgress, bagQrUrl, batchQrUrl, formatCedis } from '../../utils/bagUtils';
import { fullDate, relativeAge } from '../../utils/pickupRequestUtils';

const BAG_PAGE = 10;

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-gray-600 text-sm">{label}</p>
    <div className="font-medium break-words">{children}</div>
  </div>
);

/** Everything about one batch: details, progress, its bags (paged) and QR downloads */
const BatchDetailsModal = ({ batch: b, email, busy, paused = false, onDownloadAll, onArchive, onRestore, onClose }) => {
  const [bags, setBags] = useState(null);
  const [bagTotal, setBagTotal] = useState(0);
  const [bagPage, setBagPage] = useState(1);
  const [bagError, setBagError] = useState(null);
  const [qrBusy, setQrBusy] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !paused) onClose(); }; // paused: a dialog on top handles Escape
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, paused]);

  useEffect(() => {
    let live = true;
    setBags(null);
    fetchBatchBags(b.id, { page: bagPage, size: BAG_PAGE })
      .then(r => { if (live) { setBags(r.rows); setBagTotal(r.total); setBagError(null); } })
      .catch(e => { if (live) { setBags([]); setBagError(e.message); } });
    return () => { live = false; };
  }, [b.id, bagPage]);

  // Same link and file name as the batch ZIP (src/workers/QRCodeWorker.js)
  const downloadBagQr = useCallback(async (bag) => {
    setQrBusy(bag.id);
    try {
      const svg = await QRCode.toString(bagQrUrl(b.id, bag.bagNo, email), { type: 'svg', margin: 2, width: 600, errorCorrectionLevel: 'M' });
      saveAs(new Blob([svg], { type: 'image/svg+xml' }), `QR_${b.id}_${bag.bagNo}.svg`);
    } finally {
      setQrBusy(null);
    }
  }, [b.id, email]);

  const p = batchProgress(b);
  const pages = Math.max(1, Math.ceil(bagTotal / BAG_PAGE));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true"
        aria-labelledby="batch-details-title" onClick={e => e.stopPropagation()} data-testid="batch-details">
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center gap-3 z-10">
          <h2 id="batch-details-title" className="text-lg font-semibold">Batch</h2>
          <CopyId id={b.id} />
          <BagStageBadge stage={b.stage} />
          <button type="button" onClick={onClose} className="ml-auto text-2xl leading-none text-gray-500 hover:text-gray-700" aria-label="Close">&times;</button>
        </div>

        <div className="p-5 space-y-6 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Created at">{b.createdAt ? fullDate(b.createdAt) : '—'}</Field>
            <Field label="Created by">
              {b.generatedByName || <span className="text-gray-500 font-normal" title="Batches scanned by a household before this update don't record which admin generated them">—</span>}
            </Field>
            <Field label="Batch number">{orDash(b.batchNumber)}</Field>
            <Field label="Type">{orDash(b.type)}</Field>
            <Field label="Size">{orDash(b.size)}</Field>
            <Field label="QR prefix"><span className="font-mono">{orDash(b.qrPrefix)}</span></Field>
            <Field label="Quantity">{b.bagCount} bags</Field>
            <Field label="Price">{formatCedis(b.totalBatchPrice)} per batch<span className="block text-xs text-gray-500 font-normal">{formatCedis(b.unitPrice)} per bag</span></Field>
            <Field label="Scanned by household">
              {b.householdName ? <>{b.householdName}{b.scannedByHouseholdAt && <span className="block text-xs text-gray-500 font-normal">{fullDate(b.scannedByHouseholdAt)}</span>}</> : '—'}
            </Field>
            <Field label="Status"><BagStageBadge stage={b.stage} /></Field>
          </div>

          <div>
            <h3 className="font-medium mb-2">Progress</h3>
            <div className="relative w-full bg-gray-200 rounded-full h-2.5 overflow-hidden" aria-label="Bag progress">
              <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ width: `${p.distributedPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-yellow-500" style={{ width: `${p.filledPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-green-600" style={{ width: `${p.collectedPct}%` }} />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-gray-600 mt-2" data-testid="batch-progress">
              <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />{p.distributed} distributed</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1" />{p.filled} filled</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-green-600 mr-1" />{p.collected} collected</span>
              <span>{p.total} total</span>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Bags ({bagTotal})</h3>
            {bagError && <p className="text-red-600 mb-2">{bagError}</p>}
            {bags === null ? <p className="text-gray-500">Loading bags…</p> : bags.length === 0 ? (
              <p className="text-gray-500">No bag records for this batch yet.</p>
            ) : (
              <>
                <table className="w-full table-fixed hidden sm:table" data-testid="bag-rows">
                  <thead className="text-xs text-left text-gray-500 uppercase bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 w-[18%]">Bag</th>
                      <th className="px-2 py-2 w-[14%]">Status</th>
                      <th className="px-2 py-2 w-[28%]">Household / location</th>
                      <th className="px-2 py-2 w-[16%]">Last activity</th>
                      <th className="px-2 py-2 w-[14%]">Collector</th>
                      <th className="px-2 py-2 w-[10%]"><span className="sr-only">QR</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bags.map(bag => (
                      <tr key={bag.id} className="align-top">
                        <td className="px-2 py-2"><span className="font-medium">#{bag.bagNo}</span><span className="block text-xs text-gray-500 font-mono truncate" title={bag.qrCode || ''}>{bag.qrCode || '—'}</span></td>
                        <td className="px-2 py-2"><BagStageBadge stage={bag.stage} /></td>
                        <td className="px-2 py-2 truncate" title={[bag.householdName, bag.address].filter(Boolean).join(' · ')}>
                          {bag.householdName || '—'}{bag.address && <span className="block text-xs text-gray-500 truncate">{bag.address}</span>}
                        </td>
                        <td className="px-2 py-2 text-gray-600" title={bag.lastActivityAt ? fullDate(bag.lastActivityAt) : ''}>{bag.lastActivityAt ? relativeAge(bag.lastActivityAt) : '—'}</td>
                        <td className="px-2 py-2 truncate">{bag.collectorName || '—'}</td>
                        <td className="px-2 py-2 text-right">
                          <button type="button" disabled={qrBusy === bag.id} onClick={() => downloadBagQr(bag)} className="text-xs text-green-700 hover:underline disabled:opacity-50" title={`Download the QR code for bag #${bag.bagNo}`}>
                            {qrBusy === bag.id ? '…' : 'QR ⬇'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="sm:hidden divide-y divide-gray-100 border rounded">
                  {bags.map(bag => (
                    <li key={bag.id} className="p-3 flex flex-col gap-1" data-testid="bag-card">
                      <div className="flex items-center gap-2"><span className="font-medium">Bag #{bag.bagNo}</span><BagStageBadge stage={bag.stage} />
                        <button type="button" onClick={() => downloadBagQr(bag)} className="ml-auto text-xs text-green-700">QR ⬇</button></div>
                      <span className="text-gray-600">{bag.householdName || 'No household yet'}{bag.collectorName ? ` · ${bag.collectorName}` : ''}</span>
                      <span className="text-xs text-gray-500">{bag.lastActivityAt ? relativeAge(bag.lastActivityAt) : '—'}</span>
                    </li>
                  ))}
                </ul>
                {pages > 1 && (
                  <div className="flex items-center justify-end gap-2 mt-2 text-sm">
                    <button type="button" disabled={bagPage <= 1} onClick={() => setBagPage(x => x - 1)} className="px-2 py-1 border rounded disabled:opacity-40">Previous</button>
                    <span className="text-gray-600">Page {bagPage} of {pages}</span>
                    <button type="button" disabled={bagPage >= pages} onClick={() => setBagPage(x => x + 1)} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Steps come from the household's scan and its pickup requests. No app scans single bags yet, so "Last activity" is the latest of those events.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Batch QR code</h3>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="p-3 bg-white border rounded-md inline-block">
                <QRCodeSVG value={batchQrUrl(b.id)} size={160} includeMargin />
              </div>
              <div className="text-gray-600 break-all">
                <div className="font-medium mb-1">Scan URL</div>
                <a href={batchQrUrl(b.id)} target="_blank" rel="noreferrer" className="text-green-700 hover:underline">{batchQrUrl(b.id)}</a>
              </div>
            </div>
          </div>

          <EntityHistory entityId={b.id} />
        </div>

        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex flex-wrap justify-end gap-2">
          {b.archived ? (
            <button type="button" disabled={busy} onClick={() => onRestore(b)} className="px-4 py-2 border border-green-600 text-green-700 rounded hover:bg-green-50 disabled:opacity-50">Restore</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => onArchive(b)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50">Archive</button>
          )}
          <button type="button" onClick={() => onDownloadAll(b)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" title="Regenerate QR codes with the latest print size and download">
            🔄 Regenerate &amp; Download
          </button>
          <button type="button" onClick={() => onDownloadAll(b)} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Download QRs</button>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">Close</button>
        </div>
      </div>
    </div>
  );
};

export default BatchDetailsModal;
