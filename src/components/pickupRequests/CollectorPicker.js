import React from 'react';
import { input } from './theme';

const label = (c) => {
  const parts = [c.name];
  if (c.distanceKm !== null && c.distanceKm !== undefined) parts.push(`${c.distanceKm.toFixed(1)} km away`);
  else parts.push('location unknown');
  parts.push(c.online ? 'online' : 'offline');
  parts.push(`${c.jobs?.active ?? 0} active job${(c.jobs?.active ?? 0) === 1 ? '' : 's'}`);
  return parts.join(' · ');
};

/**
 * Collector dropdown, nearest first (collectors from collectorsByDistance()).
 * Choosing a name only selects it; the caller assigns after confirmation.
 */
const CollectorPicker = ({ collectors, value, onChange, id, className = '' }) => (
  <select id={id} value={value || ''} onChange={e => onChange(e.target.value)} className={`border rounded px-2 py-1.5 text-sm ${className}`} style={input} aria-label="Collector">
    <option value="">Select a collector…</option>
    {collectors.map(c => (
      <option key={c.id} value={c.id} disabled={!c.userId}>{label(c)}{!c.userId ? ' (no user account)' : ''}</option>
    ))}
  </select>
);

export default CollectorPicker;
