import React from 'react';

const MapControls = ({ 
  mapMode, 
  setMapMode, 
  showCollectors, 
  setShowCollectors,
  showPickups,
  setShowPickups,
  showServiceAreas,
  setShowServiceAreas,
  centerMap
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border-0 p-4 mb-4">
      <div className="flex flex-col md:flex-row justify-between">
        <div>
          <h3 className="font-semibold mb-3">Map Display</h3>
          <div className="flex flex-wrap gap-3">
            <button
              className={`inline-flex items-center px-3 py-1.5 border rounded-full text-xs font-medium ${
                mapMode === 'default' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-700 border-gray-300'
              }`}
              onClick={() => setMapMode('default')}
            >
              <i className="fas fa-map-marked-alt mr-1.5"></i> Default View
            </button>
            <button
              className={`inline-flex items-center px-3 py-1.5 border rounded-full text-xs font-medium ${
                mapMode === 'satellite' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-700 border-gray-300'
              }`}
              onClick={() => setMapMode('satellite')}
            >
              <i className="fas fa-satellite mr-1.5"></i> Satellite
            </button>
            <button
              className="inline-flex items-center px-3 py-1.5 border rounded-full text-xs font-medium bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              onClick={centerMap}
            >
              <i className="fas fa-compress-arrows-alt mr-1.5"></i> Reset View
            </button>
          </div>
        </div>
        
        <div className="mt-4 md:mt-0">
          <h3 className="font-semibold mb-3">Layer Visibility</h3>
          <div className="flex flex-wrap gap-3">
            <button
              className={`inline-flex items-center px-3 py-1.5 border rounded-full text-xs font-medium ${
                showCollectors ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-500 border-gray-300'
              }`}
              onClick={() => setShowCollectors(!showCollectors)}
            >
              <i className={`fas fa-${showCollectors ? 'check-circle mr-1.5' : 'circle mr-1.5'}`}></i> Collectors
            </button>
            <button
              className={`inline-flex items-center px-3 py-1.5 border rounded-full text-xs font-medium ${
                showPickups ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-500 border-gray-300'
              }`}
              onClick={() => setShowPickups(!showPickups)}
            >
              <i className={`fas fa-${showPickups ? 'check-circle mr-1.5' : 'circle mr-1.5'}`}></i> Pickup Requests
            </button>
            <button
              className={`inline-flex items-center px-3 py-1.5 border rounded-full text-xs font-medium ${
                showServiceAreas ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-500 border-gray-300'
              }`}
              onClick={() => setShowServiceAreas(!showServiceAreas)}
            >
              <i className={`fas fa-${showServiceAreas ? 'check-circle mr-1.5' : 'circle mr-1.5'}`}></i> Service Areas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapControls;
