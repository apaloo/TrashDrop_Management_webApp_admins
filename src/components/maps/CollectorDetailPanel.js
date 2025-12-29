import React from 'react';

const CollectorDetailPanel = ({ collector, onClose }) => {
  const lastUpdateTime = new Date(collector.lastUpdated).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="bg-white rounded-lg shadow-lg border-0">
      <div className="border-b p-4 flex justify-between items-center">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden mr-3">
            <img 
              src={collector.profilePic} 
              alt={collector.name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/40';
              }}
            />
          </div>
          <div>
            <h3 className="font-semibold">{collector.name}</h3>
            <p className="text-xs text-gray-500">Vehicle {collector.vehicle}</p>
          </div>
        </div>
        <button 
          className="text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="p-4">
        {/* Status Banner */}
        <div className={`flex items-center p-2 rounded mb-4 ${
          collector.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
        }`}>
          <i className={`fas fa-${collector.status === 'active' ? 'check-circle text-green-600' : 'pause-circle text-gray-500'} mr-2`}></i>
          <span className={`text-sm font-medium ${
            collector.status === 'active' ? 'text-green-600' : 'text-gray-500'
          }`}>
            {collector.status === 'active' ? 'Active' : 'Inactive'} • Last Updated: {lastUpdateTime}
          </span>
        </div>
        
        {/* Capacity */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Current Capacity</span>
            <span className={`font-medium ${
              collector.capacityRemaining < 30 ? 'text-red-600' : 
              collector.capacityRemaining < 60 ? 'text-orange-500' : 
              'text-green-600'
            }`}>{collector.capacityRemaining}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                collector.capacityRemaining < 30 ? 'bg-red-600' : 
                collector.capacityRemaining < 60 ? 'bg-orange-500' : 
                'bg-green-600'
              }`}
              style={{ width: `${collector.capacityRemaining}%` }}
            ></div>
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
          <button className="px-3 py-2 bg-blue-600 text-white rounded flex items-center justify-center flex-1 text-sm hover:bg-blue-700">
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
