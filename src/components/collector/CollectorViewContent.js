import React from 'react';

/**
 * CollectorViewContent - Displays collector information in view mode
 * 
 * @param {Object} collector - The collector data to display
 */
const CollectorViewContent = ({ collector }) => {
  // Format date to readable string
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left column - Basic info */}
      <div className="md:col-span-1">
        <div className="flex flex-col items-center">
          <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center mb-3 overflow-hidden">
            {collector.avatar ? (
              <img 
                src={collector.avatar} 
                alt={collector.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <i className="fas fa-user-circle text-gray-400 text-5xl"></i>
            )}
          </div>
          
          <h4 className="text-xl font-semibold text-gray-800 mb-1">
            {collector.name}
          </h4>
          
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-2 ${
            collector.status === 'Active' ? 'bg-green-100 text-green-800' : 
            collector.status === 'Idle' ? 'bg-yellow-100 text-yellow-800' : 
            'bg-gray-100 text-gray-800'
          }`}>
            {collector.status || 'Unknown'}
          </div>
          
          <p className="text-gray-500 text-sm mb-3">
            {collector.region || 'No region assigned'}
          </p>
          
          <div className="flex space-x-2 mb-4">
            <button className="p-2 bg-blue-50 rounded-full text-blue-500 hover:bg-blue-100">
              <i className="fas fa-phone"></i>
            </button>
            <button className="p-2 bg-blue-50 rounded-full text-blue-500 hover:bg-blue-100">
              <i className="fas fa-envelope"></i>
            </button>
            <button className="p-2 bg-blue-50 rounded-full text-blue-500 hover:bg-blue-100">
              <i className="fas fa-comment"></i>
            </button>
          </div>
          
          <div className="w-full bg-blue-50 rounded-lg p-3">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Quick Stats</h5>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-500">Collections</p>
                <p className="font-semibold text-blue-600">{collector.collectionsCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Rating</p>
                <p className="font-semibold text-blue-600">
                  {collector.rating || 'N/A'} {collector.rating && (
                    <i className="fas fa-star text-yellow-500 text-xs"></i>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">On Time</p>
                <p className="font-semibold text-blue-600">{collector.onTimeRate || '0%'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Since</p>
                <p className="font-semibold text-blue-600">
                  {collector.joinDate ? new Date(collector.joinDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right column - Details */}
      <div className="md:col-span-2">
        {/* Contact information */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <i className="fas fa-address-card text-blue-500 mr-2"></i>
            Contact Information
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Email</p>
              <p className="font-medium">{collector.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Phone</p>
              <p className="font-medium">{collector.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Alternative Contact</p>
              <p className="font-medium">{collector.alternativeContact || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Region</p>
              <p className="font-medium">{collector.region || 'N/A'}</p>
            </div>
          </div>
        </div>
        
        {/* Vehicle information */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <i className="fas fa-truck text-blue-500 mr-2"></i>
            Vehicle Information
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Vehicle Type</p>
              <p className="font-medium">{collector.vehicleType || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Vehicle ID</p>
              <p className="font-medium">{collector.vehicleId || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Capacity</p>
              <p className="font-medium">{collector.capacity || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Last Maintenance</p>
              <p className="font-medium">
                {collector.lastMaintenance ? formatDate(collector.lastMaintenance) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Activity */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <i className="fas fa-history text-blue-500 mr-2"></i>
            Recent Activity
          </h5>
          
          {collector.recentActivity && collector.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {collector.recentActivity.slice(0, 3).map((activity, index) => (
                <div key={index} className="flex items-start">
                  <div className={`h-8 w-8 rounded-full mr-3 flex items-center justify-center ${
                    activity.type === 'collection' ? 'bg-green-100 text-green-500' :
                    activity.type === 'delivery' ? 'bg-blue-100 text-blue-500' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    <i className={`fas ${
                      activity.type === 'collection' ? 'fa-truck-loading' :
                      activity.type === 'delivery' ? 'fa-box' :
                      'fa-circle'
                    } text-sm`}></i>
                  </div>
                  <div>
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-gray-500">{formatDate(activity.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent activity recorded</p>
          )}
          
          {collector.recentActivity && collector.recentActivity.length > 3 && (
            <button className="mt-3 text-sm text-blue-600 hover:text-blue-800">
              View All Activity
            </button>
          )}
        </div>
        
        {/* Notes */}
        {collector.notes && (
          <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
            <h5 className="text-sm font-medium text-gray-700 mb-1 flex items-center">
              <i className="fas fa-sticky-note text-yellow-500 mr-2"></i>
              Notes
            </h5>
            <p className="text-sm">{collector.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectorViewContent;
