import React from 'react';
import { relativeTime } from '../../utils/liveMapUtils';

const locationText = (presence) => (presence.locationAt
  ? `Last location update ${new Date(presence.locationAt).toLocaleString()}`
  : 'Never reported a location');

/** Online (green, On-Duty) / Seen today (amber, <24 h) / Offline (grey), with "last seen" */
const PresenceBadge = ({ presence, showLastSeen = false, className = '' }) => {
  const online = presence.key === 'online';
  // An On-Duty collector whose phone hasn't sent a location for 10+ minutes
  const gps = online && showLastSeen && presence.gpsStale
    ? ` · GPS ${presence.locationAt ? relativeTime(presence.locationAt) : 'none'}` : '';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${presence.badge} ${className}`}
      title={online ? `On-Duty in the collector app. ${locationText(presence)}` : locationText(presence)}>
      <span className="w-2 h-2 rounded-full" style={{ background: presence.color }} aria-hidden="true"></span>
      {online ? `Online${gps}` : showLastSeen && presence.lastSeen ? `Last seen ${relativeTime(presence.lastSeen)}` : presence.label}
    </span>
  );
};

export default PresenceBadge;
