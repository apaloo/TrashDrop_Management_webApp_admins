import React, { useEffect, useMemo, useState } from 'react';
import { card, muted, border } from '../pickupRequests/theme';
import { PriorityBadge } from '../pickupRequests/StatusBadge';
import { shortId, shortAddress, bagsLabel, formatGhs, relativeAge, distanceKm } from '../../utils/pickupRequestUtils';
import { relativeTime } from '../../utils/liveMapUtils';

/**
 * Pending, unassigned requests nearest the collector's last location first.
 * Pick several, confirm, and the page assigns them one by one with the same
 * rules as the Pickup Requests page.
 */
const AssignPickupsModal = ({ collector, requests, loading, busy, onAssign, onClose }) => {
  const [selected, setSelected] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || busy) return;
      if (confirming) setConfirming(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, confirming, onClose]);

  const ranked = useMemo(() => {
    const pos = collector.position;
    return (requests || [])
      .map(r => ({ ...r, distanceKm: pos && r.lat !== null ? distanceKm(pos[0], pos[1], r.lat, r.lng) : null }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
        || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [requests, collector.position]);

  const key = (r) => `${r.source}:${r.id}`;
  const chosen = ranked.filter(r => selected.has(key(r)));
  const toggle = (r) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(key(r))) next.delete(key(r)); else next.add(key(r));
    return next;
  });
  const allSelected = ranked.length > 0 && chosen.length === ranked.length;
  const totalFee = chosen.reduce((s, r) => s + (r.fee || 0), 0);
  const totalBags = chosen.reduce((s, r) => s + (r.bags || 0), 0);

  return (
    <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4" onClick={() => !busy && onClose()}>
      <div className="rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col border" style={card}
        role="dialog" aria-modal="true" aria-labelledby="assign-title" onClick={e => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center gap-2" style={border}>
          <div className="min-w-0">
            <h2 id="assign-title" className="font-semibold truncate">Assign pickups to {collector.name}</h2>
            <p className="text-xs" style={muted}>
              {collector.position ? 'Nearest first, from their last location' : 'Location unknown: oldest first'}
              {collector.presence?.lastSeen ? ` · last seen ${relativeTime(collector.presence.lastSeen)}` : ''}
              {collector.jobs?.active ? ` · ${collector.jobs.active} active job${collector.jobs.active === 1 ? '' : 's'} already` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="ml-auto text-xl leading-none" style={muted} aria-label="Close">&times;</button>
        </div>

        {confirming ? (
          <div className="p-5 text-sm space-y-3 overflow-y-auto">
            <p>Assign <strong>{chosen.length}</strong> pickup{chosen.length === 1 ? '' : 's'} to <strong>{collector.name}</strong>?
              {' '}They'll be marked Assigned and {collector.name.split(' ')[0]} gets a notification.</p>
            <ul className="space-y-1">
              {chosen.map(r => (
                <li key={key(r)} className="flex gap-2">
                  <span className="font-mono">#{shortId(r.id)}</span>
                  <span className="truncate">{shortAddress(r.address) || 'No address'}</span>
                  <span className="ml-auto whitespace-nowrap" style={muted}>{r.distanceKm !== null ? `${r.distanceKm.toFixed(1)} km` : ''}</span>
                </li>
              ))}
            </ul>
            <p style={muted}>{bagsLabel(totalBags)} · {formatGhs(totalFee)}</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <p className="p-5 text-sm" style={muted}>Loading pending requests…</p>
            ) : ranked.length === 0 ? (
              <p className="p-5 text-sm" style={muted}>No pending, unassigned requests right now.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 text-xs text-left" style={{ ...card, ...muted }}>
                  <tr className="border-b" style={border}>
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox" aria-label="Select all" checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(ranked.map(key)))} />
                    </th>
                    <th className="px-2 py-2">Area</th>
                    <th className="px-2 py-2 text-right">Distance</th>
                    <th className="px-2 py-2 hidden sm:table-cell">Bags</th>
                    <th className="px-2 py-2 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(r => (
                    <tr key={key(r)} className="border-b cursor-pointer hover:bg-black hover:bg-opacity-5" style={border} onClick={() => toggle(r)}>
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`Select request ${shortId(r.id)}`} checked={selected.has(key(r))} onChange={() => toggle(r)} onClick={e => e.stopPropagation()} /></td>
                      <td className="px-2 py-2 min-w-0">
                        <div className="truncate max-w-[16rem]" title={r.address || ''}>{shortAddress(r.address) || (r.lat !== null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : 'No location')}</div>
                        <div className="text-xs flex items-center gap-1.5" style={muted}>
                          <span className="font-mono">#{shortId(r.id)}</span> · {relativeAge(r.createdAt)}
                          {r.priority === 'high' && <PriorityBadge priority="high" />}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{r.distanceKm !== null ? `${r.distanceKm.toFixed(1)} km` : '—'}</td>
                      <td className="px-2 py-2 hidden sm:table-cell whitespace-nowrap">{bagsLabel(r.bags)}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{formatGhs(r.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="border-t px-5 py-3 flex flex-wrap items-center gap-2" style={border}>
          <span className="text-xs mr-auto" style={muted}>{chosen.length} selected</span>
          {confirming ? (
            <>
              <button type="button" className="px-4 py-2 rounded text-sm border" style={{ ...border, ...muted }} disabled={busy} onClick={() => setConfirming(false)}>Back</button>
              <button type="button" className="px-4 py-2 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50" disabled={busy}
                onClick={() => onAssign(chosen)}>{busy ? 'Assigning…' : `Assign ${chosen.length}`}</button>
            </>
          ) : (
            <>
              <button type="button" className="px-4 py-2 rounded text-sm border" style={{ ...border, ...muted }} onClick={onClose}>Cancel</button>
              <button type="button" className="px-4 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40" disabled={chosen.length === 0}
                onClick={() => setConfirming(true)}>Review {chosen.length || ''} assignment{chosen.length === 1 ? '' : 's'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignPickupsModal;
