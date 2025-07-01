import React, { useState, useEffect } from 'react';

/**
 * Advanced Filter Component - reusable filtering system across all admin portal pages
 * 
 * @param {Object} filters - Current filter state
 * @param {Function} onFilterChange - Function to call when filters change
 * @param {Array} filterConfig - Configuration for available filters
 * @param {Function} onClearFilters - Function to clear all filters
 * @param {Boolean} showActiveFilters - Whether to show active filter indicators
 * @param {String} className - Additional class names
 */
const AdvancedFilter = ({ 
  filters, 
  onFilterChange, 
  filterConfig, 
  onClearFilters,
  showActiveFilters = true,
  className = ""
}) => {
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  
  // Count active filters
  useEffect(() => {
    let count = 0;
    
    // Check text search
    if (filters.searchTerm && filters.searchTerm.trim() !== '') {
      count++;
    }
    
    // Check dropdown filters
    Object.keys(filters).forEach(key => {
      if (key !== 'searchTerm' && key !== 'dateRange' && filters[key] && filters[key] !== 'all') {
        count++;
      }
    });
    
    // Check date range
    if (filters.dateRange) {
      if (filters.dateRange.start) count++;
      if (filters.dateRange.end) count++;
    }
    
    setActiveFiltersCount(count);
  }, [filters]);

  // Handle search input change
  const handleSearchChange = (e) => {
    onFilterChange('searchTerm', e.target.value);
  };

  // Handle dropdown select change
  const handleSelectChange = (filterName, e) => {
    onFilterChange(filterName, e.target.value);
  };

  // Handle date range change
  const handleDateChange = (rangeType, e) => {
    onFilterChange('dateRange', {
      ...filters.dateRange,
      [rangeType]: e.target.value
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border-0 p-4 ${className}`}>
      <div className="flex flex-col md:flex-row gap-4 items-end flex-wrap">
        {/* Search input */}
        {filterConfig.includes('search') && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-400"></i>
              </div>
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                value={filters.searchTerm || ''}
                onChange={handleSearchChange}
              />
            </div>
          </div>
        )}
        
        {/* Status dropdown */}
        {filterConfig.includes('status') && (
          <div className="w-full md:w-44">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full py-2 px-3 border rounded-md focus:ring-green-500 focus:border-green-500"
              value={filters.status || 'all'}
              onChange={(e) => handleSelectChange('status', e)}
            >
              <option value="all">All Statuses</option>
              {filters.statusOptions?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Area/location dropdown */}
        {filterConfig.includes('area') && (
          <div className="w-full md:w-44">
            <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
            <select
              className="w-full py-2 px-3 border rounded-md focus:ring-green-500 focus:border-green-500"
              value={filters.area || 'all'}
              onChange={(e) => handleSelectChange('area', e)}
            >
              <option value="all">All Areas</option>
              {filters.areaOptions?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Type dropdown */}
        {filterConfig.includes('type') && (
          <div className="w-full md:w-44">
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              className="w-full py-2 px-3 border rounded-md focus:ring-green-500 focus:border-green-500"
              value={filters.type || 'all'}
              onChange={(e) => handleSelectChange('type', e)}
            >
              <option value="all">All Types</option>
              {filters.typeOptions?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date range - Start date */}
        {filterConfig.includes('dateRange') && (
          <>
            <div className="w-full md:w-44">
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                className="w-full py-2 px-3 border rounded-md focus:ring-green-500 focus:border-green-500"
                value={filters.dateRange?.start || ''}
                onChange={(e) => handleDateChange('start', e)}
              />
            </div>
            
            {/* Date range - End date */}
            <div className="w-full md:w-44">
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                className="w-full py-2 px-3 border rounded-md focus:ring-green-500 focus:border-green-500"
                value={filters.dateRange?.end || ''}
                onChange={(e) => handleDateChange('end', e)}
              />
            </div>
          </>
        )}
        
        {/* Custom filters slot */}
        {filterConfig.includes('custom') && filters.customFilters}
        
        {/* Clear filters button */}
        <button
          className={`px-4 py-2 text-gray-600 hover:text-blue-800 border border-gray-300 hover:border-blue-800 rounded-md ${
            activeFiltersCount > 0 ? 'bg-blue-50' : ''
          }`}
          onClick={onClearFilters}
          disabled={activeFiltersCount === 0}
        >
          <span>Clear Filters</span>
          {activeFiltersCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-blue-600 text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>
      
      {/* Active filters indicators */}
      {showActiveFilters && activeFiltersCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.searchTerm && filters.searchTerm.trim() !== '' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Search: {filters.searchTerm}
              <button 
                className="ml-1 text-blue-600"
                onClick={() => onFilterChange('searchTerm', '')}
              >
                <i className="fas fa-times-circle"></i>
              </button>
            </span>
          )}
          
          {Object.keys(filters).map(key => {
            if (key !== 'searchTerm' && key !== 'dateRange' && key !== 'statusOptions' && 
                key !== 'areaOptions' && key !== 'typeOptions' && key !== 'customFilters' && 
                filters[key] && filters[key] !== 'all') {
              const optionsKey = `${key}Options`;
              const label = filters[optionsKey]?.find(opt => opt.value === filters[key])?.label || filters[key];
              
              return (
                <span key={key} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {key.charAt(0).toUpperCase() + key.slice(1)}: {label}
                  <button 
                    className="ml-1 text-blue-600"
                    onClick={() => onFilterChange(key, 'all')}
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                </span>
              );
            }
            return null;
          }).filter(Boolean)}
          
          {filters.dateRange?.start && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              From: {filters.dateRange.start}
              <button 
                className="ml-1 text-blue-600"
                onClick={() => handleDateChange('start', { target: { value: '' }})}
              >
                <i className="fas fa-times-circle"></i>
              </button>
            </span>
          )}
          
          {filters.dateRange?.end && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              To: {filters.dateRange.end}
              <button 
                className="ml-1 text-blue-600"
                onClick={() => handleDateChange('end', { target: { value: '' }})}
              >
                <i className="fas fa-times-circle"></i>
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedFilter;
