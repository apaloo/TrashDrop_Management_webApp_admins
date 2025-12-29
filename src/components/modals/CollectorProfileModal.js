import React, { useState, useEffect } from 'react';
import CollectorViewContent from '../collector/CollectorViewContent';
import CollectorEditForm from '../collector/CollectorEditForm';

/**
 * Collector Profile Modal Component - View and Edit modes
 * 
 * @param {Boolean} isOpen - Controls visibility of the modal
 * @param {Function} onClose - Function to call when closing the modal
 * @param {Object} collector - Collector data object
 * @param {Function} onSave - Function to call when saving changes
 */
const CollectorProfileModal = ({ isOpen, onClose, collector, onSave }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Initialize form data when collector data changes or modal opens
  useEffect(() => {
    if (collector) {
      setFormData({
        name: collector.name || '',
        email: collector.email || '',
        phone: collector.phone || '',
        region: collector.region || '',
        status: collector.status || 'Active',
        vehicleType: collector.vehicleType || '',
        vehicleId: collector.vehicleId || '',
        capacity: collector.capacity || '',
        alternativeContact: collector.alternativeContact || '',
        notes: collector.notes || ''
      });
    }
  }, [collector, isOpen]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Switch to edit mode
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // Cancel edit and revert changes
  const handleCancel = () => {
    setIsEditMode(false);
    setErrors({});
    
    // Reset form data to original collector data
    if (collector) {
      setFormData({
        name: collector.name || '',
        email: collector.email || '',
        phone: collector.phone || '',
        region: collector.region || '',
        status: collector.status || 'Active',
        vehicleType: collector.vehicleType || '',
        vehicleId: collector.vehicleId || '',
        capacity: collector.capacity || '',
        alternativeContact: collector.alternativeContact || '',
        notes: collector.notes || ''
      });
    }
  };

  // Validate form and save changes
  const handleSave = () => {
    // Validate form
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.region.trim()) newErrors.region = 'Region is required';
    
    // If there are errors, show them and don't proceed
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Call the save function with updated collector data
    onSave({
      ...collector,
      ...formData
    });
    
    // Exit edit mode
    setIsEditMode(false);
    setErrors({});
  };

  if (!isOpen || !collector) return null;

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
            {isEditMode ? 'Edit Collector' : 'Collector Profile'}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isEditMode ? (
            <CollectorEditForm 
              formData={formData} 
              errors={errors} 
              handleChange={handleChange}
            />
          ) : (
            <CollectorViewContent collector={collector} />
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t p-4 flex justify-end bg-gray-50">
          {isEditMode ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 mr-3"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mr-3"
              >
                Edit Profile
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectorProfileModal;
