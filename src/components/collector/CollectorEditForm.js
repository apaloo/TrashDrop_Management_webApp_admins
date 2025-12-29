import React from 'react';

/**
 * CollectorEditForm - Form for editing collector information
 * 
 * @param {Object} formData - Current form data
 * @param {Object} errors - Validation errors
 * @param {Function} handleChange - Function to handle input changes
 */
const CollectorEditForm = ({ formData, errors, handleChange }) => {
  const regions = ['North', 'South', 'East', 'West', 'Central', 'Northeast', 'Northwest', 'Southeast', 'Southwest'];
  const statuses = ['Active', 'Inactive', 'On Leave', 'Idle', 'In Training'];
  const vehicleTypes = ['Van', 'Truck', 'Bicycle', 'Motorcycle', 'Car', 'On Foot'];

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Personal Information */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
          <i className="fas fa-user text-blue-500 mr-2"></i>
          Personal Information
        </h5>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name*
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter full name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>
          
          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status*
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email*
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                errors.email ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="email@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>
          
          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone*
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                errors.phone ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="(xxx) xxx-xxxx"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
            )}
          </div>
          
          {/* Alternative Contact */}
          <div>
            <label htmlFor="alternativeContact" className="block text-sm font-medium text-gray-700 mb-1">
              Alternative Contact
            </label>
            <input
              type="text"
              id="alternativeContact"
              name="alternativeContact"
              value={formData.alternativeContact || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Emergency contact"
            />
          </div>
          
          {/* Region */}
          <div>
            <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
              Region*
            </label>
            <select
              id="region"
              name="region"
              value={formData.region}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                errors.region ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select Region</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            {errors.region && (
              <p className="mt-1 text-sm text-red-600">{errors.region}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Vehicle Information */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
          <i className="fas fa-truck text-blue-500 mr-2"></i>
          Vehicle Information
        </h5>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vehicle Type */}
          <div>
            <label htmlFor="vehicleType" className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type
            </label>
            <select
              id="vehicleType"
              name="vehicleType"
              value={formData.vehicleType || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">Select Vehicle Type</option>
              {vehicleTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          
          {/* Vehicle ID */}
          <div>
            <label htmlFor="vehicleId" className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle ID
            </label>
            <input
              type="text"
              id="vehicleId"
              name="vehicleId"
              value={formData.vehicleId || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Vehicle identification"
            />
          </div>
          
          {/* Capacity */}
          <div>
            <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (kg)
            </label>
            <input
              type="number"
              id="capacity"
              name="capacity"
              value={formData.capacity || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Maximum capacity"
            />
          </div>
        </div>
      </div>
      
      {/* Notes */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
          <i className="fas fa-sticky-note text-blue-500 mr-2"></i>
          Additional Notes
        </h5>
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Additional information about this collector"
          ></textarea>
        </div>
      </div>
      
      <div className="text-xs text-gray-500">
        * Required fields
      </div>
    </div>
  );
};

export default CollectorEditForm;
