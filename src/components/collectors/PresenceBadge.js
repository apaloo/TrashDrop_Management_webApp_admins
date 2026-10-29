import React from 'react';
import { relativeTime } from '../../utils/liveMapUtils';

const locationText = (presence) => (presence.locationAt
  ? `Last location update ${new Date(presence.locationAt).toLocaleString()}`
  : 'Never reported a location');

const titleOf = (presence) => {
  if (presence.key === 'online') return `On-Duty in the collector app. ${locationText(presence)}`;
  if (presence.noSignal) {
    const since = presence.lastSeen ? ` since ${new Date(presence.lastSeen).toLocaleString()}` : '';
    return `On-Duty in the collector app, but the app hasn't checked in${since}: the phone is offline, or the app is closed or in the background. ${locationText(presence)}`;
  }
  return locationText(presence);
};

const offlineText = (presence, showLastSeen) => {
  const seen = showLastSeen && presence.lastSeen ? relativeTime(presence.lastSeen) : null;
  if (presence.noSignal) return seen ? `No signal · last seen ${seen}` : 'No signal';
  return seen ? `Last seen ${seen}` : presence.label;
};

/**
 * Online (green, On-Duty and checking in) / Seen today (amber, <24 h) /
 * Offline (grey), with "last seen". A collector left On-Duty whose app has
 * stopped checking in shows "No signal".
 */
const PresenceBadge = ({ presence, showLastSeen = false, className = '' }) => {
  const online = presence.key === 'online';
  // An On-Duty collector whose phone hasn't sent a location for 10+ minutes
  const gps = online && showLastSeen && presence.gpsStale
    ? ` · GPS ${presence.locationAt ? relativeTime(presence.locationAt) : 'none'}` : '';
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${presence.badge} ${className}`}
      title={titleOf(presence)}>
      <span className="w-2 h-2 rounded-full" style={{ background: presence.color }} aria-hidden="true"></span>
      {online ? `Online${gps}` : offlineText(presence, showLastSeen)}
    </span>
  );
};

export default PresenceBadge;
