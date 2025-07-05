import React, { useState, useEffect, useMemo } from 'react';
import MobileReportsVerification from '../components/MobileReportsVerification';
import { fetchIllegalDumpingReports, updateIllegalDumpingStatus } from '../utils/databaseUtils';
import { format } from 'date-fns';
import { STATUS } from '../config/constants';
import { appConfig } from '../config';

const IllegalDumpingHistory = () => {
  // State management hooks will go here
  // State management
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [filters, setFilters] = useState({
    resolution: [],
    startDate: '',
    endDate: ''
  });

  // Fetch history data
  useEffect(() => {
    const loadIllegalDumpingData = async () => {
      setLoading(true);
      try {
        let statusFilter = null;
        if (selectedTab === 'open') statusFilter = STATUS.ILLEGAL_DUMPING.REPORTED;
        else if (selectedTab === 'in-progress') statusFilter = STATUS.ILLEGAL_DUMPING.VERIFIED;
        else if (selectedTab === 'resolved') statusFilter = STATUS.ILLEGAL_DUMPING.CLEANED_UP;
        
        const data = await fetchIllegalDumpingReports(statusFilter);
        
        // Transform the data to match the expected structure
        const transformedData = data.map(item => ({
          id: item.id,
          reportedAt: item.reported_at,
          reportedBy: item.reporter?.email || 'unknown',
          resolvedAt: item.resolved_at,
          location: {
            lat: item.latitude,
            lng: item.longitude,
            address: item.address
          },
          description: item.description,
          images: item.images || [],
          severity: item.severity || 'Medium',
          wasteType: item.waste_type || 'Mixed',
          status: item.status,
          verifiedAt: item.verified_at,
          verifiedBy: item.verified_by,
          cleanupAssigned: !!item.assigned_to,
          cleanupTeam: item.assignee?.first_name ? `${item.assignee.first_name} ${item.assignee.last_name}` : undefined,
          estimatedCleanupDate: item.estimated_cleanup_date,
          resolutionType: item.resolution_type || (item.status === STATUS.ILLEGAL_DUMPING.CLEANED_UP ? STATUS.ILLEGAL_DUMPING.CLEANED_UP : item.status)
        }));
        
        setHistoryData(transformedData);
      } catch (error) {
        console.error('Error loading illegal dumping data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadIllegalDumpingData();
  }, [selectedTab]);

  // Calculate metrics for KPI cards
  const metrics = useMemo(() => {
    // Calculate metrics from the actual data instead of using mock function
    const totalReports = historyData.length;
    const resolvedCount = historyData.filter(item => item.status === STATUS.ILLEGAL_DUMPING.CLEANED_UP).length;
    const verifiedCount = historyData.filter(item => item.status === STATUS.ILLEGAL_DUMPING.VERIFIED).length;
    const reportedCount = historyData.filter(item => item.status === STATUS.ILLEGAL_DUMPING.REPORTED).length;
    
    const averageResolutionTime = historyData.reduce((acc, item) => {
      if (item.resolvedAt && item.reportedAt) {
        const reported = new Date(item.reportedAt).getTime();
        const resolved = new Date(item.resolvedAt).getTime();
        return acc + (resolved - reported);
      }
      return acc;
    }, 0) / (resolvedCount || 1);
    
    const averageResolutionDays = Math.round(averageResolutionTime / (1000 * 60 * 60 * 24) * 10) / 10;
    
    const wasteTypeCounts = historyData.reduce((acc, item) => {
      const type = item.wasteType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    const severityCounts = historyData.reduce((acc, item) => {
      const severity = item.severity || 'Medium';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});
    
    return {
      totalReports,
      resolvedCount,
      reportedCount,
      verifiedCount,
      averageResolutionDays,
      wasteTypes: wasteTypeCounts,
      severityBreakdown: severityCounts,
      cleanupEfficiency: resolvedCount > 0 ? Math.round((resolvedCount / totalReports) * 100) : 0,
      monthlyTrend: [32, 36, 28, 40, 45, totalReports], // Keep last month's trend static except current month
    };
  }, [historyData]);
   // Handle filter changes
   const handleFilterChange = (filterType, value) => {
    setFilters(prevFilters => {
      const newFilters = { ...prevFilters };
      
      if (filterType === 'resolution') {
        if (newFilters.resolution.includes(value)) {
          newFilters.resolution = newFilters.resolution.filter(item => item !== value);
        } else {
          newFilters.resolution.push(value);
        }
      } else {
        newFilters[filterType] = value;
      }
      
      return newFilters;
    });
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      resolution: [],
      startDate: '',
      endDate: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };
  // Filter data based on all active filters
  const filteredData = useMemo(() => {
    return historyData.filter(item => {
      // Filter by resolution if any are selected
      const resolutionMatch = filters.resolution.length === 0 || 
        filters.resolution.includes(item.resolutionType);
      
      // Filter by date range if set
      const itemDate = new Date(item.resolvedAt);
      const startDateMatch = !filters.startDate || 
        itemDate >= new Date(filters.startDate);
      const endDateMatch = !filters.endDate || 
        itemDate <= new Date(filters.endDate);
      
      // Filter by search term
      const searchMatch = !searchTerm || 
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.location && item.location.address && item.location.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.wasteType && item.wasteType.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filter by tab selection
      const tabMatch = selectedTab === 'all' || 
        (selectedTab === 'resolved' && item.resolutionType === 'Cleaned Up') ||
        (selectedTab === 'cancelled' && item.resolutionType === 'Cancelled');
      
      return resolutionMatch && startDateMatch && endDateMatch && searchMatch && tabMatch;
    });
  }, [historyData, filters, searchTerm, selectedTab]);

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  // Handle item selection for detail view
  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };
  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 md:mb-0">
          Illegal Dumping History
        </h1>
        <div className="flex items-center">
          <div className="relative rounded-md shadow-sm">
            <input
              type="text"
              className="form-input py-2 pl-10 pr-3 block w-full sm:text-sm border-gray-300 rounded-md transition ease-in-out duration-150"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page when search changes
              }}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            {searchTerm && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button 
                  onClick={() => setSearchTerm('')}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total Resolved Reports Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 mr-4">
              <i className="fas fa-check-circle text-blue-500"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase">Total Resolved Reports</p>
              <p className="text-2xl font-bold">{metrics.totalResolved}</p>
            </div>
          </div>
        </div>
        
        {/* Cleanup Teams Involved Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 mr-4">
              <i className="fas fa-users text-green-500"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase">Cleanup Teams Involved</p>
              <p className="text-2xl font-bold">{metrics.teamsInvolved}</p>
            </div>
          </div>
        </div>
        
        {/* Average Resolution Time Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 mr-4">
              <i className="fas fa-clock text-purple-500"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase">Avg. Resolution Time</p>
              <p className="text-2xl font-bold">{metrics.avgResolutionTimeHours} hours</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile App Reports Verification */}
      <MobileReportsVerification 
        onReportVerified={() => {
          // Refresh illegal dumping data when a new report is verified
          loadIllegalDumpingData();
        }}
      />

      {/* Filters section */}
         <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Filters</h3>
          <button 
            className="text-blue-600 text-sm flex items-center hover:underline"
            onClick={resetFilters}
          >
            <i className="fas fa-undo-alt mr-1"></i> Reset All
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Resolution type filters */}
          <div>
            <p className="text-sm font-medium mb-2">Resolution Type</p>
            <div className="flex flex-wrap gap-2">
              {[STATUS.ILLEGAL_DUMPING.CLEANED_UP, 'Cancelled'].map(type => {
                const isActive = filters.resolution.includes(type);
                const typeColor = type === STATUS.ILLEGAL_DUMPING.CLEANED_UP ? '#4CAF50' : '#F44336';
                return (
                  <button
                    key={type}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isActive ? 'text-white' : 'text-gray-700'}`}
                    style={{ 
                      backgroundColor: isActive ? typeColor : 'white',
                      borderColor: typeColor
                    }}
                    onClick={() => handleFilterChange('resolution', type)}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Date range filters */}
          <div>
            <p className="text-sm font-medium mb-2">From Date</p>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">To Date</p>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>
      </div>
      
      {/* Tabs for history filtering */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${selectedTab === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setSelectedTab('all')}
          >
            All
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${selectedTab === 'resolved' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setSelectedTab('resolved')}
          >
            Resolved
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${selectedTab === 'cancelled' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setSelectedTab('cancelled')}
          >
            Cancelled
          </button>
        </nav>
      </div>

          {/* Data Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resolution Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cleanup Team
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resolved Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                      Loading data...
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center py-6">
                      <i className="fas fa-search text-3xl mb-2"></i>
                      <p>No history records found matching your criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleSelectItem(item)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.location && item.location.address ? item.location.address : 'Unknown location'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${item.resolutionType === STATUS.ILLEGAL_DUMPING.CLEANED_UP ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.resolutionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.cleanupTeam || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(item.resolvedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(item);
                        }}>
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{paginatedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="font-medium">{filteredData.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${currentPage === 1 ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                                  {/* Page numbers */}
                                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show page numbers centered around current page
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${currentPage === pageNum ? 'bg-blue-50 text-blue-600 z-10' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${currentPage === totalPages ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>   

            {/* Detail View Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 overflow-y-auto z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowDetailModal(false)}></div>
            
            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full md:max-w-xl">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                      Report Details
                    </h3>

                    <div className="mt-2 space-y-4">
                      {/* Report ID and Status */}
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-500">Report ID</p>
                        <p className="text-sm font-medium">{selectedItem.id}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-500">Resolution Type</p>
                        <span className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full ${selectedItem.resolutionType === 'Cleaned Up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {selectedItem.resolutionType}
                        </span>
                      </div>
                      
                      {/* Divider */}
                      <hr className="my-4 border-gray-200" />
                      
                      {/* Location Details */}
                      <div>
                        <h4 className="text-md font-medium mb-2">Location</h4>
                        <p className="text-sm">{selectedItem.location && selectedItem.location.address ? selectedItem.location.address : 'Unknown location'}</p>
                        <div className="flex">
                          <p className="text-xs text-gray-500 mr-2">Lat: {selectedItem.location && selectedItem.location.latitude ? selectedItem.location.latitude : 'N/A'}</p>
                          <p className="text-xs text-gray-500">Lng: {selectedItem.location && selectedItem.location.longitude ? selectedItem.location.longitude : 'N/A'}</p>
                        </div>
                      </div>
                                          {/* Waste Details */}
                                          <div>
                        <h4 className="text-md font-medium mb-2">Waste Details</h4>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm text-gray-500">Type</p>
                          <p className="text-sm">{selectedItem.wasteType}</p>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm text-gray-500">Severity</p>
                          <p className="text-sm">{selectedItem.severity}</p>
                        </div>
                      </div>
                      
                      {/* Resolution Details */}
                      <div>
                        <h4 className="text-md font-medium mb-2">Resolution Details</h4>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm text-gray-500">Reported On</p>
                          <p className="text-sm">{formatDate(selectedItem.reportedAt)}</p>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm text-gray-500">Resolved On</p>
                          <p className="text-sm">{formatDate(selectedItem.resolvedAt)}</p>
                        </div>
                        {selectedItem.cleanupTeam && (
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-sm text-gray-500">Cleanup Team</p>
                            <p className="text-sm">{selectedItem.cleanupTeam}</p>
                          </div>
                        )}
                      </div>
                                           {/* Notes if available */}
                                           {selectedItem.notes && (
                        <div>
                          <h4 className="text-md font-medium mb-2">Notes</h4>
                          <p className="text-sm bg-gray-50 p-3 rounded">{selectedItem.notes}</p>
                        </div>
                      )}
                      
                      {/* Images if available */}
                      {selectedItem.images && selectedItem.images.length > 0 && (
                        <div>
                          <h4 className="text-md font-medium mb-2">Images</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {selectedItem.images.map((img, index) => (
                              <img 
                                key={index} 
                                src={img} 
                                alt={`Illegal dumping ${index + 1}`} 
                                className="rounded-md w-full h-24 object-cover"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowDetailModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IllegalDumpingHistory;
   