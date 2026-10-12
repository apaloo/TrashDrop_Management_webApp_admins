import React, { useMemo, useState } from 'react';
import ConfirmDialog from '../pickupRequests/ConfirmDialog';
import CollectorPicker from '../pickupRequests/CollectorPicker';
import LocationPicker from './LocationPicker';
import { input, muted } from '../pickupRequests/theme';
import { collectorsByDistance, shortId, shortAddress } from '../../utils/pickupRequestUtils';
import { formatGhanaPhone } from '../../utils/collectorAdminUtils';

/* Each dialog collects what the action needs and calls onConfirm(payload). */

export const AssignCollectorDialog = ({ request, collectors, busy, onConfirm, onClose }) => {
  const ranked = useMemo(() => collectorsByDistance(request, collectors.filter(c => c.status === 'active')), [request, collectors]);
  const [id, setId] = useState(ranked.find(c => c.userId)?.id || '');
  const chosen = ranked.find(c => c.id === id);
  return (
    <ConfirmDialog title={`Assign a collector to #${shortId(request.id)}`} confirmLabel="Assign" busy={busy} confirmDisabled={!chosen?.userId}
      onConfirm={() => onConfirm(chosen)} onClose={onClose}>
      <p style={muted}>{shortAddress(request.address) || 'No address'} · nearest collectors first. They get a notification.</p>
      <CollectorPicker collectors={ranked} value={id} onChange={setId} className="w-full" />
      {chosen?.distanceKm != null && chosen.distanceKm > 20 && <p className="text-amber-700 text-xs">{chosen.name} is {chosen.distanceKm.toFixed(1)} km away.</p>}
    </ConfirmDialog>
  );
};

export const ContactCollectorDialog = ({ collector, context, busy, onConfirm, onClose }) => {
  const [message, setMessage] = useState(context ? `Please check ${context}.` : 'Please check in with the TrashDrop office.');
  return (
    <ConfirmDialog title={`Contact ${collector?.name || 'collector'}`} confirmLabel="Send app message" busy={busy}
      confirmDisabled={!collector?.userId || !message.trim()} onConfirm={() => onConfirm(message.trim())} onClose={onClose}>
      {collector?.phone
        ? <p>Phone: <a className="underline text-blue-600" href={`tel:${collector.phone}`}>{formatGhanaPhone(collector.phone)}</a> <span style={muted}>(tap to call)</span></p>
        : <p className="text-amber-700">No phone number on file.</p>}
      {collector?.userId ? (
        <label className="block">
          <span className="block text-xs mb-1" style={muted}>Message in the collector app</span>
          <textarea rows="3" value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded px-2 py-1.5" style={input} aria-label="Message" />
        </label>
      ) : <p style={muted}>This collector has no app account, so only a call is possible.</p>}
    </ConfirmDialog>
  );
};

export const NotifyCustomerDialog = ({ request, busy, onConfirm, onClose }) => {
  const [message, setMessage] = useState(`Update on your pickup request #${shortId(request.id)}: `);
  return (
    <ConfirmDialog title={`Notify ${request.customer?.name || 'the customer'}`} confirmLabel="Send notification" busy={busy}
      confirmDisabled={!message.trim()} onConfirm={() => onConfirm(message.trim())} onClose={onClose}>
      <p style={muted}>Shows in the customer's TrashDrop app.</p>
      <textarea rows="4" value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded px-2 py-1.5" style={input} aria-label="Message" />
    </ConfirmDialog>
  );
};

export const FixLocationDialog = ({ request, problem, busy, onConfirm, onClose }) => {
  const swapped = request.rawLat != null && request.rawLng != null
    ? { lat: request.rawLng, lng: request.rawLat } : null;
  const [point, setPoint] = useState(null);
  return (
    <ConfirmDialog title={`Fix the location of #${shortId(request.id)}`} confirmLabel="Save location" busy={busy} confirmDisabled={!point}
      onConfirm={() => onConfirm(point)} onClose={onClose}>
      <p style={muted}>{problem ? `Problem: ${problem}. ` : ''}Search the address or click the map.</p>
      {swapped && /swapped/i.test(problem || '') && (
        <button type="button" className="text-sm underline text-blue-600" onClick={() => setPoint({ ...swapped, address: null })}>
          Use the swapped coordinates ({swapped.lat}, {swapped.lng})
        </button>
      )}
      <LocationPicker value={point} onChange={setPoint} height="h-56" />
    </ConfirmDialog>
  );
};

export const MergeDuplicatesDialog = ({ request, otherId, busy, onConfirm, onClose }) => (
  <ConfirmDialog title="Merge duplicate requests?" confirmLabel={`Cancel #${shortId(request.id)}`} danger busy={busy}
    onConfirm={() => onConfirm()} onClose={onClose}>
    <p>Request <span className="font-mono">#{shortId(request.id)}</span> will be cancelled as a duplicate of
      {' '}<span className="font-mono">#{shortId(otherId)}</span>, which stays open.</p>
    <p style={muted}>The cancellation is saved with the reason "Duplicate request".</p>
  </ConfirmDialog>
);
