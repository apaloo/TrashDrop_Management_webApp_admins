import React from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import {
  COLLECTOR_ONLINE_COLOR, COLLECTOR_OFFLINE_COLOR, ONLINE_WINDOW_MS, capacityBadgeClass, relativeTime, collectorLastSeen,
} from '../../utils/liveMapUtils';

const iconCache = {};
const collectorIcon = (online) => {
  const key = online ? 'on' : 'off';
  if (!iconCache[key]) {
    iconCache[key] = L.divIcon({
      className: 'custom-collector-icon',
      html: `<div style="background:${online ? COLLECTOR_ONLINE_COLOR : COLLECTOR_OFFLINE_COLOR};width:34px;height:34px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff">
        <i class="fas fa-truck" style="font-size:13px"></i></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -16],
    });
  }
  return iconCache[key];
};

/**
 * Collector on the Live Map. Expects a collector from withCollectorPosition()
 * (position, online). Renders nothing without a valid position.
 */
const CollectorMapMarker = ({ collector, onViewDetails, markerRef }) => {
  if (!collector?.position) return null;
  const capacity = collector.capacityUsed ?? 0;
  const locationAt = collectorLastSeen(collector);
  // On-Duty, but the pin is where the phone last sent a location
  const oldLocation = collector.online && !(Date.now() - new Date(locationAt).getTime() <= ONLINE_WINDOW_MS);

  return (
    // Online collectors sit above offline ones at the same spot
    <Marker position={collector.position} icon={collectorIcon(collector.online)} ref={markerRef} zIndexOffset={collector.online ? 1000 : 0}
      title={`Collector ${collector.name || ''}, ${collector.online ? 'online' : 'offline'}`}>
      <Tooltip direction="top" offset={[0, -16]}>{collector.name}</Tooltip>
      <Popup>
        <div className="text-sm min-w-[200px]">
          <p className="font-semibold text-td-ink">{collector.name || 'Unknown collector'}</p>
          <p className="text-xs mb-2">
            <span className={`inline-flex items-center gap-1 font-medium ${collector.online ? 'text-green-700' : 'text-td-sage'}`}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: collector.online ? COLLECTOR_ONLINE_COLOR : COLLECTOR_OFFLINE_COLOR }}></span>
              {collector.online ? 'Online (On-Duty)' : 'Off duty'}
            </span>
            <span className="text-td-sage"> · {collector.status === 'active' ? 'Active' : 'Inactive'} account</span>
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs bg-td-cream rounded p-2 mb-2">
            <div>
              <p className="text-td-sage">Capacity</p>
              <span className={`inline-block mt-0.5 px-1.5 rounded font-semibold ${capacityBadgeClass(capacity)}`}>{capacity}%</span>
            </div>
            <div>
              <p className="text-td-sage">Completed</p>
              <p className="font-semibold text-td-ink">{collector.stats?.completedToday || 0}</p>
            </div>
            <div>
              <p className="text-td-sage">Pending</p>
              <p className="font-semibold text-td-ink">{collector.stats?.pendingPickups || 0}</p>
            </div>
          </div>
          <p className={`text-xs ${oldLocation ? 'text-amber-700' : 'text-td-sage'}`}>
            Location {relativeTime(locationAt)}{oldLocation ? ' (the phone has not sent a newer location)' : ''}
          </p>
          {typeof onViewDetails === 'function' && (
            <button className="mt-2 text-td-forest text-xs hover:underline" onClick={() => onViewDetails(collector)}>
              View details
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
};

export default CollectorMapMarker;
