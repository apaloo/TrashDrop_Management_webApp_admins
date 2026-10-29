import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import CollectorPicker from './CollectorPicker';
import { card, muted, border } from './theme';
import { canonicalStatus, canCancel } from '../../constants/pickupStatus';
import {
  shortId, bagsLabel, fullDate, relativeAge, formatGhs, feeBreakdown, collectorsByDistance, isOverdue,
} from '../../utils/pickupRequestUtils';
import { fetchBatchPrice, fetchZoneBinPrice, fetchBinPromotion } from '../../services/pickupAdminService';
import EntityHistory from '../logs/EntityHistory';

const pin = L.divIcon({
  className: 'custom-marker-icon',
  html: '<div style="background:#16A34A;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const Field = ({ label, children, wide }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <p className="text-xs" style={muted}>{label}</p>
    <div className="font-medium break-words">{children}</div>
  </div>
);

const RequestDetailsModal = ({
  row, address, collectors, assignCollectors, duplicates = [], outsideServiceArea, busy,
  onAssign, onStatus, onCancel, onCancelAsDuplicate, onOpenRequest, onClose, onCopy,
}) => {
  const [collectorId, setCollectorId] = useState('');
  const [batchPrice, setBatchPrice] = useState(null);
  const [zone, setZone] = useState(null);
  const [promo, setPromo] = useState(null);
  const [binPricingLoaded, setBinPricingLoaded] = useState(false);
  const status = canonicalStatus(row.status);
  const hasCollector = !!row.collectorRef;
  const ranked = collectorsByDistance(row, collectors);
  // Who this account may assign to (Waste Management Managers: their region only)
  const assignRanked = assignCollectors ? collectorsByDistance(row, assignCollectors) : ranked;
  const chosen = assignRanked.find(c => c.id === collectorId);
  // No verdict on a bin's fee until we know whether it was a promotion
  const fee = feeBreakdown(row, { batchPrice, zone: binPricingLoaded ? zone : null, promo });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let live = true;
    setBatchPrice(null);
    setZone(null);
    setPromo(null);
    setBinPricingLoaded(false);
    if (row.source === 'pickup_requests' && row.batchId) fetchBatchPrice(row.batchId).then(p => { if (live) setBatchPrice(p); });
    if (row.source === 'digital_bins' && row.promotionalFee === null) {
      fetchBinPromotion(row.id, row.binSizeLiters).catch(() => null).then(async (p) => {
        const z = p ? null : await fetchZoneBinPrice(row.lat, row.lng, row.binSizeLiters).catch(() => null);
        if (!live) return;
        setPromo(p);
        setZone(z);
        setBinPricingLoaded(true);
      });
    }
    return () => { live = false; };
  }, [row.id, row.source, row.batchId, row.lat, row.lng, row.binSizeLiters, row.promotionalFee]);

  const action = (label, to, cls, disabled, title) => (
    <button key={to} type="button" disabled={busy || disabled} title={title} onClick={() => onStatus(row, to)}
      className={`px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border" style={card}
        role="dialog" aria-modal="true" aria-labelledby="request-details-title" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b px-5 py-3 flex items-center gap-3" style={{ ...card, ...border }}>
          <h3 id="request-details-title" className="font-semibold">Request <span className="font-mono">#{shortId(row.id)}</span></h3>
          <StatusBadge status={row.status} />
          {isOverdue(row) && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">Overdue</span>}
          <button type="button" onClick={onClose} className="ml-auto text-xl leading-none" style={muted} aria-label="Close">&times;</button>
        </div>

        <div className="p-5 space-y-5 text-sm">
          {(duplicates.length > 0 || outsideServiceArea || row.locationIssue) && (
            <div className="space-y-2">
              {duplicates.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-3">
                  <p className="font-medium mb-1">Possible duplicate: same customer, same place, still open, within 48 hours</p>
                  <ul className="space-y-1">
                    {duplicates.map(d => (
                      <li key={`${d.source}-${d.id}`} className="flex flex-wrap items-center gap-2">
                        <button type="button" className="font-mono underline" onClick={() => onOpenRequest(d)}>#{shortId(d.id)}</button>
                        <span>{relativeAge(d.createdAt)}</span>
                        <StatusBadge status={d.status} />
                        {canCancel(row.status) && (
                          <button type="button" disabled={busy} className="ml-auto text-xs underline" onClick={() => onCancelAsDuplicate(row, d)}>
                            Merge: cancel this one as a duplicate of #{shortId(d.id)}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {outsideServiceArea && <p className="rounded border border-orange-300 bg-orange-50 text-orange-900 p-3">Outside service area: no collector is within 25 km of this pickup.</p>}
              {row.locationIssue && <p className="rounded border border-red-300 bg-red-50 text-red-800 p-3">Location problem: {row.locationIssue}.</p>}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Request ID" wide>
              <span className="font-mono text-xs">{row.id}</span>
              <button type="button" className="ml-2 text-xs underline" style={muted} onClick={() => onCopy(row.id)}>Copy</button>
            </Field>
            <Field label="Customer">{row.customer?.name || 'Unknown customer'}</Field>
            <Field label="Contact">{[row.customer?.phone, row.customer?.email].filter(Boolean).join(' · ') || '—'}</Field>
            <Field label="Requested"><span title={fullDate(row.createdAt)}>{fullDate(row.createdAt)} ({relativeAge(row.createdAt)})</span></Field>
            <Field label="Priority"><PriorityBadge priority={row.priority} /></Field>
            <Field label="Waste type">{row.wasteType}</Field>
            <Field label="Quantity">{bagsLabel(row.bags)}{row.binSizeLiters ? ` · ${row.binSizeLiters} L bin` : ''}</Field>
            <Field label="Source">{row.source === 'digital_bins' ? 'Digital Bin' : row.source === 'scheduled_pickups' ? 'Scheduled' : 'Request'}</Field>
            {row.scheduledDate && <Field label="Scheduled">{fullDate(row.scheduledDate)}</Field>}
            <Field label="Location" wide>
              {address || 'No address'}
              {row.lat !== null && (
                <span className="block text-xs font-normal" style={muted}>Lat {row.lat.toFixed(5)}, Lng {row.lng.toFixed(5)}</span>
              )}
            </Field>
          </div>

          {row.lat !== null && (
            <div className="h-48 rounded overflow-hidden border" style={border}>
              <MapContainer center={[row.lat, row.lng]} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[row.lat, row.lng]} icon={pin} title="Pickup location" />
              </MapContainer>
            </div>
          )}

          {/* Collector */}
          <div className="rounded border p-3 space-y-2" style={border}>
            <p className="text-xs" style={muted}>Collector</p>
            {hasCollector ? (
              <p className="font-medium">{row.collectorName || 'Assigned (profile not found)'}
                {(() => { const c = ranked.find(x => x.id === row.collectorProfileId); return c?.distanceKm != null ? <span className="font-normal" style={muted}> · {c.distanceKm.toFixed(1)} km away</span> : null; })()}
              </p>
            ) : status === 'pending' && onAssign ? (
              <div className="flex flex-wrap items-center gap-2">
                <CollectorPicker collectors={assignRanked} value={collectorId} onChange={setCollectorId} className="flex-1 min-w-[220px]" />
                <button type="button" disabled={!chosen || busy} onClick={() => onAssign(row, chosen)}
                  className="px-4 py-1.5 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40">
                  Assign
                </button>
              </div>
            ) : <p style={muted}>Not assigned</p>}
          </div>

          {/* Fee */}
          <div className="rounded border p-3" style={border}>
            <div className="flex justify-between items-baseline">
              <p className="text-xs" style={muted}>Fee</p>
              <p className="font-semibold">{formatGhs(row.fee)}</p>
            </div>
            {fee.lines.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {fee.lines.map(([label, amount]) => (
                  <li key={label} className="flex justify-between text-xs"><span style={muted}>{label}</span><span>{formatGhs(amount)}</span></li>
                ))}
                {fee.expected !== null && <li className="flex justify-between text-xs border-t pt-1 mt-1" style={border}><span style={muted}>Expected total</span><span>{formatGhs(fee.expected)}</span></li>}
              </ul>
            )}
            {fee.mismatch && (
              <p className="mt-2 text-xs rounded bg-amber-50 text-amber-900 border border-amber-300 p-2" data-testid="fee-mismatch">
                Stored fee {formatGhs(row.fee)} doesn't match the pricing logic ({formatGhs(fee.expected)}). {fee.note}
              </p>
            )}
            {!fee.mismatch && fee.note && <p className="mt-1 text-xs" style={muted}>{fee.note}</p>}
            {row.payouts?.total !== null && row.payouts?.total !== undefined && (
              <p className="mt-1 text-xs" style={muted}>Collector payout {formatGhs(row.payouts.total)}{row.payouts.platform !== null ? ` · platform ${formatGhs(row.payouts.platform)}` : ''}</p>
            )}
          </div>

          {row.notes && <Field label="Notes">{row.notes}</Field>}
          {status === 'cancelled' && (
            <Field label="Cancelled">{fullDate(row.cancelledAt)}{row.cancellationReason ? ` · ${row.cancellationReason}` : ''}</Field>
          )}

          <EntityHistory entityId={row.id} />
        </div>

        {/* Actions: only the next steps the status allows */}
        {(status !== 'disposed' && status !== 'cancelled' && status !== 'expired') && (
          <div className="sticky bottom-0 border-t px-5 py-3 flex flex-wrap justify-end gap-2" style={{ ...card, ...border }}>
            {status === 'pending' && action('Start Pickup', 'en_route', 'bg-purple-600', true, 'Assign a collector first')}
            {status === 'accepted' && action('Start Pickup', 'en_route', 'bg-green-600 hover:bg-green-700', !hasCollector, hasCollector ? '' : 'Assign a collector first')}
            {status === 'en_route' && action('Mark Arrived', 'arrived', 'bg-green-600 hover:bg-green-700', !hasCollector)}
            {status === 'arrived' && action('Start Collecting', 'collecting', 'bg-green-600 hover:bg-green-700', !hasCollector)}
            {hasCollector && ['arrived', 'collecting'].includes(status) && action('Mark as Completed', 'disposed', 'bg-green-600 hover:bg-green-700', false)}
            {canCancel(row.status) && (
              <button type="button" disabled={busy} onClick={() => onCancel([row])} className="px-4 py-2 rounded text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50">
                Cancel Request
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestDetailsModal;
