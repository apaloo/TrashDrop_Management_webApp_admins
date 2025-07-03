import React, { useState } from 'react';
import { STATUS, PRIORITY } from '../../config/constants';
import { appConfig } from '../../config';

const BulkActionModal = ({ selectedAlerts, onClose, onBulkUpdateStatus, onBulkAssign }) => {
  const [actionType, setActionType] = useState('status');
  const [statusValue, setStatusValue] = useState(STATUS.ALERT.RESOLVED);
  const [assignedTo, setAssignedTo] = useState('');
  
  const handleAction = () => {
    if (actionType === 'status') {
      onBulkUpdateStatus(selectedAlerts, statusValue);
    } else if (actionType === 'assign') {
      onBulkAssign(selectedAlerts, assignedTo === '' ? null : assignedTo);
    }
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="border-b p-4 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">Bulk Update Alerts</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-5">
            <p className="text-sm text-gray-600">
              Selected <span className="font-semibold">{selectedAlerts.length}</span> alert{selectedAlerts.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="space-y-4">
            {/* Action Type */}
            <div>
              <label htmlFor="actionType" className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                id="actionType"
                name="actionType"
                className="w-full p-2 border rounded-md"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
              >
                <option value="status">Update Status</option>
                <option value="assign">Assign To</option>
              </select>
            </div>
            
            {/* Status Action */}
            {actionType === 'status' && (
              <div>
                <label htmlFor="statusValue" className="block text-sm font-medium text-gray-700 mb-1">
                  Set Status To
                </label>
                <select
                  id="statusValue"
                  name="statusValue"
                  className="w-full p-2 border rounded-md"
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value)}
                >
                  <option value={STATUS.ALERT.RESOLVED}>Resolved</option>
                  <option value={STATUS.ALERT.OPEN}>Open</option>
                  <option value={STATUS.ALERT.IN_PROGRESS}>In Progress</option>
                  <option value={STATUS.ALERT.CLOSED}>Closed</option>
                </select>
              </div>
            )}
            
            {/* Assignment Action */}
            {actionType === 'assign' && (
              <div>
                <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To
                </label>
                <select
                  id="assignedTo"
                  name="assignedTo"
                  className="w-full p-2 border rounded-md"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">Not assigned</option>
                  <option value={appConfig.app.adminEmail}>Admin</option>
                  <option value={appConfig.app.supportEmail}>Support Team</option>
                  <option value={appConfig.app.operationsEmail}>Operations</option>
                </select>
              </div>
            )}
          </div>
        </div>
        
        <div className="border-t p-4 bg-gray-50 flex justify-end space-x-3">
          <button
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={handleAction}
          >
            Apply to Selected
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionModal;
