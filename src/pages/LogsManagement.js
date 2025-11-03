import React, { useState, useEffect, useMemo } from 'react';
import { fetchLogs } from '../utils/databaseUtils';
import { LOG_LEVEL } from '../config/constants';
import { appConfig } from '../config';

// Generate mock log entries
const generateMockLogs = () => {
  const logLevels = [LOG_LEVEL.INFO, LOG_LEVEL.WARNING, LOG_LEVEL.ERROR, LOG_LEVEL.DEBUG];
  const sources = ['System', 'Authentication', 'Pickup Request', 'Collector', 'Bag Management', 'User Action'];
  const users = [appConfig.app.adminEmail, appConfig.app.supportEmail, 'john.doe@trashdrop.com', 'collector1@trashdrop.com', null];
  const actions = [
    'User login',
    'Password reset request',
    'Collector status changed',
    'Pickup request created',
    'Pickup request assigned',
    'Pickup request completed',
    'Bag batch generated',
    'User preferences updated',
    'System maintenance triggered',
    'Region added',
    'Alert resolved',
    'Database backup',
    'API rate limit reached',
    'Authentication failure'
  ];
  
  const mockLogs = [];
  
  // Current date for reference
  const now = new Date();
  
  // Generate 50 log entries
  for (let i = 0; i < 50; i++) {
    const level = logLevels[Math.floor(Math.random() * logLevels.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    // Generate a timestamp within the last 7 days
    const timestamp = new Date(now.getTime() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
    
    // Generate a unique ID
    const id = `log-${i + 1}-${Date.now().toString(36)}`;
    
    // Generate IP address
    const ip = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    
    // Generate request duration (for some entries)
    const requestDuration = Math.random() > 0.7 ? null : Math.floor(Math.random() * 2000);
    
    // Generate response code (for some entries)
    const responseCode = Math.random() > 0.6 ? null : [200, 201, 400, 403, 404, 500][Math.floor(Math.random() * 6)];
    
    // Generate details based on action and level
    let details = '';
    switch (level) {
      case 'ERROR':
        details = `Failed to ${action.toLowerCase()}. ${['Connection timeout', 'Invalid input', 'Unauthorized access', 'Internal server error'][Math.floor(Math.random() * 4)]}`;
        break;
      case 'WARNING':
        details = `${action} completed with warnings. ${['Performance degradation detected', 'Retry attempt required', 'Data may be incomplete'][Math.floor(Math.random() * 3)]}`;
        break;
      case 'INFO':
        details = `Successfully ${action.toLowerCase()}.`;
        break;
      case 'DEBUG':
        details = `${action} process details: ${['Step 1 complete', 'Parameters validated', 'Cache refreshed', 'Response parsed'][Math.floor(Math.random() * 4)]}`;
        break;
      default:
        details = `${action} recorded.`;
    }
    
    // Generate related entity for some logs
    const relatedEntity = Math.random() > 0.5 ? {
      type: ['pickup_request', 'collector', 'bag_batch', 'user', 'region'][Math.floor(Math.random() * 5)],
      id: `${['req', 'col', 'bag', 'usr', 'reg'][Math.floor(Math.random() * 5)]}-${Math.floor(Math.random() * 10000)}`
    } : null;
    
    mockLogs.push({
      id,
      timestamp: timestamp.toISOString(),
      level,
      source,
      message: action,
      details,
      user,
      ip,
      requestDuration,
      responseCode,
      relatedEntity
    });
  }
  
  // Sort by timestamp (newest first)
  return mockLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

const mockLogs = generateMockLogs();

const LogsManagement = () => {
  // State for logs data
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for expanded log entry
  const [expandedLogId, setExpandedLogId] = useState(null);
  
  // Filters state
  const [filters, setFilters] = useState({
    level: 'all',
    source: 'all',
    dateRange: {
      start: null,
      end: null
    },
    searchQuery: ''
  });
  
  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    logsPerPage: 10
  });
  
  // Load logs data from Supabase
  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get filter parameters
        const logLevel = filters.level !== 'all' ? filters.level : null;
        const logSource = filters.source !== 'all' ? filters.source : null;
        const dateRange = filters.dateRange.start && filters.dateRange.end ? {
          start: filters.dateRange.start,
          end: filters.dateRange.end
        } : null;
        
        // Fetch logs from Supabase with filters
        const logsData = await fetchLogs(logLevel, logSource, dateRange, filters.searchQuery);
        
        // Transform data from snake_case to camelCase
        const formattedLogs = logsData.map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          level: log.level,
          source: log.source,
          message: log.message,
          userId: log.user_id,
          userName: log.user_name,
          userEmail: log.user_email,
          details: log.details || {},
          ip: log.ip,
          requestPath: log.request_path,
          requestMethod: log.request_method,
          requestDuration: log.request_duration,
          relatedEntityId: log.related_entity_id,
          relatedEntityType: log.related_entity_type
        }));
        
        setLogs(formattedLogs);
      } catch (err) {
        console.error('Error fetching logs:', err);
        setError('Failed to load logs. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadLogs();
  }, [filters]); // Re-fetch when filters change
  
  // Helper function to handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => {
      if (filterType === 'dateRange') {
        return {
          ...prev,
          dateRange: {
            ...prev.dateRange,
            ...value
          }
        };
      }
      return {
        ...prev,
        [filterType]: value
      };
    });
    
    // Reset to first page when filters change
    setPagination(prev => ({
      ...prev,
      currentPage: 1
    }));
  };
  
  // Format date to readable string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Apply filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by level
      if (filters.level !== 'all' && log.level !== filters.level) {
        return false;
      }
      
      // Filter by source
      if (filters.source !== 'all' && log.source !== filters.source) {
        return false;
      }
      
      // Filter by date range
      if (filters.dateRange.start) {
        const startDate = new Date(filters.dateRange.start);
        const logDate = new Date(log.timestamp);
        if (logDate < startDate) {
          return false;
        }
      }
      
      if (filters.dateRange.end) {
        const endDate = new Date(filters.dateRange.end);
        endDate.setHours(23, 59, 59, 999); // Set to end of day
        const logDate = new Date(log.timestamp);
        if (logDate > endDate) {
          return false;
        }
      }
      
      // Filter by search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const detailsText = typeof log.details === 'string'
          ? log.details
          : JSON.stringify(log.details || '');
        return (
          log.message?.toLowerCase().includes(query) ||
          detailsText?.toLowerCase().includes(query) ||
          log.source?.toLowerCase().includes(query) ||
          log.user?.toLowerCase?.().includes(query) ||
          log.relatedEntity?.id?.toLowerCase?.().includes(query) ||
          log.id?.toLowerCase?.().includes(query)
        );
      }
      
      return true;
    });
  }, [logs, filters]);
  
  // Use centralized constants for log levels and get unique sources for filter options
  const uniqueLogLevels = useMemo(() => Object.values(LOG_LEVEL), []);
  const uniqueSources = useMemo(() => [...new Set(logs.map(log => log.source))], [logs]);
  
  // Get current logs for pagination
  const indexOfLastLog = pagination.currentPage * pagination.logsPerPage;
  const indexOfFirstLog = indexOfLastLog - pagination.logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  
  // Change page
  const paginate = (pageNumber) => setPagination(prev => ({
    ...prev,
    currentPage: pageNumber
  }));
  
  // Toggle expanded log details
  const toggleLogExpansion = (logId) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };
  
  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-800">Logs & Audit Trail</h1>
        
        {/* Summary stats */}
        <div className="flex flex-wrap gap-4">
          <div className="px-4 py-2 bg-white rounded-lg shadow-sm border-0 flex items-center">
            <div className="rounded-full p-2 mr-2" style={{ backgroundColor: 'rgba(220, 53, 69, 0.1)' }}>
              <i className="fas fa-exclamation-circle" style={{ color: '#dc3545' }}></i>
            </div>
            <div>
              <p className="text-xs text-gray-500">Errors</p>
              <p className="font-semibold">{logs.filter(log => log.level === LOG_LEVEL.ERROR).length}</p>
            </div>
          </div>
          
          <div className="px-4 py-2 bg-white rounded-lg shadow-sm border-0 flex items-center">
            <div className="rounded-full p-2 mr-2" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}>
              <i className="fas fa-exclamation-triangle" style={{ color: '#ffc107' }}></i>
            </div>
            <div>
              <p className="text-xs text-gray-500">Warnings</p>
              <p className="font-semibold">{logs.filter(log => log.level === LOG_LEVEL.WARNING).length}</p>
            </div>
          </div>
          
          <div className="px-4 py-2 bg-white rounded-lg shadow-sm border-0 flex items-center">
            <div className="rounded-full p-2 mr-2" style={{ backgroundColor: 'rgba(40, 167, 69, 0.1)' }}>
              <i className="fas fa-info-circle" style={{ color: '#28a745' }}></i>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Entries</p>
              <p className="font-semibold">{logs.length}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters section */}
      <div className="bg-white rounded-lg shadow-sm border-0 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end flex-wrap">
          {/* Search box */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-400"></i>
              </div>
              <input
                type="text"
                placeholder="Search logs..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
              />
            </div>
          </div>
          
          {/* Log level filter */}
          <div className="w-full md:w-44">
            <label className="block text-sm font-medium text-gray-700 mb-1">Log Level</label>
            <select
              className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
            >
              <option value="all">All Levels</option>
              {uniqueLogLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          
          {/* Source filter */}
          <div className="w-full md:w-44">
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={filters.source}
              onChange={(e) => handleFilterChange('source', e.target.value)}
            >
              <option value="all">All Sources</option>
              {uniqueSources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
          
          {/* Date range filter - Start date */}
          <div className="w-full md:w-44">
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={filters.dateRange.start || ''}
              onChange={(e) => handleFilterChange('dateRange', { start: e.target.value })}
            />
          </div>
          
          {/* Date range filter - End date */}
          <div className="w-full md:w-44">
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={filters.dateRange.end || ''}
              onChange={(e) => handleFilterChange('dateRange', { end: e.target.value })}
            />
          </div>
          
          {/* Clear filters button */}
          <button
            className="px-4 py-2 text-blue-600 hover:text-blue-800 border border-blue-600 hover:border-blue-800 rounded-md"
            onClick={() => setFilters({
              level: 'all',
              source: 'all',
              dateRange: { start: null, end: null },
              searchQuery: ''
            })}
          >
            Clear Filters
          </button>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <i className="fas fa-circle-notch fa-spin text-blue-500 text-4xl mb-4"></i>
            <p className="text-gray-500">Loading logs...</p>
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border-0 p-8 text-center">
          <div className="inline-block p-4 rounded-full bg-gray-100 mb-4">
            <i className="fas fa-search text-gray-400 text-2xl"></i>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No log entries found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try changing your filters or search query
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border-0 overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentLogs.map(log => (
                    <React.Fragment key={log.id}>
                      <tr className={`${expandedLogId === log.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        {/* Timestamp */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(log.timestamp)}
                        </td>
                        
                        {/* Level */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.level === LOG_LEVEL.ERROR ? 'bg-red-100 text-red-800' : 
                            log.level === LOG_LEVEL.WARNING ? 'bg-yellow-100 text-yellow-800' : 
                            log.level === LOG_LEVEL.INFO ? 'bg-green-100 text-green-800' : 
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {log.level === LOG_LEVEL.ERROR && <i className="fas fa-exclamation-circle mr-1"></i>}
                            {log.level === LOG_LEVEL.WARNING && <i className="fas fa-exclamation-triangle mr-1"></i>}
                            {log.level === LOG_LEVEL.INFO && <i className="fas fa-info-circle mr-1"></i>}
                            {log.level === LOG_LEVEL.DEBUG && <i className="fas fa-bug mr-1"></i>}
                            {log.level}
                          </span>
                        </td>
                        
                        {/* Source */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.source}
                        </td>
                        
                        {/* Message */}
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-sm truncate">
                          {log.message}
                        </td>
                        
                        {/* User */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.user || <em className="text-gray-400">System</em>}
                        </td>
                        
                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => toggleLogExpansion(log.id)}
                          >
                            {expandedLogId === log.id ? (
                              <>
                                <i className="fas fa-chevron-up mr-1"></i>
                                Hide Details
                              </>
                            ) : (
                              <>
                                <i className="fas fa-chevron-down mr-1"></i>
                                View Details
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded details row */}
                      {expandedLogId === log.id && (
                        <tr className="bg-blue-50">
                          <td colSpan="6" className="px-6 py-4">
                            <div className="text-sm">
                              {/* Log ID and IP */}
                              <div className="flex flex-col md:flex-row md:items-center mb-4">
                                <div className="md:w-1/2 mb-2 md:mb-0">
                                  <span className="text-gray-500 mr-2">Log ID:</span>
                                  <code className="bg-gray-100 px-1 py-0.5 rounded">{log.id}</code>
                                </div>
                                {log.ip && (
                                  <div className="md:w-1/2">
                                    <span className="text-gray-500 mr-2">IP Address:</span>
                                    <code className="bg-gray-100 px-1 py-0.5 rounded">{log.ip}</code>
                                  </div>
                                )}
                              </div>
                              
                              {/* Details */}
                              <div className="mb-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Details</h4>
                                {log.details == null || (typeof log.details === 'string' && log.details.trim() === '') ? (
                                  <p className="text-gray-500">No details</p>
                                ) : typeof log.details === 'string' ? (
                                  <p className="bg-white p-3 border border-gray-200 rounded break-words whitespace-pre-wrap">{log.details}</p>
                                ) : (
                                  <pre className="bg-white p-3 border border-gray-200 rounded overflow-auto text-xs">
{JSON.stringify(log.details, null, 2)}
                                  </pre>
                                )}
                              </div>
                              
                              {/* Related entity if any */}
                              {log.relatedEntity && (
                                <div className="mb-4">
                                  <h4 className="text-sm font-medium text-gray-900 mb-2">Related Entity</h4>
                                  <div className="flex items-center bg-white p-3 border border-gray-200 rounded">
                                    <span className="text-gray-700 uppercase text-xs font-medium mr-2">{log.relatedEntity.type.replace('_', ' ')}:</span>
                                    <span className="text-blue-600">{log.relatedEntity.id}</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Performance metrics if available */}
                              {(log.requestDuration !== null || log.responseCode !== null) && (
                                <div className="flex flex-col md:flex-row md:items-center">
                                  {log.requestDuration !== null && (
                                    <div className="md:w-1/2 mb-2 md:mb-0">
                                      <span className="text-gray-500 mr-2">Request Duration:</span>
                                      <span className={`${log.requestDuration > 1000 ? 'text-amber-600' : 'text-gray-900'}`}>
                                        {log.requestDuration} ms
                                      </span>
                                    </div>
                                  )}
                                  {log.responseCode !== null && (
                                    <div className="md:w-1/2">
                                      <span className="text-gray-500 mr-2">Response Code:</span>
                                      <span className={`
                                        ${log.responseCode >= 200 && log.responseCode < 300 ? 'text-green-600' : ''}
                                        ${log.responseCode >= 400 && log.responseCode < 500 ? 'text-amber-600' : ''}
                                        ${log.responseCode >= 500 ? 'text-red-600' : ''}
                                      `}>
                                        {log.responseCode}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Showing {indexOfFirstLog + 1}-{Math.min(indexOfLastLog, filteredLogs.length)} of {filteredLogs.length} logs
            </div>
            
            <div className="flex">
              <select
                className="mr-4 border border-gray-300 rounded-md text-sm py-1 px-2"
                value={pagination.logsPerPage}
                onChange={(e) => setPagination(prev => ({
                  ...prev,
                  logsPerPage: Number(e.target.value),
                  currentPage: 1
                }))}
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => paginate(Math.max(1, pagination.currentPage - 1))}
                  disabled={pagination.currentPage === 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${pagination.currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                
                {/* Page numbers */}
                {[...Array(Math.ceil(filteredLogs.length / pagination.logsPerPage)).keys()].map(number => (
                  <button
                    key={number + 1}
                    onClick={() => paginate(number + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      pagination.currentPage === number + 1
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {number + 1}
                  </button>
                )).slice(
                  Math.max(0, pagination.currentPage - 3),
                  Math.min(
                    Math.ceil(filteredLogs.length / pagination.logsPerPage),
                    pagination.currentPage + 2
                  )
                )}
                
                <button
                  onClick={() => paginate(Math.min(
                    Math.ceil(filteredLogs.length / pagination.logsPerPage),
                    pagination.currentPage + 1
                  ))}
                  disabled={pagination.currentPage === Math.ceil(filteredLogs.length / pagination.logsPerPage)}
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                    pagination.currentPage === Math.ceil(filteredLogs.length / pagination.logsPerPage)
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </nav>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LogsManagement;
