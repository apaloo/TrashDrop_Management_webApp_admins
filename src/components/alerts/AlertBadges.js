import React from 'react';
import { alertPriority, alertStatus, alertType } from '../../constants/alerts';
import { muted } from '../pickupRequests/theme';

export const AlertPriorityBadge = ({ priority }) => {
  const p = alertPriority(priority);
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${p.className}`}>{p.label}</span>;
};

export const AlertStatusBadge = ({ status }) => {
  const s = alertStatus(status);
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${s.className}`}>{s.label}</span>;
};

export const AlertTypeLabel = ({ type, className = '' }) => {
  const t = alertType(type);
  return (
    <span className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${className}`} style={muted}>
      <i className={t.icon} aria-hidden="true"></i>{t.label}
    </span>
  );
};
