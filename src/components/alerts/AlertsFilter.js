import React from 'react';

const AlertsFilter = ({ filters, handleFilterChange, clearFilters }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border-0 p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        {/* Search box */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              placeholder="Search alerts..."
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={filters.searchQuery}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            />
          </div>
        </div>
        
        {/* Status filter */}
        <div className="w-full md:w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        
        {/* Priority filter */}
        <div className="w-full md:w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        
        {/* Type filter */}
        <div className="w-full md:w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="pickup_request">Pickup Requests</option>
            <option value="collector">Collectors</option>
            <option value="system">System</option>
            <option value="region">Regions</option>
          </select>
        </div>
        
        {/* Date filter dropdown */}
        <div className="w-full md:w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
          <select
            className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7Days">Last 7 Days</option>
            <option value="last30Days">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        
        {/* Custom date range */}
        {filters.dateRange === 'custom' && (
          <>
            <div className="w-full md:w-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            
            <div className="w-full md:w-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </>
        )}
        
        {/* Clear filters button */}
        <button
          className="px-4 py-2 text-blue-600 hover:text-blue-800 border border-blue-600 hover:border-blue-800 rounded-md"
          onClick={clearFilters}
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default AlertsFilter;
