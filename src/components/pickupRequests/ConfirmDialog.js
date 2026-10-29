import React, { useEffect } from 'react';
import { card, muted, border } from './theme';

/** Small confirmation modal. Children render extra fields (e.g. a cancel reason). */
const ConfirmDialog = ({ title, children, confirmLabel = 'Confirm', danger = false, busy = false, confirmDisabled = false, onConfirm, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  return (
    <div className="fixed inset-0 z-[3000] bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-xl shadow-xl border" style={card} role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b" style={border}><h3 id="confirm-title" className="font-semibold">{title}</h3></div>
        <div className="px-5 py-4 text-sm space-y-3">{children}</div>
        <div className="px-5 py-3 border-t flex justify-end gap-2" style={border}>
          <button type="button" className="px-4 py-2 rounded text-sm border" style={{ ...border, ...muted }} onClick={onClose} disabled={busy}>Back</button>
          <button type="button" onClick={onConfirm} disabled={busy || confirmDisabled}
            className={`px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
