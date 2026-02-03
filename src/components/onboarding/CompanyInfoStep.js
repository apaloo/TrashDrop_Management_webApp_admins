import React, { useState } from 'react';

const CompanyInfoStep = ({ formData, updateFormData, onNext }) => {
  const [companyName, setCompanyName] = useState(formData.companyName || '');
  const [companyType, setCompanyType] = useState(formData.companyType || '');
  const [operatingArea, setOperatingArea] = useState(formData.operatingArea || '');
  const [validationErrors, setValidationErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    
    if (!companyName.trim()) {
      errors.companyName = 'Company name is required';
    }
    
    if (!companyType) {
      errors.companyType = 'Company type is required';
    }
    
    if (!operatingArea.trim()) {
      errors.operatingArea = 'Operating area is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      updateFormData({
        companyName,
        companyType,
        operatingArea
      });
      
      onNext();
    }
  };

  return (
    <div className="py-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900">Company Information</h3>
        <p className="mt-2 text-md text-gray-600 max-w-md mx-auto">
          Tell us about your company to help personalize your TrashDrop experience
        </p>
      </div>

      <form className="mt-6 space-y-6 max-w-lg mx-auto" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="company-name" className="block text-sm font-medium text-gray-700">
            Company Name
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-building text-gray-400"></i>
            </div>
            <input
              type="text"
              id="company-name"
              name="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={`block w-full pl-10 rounded-md shadow-sm py-2.5 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm ${
                validationErrors.companyName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your company name"
            />
          </div>
          {validationErrors.companyName && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.companyName}</p>
          )}
        </div>

        <div>
          <label htmlFor="company-type" className="block text-sm font-medium text-gray-700">
            Company Type
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-briefcase text-gray-400"></i>
            </div>
            <select
              id="company-type"
              name="company-type"
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              className={`block w-full pl-10 rounded-md shadow-sm py-2.5 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm ${
                validationErrors.companyType ? 'border-red-500' : 'border-gray-300'
              }`}
            >
            <option value="">Select Company Type</option>
            <option value="waste_management">Waste Management</option>
            <option value="recycling">Recycling</option>
            <option value="municipality">Municipality</option>
            <option value="nonprofit">Non-Profit Organization</option>
            <option value="other">Other</option>
            </select>
          </div>
          {validationErrors.companyType && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.companyType}</p>
          )}
        </div>

        <div>
          <label htmlFor="operating-area" className="block text-sm font-medium text-gray-700">
            Operating Area
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
              <i className="fas fa-map-marker-alt text-gray-400"></i>
            </div>
            <textarea
              id="operating-area"
              name="operating-area"
              rows={3}
              value={operatingArea}
              onChange={(e) => setOperatingArea(e.target.value)}
              placeholder="Describe your service area (e.g., 'City of Portland', 'Greater Chicago Area')"
              className={`block w-full pl-10 rounded-md shadow-sm py-2.5 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm ${
                validationErrors.operatingArea ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          {validationErrors.operatingArea && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.operatingArea}</p>
          )}
        </div>

        <div className="flex justify-end mt-8">
          <button
            type="submit"
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150"
          >
            Continue to Preferences
            <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompanyInfoStep;
