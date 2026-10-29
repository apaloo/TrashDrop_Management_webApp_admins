import React from 'react';
import { relativeTime, collectorLastSeen } from '../../utils/liveMapUtils';
import { secureUrl } from '../../utils/secureUrl';

const CollectorDetailPanel = ({ collector, onClose }) => {
  const lastUpdateTime = relativeTime(collectorLastSeen(collector));
  const capacity = collector.capacityUsed ?? 0;
  const capacityText = capacity >= 90 ? 'text-red-600' : capacity >= 70 ? 'text-amber-600' : 'text-gray-600';
  const capacityBar = capacity >= 90 ? 'bg-red-600' : capacity >= 70 ? 'bg-amber-500' : 'bg-gray-400';

  return (
    <div className="rounded-lg shadow-lg border" style={{ background: 'var(--td-card-bg)', borderColor: 'var(--td-card-border)', color: 'var(--td-text-primary)' }}>
      <div className="border-b p-4 flex justify-between items-center">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden mr-3">
            <img 
              src={secureUrl(collector.profilePic)} 
              alt={collector.name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/40';
              }}
            />
          </div>
          <div>
            <h3 className="font-semibold">{collector.name}</h3>
            <p className="text-xs text-gray-500">
              Vehicle{' '}
              {typeof collector.vehicle === 'string'
                ? collector.vehicle
                : `${collector.vehicle?.type || 'Vehicle'}${collector.vehicle?.plate ? ` • ${collector.vehicle.plate}` : ''}${collector.vehicle?.capacity ? ` • ${collector.vehicle.capacity}` : ''}`}
            </p>
          </div>
        </div>
        <button 
          className="text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="p-4" style={{ paddingBottom: '100px' }}>
        {/* Status Banner */}
        <div className={`flex items-center p-2 rounded mb-4 ${
          collector.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
        }`}>
          <i className={`fas fa-${collector.status === 'active' ? 'check-circle text-green-600' : 'pause-circle text-gray-500'} mr-2`}></i>
          <span className={`text-sm font-medium ${
            collector.status === 'active' ? 'text-green-600' : 'text-gray-500'
          }`}>
            {collector.online ? 'Online' : 'Offline'} • {collector.status === 'active' ? 'Active' : 'Inactive'} account • Last update: {lastUpdateTime}
          </span>
        </div>
        
        {/* Capacity */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Current Capacity</span>
            <span className={`font-medium ${capacityText}`}>{capacity}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full ${capacityBar}`} style={{ width: `${Math.min(100, capacity)}%` }}></div>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border rounded p-3">
            <div className="text-xl font-semibold">{collector.stats.completedToday}</div>
            <div className="text-xs text-gray-500">Pickups Completed</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xl font-semibold">{collector.stats.pendingPickups}</div>
            <div className="text-xs text-gray-500">Pending Pickups</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xl font-semibold">{collector.stats.totalDistance} km</div>
            <div className="text-xs text-gray-500">Total Distance</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xl font-semibold">{collector.stats.avgResponseTime} min</div>
            <div className="text-xs text-gray-500">Avg Response Time</div>
          </div>
        </div>
        
        {/* Contact */}
        <div className="bg-gray-50 p-3 rounded mb-4">
          <h4 className="font-medium text-sm mb-2">Contact Information</h4>
          <p className="text-sm flex items-center">
            <i className="fas fa-phone-alt mr-2 text-gray-500"></i> {collector.contactNumber}
          </p>
          <p className="text-sm flex items-center mt-2">
            <i className="fas fa-map-marker-alt mr-2 text-gray-500"></i> {collector.assignedRegion}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex space-x-2">
          <button className="px-3 py-2 bg-green-600 text-white rounded flex items-center justify-center flex-1 text-sm hover:bg-green-700">
            <i className="fas fa-phone mr-2"></i> Call Collector
          </button>
          <button className="px-3 py-2 bg-gray-100 text-gray-800 rounded flex items-center justify-center flex-1 text-sm hover:bg-gray-200">
            <i className="fas fa-route mr-2"></i> View Route
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectorDetailPanel;
