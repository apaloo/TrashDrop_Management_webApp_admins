import React, { useEffect, useState } from 'react';
import { card, input, muted, border } from '../pickupRequests/theme';
import { AlertPriorityBadge, AlertStatusBadge, AlertTypeLabel } from './AlertBadges';
import { ACTIONS, actionsFor } from './alertActions';
import { STATUS_ACTIONS, STATUS_ACTION_LABELS, alertStatus, alertPriority } from '../../constants/alerts';
import { ageLabel } from '../../utils/alertUtils';
import { fullDate } from '../../utils/pickupRequestUtils';
import EntityHistory from '../logs/EntityHistory';

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-xs" style={muted}>{label}</p>
    <div className="font-medium break-words">{children}</div>
  </div>
);

const ICON = { created: 'fas fa-plus-circle', status: 'fas fa-exchange-alt', assigned: 'fas fa-user-tag', escalated: 'fas fa-arrow-up', comment: 'far fa-comment', action: 'fas fa-bolt' };

const describe = (e, staffName) => {
  switch (e.kind) {
    case 'created': return e.actor_name?.startsWith('Rule:') ? 'Created automatically' : 'Created';
    case 'status': return `${alertStatus(e.from_value).label} → ${alertStatus(e.to_value).label}`;
    case 'assigned': return e.to_value ? `Assigned to ${staffName(e.to_value)}` : 'Unassigned';
    case 'escalated': return `Priority ${alertPriority(e.from_value).label} → ${alertPriority(e.to_value).label}`;
    case 'comment': return 'Comment';
    case 'action': return `${ACTIONS[e.to_value]?.label || e.to_value}${e.data?.ok === false ? ' (failed)' : ''}`;
    default: return e.kind;
  }
};

/**
 * One alert: what it's about (with the record's live details), what to do
 * (actions that fit the type), status buttons, assignment and the timeline.
 */
