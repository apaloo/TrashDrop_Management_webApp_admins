import React from 'react';
import { relativeTime } from '../../utils/liveMapUtils';

/** Online (green, <10 min) / Seen today (amber, <24 h) / Offline (grey), with "last seen" */
const PresenceBadge = ({ presence, showLastSeen = false, className = '' }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${presence.badge} ${className}`}
    title={presence.lastSeen ? `Last location update ${new Date(presence.lastSeen).toLocaleString()}` : 'Never reported a location'}>
    <span className="w-2 h-2 rounded-full" style={{ background: presence.color }} aria-hidden="true"></span>
    {presence.key === 'online' ? 'Online' : showLastSeen && presence.lastSeen ? `Last seen ${relativeTime(presence.lastSeen)}` : presence.label}
  </span>
);

export default PresenceBadge;
