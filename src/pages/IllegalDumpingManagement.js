import React, { useState, useEffect } from 'react';
import { fetchIllegalDumpingReports, updateIllegalDumpingStatus, fetchIllegalDumpingHistory, assignCleanupTeam } from '../utils/databaseUtils';
import { STATUS, SEVERITY } from '../config/constants';
import { reverseGeocodeWithCache } from '../utils/geocoding';

const IllegalDumpingManagement = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReportHistory, setSelectedReportHistory] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [metrics, setMetrics] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshIntervalMs] = useState(60000);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [geocodedAddress, setGeocodedAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Unified refresh function
  const refreshReports = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const statusParam = filterStatus !== 'All' ? filterStatus : null;
      const response = await fetchIllegalDumpingReports({ limit: 100, page: 1, status: statusParam });
      const data = Array.isArray(response) ? response : (response?.data || []);
      setReports(data);

      // Calculate metrics
      const computed = {
        totalReports: data.length,
        verifiedReports: data.filter(r => r.status === STATUS.ILLEGAL_DUMPING.VERIFIED || r.status === STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED || r.status === STATUS.ILLEGAL_DUMPING.CLEANED_UP).length,
        cleanedUpReports: data.filter(r => r.status === STATUS.ILLEGAL_DUMPING.CLEANED_UP).length,
        avgCleanupTimeHours: 24
      };
      setMetrics(computed);

      setLastUpdated(new Date());
      if (!silent) {
        setToastMessage('Data refreshed');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (error) {
      console.error('Error refreshing illegal dumping data:', error);
      if (!silent) {
        setToastMessage('Failed to refresh data');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    refreshReports(true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const id = setInterval(() => {
      refreshReports(true);
    }, autoRefreshIntervalMs);
    return () => clearInterval(id);
  }, [autoRefreshEnabled, autoRefreshIntervalMs, filterStatus]);

  const handleViewDetails = async (report) => {
    setSelectedReport(report);
    setGeocodedAddress(null); // Reset geocoded address
    
    try {
      // Fetch history for this report from Supabase
      const history = await fetchIllegalDumpingHistory(report.id);
      setSelectedReportHistory(history);
    } catch (error) {
      console.error('Error fetching report history:', error);
      setSelectedReportHistory([]);
    }
    
    setShowDetailsModal(true);
  };

  // Reverse geocode coordinates when report is selected
  useEffect(() => {
    const fetchAddress = async () => {
      if (!selectedReport) {
        setGeocodedAddress(null);
        return;
      }

      // If location_description already exists, use it
      if (selectedReport.location_description) {
        setGeocodedAddress(selectedReport.location_description);
        return;
      }

      // Try to get coordinates
      const lat = selectedReport.latitude || selectedReport.location_lat || selectedReport.location?.lat;
      const lng = selectedReport.longitude || selectedReport.location_lng || selectedReport.location?.lng;

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        setLoadingAddress(true);
        try {
          const address = await reverseGeocodeWithCache(lat, lng);
          setGeocodedAddress(address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } catch (error) {
          console.error('Error geocoding address:', error);
          setGeocodedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } finally {
          setLoadingAddress(false);
        }
      } else {
        setGeocodedAddress(null);
      }
    };

    fetchAddress();
  }, [selectedReport]);

  const updateReportStatus = async (reportId, newStatus, notes = '') => {
    try {
      console.log('Updating report status:', reportId, newStatus);
      
      // Update status in Supabase
      const result = await updateIllegalDumpingStatus(reportId, newStatus);
      console.log('Update result:', result);
      
      // Check for error in response
      if (result?.error) {
        throw new Error(result.error.message || 'Failed to update status');
      }
      
      // Update local state
      setReports(prevReports => 
        prevReports.map(report => {
          if (report.id === reportId) {
            return { ...report, status: newStatus };
          }
          return report;
        })
      );
      
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(prev => ({ ...prev, status: newStatus }));
      }
      
      // Show success message
      setToastMessage(`Status updated to ${newStatus}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
      // Refresh report history if the details modal is open
      if (selectedReport && selectedReport.id === reportId) {
        const history = await fetchIllegalDumpingHistory(reportId);
        setSelectedReportHistory(history);
      }
      
      // Refresh reports list
      await refreshReports(true);
    } catch (error) {
      console.error('Error updating report status:', error);
      setToastMessage(`Failed to update status: ${error.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const assignCleanup = async (reportId, teamName) => {
    try {
      console.log('Assigning cleanup:', reportId, teamName);
      
      // Calculate date 2 days in the future for estimated cleanup
      const estimatedCleanupDate = new Date(Date.now() + 2*24*60*60*1000).toISOString();
      
      // Update in Supabase
      const result = await assignCleanupTeam(reportId, teamName, estimatedCleanupDate);
      console.log('Assign cleanup result:', result);
      
      // Check for error in response
      if (result?.error) {
        throw new Error(result.error.message || 'Failed to assign cleanup team');
      }
      
      // Extract the data from result
      const updatedReport = result?.data || result;
      
      // Update local state
      setReports(prevReports => 
        prevReports.map(report => {
          if (report.id === reportId) {
            return { ...report, ...updatedReport, cleanup_team: teamName, estimated_cleanup_date: estimatedCleanupDate };
          }
          return report;
        })
      );
    
      // Update selected report if it's the one being modified
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(prev => ({ ...prev, ...updatedReport, cleanup_team: teamName, estimated_cleanup_date: estimatedCleanupDate }));
        
        // Refresh history
        const history = await fetchIllegalDumpingHistory(reportId);
        setSelectedReportHistory(history);
      }
      
      // Show success message
      setToastMessage(`Cleanup assigned to ${teamName}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
      // Refresh reports list
      await refreshReports(true);
      
    } catch (error) {
      console.error('Error assigning cleanup team:', error);
      setToastMessage(`Failed to assign cleanup team: ${error.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const filteredReports = reports
    .filter(report => {
      if (filterStatus !== 'All') {
        return (report.status || '').toUpperCase() === filterStatus.toUpperCase();
      }
      return true;
    })
    .filter(report => {
      if (filterSeverity !== 'All') {
        return (report.severity || '').toUpperCase() === filterSeverity.toUpperCase();
      }
      return true;
    })
    .filter(report => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          (report.id || '').toString().toLowerCase().includes(searchLower) ||
          (report.location_address || report.address || 
            (report.location && report.location.address) || '').toLowerCase().includes(searchLower) ||
          (report.description || '').toLowerCase().includes(searchLower) ||
          (report.waste_type || report.wasteType || '').toLowerCase().includes(searchLower)
        );
      }
      return true;
    });

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Illegal Dumping Management</h1>
        <p className="text-gray-600">Track and manage illegal dumping reports and cleanups</p>
      </div>
      {/* Toolbar: Refresh and Auto-Refresh */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {lastUpdated && `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}`}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
            />
            Auto-Refresh 60s
          </label>
          <button
            onClick={() => refreshReports(false)}
            disabled={loading}
            className={`px-3 py-2 rounded text-white text-sm font-medium ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {loading ? (
              <span className="inline-flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i> Refreshing...
              </span>
            ) : (
              <span className="inline-flex items-center">
                <i className="fas fa-sync mr-2"></i> Refresh
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-20 right-4 bg-white shadow-lg rounded-md p-4 z-50 animate-fade-in-down flex items-center">
          <i className="fas fa-info-circle text-blue-500 mr-2"></i>
          <span>{toastMessage}</span>
          <button className="ml-4 text-gray-400 hover:text-gray-600" onClick={() => setShowToast(false)}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      {!loading && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Total Reports</p>
            <p className="text-2xl font-bold">{metrics.totalReports}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Verified Reports</p>
            <p className="text-2xl font-bold">{metrics.verifiedReports}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Cleaned Up</p>
            <p className="text-2xl font-bold">{metrics.cleanedUpReports}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Avg Cleanup Time</p>
            <p className="text-2xl font-bold">{metrics.avgCleanupTimeHours.toFixed(1)} hrs</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2">
          <input
            type="text"
            placeholder="Search by ID, address, description, or waste type..."
            className="w-full p-2 border border-gray-300 rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-1/4">
          <select
            className="w-full p-2 border border-gray-300 rounded-lg"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value={STATUS.ILLEGAL_DUMPING.REPORTED.toString()}>{STATUS.ILLEGAL_DUMPING.REPORTED}</option>
            <option value={STATUS.ILLEGAL_DUMPING.VERIFIED.toString()}>{STATUS.ILLEGAL_DUMPING.VERIFIED}</option>
            <option value={STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED.toString()}>{STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED}</option>
            <option value={STATUS.ILLEGAL_DUMPING.CLEANED_UP.toString()}>{STATUS.ILLEGAL_DUMPING.CLEANED_UP}</option>
            <option value={STATUS.ILLEGAL_DUMPING.CANCELLED.toString()}>{STATUS.ILLEGAL_DUMPING.CANCELLED}</option>
          </select>
        </div>
        <div className="w-full md:w-1/4">
          <select
            className="w-full p-2 border border-gray-300 rounded-lg"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="All">All Severities</option>
            <option value={SEVERITY.LOW.toString()}>{SEVERITY.LOW}</option>
            <option value={SEVERITY.MEDIUM.toString()}>{SEVERITY.MEDIUM}</option>
            <option value={SEVERITY.HIGH.toString()}>{SEVERITY.HIGH}</option>
            <option value={SEVERITY.CRITICAL.toString()}>{SEVERITY.CRITICAL}</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reported At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Waste Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {report.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(report.reported_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="truncate max-w-xs">
                      {report.location_address || report.address || (report.location && report.location.address) || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.waste_type || report.wasteType || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      (report.severity || '').toUpperCase() === SEVERITY.LOW.toUpperCase() ? 'bg-green-100 text-green-800' : 
                      (report.severity || '').toUpperCase() === SEVERITY.MEDIUM.toUpperCase() ? 'bg-yellow-100 text-yellow-800' :
                      (report.severity || '').toUpperCase() === SEVERITY.HIGH.toUpperCase() ? 'bg-orange-100 text-orange-800' :
                      (report.severity || '').toUpperCase() === SEVERITY.CRITICAL.toUpperCase() ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {report.severity || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      (report.status || '').toUpperCase() === STATUS.ILLEGAL_DUMPING.CLEANED_UP.toUpperCase() ? 'bg-green-100 text-green-800' :
                      (report.status || '').toUpperCase() === STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED.toUpperCase() ? 'bg-blue-100 text-blue-800' :
                      (report.status || '').toUpperCase() === STATUS.ILLEGAL_DUMPING.VERIFIED.toUpperCase() ? 'bg-yellow-100 text-yellow-800' :
                      (report.status || '').toUpperCase() === STATUS.ILLEGAL_DUMPING.CANCELLED.toUpperCase() ? 'bg-gray-100 text-gray-800' :
                      (report.status || '').toUpperCase() === STATUS.ILLEGAL_DUMPING.REPORTED.toUpperCase() ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {report.status || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <button
                      onClick={() => handleViewDetails(report)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Details
                    </button>
                    {report.status !== STATUS.ILLEGAL_DUMPING.CLEANED_UP && report.status !== STATUS.ILLEGAL_DUMPING.CANCELLED && (
                      <button 
                        onClick={() => updateReportStatus(report.id, STATUS.ILLEGAL_DUMPING.CLEANED_UP)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Mark Cleaned
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Report Details Modal */}
      {showDetailsModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Dumping Report Details: {selectedReport.id}</h2>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Reported At</p>
                <p className="font-medium">
                  {new Date(selectedReport.reportedAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Reported By</p>
                <p className="font-medium">{selectedReport.reportedBy}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <p className={`font-medium ${
                  selectedReport.status === 'Cleaned Up' ? 'text-green-600' : 
                  selectedReport.status === 'Canceled' ? 'text-gray-600' : 
                  'text-blue-600'
                }`}>
                  {selectedReport.status}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Severity</p>
                <p className={`font-medium ${
                  (selectedReport.severity || '').toUpperCase() === SEVERITY.LOW.toUpperCase() ? 'text-green-600' : 
                  (selectedReport.severity || '').toUpperCase() === SEVERITY.MEDIUM.toUpperCase() ? 'text-yellow-600' :
                  (selectedReport.severity || '').toUpperCase() === SEVERITY.HIGH.toUpperCase() ? 'text-orange-600' :
                  (selectedReport.severity || '').toUpperCase() === SEVERITY.CRITICAL.toUpperCase() ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {selectedReport.severity || 'Unknown'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600 text-sm">Location</p>
                {loadingAddress ? (
                  <p className="font-medium text-gray-500">
                    <span className="animate-pulse">Loading address...</span>
                  </p>
                ) : (
                  <p className="font-medium">{geocodedAddress || 'Location not available'}</p>
                )}
              </div>
              <div className="col-span-2">
                <p className="text-gray-600 text-sm">Description</p>
                <p className="font-medium">{selectedReport.description || 'No description available'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Waste Type</p>
                <p className="font-medium">{selectedReport.waste_type || selectedReport.wasteType || 'N/A'}</p>
              </div>
              {(selectedReport.verified_at || selectedReport.verifiedAt) && (
                <div>
                  <p className="text-gray-600 text-sm">Verified At</p>
                  <p className="font-medium">
                    {new Date(selectedReport.verified_at || selectedReport.verifiedAt).toLocaleString()}
                  </p>
                </div>
              )}
              {(selectedReport.cleanup_team || selectedReport.cleanupTeam) && (
                <div>
                  <p className="text-gray-600 text-sm">Cleanup Team</p>
                  <p className="font-medium">{selectedReport.cleanup_team || selectedReport.cleanupTeam}</p>
                </div>
              )}
              {(selectedReport.estimated_cleanup_date || selectedReport.estimatedCleanupDate) && (
                <div>
                  <p className="text-gray-600 text-sm">Estimated Cleanup</p>
                  <p className="font-medium">
                    {new Date(selectedReport.estimated_cleanup_date || selectedReport.estimatedCleanupDate).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            
            {/* Images section */}
            <div className="mb-6">
              <h3 className="font-medium mb-2">Images ({selectedReport.images ? selectedReport.images.length : 0})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {selectedReport.images && selectedReport.images.length > 0 ? (
                  selectedReport.images.map((img, index) => (
                    <div key={index} className="bg-gray-100 rounded overflow-hidden">
                      <img 
                        src={img} 
                        alt={`Report evidence ${index + 1}`}
                        className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(img, '_blank')}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage unavailable%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <div className="bg-gray-100 p-4 rounded col-span-3 text-center">
                    <p className="text-gray-500">No images available</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Images must be uploaded to Supabase Storage
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* History Timeline */}
            {selectedReportHistory.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium mb-2">Activity History</h3>
                <div className="border-l-2 border-gray-200 ml-3">
                  {selectedReportHistory.map((item) => (
                    <div key={item.id} className="ml-6 mb-4 relative">
                      <div className="absolute -left-9 mt-1.5 w-4 h-4 rounded-full bg-blue-500"></div>
                      <p className="text-sm text-gray-500">
                        {new Date(item.changed_at || item.timestamp).toLocaleString()}
                      </p>
                      <p className="font-medium">{item.status || item.action}</p>
                      <p className="text-gray-600">By: {item.user ? `${item.user.first_name} ${item.user.last_name}` : (item.changed_by || item.performedBy || 'System')}</p>
                      {(item.notes) && <p className="text-sm mt-1">{item.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            {selectedReport.status !== STATUS.ILLEGAL_DUMPING.CLEANED_UP && selectedReport.status !== STATUS.ILLEGAL_DUMPING.CANCELLED && (
              <div className="border-t pt-4 flex flex-wrap justify-end gap-2">
                {!(selectedReport.cleanup_assigned || selectedReport.cleanupAssigned) && (
                  <button
                    onClick={() => assignCleanup(selectedReport.id, 'Team Alpha')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Assign Cleanup
                  </button>
                )}
                
                <button
                  onClick={() => updateReportStatus(selectedReport.id, STATUS.ILLEGAL_DUMPING.CLEANED_UP)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Mark as Cleaned Up
                </button>
                
                <button
                  onClick={() => updateReportStatus(selectedReport.id, STATUS.ILLEGAL_DUMPING.CANCELLED)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel Report
                </button>
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IllegalDumpingManagement;
