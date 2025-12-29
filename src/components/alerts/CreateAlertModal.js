import React, { useState } from 'react';
import { STATUS, PRIORITY } from '../../config/constants';

const CreateAlertModal = ({ onClose, onCreateAlert }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: PRIORITY.MEDIUM,
    relatedToType: 'system',
    relatedToId: '',
    relatedToLocation: '',
    assignedTo: ''
  });
  
  const [formErrors, setFormErrors] = useState({});
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error when field is updated
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!formData.relatedToId.trim() && formData.relatedToType !== 'system') {
      errors.relatedToId = 'ID is required for the selected entity type';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = () => {
    if (!validateForm()) return;
    
    const newAlert = {
      id: `alert-${Date.now()}`,
      title: formData.title,
      description: formData.description,
      status: 'open',
      priority: formData.priority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relatedTo: {
        type: formData.relatedToType,
        id: formData.relatedToId || `auto-${Date.now()}`,
        location: formData.relatedToLocation || null
      },
      assignedTo: formData.assignedTo || null,
      comments: []
    };
    
    onCreateAlert(newAlert);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="border-b p-4 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">Create New Alert</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Alert Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                className={`w-full p-2 border rounded-md ${formErrors.title ? 'border-red-500' : ''}`}
                placeholder="Enter alert title"
                value={formData.title}
                onChange={handleChange}
              />
              {formErrors.title && (
                <p className="mt-1 text-sm text-red-500">{formErrors.title}</p>
              )}
            </div>
            
            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows="3"
                className={`w-full p-2 border rounded-md ${formErrors.description ? 'border-red-500' : ''}`}
                placeholder="Describe the alert"
                value={formData.description}
                onChange={handleChange}
              ></textarea>
              {formErrors.description && (
                <p className="mt-1 text-sm text-red-500">{formErrors.description}</p>
              )}
            </div>
            
            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                className="w-full p-2 border rounded-md"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value={PRIORITY.CRITICAL}>Critical</option>
                <option value={PRIORITY.HIGH}>High</option>
                <option value={PRIORITY.MEDIUM}>Medium</option>
                <option value={PRIORITY.LOW}>Low</option>
              </select>
            </div>
            
            {/* Related Entity Type */}
            <div>
              <label htmlFor="relatedToType" className="block text-sm font-medium text-gray-700 mb-1">
                Related To
              </label>
              <select
                id="relatedToType"
                name="relatedToType"
                className="w-full p-2 border rounded-md"
                value={formData.relatedToType}
                onChange={handleChange}
              >
                <option value="pickup_request">Pickup Request</option>
                <option value="collector">Collector</option>
                <option value="region">Region</option>
                <option value="system">System</option>
              </select>
            </div>
            
            {/* Entity ID */}
            {formData.relatedToType !== 'system' && (
              <div>
                <label htmlFor="relatedToId" className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.relatedToType.charAt(0).toUpperCase() + formData.relatedToType.slice(1).replace('_', ' ')} ID
                  {formData.relatedToType !== 'system' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  id="relatedToId"
                  name="relatedToId"
                  className={`w-full p-2 border rounded-md ${formErrors.relatedToId ? 'border-red-500' : ''}`}
                  placeholder={`Enter ${formData.relatedToType} ID`}
                  value={formData.relatedToId}
                  onChange={handleChange}
                />
                {formErrors.relatedToId && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.relatedToId}</p>
                )}
              </div>
            )}
            
            {/* Location */}
            <div>
              <label htmlFor="relatedToLocation" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                id="relatedToLocation"
                name="relatedToLocation"
                className="w-full p-2 border rounded-md"
                placeholder="Location (optional)"
                value={formData.relatedToLocation}
                onChange={handleChange}
              />
            </div>
            
            {/* Assigned To */}
            <div>
              <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 mb-1">
                Assign To
              </label>
              <select
                id="assignedTo"
                name="assignedTo"
                className="w-full p-2 border rounded-md"
                value={formData.assignedTo}
                onChange={handleChange}
              >
                <option value="">Not assigned</option>
                <option value="admin@trashdrop.com">Admin</option>
                <option value="support@trashdrop.com">Support Team</option>
                <option value="operations@trashdrop.com">Operations</option>
              </select>
            </div>
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
            onClick={handleSubmit}
          >
            Create Alert
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAlertModal;
