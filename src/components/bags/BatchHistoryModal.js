import React, { useCallback, useEffect, useState } from 'react';
import BagStageBadge from './BagStageBadge';
import CopyId from './CopyId';
import { fetchBatchHistory } from '../../services/bagAdminService';
import { orDash, batchProgress, formatCedis } from '../../utils/bagUtils';
import { fullDate, relativeAge } from '../../utils/pickupRequestUtils';

const KIND_STYLE = {
  household_scan: 'bg-blue-500',
  scan: 'bg-indigo-500',
  pickup_requested: 'bg-yellow-500',
  collected: 'bg-green-600',
};

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-td-sage text-sm">{label}</p>
    <div className="font-medium break-words">{children}</div>
  </div>
);

/** "View History": batch summary, its bags, and each bag's timeline (click a bag) */
const BatchHistoryModal = ({ batch: b, onClose }) => {
  const [data, setData] = useState(null); // { bags, events }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchBatchHistory(b.id)
      .then(setData)
      .catch(e => { setData(null); setError(e.message); })
      .finally(() => setLoading(false));
  }, [b.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = batchProgress(b);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true"
        aria-labelledby="batch-history-title" onClick={e => e.stopPropagation()} data-testid="batch-history">
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center gap-3 z-10">
          <h2 id="batch-history-title" className="text-lg font-semibold">Batch history</h2>
          <CopyId id={b.id} />
          <BagStageBadge stage={b.stage} />
          <button type="button" onClick={onClose} className="ml-auto text-2xl leading-none text-td-sage hover:text-td-ink" aria-label="Close">&times;</button>
        </div>

        <div className="p-5 space-y-6 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Created">{b.createdAt ? fullDate(b.createdAt) : '—'}</Field>
            <Field label="Created by">{orDash(b.generatedByName)}</Field>
            <Field label="Type">{orDash(b.type)}</Field>
            <Field label="Size">{orDash(b.size)}</Field>
            <Field label="QR prefix"><span className="font-mono">{orDash(b.qrPrefix)}</span></Field>
            <Field label="Household">{orDash(b.householdName)}</Field>
            <Field label="Price">{formatCedis(b.totalBatchPrice)}<span className="block text-xs text-td-sage font-normal">{formatCedis(b.unitPrice)} per bag</span></Field>
            <Field label="Scanned">{b.scannedCount} of {p.total} bags ({b.scannedPct}%)</Field>
            <Field label="Collected">{b.collected} of {p.total} bags</Field>
          </div>
          <div>
            <div className="relative w-full bg-gray-200 rounded-full h-2.5 overflow-hidden" aria-label="Bag progress">
              <div className="absolute inset-y-0 left-0 bg-td-orange" style={{ width: `${p.distributedPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-[#1d4ed8]" style={{ width: `${p.filledPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-green-600" style={{ width: `${p.collectedPct}%` }} />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-td-sage mt-2">
              <span>{p.distributed} distributed</span><span>{p.filled} filled</span><span>{p.collected} collected</span><span>{p.total} total</span>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Bags</h3>
            {loading ? <p className="text-td-sage">Loading history…</p> : error ? (
              <div className="rounded border border-red-300 bg-red-50 text-red-800 p-3" role="alert" data-testid="history-error">
                <p className="font-medium">History could not be loaded.</p>
                <p className="text-xs mt-1 break-words">{error}</p>
                <button type="button" onClick={load} className="mt-2 px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700">Retry</button>
              </div>
            ) : data.bags.length === 0 ? (
              <p className="text-td-sage">This batch has no bag records yet (bags are created when a household scans the batch QR).</p>
            ) : (
              <ul className="border rounded divide-y" data-testid="history-bags">
                {data.bags.map(bag => {
                  const events = data.events[bag.id] || [];
                  const isOpen = open === bag.id;
                  return (
                    <li key={bag.id}>
                      <button type="button" onClick={() => setOpen(isOpen ? null : bag.id)} aria-expanded={isOpen}
                        className="w-full text-left px-3 py-2 grid grid-cols-2 sm:grid-cols-[4rem_7rem_1fr_1fr_5rem] gap-x-3 gap-y-1 items-center hover:bg-td-cream">
                        <span className="font-medium">#{bag.bagNo}</span>
                        <span><BagStageBadge stage={bag.stage} /></span>
                        <span className="text-td-sage truncate" title={bag.lastScanAt ? fullDate(bag.lastScanAt) : ''}>
                          {bag.lastScanAt ? `Scanned ${relativeAge(bag.lastScanAt)}` : 'Not scanned'}{bag.lastScannedByName ? ` · ${bag.lastScannedByName}` : ''}
                        </span>
                        <span className="text-td-sage truncate" title={bag.lastLocation || ''}>{bag.lastLocation || '—'}</span>
                        <span className="text-td-sage text-xs sm:text-right">{bag.scanCount} scan{bag.scanCount === 1 ? '' : 's'} {isOpen ? '▴' : '▾'}</span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 bg-td-cream" data-testid="bag-timeline">
                          <p className="text-xs text-td-sage font-mono break-all pt-2">{bag.qrCode || bag.id}</p>
                          {events.length === 0 ? <p className="text-td-sage py-2">No events recorded for this bag yet.</p> : (
                            <ol className="mt-2 space-y-2">
                              {events.map((e, i) => (
                                <li key={`${e.kind}-${i}`} className="flex gap-3">
                                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-none ${KIND_STYLE[e.kind] || 'bg-gray-400'}`} />
                                  <div className="min-w-0">
                                    <p className="font-medium">{e.label}</p>
                                    <p className="text-xs text-td-sage">{fullDate(e.at)}{e.actor ? ` · ${e.actor}` : ''}{e.location ? ` · ${e.location}` : ''}</p>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-td-sage mt-2">
              A scan is a household scanning the batch QR, or a scan saved by an app. Collector bag scans aren't saved by the collector app yet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchHistoryModal;
