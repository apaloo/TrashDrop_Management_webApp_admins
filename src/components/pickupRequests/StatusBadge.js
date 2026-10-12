import React from 'react';
import { statusInfo } from '../../constants/pickupStatus';
import { priorityInfo } from '../../constants/pickupStatus';

/** Status pill; colours come from the shared status model (same as the Live Map) */
export const StatusBadge = ({ status }) => {
  const s = statusInfo(status);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white whitespace-nowrap" style={{ background: s.color }} data-testid="status-badge">
      {s.label}
    </span>
  );
};

export const PriorityBadge = ({ priority }) => {
  const p = priorityInfo(priority);
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${p.className}`}>{p.label}</span>;
};

export default StatusBadge;
