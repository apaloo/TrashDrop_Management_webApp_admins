import React from 'react';
import { statusBadgeClass, statusLabel } from '../../utils/illegalDumpingReportUtils';

/** The one status pill used on Reports, History and every details modal */
const StatusBadge = ({ status, className = '' }) => (
  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(status)} ${className}`}>
    {statusLabel(status)}
  </span>
);

export default StatusBadge;
