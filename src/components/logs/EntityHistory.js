import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { muted, border } from '../pickupRequests/theme';
import { fetchEntityHistory } from '../../services/auditLogService';
import { formatAccra, relativeFromNow, changeRows } from '../../utils/logUtils';
import { LogLevelBadge } from './LogBadges';

/**
 * "History" for one record (request, collector or alert): every audit-log
 * row with its id, newest first. Loads when opened.
 */
const EntityHistory = ({ entityId, includeAssignments = false, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !entityId) return undefined;
    let live = true;
    setRows(null);
    fetchEntityHistory(entityId, { includeAssignments })
      .then(r => { if (live) { setRows(r); setError(null); } })
      .catch(e => { if (live) { setError(e.message); setRows([]); } });
    return () => { live = false; };
  }, [open, entityId, includeAssignments]);

  return (
    <div className="rounded border" style={border} data-testid="entity-history">
      <div className="flex items-center gap-3 px-3 py-2 text-sm">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex-1 flex items-center justify-between font-medium">
          <span>History</span>
          <span className="text-xs font-normal" style={muted}>{open ? 'Hide ▴' : 'Show ▾'}</span>
        </button>
        <Link to={`/request-pickup/logs?entity=${encodeURIComponent(entityId)}&range=all`} className="text-xs text-td-forest hover:underline whitespace-nowrap" data-testid="view-history">
          View history →
        </Link>
      </div>
      {open && (
        <div className="px-3 pb-3 text-sm">
          {error && <p className="text-red-600 text-xs">{error}</p>}
          {rows === null ? <p style={muted}>Loading…</p> : rows.length === 0 ? <p style={muted}>No history recorded yet.</p> : (
            <ol className="space-y-2" data-testid="history-rows">
              {rows.map(l => {
                const changes = changeRows(l.before, l.after);
                return (
                  <li key={l.id} className="border-l-2 pl-3" style={border}>
                    <div className="flex flex-wrap items-center gap-2">
                      <LogLevelBadge level={l.level} />
                      <span className="font-medium">{l.actionLabel}</span>
                      <span className="text-xs" style={muted} title={relativeFromNow(l.createdAt)}>{formatAccra(l.createdAt)} · {l.actorName || 'System'}</span>
                    </div>
                    <p className="text-xs mt-0.5 break-words" style={muted}>{l.message}</p>
                    {changes.length > 0 && (
                      <p className="text-xs mt-0.5">{changes.map(c => `${c.label}: ${c.from} → ${c.to}`).join(' · ')}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};

export default EntityHistory;
