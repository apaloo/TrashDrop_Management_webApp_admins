import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { 
  fetchBagBatches, 
  fetchBagHistory,
  // Add imports for new statistics functions that we'll create
  fetchBagRequestStats,
  fetchCollectorStats,
  fetchPerformanceStats
} from '../utils/databaseUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCalendar, faHistory, faChartLine, faBoxOpen, faRecycle, faMapMarkerAlt, faUser, faQrcode } from '@fortawesome/free-solid-svg-icons';

const BagHistory = () => {
  // State for table data
  const [batches, setBatches] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [batchScanHistory, setBatchScanHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Stats state
  const [statsLoading, setStatsLoading] = useState(true);
  const [bagRequestStats, setBagRequestStats] = useState({
    total: 0,
    todayChange: 0,
    weeklyChange: 0,
    pendingCollection: 0,
    collected: 0,
    awaiting: 0,
    dailyTrend: Array(7).fill(0),
    dayLabels: [],
    avgDailyRequests: 0
  });
  const [collectorStats, setCollectorStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    regions: 0,
    lastUpdated: new Date().toISOString()
  });
  const [performanceStats, setPerformanceStats] = useState({
    overall: 0,
    monthlyChange: 0,
    changeInterval: 'week',
    responseTime: 0,
    collectionTime: 0,
    completionRate: 0,
    scanAccuracy: 0,
    dailyAverage: 0,
    weeklyGoal: 0
  });
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [scanFilter, setScanFilter] = useState(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Function to load batches with pagination and sorting
  const loadBatchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Prepare filters object
      const filters = {
        status: filterStatus,
        search: searchTerm
      };
      
      // Fetch bag batches with pagination and sorting parameters
      const result = await fetchBagBatches({
        page: currentPage,
        limit: itemsPerPage,
        sortField,
        sortDirection,
        filters
      });
      
      // Transform from snake_case to camelCase for consistency
      const formattedData = result.data.map(batch => ({
        id: batch.id,
        createdAt: batch.created_at,
        createdBy: batch.created_by,
        quantity: batch.quantity,
        type: batch.type,
        size: batch.size,
        status: batch.status,
        distributed: batch.distributed || 0,
        scanned: batch.scanned || 0,
        qrPrefix: batch.qr_prefix,
        last_scan_date: batch.last_scan_date
      }));
      
      // Update state with batches and pagination data
      setBatches(formattedData);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      
      // Clear any previous error
      if (error) setError(null);
      
    } catch (err) {
      console.error('Error loading batch data:', err);
      setError('Failed to load batch data: ' + (err.message || 'Please refresh and try again'));
      // Show a more specific error message if we can determine the cause
      if (err.code === 'PGRST301') {
        setError('Database connection failed. Please check your network connection.');
      } else if (err.code === '23505') { 
        setError('Data integrity error. Please contact support.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Trigger batch data loading when pagination or filter parameters change
  useEffect(() => {
    loadBatchData();
  }, [currentPage, filterStatus, searchTerm, sortField, sortDirection]);

  // Function to fetch all dashboard statistics
  const refreshStats = async () => {
    setStatsLoading(true);
    try {
      // IMPORTANT: Force use of Supabase data even in development mode
      console.log('BagHistory: Starting fetch of live statistics...');
      
      // Fetch all stats in parallel for better performance
      const [bagStats, collectorData, performanceData] = await Promise.all([
        fetchBagRequestStats(),
        fetchCollectorStats(),
        fetchPerformanceStats()
      ]);
      
      console.log('BagHistory: Stats fetched successfully:');
      console.log('BagHistory: Bag Stats:', bagStats);
      console.log('BagHistory: Collector Stats:', collectorData);
      console.log('BagHistory: Performance Stats:', performanceData);
      
      // Ensure all values are properly set
      if (!performanceData.dailyAverage && bagStats.avgDailyRequests) {
        console.log('BagHistory: Setting dailyAverage from avgDailyRequests');
        performanceData.dailyAverage = bagStats.avgDailyRequests;
      }
      
      // Set weekly goal based on overall performance if not provided
      if (!performanceData.weeklyGoal) {
        performanceData.weeklyGoal = Math.round(performanceData.overall * 1.1);
      }
      
      // Update state with fetched statistics
      console.log('BagHistory: Updating state with fetched statistics...');
      setBagRequestStats(bagStats);
      setCollectorStats(collectorData);
      setPerformanceStats(performanceData);
      
      // Clear any previous error
      if (error) setError(null);
      
    } catch (error) {
      console.error('BagHistory: Error fetching statistics:', error);
      setError('Failed to load dashboard statistics: ' + (error.message || 'Unknown error'));
    } finally {
      setStatsLoading(false);
    }
  };
  
  // Fetch statistics for dashboard cards on initial load
  useEffect(() => {
    // Immediate fetch on component mount
    refreshStats();
    
    // Set up an interval to refresh stats periodically (every 5 minutes)
    const intervalId = setInterval(() => {
      refreshStats();
    }, 5 * 60 * 1000);
    
    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array ensures this runs only once on mount

  // No client-side filtering needed as we now use server-side filtering
  // We'll use batches directly from the API response
  
  // Handle search input change with debouncing
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when search changes
  };
  
  // Handle status filter change
  const handleStatusChange = (e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };
  
  const handleScanFilterChange = (value) => {
    // This would be implemented on the server side in a full solution
    // For now we'll just keep the UI functional
    setScanFilter(value);
  };

  // The paginate function is no longer needed since we're using setCurrentPage directly
  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
  };
  
  // Function to handle viewing history
  const handleViewHistory = async (batch) => {
    setSelectedBatch(batch);
    setLoadingHistory(true);
    setShowHistoryModal(true);
    setError(null);
    
    try {
      // Fetch scan history for this batch from Supabase
      const historyData = await fetchBagHistory(batch.id);
      
      // Format the history data
      const formattedHistory = historyData.map(scan => ({
        id: scan.id,
        batchId: scan.bags?.batch_id || '',
        bagId: scan.bag_id,
        scannedAt: scan.scanned_at,
        scannedBy: scan.collectors ? `${scan.collectors.first_name || ''} ${scan.collectors.last_name || ''}`.trim() : 'Unknown',
        location: scan.location || 'N/A',
        status: scan.status || 'Scanned',
        notes: scan.notes || ''
      }));
      
      // Sort by scan date, newest first
      setBatchScanHistory(formattedHistory.sort((a, b) => 
        new Date(b.scannedAt) - new Date(a.scannedAt)
      ));
    } catch (err) {
      console.error('Error fetching batch history:', err);
      setBatchScanHistory([]);
      // Set a specific error message for the history modal
      setError(`Failed to load scan history: ${err.message || 'Unknown error'}`);
    } finally {
      setLoadingHistory(false);
    }
  };
  
  // Close history modal and reset state
  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setBatchScanHistory([]);
    setSelectedBatch(null);
  };

  // We're using the paginate function declared above

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Bag History</h2>
        <button 
          onClick={refreshStats}
          className="flex items-center text-indigo-600 hover:text-indigo-800 px-3 py-1 border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
          disabled={statsLoading}
        >
          {statsLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing Stats...
            </>
          ) : (
            <>
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Refresh Stats
            </>
          )}
        </button>
      </div>
      
      {/* Error notification */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button 
                  onClick={() => setError(null)} 
                  className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Live Bag Requests Card */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" style={{ height: '340px' }}>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Live Bag Requests</h3>
          
          {statsLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-green-600">{bagRequestStats.total || 0}</div>
                <div className={`text-sm px-2 py-1 rounded ${bagRequestStats.todayChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {bagRequestStats.todayChange >= 0 ? `+${bagRequestStats.todayChange}` : bagRequestStats.todayChange} today
                </div>
              </div>
              
              <div className="flex space-x-3 my-2 mb-4">
                <div className="flex-1 py-1 px-2 border-l-4 border-yellow-400 bg-yellow-50">
                  <div className="text-xs text-gray-500">Pending</div>
                  <div className="font-semibold">{bagRequestStats.pendingCollection || 0}</div>
                </div>
                <div className="flex-1 py-1 px-2 border-l-4 border-green-500 bg-green-50">
                  <div className="text-xs text-gray-500">Collected</div>
                  <div className="font-semibold">{bagRequestStats.collected || 0}</div>
                </div>
                <div className="flex-1 py-1 px-2 border-l-4 border-blue-400 bg-blue-50">
                  <div className="text-xs text-gray-500">Awaiting</div>
                  <div className="font-semibold">{bagRequestStats.awaiting || 0}</div>
                </div>
              </div>
              

              
              <div className="text-sm text-gray-500 mb-2">Collection trend over time</div>
              
              {/* Additional stats */}
              <div className="flex justify-between mb-3">
                <div className="text-sm bg-green-50 text-green-800 px-3 py-1 rounded-full">
                  <span className="font-medium">{bagRequestStats.todayChange >= 0 ? '+' + bagRequestStats.todayChange : bagRequestStats.todayChange || 0}</span> today
                </div>
                <div className="text-sm bg-blue-50 text-blue-800 px-3 py-1 rounded-full">
                  <span className="font-medium">{bagRequestStats.avgDailyRequests || 0}</span> daily avg
                </div>
              </div>
              
              {/* Simple Chart Visualization */}
              <div className="flex items-end space-x-2 h-24 mb-2">
                {(bagRequestStats.dailyTrend || Array(7).fill(0)).map((value, index) => {
                  // Find the max value to normalize the heights
                  const maxValue = Math.max(...(bagRequestStats.dailyTrend || [1]), 1); // Avoid division by zero
                  const heightPercentage = value > 0 ? Math.max((value / maxValue) * 100, 10) : 0; // Ensure at least 10% height if there's a value
                  
                  // Determine color based on value relative to max
                  let bgColor = 'bg-green-300';
                  if (value >= maxValue * 0.8) bgColor = 'bg-green-600';
                  else if (value >= maxValue * 0.5) bgColor = 'bg-green-500';
                  else if (value >= maxValue * 0.3) bgColor = 'bg-green-400';
                  
                  const dayLabel = (bagRequestStats.dayLabels && bagRequestStats.dayLabels[index]) || 
                                   ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index];
                  
                  return (
                    <div key={index} className="flex flex-col items-center w-1/7 relative group">
                      <div 
                        className={`w-6 ${bgColor} rounded-t relative group cursor-pointer`}
                        style={{
                          height: `${heightPercentage}%`,
                          minHeight: value > 0 ? '4px' : '2px',
                        }}
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          {dayLabel}: {value} {value === 1 ? 'request' : 'requests'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-between text-xs text-gray-400">
                {(bagRequestStats.dayLabels && bagRequestStats.dayLabels.length > 0) ? 
                  bagRequestStats.dayLabels.map((day, index) => (
                    <span key={index}>{day}</span>
                  )) : 
                  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                    <span key={index}>{day}</span>
                  ))
                }
              </div>
            </>
          )}
        </div>
        
        {/* Collector Status Card */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" style={{ height: '340px' }}>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Collector Status</h3>
          
          {statsLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-blue-600">{collectorStats.active || 0}/{collectorStats.total || 0}</div>
                <div className={`text-sm px-2 py-1 rounded bg-blue-100 text-blue-800`}>
                  {collectorStats.active || 0} active
                </div>
              </div>
              
              {/* Collector Status Visualization */}
              <div className="relative pt-1 mb-4">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                      Active Rate
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-blue-600">
                      {(collectorStats.active / collectorStats.total) * 100}% Active
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                  <div 
                    style={{ width: `${collectorStats.total > 0 ? (collectorStats.active / collectorStats.total) * 100 : 0}%` }} 
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                  ></div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-green-100 p-3 rounded text-center">
                  <div className="text-2xl font-bold text-green-700">{collectorStats.active || 0}</div>
                  <div className="text-sm text-green-800">Active</div>
                </div>
                <div className="bg-red-100 p-3 rounded text-center">
                  <div className="text-2xl font-bold text-red-700">{collectorStats.inactive || 0}</div>
                  <div className="text-sm text-red-800">Inactive</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-500">
                  Last updated: {collectorStats.lastUpdated ? new Date(collectorStats.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </div>
                <div className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded">
                  {collectorStats.regions || 0} {(collectorStats.regions === 1) ? 'region' : 'regions'}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Performance Timeline Card */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" style={{ height: '340px' }}>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Performance Timeline</h3>
          
          {statsLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-indigo-600">{performanceStats.overall || 0}%</div>
                <div className={`text-sm px-2 py-1 rounded ${performanceStats.monthlyChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {performanceStats.monthlyChange >= 0 ? '+' : ''}{performanceStats.monthlyChange || 0}% from last {performanceStats.changeInterval || 'week'}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-500">Response Time</div>
                    <div className="text-sm font-medium">
                      {performanceStats.responseTime || 0} min
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, (performanceStats.responseTime || 0) * 100 / 60)}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Avg. time to process bags</div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Avg. collection time</span>
                    <span className="font-medium">
                      {performanceStats.collectionTime || 0} min
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded overflow-hidden">
                    <div 
                      className="h-2 bg-blue-500 rounded" 
                      style={{ width: `${Math.max(0, 100 - Math.min((performanceStats.collectionTime || 0) * 2.5, 80))}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">Avg. collection time: {performanceStats.collectionTime || 0} min</div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Completion Rate</span>
                    <span className="font-medium">{Math.round(performanceStats.completionRate || 0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded overflow-hidden">
                    <div 
                      className="h-2 bg-indigo-500 rounded" 
                      style={{ width: `${performanceStats.completionRate || 0}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Requests fully completed</div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Scan Accuracy</span>
                    <span className="font-medium">{performanceStats.scanAccuracy || 0}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded overflow-hidden">
                    <div 
                      className="h-2 bg-indigo-500 rounded" 
                      style={{ width: `${performanceStats.scanAccuracy || 0}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Daily Average: {bagRequestStats.avgDailyRequests || 0}</span>
                    <span className="text-gray-600">Weekly Goal: {Math.round(performanceStats.overall * 1.1) || 0}%</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          {/* Search Input */}
          <div className="flex-grow">
            <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                id="searchTerm"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Search by ID, type or QR prefix..."
                value={searchTerm}
                onChange={handleSearch}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
              </div>
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="w-full md:w-1/4">
            <label htmlFor="filterStatus" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="filterStatus"
              className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={filterStatus}
              onChange={handleStatusChange}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          
          {/* Bags Scanned Slider */}
          <div className="w-full md:w-1/4">
            <label htmlFor="scanFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Bags Scanned: {scanFilter}% or more
            </label>
            <input
              type="range"
              id="scanFilter"
              className="block w-full"
              min="0"
              max="100"
              value={scanFilter}
              onChange={(e) => setScanFilter(parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button 
                  onClick={() => setError(null)} 
                  className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-800">Bag Batches</h3>
        <button 
          onClick={() => loadBatchData()}
          className="flex items-center text-indigo-600 hover:text-indigo-800 px-3 py-1 border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
          disabled={loading}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Refresh Data
            </>
          )}
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        setSortField('id');
                        setSortDirection(sortField === 'id' && sortDirection === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      Batch ID
                      {sortField === 'id' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        setSortField('type');
                        setSortDirection(sortField === 'type' && sortDirection === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      Trash Type
                      {sortField === 'type' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        setSortField('size');
                        setSortDirection(sortField === 'size' && sortDirection === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      Bag Size
                      {sortField === 'size' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        setSortField('quantity');
                        setSortDirection(sortField === 'quantity' && sortDirection === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      Number of Bags
                      {sortField === 'quantity' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        setSortField('created_at');
                        setSortDirection(sortField === 'created_at' && sortDirection === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      Generation Date
                      {sortField === 'created_at' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        setSortField('scanned');
                        setSortDirection(sortField === 'scanned' && sortDirection === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      Bags Scanned
                      {sortField === 'scanned' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        setSortField('last_scan_date');
                        setSortDirection(sortField === 'last_scan_date' && sortDirection === 'asc' ? 'desc' : 'asc');
                      }}
                    >
                      Last Scan
                      {sortField === 'last_scan_date' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                        No batches match your filter criteria
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => {
                      // Get color for trash type
                      const getTrashTypeColor = (type) => {
                        switch(type) {
                          case 'Organic': return 'bg-green-100 text-green-800';
                          case 'Recyclable': return 'bg-blue-100 text-blue-800';
                          case 'Hazardous': return 'bg-red-100 text-red-800';
                          default: return 'bg-gray-100 text-gray-800';
                        }
                      };
                      
                      // Calculate scan percentage
                      const scanPercentage = (batch.scanned / batch.quantity) * 100;
                      
                      return (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{batch.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTrashTypeColor(batch.type)}`}>
                              {batch.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.size}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(batch.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="bg-indigo-600 h-2.5 rounded-full" 
                                style={{ width: `${scanPercentage}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500 mt-1 block">
                              {batch.scanned} of {batch.quantity} ({Math.round(scanPercentage)}%)
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {batch.scanned > 0 ? new Date(batch.last_scan_date || batch.last_scanned || batch.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                            <button
                              onClick={() => handleViewHistory(batch)}
                              className="text-indigo-600 hover:text-indigo-900 px-3 py-1 border border-indigo-300 rounded-md hover:bg-indigo-50"
                            >
                              <FontAwesomeIcon icon={faHistory} className="mr-1" /> View History
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} entries
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Previous
                  </button>
                  
                  {/* Show limited page numbers with ellipsis for large number of pages */}
                  {totalPages <= 7 ? (
                    // If there are 7 or fewer pages, show all page numbers
                    [...Array(totalPages).keys()].map(number => (
                      <button
                        key={number + 1}
                        onClick={() => setCurrentPage(number + 1)}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${currentPage === number + 1 ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        {number + 1}
                      </button>
                    ))
                  ) : (
                    // If there are more than 7 pages, show with ellipsis
                    <>
                      {/* Always show first page */}
                      <button
                        onClick={() => setCurrentPage(1)}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${currentPage === 1 ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        1
                      </button>
                      
                      {/* Show ellipsis if not near the beginning */}
                      {currentPage > 3 && (
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          ...
                        </span>
                      )}
                      
                      {/* Show pages around current page */}
                      {[...Array(totalPages).keys()]
                        .filter(number => {
                          const page = number + 1;
                          return (
                            (page >= currentPage - 1 && page <= currentPage + 1) && // Show current page and adjacent pages
                            page !== 1 && page !== totalPages // Exclude first and last pages as they're handled separately
                          );
                        })
                        .map(number => (
                          <button
                            key={number + 1}
                            onClick={() => setCurrentPage(number + 1)}
                            className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${currentPage === number + 1 ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                          >
                            {number + 1}
                          </button>
                        ))
                      }
                      
                      {/* Show ellipsis if not near the end */}
                      {currentPage < totalPages - 2 && (
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          ...
                        </span>
                      )}
                      
                      {/* Always show last page */}
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${currentPage === totalPages ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Scan History Modal */}
      <div className={`fixed inset-0 z-50 overflow-auto bg-gray-800 bg-opacity-75 flex ${showHistoryModal ? 'visible' : 'hidden'}`}>
        <div className="relative p-4 bg-white w-full max-w-4xl m-auto rounded-lg shadow-lg">
          {/* Modal Header */}
          <div className="flex justify-between items-center pb-3 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Scan History for Batch: {selectedBatch?.id}
              <span className="ml-2 text-sm text-gray-500">
                ({selectedBatch?.scanned} of {selectedBatch?.quantity} bags scanned)
              </span>
            </h3>
            <button 
              onClick={closeHistoryModal}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Modal Body */}
          <div className="py-4">
            {/* Error message in modal if needed */}
            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {selectedBatch && (
              <div>
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="mb-2"><span className="font-medium text-gray-700">Batch ID:</span> <span className="font-mono">{selectedBatch.id}</span></p>
                      <p className="mb-2"><span className="font-medium text-gray-700">QR Prefix:</span> <span className="font-mono">{selectedBatch.qrPrefix}</span></p>
                      <p className="mb-2">
                        <span className="font-medium text-gray-700">Type:</span> 
                        <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${selectedBatch.type === 'Organic' ? 'bg-green-100 text-green-800' : selectedBatch.type === 'Recyclable' ? 'bg-blue-100 text-blue-800' : selectedBatch.type === 'Hazardous' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          {selectedBatch.type}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="mb-2"><span className="font-medium text-gray-700">Created:</span> {new Date(selectedBatch.createdAt).toLocaleString()}</p>
                      <p className="mb-2"><span className="font-medium text-gray-700">Size:</span> {selectedBatch.size}</p>
                      <p className="mb-2"><span className="font-medium text-gray-700">Status:</span> {selectedBatch.status}</p>
                    </div>
                    <div>
                      <p className="mb-2">
                        <span className="font-medium text-gray-700">Progress:</span> 
                        <span className="ml-2">{selectedBatch.scanned} of {selectedBatch.quantity} bags</span>
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                        <div 
                          className="bg-indigo-600 h-2.5 rounded-full" 
                          style={{ width: `${(selectedBatch.scanned / selectedBatch.quantity) * 100}%` }}
                        ></div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">{Math.round((selectedBatch.scanned / selectedBatch.quantity) * 100)}% complete</p>
                    </div>
                  </div>
                </div>
                
                {loadingHistory ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                  </div>
                ) : batchScanHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    <FontAwesomeIcon icon={faQrcode} size="3x" className="mb-3 text-gray-400" />
                    <p>No scan history available for this batch</p>
                    <p className="text-sm mt-2">Bags from this batch haven't been scanned yet</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-medium">Scan Timeline</h4>
                      <span className="text-sm text-gray-500">{batchScanHistory.length} scan{batchScanHistory.length !== 1 ? 's' : ''} recorded</span>
                    </div>
                    
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                      {batchScanHistory.map((scan) => (
                        <div key={scan.id} className="border rounded-lg shadow-sm p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-medium text-indigo-600 font-mono">{scan.bagId}</span>
                            <span className="text-sm text-gray-500">{new Date(scan.scannedAt).toLocaleString()}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-2">
                            <div className="flex items-center">
                              <FontAwesomeIcon icon={faUser} className="mr-2 text-gray-500" />
                              <span><span className="font-medium">Collector:</span> {scan.scannedBy}</span>
                            </div>
                            <div className="flex items-center">
                              <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2 text-gray-500" />
                              <span><span className="font-medium">Location:</span> {scan.location}</span>
                            </div>
                          </div>
                          {scan.status && (
                            <div className="mt-2">
                              <span className="font-medium">Status:</span>
                              <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${scan.status === 'Completed' ? 'bg-green-100 text-green-800' : scan.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                {scan.status}
                              </span>
                            </div>
                          )}
                          {scan.notes && (
                            <div className="mt-2 text-sm bg-gray-50 p-2 rounded border border-gray-200">
                              <span className="font-medium block mb-1">Notes:</span>
                              <p className="text-gray-700">{scan.notes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Modal Footer */}
          <div className="pt-3 border-t flex justify-end">
            <button 
              onClick={closeHistoryModal}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BagHistory;
