import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../pickupRequests/ConfirmDialog';
import { input, muted } from '../pickupRequests/theme';
import { StatusBadge } from '../pickupRequests/StatusBadge';
import { shortId, shortAddress } from '../../utils/pickupRequestUtils';

export const DEACTIVATION_REASONS = [
  'Left TrashDrop',
  'Suspended: conduct or complaints',
  'No vehicle / vehicle off the road',
  'Duplicate account',
  'Other',
];

/**
 * Deactivate with a required reason. Blocked while the collector has active
 * jobs: those must be reassigned on the Pickup Requests page first.
 */
const DeactivateDialog = ({ collector, activeJobs, busy, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const blocked = activeJobs.length > 0;
  const needsNote = reason === 'Other';
  const fullReason = reason === 'Other' ? note.trim() : [reason, note.trim()].filter(Boolean).join(': ');

  return (
    <ConfirmDialog title={`Deactivate ${collector.name}?`} confirmLabel="Deactivate" danger busy={busy}
      confirmDisabled={blocked || !reason || (needsNote && !note.trim())}
      onConfirm={() => onConfirm(fullReason)} onClose={onClose}>
      {blocked ? (
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-3 space-y-2">
          <p className="font-medium">{collector.name} has {activeJobs.length} active job{activeJobs.length === 1 ? '' : 's'}. Reassign or finish {activeJobs.length === 1 ? 'it' : 'them'} first.</p>
          <ul className="space-y-1">
            {activeJobs.slice(0, 5).map(r => (
              <li key={`${r.source}-${r.id}`} className="flex items-center gap-2">
                <span className="font-mono text-xs">#{shortId(r.id)}</span><StatusBadge status={r.status} />
                <span className="truncate">{shortAddress(r.address) || ''}</span>
              </li>
            ))}
          </ul>
          <Link className="underline" to={`/request-pickup/requests?collector=${encodeURIComponent(collector.id)}&status=group%3Ain_progress`}>
            Open their active jobs on the Pickup Requests page
          </Link>
        </div>
      ) : (
        <>
          <p style={muted}>They won't be able to take new pickups until reactivated. This is logged.</p>
          <label className="block">
            <span className="block text-xs mb-1" style={muted}>Reason <span className="text-red-500">*</span></span>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full border rounded px-2 py-1.5" style={input} aria-label="Reason">
              <option value="">Choose a reason…</option>
              {DEACTIVATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs mb-1" style={muted}>Details {needsNote ? <span className="text-red-500">*</span> : '(optional)'}</span>
            <textarea rows="2" value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded px-2 py-1.5" style={input} aria-label="Details" />
          </label>
        </>
      )}
    </ConfirmDialog>
  );
};

export default DeactivateDialog;
