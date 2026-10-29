import React from 'react';
import { muted, border, card } from '../pickupRequests/theme';
import { AlertPriorityBadge, AlertStatusBadge, AlertTypeLabel } from './AlertBadges';
import { relatedRecord, ageLabel } from '../../utils/alertUtils';

const Related = ({ rel }) => (rel ? (
  <div className="min-w-0">
    <p className="truncate"><span className="font-mono text-xs">{rel.short}</span> <span>{rel.name}</span></p>
    {rel.detail && <p className="text-xs truncate" style={muted}>{rel.detail}</p>}
  </div>
) : <span style={muted}>System</span>);

/**
 * Alerts list: priority, title + type, related record, assignee, age, status.
 * Rows come sorted (open first, then priority, then newest). Cards on small screens.
 */
const AlertsTable = ({ alerts, ctx, staffName, selected, onToggle, onToggleAll, onOpen, sort, onSort }) => {
  const allSelected = alerts.length > 0 && alerts.every(a => selected.has(a.id));
  const arrow = (key) => (sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : '');
  const header = (key, label) => (
    <button type="button" onClick={() => onSort(key)} className="font-semibold">{label}{arrow(key)}</button>
  );

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm" data-testid="alerts-table">
          <thead className="text-xs text-left" style={muted}>
            <tr className="border-b" style={border}>
              <th className="px-3 py-2 w-8"><input type="checkbox" aria-label="Select all alerts" checked={allSelected} onChange={() => onToggleAll(!allSelected)} /></th>
              <th className="px-2 py-2">{header('priority', 'Priority')}</th>
              <th className="px-2 py-2">Alert</th>
              <th className="px-2 py-2">Related record</th>
              <th className="px-2 py-2">Assignee</th>
              <th className="px-2 py-2 whitespace-nowrap">{header('created', 'Age')}</th>
              <th className="px-2 py-2">{header('status', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.id} className="border-b align-top cursor-pointer hover:bg-black hover:bg-opacity-5" style={border} onClick={() => onOpen(a)} data-testid="alert-row">
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${a.title}`} checked={selected.has(a.id)} onChange={() => onToggle(a.id)} />
                </td>
                <td className="px-2 py-2.5"><AlertPriorityBadge priority={a.priority} /></td>
                <td className="px-2 py-2.5 max-w-[22rem]">
                  <button type="button" className="font-medium text-left hover:underline line-clamp-2" onClick={e => { e.stopPropagation(); onOpen(a); }}>{a.title}</button>
                  <AlertTypeLabel type={a.type} />
                  {a.ruleKey && <span className="ml-2 text-xs" style={muted}>· automatic</span>}
                </td>
                <td className="px-2 py-2.5 max-w-[16rem]"><Related rel={relatedRecord(a, ctx)} /></td>
                <td className="px-2 py-2.5 whitespace-nowrap">{a.assignedTo ? staffName(a.assignedTo) : <span style={muted}>Unassigned</span>}</td>
                <td className="px-2 py-2.5 whitespace-nowrap" title={a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}>{ageLabel(a.createdAt)}</td>
                <td className="px-2 py-2.5"><AlertStatusBadge status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        <label className="flex items-center gap-2 text-sm" style={muted}>
          <input type="checkbox" checked={allSelected} onChange={() => onToggleAll(!allSelected)} /> Select all
        </label>
        {alerts.map(a => (
          <div key={a.id} className="rounded-lg border p-3" style={card} data-testid="alert-card">
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" aria-label={`Select ${a.title}`} checked={selected.has(a.id)} onChange={() => onToggle(a.id)} />
              <button type="button" className="text-left flex-1 min-w-0" onClick={() => onOpen(a)}>
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <AlertPriorityBadge priority={a.priority} /><AlertStatusBadge status={a.status} />
                  <span className="text-xs ml-auto" style={muted}>{ageLabel(a.createdAt)}</span>
                </div>
                <p className="font-medium">{a.title}</p>
                <AlertTypeLabel type={a.type} />
                <div className="mt-1.5 text-sm"><Related rel={relatedRecord(a, ctx)} /></div>
                <p className="text-xs mt-1" style={muted}>{a.assignedTo ? `Assigned to ${staffName(a.assignedTo)}` : 'Unassigned'}</p>
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default AlertsTable;