const AlertDetailsModal = ({
  alert, rel, staff, staffName, activity, busy, canEdit,
  onStatus, onAssign, onComment, onAction, onMoreInfo, onClose,
}) => {
  const [comment, setComment] = useState('');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const actions = actionsFor(alert, rel);
  const statusActions = STATUS_ACTIONS[alert.status] || [];
  const timeline = activity || [];

  return (
    <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4" onClick={() => !busy && onClose()}>
      <div className="rounded-xl shadow-xl w-full max-w-3xl max-h-[94vh] overflow-y-auto border" style={card}
        role="dialog" aria-modal="true" aria-labelledby="alert-details-title" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b px-5 py-3 flex items-start gap-3" style={{ ...card, ...border }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1"><AlertPriorityBadge priority={alert.priority} /><AlertStatusBadge status={alert.status} /><AlertTypeLabel type={alert.type} /></div>
            <h2 id="alert-details-title" className="font-semibold">{alert.title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-xl leading-none" style={muted} aria-label="Close">&times;</button>
        </div>

        <div className="p-5 space-y-5 text-sm">
          {alert.description && <p className="whitespace-pre-wrap">{alert.description}</p>}

          {/* Related record */}
          <div className="rounded border p-3" style={border} data-testid="related-record">
            <p className="text-xs mb-1" style={muted}>Related to</p>
            {rel ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium"><span className="font-mono text-xs mr-1">{rel.short}</span>{rel.name}</p>
                  {rel.detail && <p className="text-xs" style={muted}>{rel.detail}</p>}
                  {rel.kind === 'pickup_request' && !rel.record && <p className="text-xs text-amber-700">This request was not found in the current data.</p>}
                </div>
                <button type="button" onClick={onMoreInfo} className="px-3 py-1.5 rounded border text-sm whitespace-nowrap" style={border}>More info</button>
              </div>
            ) : <p className="font-medium">System <span className="font-normal text-xs" style={muted}>(no linked record)</span></p>}
          </div>

          {/* Actions */}
          {actions.length > 0 && canEdit && (
            <div>
              <p className="text-xs mb-1.5" style={muted}>Actions</p>
              <div className="flex flex-wrap gap-2">
                {actions.map(key => (
                  <button key={key} type="button" disabled={busy} onClick={() => onAction(key)}
                    className="px-3 py-1.5 rounded text-sm border hover:bg-black hover:bg-opacity-5 disabled:opacity-40" style={border}>
                    <i className={`${ACTIONS[key].icon} mr-1.5`} aria-hidden="true"></i>{ACTIONS[key].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Created"><span title={fullDate(alert.createdAt)}>{ageLabel(alert.createdAt)}</span> <span className="font-normal text-xs" style={muted}>{alert.ruleKey ? 'by a rule' : ''}</span></Field>
            <Field label="Assigned to">
              <select value={alert.assignedTo || ''} disabled={busy || !canEdit} onChange={e => onAssign(e.target.value || null)}
                className="w-full border rounded px-2 py-1 text-sm font-normal" style={input} aria-label="Assign to">
                <option value="">Unassigned</option>
                {staff.filter(u => u.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            {alert.location?.lat != null
              ? <Field label="Location"><span className="font-normal">{alert.location.address || `${alert.location.lat.toFixed(5)}, ${alert.location.lng.toFixed(5)}`}</span></Field>
              : <Field label="Rule">{alert.ruleKey || 'Created by hand'}</Field>}
            {alert.resolutionNote && <div className="sm:col-span-3"><Field label={alert.autoResolved ? 'Resolved automatically' : 'Resolution note'}><span className="font-normal">{alert.resolutionNote}</span></Field></div>}
          </div>

          {/* Timeline */}
          <div>
            <h3 className="font-medium mb-2">Comments &amp; activity</h3>
            {activity === null ? <p style={muted}>The activity log appears once the alerts migration has been run.</p> : (
              <ol className="relative border-l pl-4 space-y-3" style={border} data-testid="activity">
                {timeline.length === 0 && <li style={muted}>Nothing yet</li>}
                {timeline.map(e => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] text-white bg-green-600">
                      <i className={ICON[e.kind] || 'fas fa-circle'} aria-hidden="true"></i>
                    </span>
                    <p><span className="font-medium">{describe(e, staffName)}</span>
                      <span className="text-xs" style={muted}> · {e.actor_name || 'System'} · <span title={fullDate(e.created_at)}>{ageLabel(e.created_at)}</span></span></p>
                    {e.note && e.kind !== 'created' && <p className="whitespace-pre-wrap" style={e.kind === 'comment' ? undefined : muted}>{e.note}</p>}
                  </li>
                ))}
              </ol>
            )}
            {canEdit && activity !== null && (
              <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); if (comment.trim()) onComment(comment).then(ok => ok && setComment('')); }}>
                <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment" aria-label="Add a comment"
                  className="flex-1 border rounded px-3 py-2" style={input} />
                <button type="submit" disabled={busy || !comment.trim()} className="px-3 py-2 rounded text-sm text-white bg-green-600 disabled:opacity-40">Comment</button>
              </form>
            )}
          </div>

          <EntityHistory entityId={alert.id} />
        </div>

        {canEdit && statusActions.length > 0 && (
          <div className="sticky bottom-0 border-t px-5 py-3 flex flex-wrap justify-end gap-2" style={{ ...card, ...border }}>
            {statusActions.map(to => (
              <button key={to} type="button" disabled={busy} onClick={() => onStatus(to)}
                className={`px-4 py-2 rounded text-sm font-medium disabled:opacity-40 ${to === 'resolved' ? 'text-white bg-green-600 hover:bg-green-700' : to === 'open' ? 'border text-td-forest' : 'border'}`}
                style={to === 'resolved' ? undefined : { ...border, color: to === 'open' ? undefined : 'var(--td-text-primary)' }}>
                {STATUS_ACTION_LABELS[to]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertDetailsModal;
