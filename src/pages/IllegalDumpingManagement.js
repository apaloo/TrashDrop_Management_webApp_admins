import React, { useState, useEffect } from 'react';
import { dumpingReports, dumpingHistory, getCleanupMetrics } from '../mock/illegalDumping';

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

  useEffect(() => {
    // Simulate API call with timeout
    setTimeout(() => {
      setReports(dumpingReports);
      setMetrics(getCleanupMetrics());
      setLoading(false);
    }, 1000);
  }, []);

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    // Filter history for this report
    const history = dumpingHistory.filter(item => item.reportId === report.id);
    setSelectedReportHistory(history);
    setShowDetailsModal(true);
  };

  const updateReportStatus = (reportId, newStatus, notes = '') => {
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
    
    // In a real application, you would also update the database and add a history entry
  };

  const assignCleanup = (reportId, teamName) => {
    setReports(prevReports => 
      prevReports.map(report => {
        if (report.id === reportId) {
          return { 
            ...report, 
            cleanupAssigned: true,
            cleanupTeam: teamName,
            status: 'Cleanup Scheduled',
            estimatedCleanupDate: new Date(Date.now() + 2*24*60*60*1000).toISOString()
          };
        }
        return report;
      })
    );
    
    if (selectedReport && selectedReport.id === reportId) {
      setSelectedReport(prev => ({ 
        ...prev, 
        cleanupAssigned: true,
        cleanupTeam: teamName,
        status: 'Cleanup Scheduled',
        estimatedCleanupDate: new Date(Date.now() + 2*24*60*60*1000).toISOString()
      }));
    }
  };

  const filteredReports = reports
    .filter(report => {
      if (filterStatus !== 'All') {
        return report.status === filterStatus;
      }
      return true;
    })
    .filter(report => {
      if (filterSeverity !== 'All') {
        return report.severity === filterSeverity;
      }
      return true;
    })
    .filter(report => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          report.id.toLowerCase().includes(searchLower) ||
          report.location.address.toLowerCase().includes(searchLower) ||
          report.description.toLowerCase().includes(searchLower) ||
          report.wasteType.toLowerCase().includes(searchLower)
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
            <option value="Reported">Reported</option>
            <option value="Under Investigation">Under Investigation</option>
            <option value="Cleanup Scheduled">Cleanup Scheduled</option>
            <option value="Cleaned Up">Cleaned Up</option>
            <option value="Canceled">Canceled</option>
          </select>
        </div>
        <div className="w-full md:w-1/4">
          <select
            className="w-full p-2 border border-gray-300 rounded-lg"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="All">All Severities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
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
                    {new Date(report.reportedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="truncate max-w-xs">
                      {report.location.address}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.wasteType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      report.severity === 'Low' ? 'bg-green-100 text-green-800' : 
                      report.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      report.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {report.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      report.status === 'Cleaned Up' ? 'bg-green-100 text-green-800' :
                      report.status === 'Cleanup Scheduled' ? 'bg-blue-100 text-blue-800' :
                      report.status === 'Under Investigation' ? 'bg-yellow-100 text-yellow-800' :
                      report.status === 'Canceled' ? 'bg-gray-100 text-gray-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <button
                      onClick={() => handleViewDetails(report)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Details
                    </button>
                    {report.status !== 'Cleaned Up' && report.status !== 'Canceled' && (
                      <button 
                        onClick={() => updateReportStatus(report.id, 'Cleaned Up')}
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
                  selectedReport.severity === 'Low' ? 'text-green-600' : 
                  selectedReport.severity === 'Medium' ? 'text-yellow-600' :
                  selectedReport.severity === 'High' ? 'text-orange-600' :
                  'text-red-600'
                }`}>
                  {selectedReport.severity}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600 text-sm">Location</p>
                <p className="font-medium">{selectedReport.location.address}</p>
                <p className="text-sm text-gray-500">
                  Lat: {selectedReport.location.lat.toFixed(4)}, Lng: {selectedReport.location.lng.toFixed(4)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600 text-sm">Description</p>
                <p className="font-medium">{selectedReport.description}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Waste Type</p>
                <p className="font-medium">{selectedReport.wasteType}</p>
              </div>
              {selectedReport.verifiedAt && (
                <div>
                  <p className="text-gray-600 text-sm">Verified At</p>
                  <p className="font-medium">
                    {new Date(selectedReport.verifiedAt).toLocaleString()}
                  </p>
                </div>
              )}
              {selectedReport.cleanupTeam && (
                <div>
                  <p className="text-gray-600 text-sm">Cleanup Team</p>
                  <p className="font-medium">{selectedReport.cleanupTeam}</p>
                </div>
              )}
              {selectedReport.estimatedCleanupDate && (
                <div>
                  <p className="text-gray-600 text-sm">Estimated Cleanup</p>
                  <p className="font-medium">
                    {new Date(selectedReport.estimatedCleanupDate).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            
            {/* Images section - in a real app these would display actual images */}
            <div className="mb-6">
              <h3 className="font-medium mb-2">Images ({selectedReport.images.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {selectedReport.images.map((img, index) => (
                  <div key={index} className="bg-gray-200 p-4 rounded flex items-center justify-center">
                    <p className="text-gray-500">[Image: {img}]</p>
                  </div>
                ))}
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
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                      <p className="font-medium">{item.action}</p>
                      <p className="text-gray-600">By: {item.performedBy}</p>
                      {item.notes && <p className="text-sm mt-1">{item.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            {selectedReport.status !== 'Cleaned Up' && selectedReport.status !== 'Canceled' && (
              <div className="border-t pt-4 flex flex-wrap justify-end gap-2">
                {!selectedReport.cleanupAssigned && (
                  <button
                    onClick={() => assignCleanup(selectedReport.id, 'Team Alpha')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Assign Cleanup
                  </button>
                )}
                
                <button
                  onClick={() => updateReportStatus(selectedReport.id, 'Cleaned Up')}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Mark as Cleaned Up
                </button>
                
                <button
                  onClick={() => updateReportStatus(selectedReport.id, 'Canceled')}
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
