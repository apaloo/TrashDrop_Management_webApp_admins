import React, { useState } from 'react';
import ConfirmDialog from '../pickupRequests/ConfirmDialog';
import { input, muted } from '../pickupRequests/theme';
import { STATUS_ACTION_LABELS, alertStatus } from '../../constants/alerts';

const HELP = {
  acknowledged: 'Marks the alert as seen; it stays on the "Needs attention" list.',
  in_progress: 'Shows the team someone is working on it.',
  resolved: 'Say what was done. Rule alerts come back if the problem is still there after a day.',
  closed: 'Closes without fixing (e.g. not a real problem). A rule won\'t re-raise it for 24 hours.',
  open: 'Puts the alert back on the "Needs attention" list.',
};

/** Confirm a status change for one or many alerts; resolving needs a note */
const StatusChangeDialog = ({ to, count = 1, title, busy, onConfirm, onClose }) => {
  const [note, setNote] = useState('');
  const needsNote = to === 'resolved';
  const label = STATUS_ACTION_LABELS[to] || alertStatus(to).label;
  return (
    <ConfirmDialog title={title || `${label} ${count === 1 ? 'this alert' : `${count} alerts`}?`} confirmLabel={label}
      danger={to === 'closed'} busy={busy} confirmDisabled={needsNote && !note.trim()}
      onConfirm={() => onConfirm(note.trim())} onClose={onClose}>
      <p style={muted}>{HELP[to]}</p>
      {(to === 'resolved' || to === 'closed') && (
        <label className="block">
          <span className="block text-xs mb-1" style={muted}>{needsNote ? <>How was it resolved? <span className="text-red-500">*</span></> : 'Note (optional)'}</span>
          <textarea rows="3" value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded px-2 py-1.5" style={input} aria-label="Note" />
        </label>
      )}
    </ConfirmDialog>
  );
};

export default StatusChangeDialog;
