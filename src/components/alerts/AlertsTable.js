import React from 'react';
import { STATUS, PRIORITY } from '../../config/constants';

const AlertsTable = ({ 
  alerts, 
  onViewDetails, 
  onToggleStatus, 
  sorting, 
  setSorting, 
  selectedAlerts, 
  toggleAlertSelection,
  toggleSelectAll,
  allSelected
}) => {
  // Format date to readable string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-3 py-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Alert
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Related To
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => setSorting(prev => ({
                  field: 'createdAt',
                  direction: prev.field === 'createdAt' && prev.direction === 'desc' ? 'asc' : 'desc'
                }))}
              >
                Created
                {sorting.field === 'createdAt' && (
                  <i className={`fas fa-sort-${sorting.direction === 'asc' ? 'up' : 'down'} ml-1`}></i>
                )}
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {alerts.map(alert => (
              <tr key={alert.id} className={selectedAlerts.includes(alert.id) ? "bg-blue-50" : ""}>
                {/* Checkbox */}
                <td className="px-3 py-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                      checked={selectedAlerts.includes(alert.id)}
                      onChange={() => toggleAlertSelection(alert.id)}
                    />
                  </div>
                </td>
                
                {/* Alert info */}
                <td className="px-6 py-4">
                  <div className="flex items-start">
                    <div className="mr-3 mt-1">
                      {alert.priority === 'critical' && (
                        <i className="fas fa-exclamation-circle text-red-600"></i>
                      )}
                      {alert.priority === 'high' && (
                        <i className="fas fa-exclamation-triangle text-orange-500"></i>
                      )}
                      {alert.priority === 'medium' && (
                        <i className="fas fa-exclamation text-yellow-500"></i>
                      )}
                      {alert.priority === 'low' && (
                        <i className="fas fa-info-circle text-blue-500"></i>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{alert.title}</div>
                      <div className="text-sm text-gray-500 line-clamp-1">{alert.description}</div>
                    </div>
                  </div>
                </td>
                
                {/* Related entity */}
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <div className="font-medium text-gray-500 uppercase">
                      {alert.relatedTo.type.replace('_', ' ')}
                    </div>
                    <div>
                      <span className="text-gray-900">{alert.relatedTo.id}</span>
                      {alert.relatedTo.location && (
                        <span className="text-gray-500 ml-1">({alert.relatedTo.location})</span>
                      )}
                    </div>
                  </div>
                </td>
                
                {/* Status */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    alert.status === STATUS.ALERT.OPEN 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-green-100 text-green-800'
                  }`}>
                    {alert.status === STATUS.ALERT.OPEN ? (
                      <>
                        <i className="fas fa-circle text-xs mr-1"></i>
                        Open
                      </>
                    ) : alert.status === STATUS.ALERT.RESOLVED ? (
                      <>
                        <i className="fas fa-check text-xs mr-1"></i>
                        Resolved
                      </>
                    ) : alert.status === STATUS.ALERT.IN_PROGRESS ? (
                      <>
                        <i className="fas fa-sync text-xs mr-1"></i>
                        In Progress
                      </>
                    ) : (
                      <>
                        <i className="fas fa-times text-xs mr-1"></i>
                        Closed
                      </>
                    )}
                  </span>
                </td>
                
                {/* Created date */}
                <td className="px-6 py-4 text-sm text-gray-500">
                  {formatDate(alert.createdAt)}
                </td>
                
                {/* Actions */}
                <td className="px-6 py-4 text-right text-sm font-medium">
                  <button
                    className="text-blue-600 hover:text-blue-900 mr-4"
                    onClick={() => onViewDetails(alert)}
                  >
                    <i className="fas fa-eye mr-1"></i>
                    View
                  </button>
                  <button
                    className={`${
                      alert.status === STATUS.ALERT.OPEN ? 'text-green-600 hover:text-green-900' : 'text-yellow-600 hover:text-yellow-900'
                    }`}
                    onClick={() => onToggleStatus(alert.id)}
                  >
                    {alert.status === STATUS.ALERT.OPEN ? (
                      <>
                        <i className="fas fa-check-circle mr-1"></i>
                        Resolve
                      </>
                    ) : (
                      <>
                        <i className="fas fa-redo mr-1"></i>
                        Reopen
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertsTable;
