import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Custom collector marker component
const CollectorMapMarker = ({ collector, openDetailModal }) => {
  // Add safety checks for collector and location
  if (!collector || !collector.currentLocation || !collector.currentLocation.lat || !collector.currentLocation.lng) {
    return null; // Don't render if location data is missing
  }

  const vehicleLabel = typeof collector.vehicle === 'string'
    ? collector.vehicle
    : `${collector.vehicle?.type || 'Vehicle'}${collector.vehicle?.plate ? ` • ${collector.vehicle.plate}` : ''}${collector.vehicle?.capacity ? ` • ${collector.vehicle.capacity}` : ''}`;

  // Create custom collector icon
  const collectorIcon = L.divIcon({
    className: 'custom-collector-icon',
    html: `
      <div class="relative">
        <div style="background-color: ${(collector.status === 'active') ? '#4CAF50' : '#9E9E9E'}; 
                    width: 36px; 
                    height: 36px; 
                    border-radius: 50%; 
                    border: 3px solid white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;">
          <i class="fas fa-truck"></i>
        </div>
        <div style="position: absolute;
                    bottom: -5px;
                    right: -5px;
                    background-color: ${(collector.capacityRemaining || 0) < 30 ? '#dc3545' : 
                                         (collector.capacityRemaining || 0) < 60 ? '#FF9800' : 
                                         '#4CAF50'};
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    border: 2px solid white;
                    font-size: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;">
          ${collector.capacityRemaining || 0}%
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  return (
    <Marker
      position={[collector.currentLocation.lat, collector.currentLocation.lng]}
      icon={collectorIcon}
    >
      <Popup>
        <div className="p-2">
          <div className="flex items-center mb-2">
            <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden mr-3">
              <img 
                src={collector.profilePic || 'https://via.placeholder.com/40'} 
                alt={collector.name || 'Collector'}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/40';
                }}
              />
            </div>
            <div>
              <h3 className="font-semibold">{collector.name || 'Unknown Collector'}</h3>
              <p className="text-xs text-gray-500">Vehicle {vehicleLabel || 'N/A'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
            <div>
              <p className="text-gray-500">Status</p>
              <p className={`font-medium ${(collector.status === 'active') ? 'text-green-600' : 'text-gray-500'}`}>
                {(collector.status === 'active') ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Region</p>
              <p className="font-medium">{collector.assignedRegion || 'Unassigned'}</p>
            </div>
          </div>
          
          <div className="flex justify-between text-xs bg-gray-50 p-2 rounded mb-2">
            <div className="text-center">
              <p className="text-gray-500">Completed</p>
              <p className="font-semibold">{collector.stats?.completedToday || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Pending</p>
              <p className="font-semibold">{collector.stats?.pendingPickups || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Capacity</p>
              <p className="font-semibold">{collector.capacityRemaining || 0}%</p>
            </div>
          </div>
          
          <button 
            className="w-full text-center mt-1 text-blue-600 text-sm hover:underline"
            onClick={() => openDetailModal(collector)}
          >
            View Details
          </button>
        </div>
      </Popup>
    </Marker>
  );
};

export default CollectorMapMarker;
