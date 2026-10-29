import React, { useEffect } from 'react';
import { card, muted, border } from '../pickupRequests/theme';
import { LogLevelBadge, actorRoleLabel } from './LogBadges';
import { formatAccra, relativeFromNow, changeRows, recordLink } from '../../utils/logUtils';
import { LOG_ENTITY_TYPES } from '../../constants/alerts';

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-xs" style={muted}>{label}</p>
    <div className="font-medium break-words">{children}</div>
  </div>
);

/** One log row: who, when, what, the record, field changes and metadata. Empty parts are hidden. */
const LogDetailsModal = ({ log, onOpenRecord, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const changes = changeRows(log.before, log.after);
  const hasMeta = log.metadata && Object.keys(log.metadata).length > 0;
  const link = recordLink(log.entityType, log.entityId);
  const entityLabel = LOG_ENTITY_TYPES.find(t => t.key === log.entityType)?.label || log.entityType;

  return (
    <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border" style={card}
        role="dialog" aria-modal="true" aria-labelledby="log-details-title" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 border-b px-5 py-3 flex items-start gap-3" style={{ ...card, ...border }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1"><LogLevelBadge level={log.level} />{log.isSample && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Sample</span>}</div>
            <h2 id="log-details-title" className="font-semibold">{log.actionLabel}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-xl leading-none" style={muted} aria-label="Close">&times;</button>
        </div>

        <div className="p-5 space-y-5 text-sm">
          {log.message && <p className="whitespace-pre-wrap break-words">{log.message}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Who">{log.actorName || 'System'} <span className="font-normal text-xs" style={muted}>({actorRoleLabel(log.actorRole)})</span></Field>
            <Field label="When (Accra)"><span title={relativeFromNow(log.createdAt)}>{formatAccra(log.createdAt)}</span> <span className="font-normal text-xs" style={muted}>{relativeFromNow(log.createdAt)}</span></Field>
            {log.action && <Field label="Action"><span className="font-mono text-xs">{log.action}</span></Field>}
            {log.source && <Field label="Source">{log.source}</Field>}
            {log.entityId && (
              <Field label="Record">
                <span className="font-normal">{entityLabel} </span><span className="font-mono text-xs">{log.entityId}</span>
                {link && <button type="button" className="ml-2 text-xs text-blue-600 underline" onClick={() => onOpenRecord(link)}>Open record</button>}
              </Field>
            )}
          </div>

          {changes.length > 0 && (
            <div>
              <h3 className="font-medium mb-1.5">Changes</h3>
              <table className="w-full text-sm border rounded" style={border} data-testid="log-changes">
                <thead className="text-xs text-left" style={muted}>
                  <tr className="border-b" style={border}><th className="px-2 py-1.5">Field</th><th className="px-2 py-1.5">Old</th><th className="px-2 py-1.5"></th><th className="px-2 py-1.5">New</th></tr>
                </thead>
                <tbody>
                  {changes.map(c => (
                    <tr key={c.field} className="border-b align-top" style={border}>
                      <td className="px-2 py-1.5" style={muted}>{c.label}</td>
                      <td className="px-2 py-1.5 break-all">{c.from}</td>
                      <td className="px-1 py-1.5" style={muted}>→</td>
                      <td className="px-2 py-1.5 break-all font-medium">{c.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasMeta && (
            <div>
              <h3 className="font-medium mb-1.5">Details</h3>
              <pre className="text-xs p-3 rounded border overflow-auto max-h-64" style={border}>{JSON.stringify(log.metadata, null, 2)}</pre>
            </div>
          )}

          {log.userAgent && <p className="text-xs break-words" style={muted}>Browser <span className="font-mono">{log.userAgent}</span></p>}
          <p className="text-xs" style={muted}>Log ID <span className="font-mono">{log.id}</span></p>
        </div>
      </div>
    </div>
  );
};

export default LogDetailsModal;
