import React from 'react';
import { Polygon, Tooltip } from 'react-leaflet';

// Component to display service area boundaries on the map
const ServiceAreaLayer = ({ area }) => {
  const positions = area.coordinates.map(coord => [coord[0], coord[1]]);

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: area.color,
        weight: area.strokeWidth,
        fillOpacity: area.fillOpacity
      }}
    >
      <Tooltip direction="center" permanent={false} sticky>
        <div className="p-1">
          <p className="font-medium text-sm">{area.name}</p>
          <div className="flex justify-between text-xs mt-1">
            <span>Collectors: {area.activeCollectors}</span>
            <span className="ml-2">Requests: {area.requestsInProgress}</span>
          </div>
        </div>
      </Tooltip>
    </Polygon>
  );
};

export default ServiceAreaLayer;
