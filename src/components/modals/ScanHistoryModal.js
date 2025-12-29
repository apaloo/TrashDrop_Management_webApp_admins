import React from 'react';

/**
 * Scan History Modal with Timeline Visualization
 * Displays a chronological history of bag scanning events
 * 
 * @param {Boolean} isOpen - Controls visibility of the modal
 * @param {Function} onClose - Function to call when closing the modal
 * @param {Array} scanHistory - Array of scan history events
 * @param {String} bagId - ID of the bag being viewed
 */
const ScanHistoryModal = ({ isOpen, onClose, scanHistory = [], bagId }) => {
  if (!isOpen) return null;
  
  // Sort scan history by timestamp (newest first)
  const sortedHistory = [...scanHistory].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Format date in a readable way
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get status color for the timeline
  const getStatusColor = (status) => {
    switch(status.toLowerCase()) {
      case 'scanned':
        return 'bg-blue-500';
      case 'collected':
        return 'bg-green-500';
      case 'delivered':
        return 'bg-purple-500';
      case 'processed':
        return 'bg-teal-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get status icon for the timeline
  const getStatusIcon = (status) => {
    switch(status.toLowerCase()) {
      case 'scanned':
        return 'fa-qrcode';
      case 'collected':
        return 'fa-truck-loading';
      case 'delivered':
        return 'fa-check-circle';
      case 'processed':
        return 'fa-recycle';
      case 'error':
        return 'fa-exclamation-triangle';
      default:
        return 'fa-circle';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-3/4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">
            Scan History: {bagId || 'Bag ID'}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        {/* Empty state */}
        {sortedHistory.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="inline-block rounded-full bg-gray-100 p-4 mb-4">
                <i className="fas fa-history text-gray-400 text-3xl"></i>
              </div>
              <p className="text-gray-500">No scan history available for this bag</p>
            </div>
          </div>
        )}
        
        {/* Timeline */}
        {sortedHistory.length > 0 && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="relative">
              {/* Timeline vertical line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              {/* Timeline events */}
              {sortedHistory.map((scan, index) => (
                <div key={index} className="relative flex items-start mb-8 pb-2">
                  {/* Timeline dot */}
                  <div className={`absolute left-8 z-10 transform -translate-x-1/2 mt-1.5 w-4 h-4 rounded-full ${getStatusColor(scan.status)} border-2 border-white shadow`}></div>
                  
                  {/* Icon circle */}
                  <div className={`relative flex items-center justify-center h-16 w-16 rounded-full mr-4 ${getStatusColor(scan.status).replace('bg-', 'bg-opacity-15 bg-')} text-${getStatusColor(scan.status).replace('bg-', '')}`}>
                    <i className={`fas ${getStatusIcon(scan.status)} text-lg`}></i>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{scan.status}</h4>
                        <p className="text-sm text-gray-500">
                          {formatDate(scan.timestamp)}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        scan.status.toLowerCase() === 'error' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {scan.source}
                      </span>
                    </div>
                    
                    <div className="mt-2 bg-gray-50 rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-500">Collector:</span>
                          <span className="ml-1">{scan.collectorName || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Location:</span>
                          <span className="ml-1">{scan.location || 'N/A'}</span>
                        </div>
                        {scan.deviceId && (
                          <div>
                            <span className="font-medium text-gray-500">Device ID:</span>
                            <span className="ml-1">{scan.deviceId}</span>
                          </div>
                        )}
                        {scan.notes && (
                          <div className="md:col-span-2">
                            <span className="font-medium text-gray-500">Notes:</span>
                            <span className="ml-1">{scan.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="border-t p-4 flex justify-end bg-gray-50">
          <button
            onClick={() => {
              // This would trigger an export function in a real app
              console.log('Exporting scan history');
            }}
            className="px-4 py-2 text-blue-600 hover:text-blue-800 flex items-center"
          >
            <i className="fas fa-download mr-2"></i>
            Export History
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 ml-3"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanHistoryModal;
