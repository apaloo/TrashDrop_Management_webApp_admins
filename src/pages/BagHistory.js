import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { bagBatches, bagHistory } from '../mock/bags';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCalendar, faHistory, faChartLine, faBoxOpen, faRecycle, faMapMarkerAlt, faUser, faQrcode } from '@fortawesome/free-solid-svg-icons';

const BagHistory = () => {
  // State for table data
  const [batches, setBatches] = useState([]);
  const [bagHistory, setBagHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [batchScanHistory, setBatchScanHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [scanFilter, setScanFilter] = useState(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setBatches(bagBatches);
      setLoading(false);
    }, 1000);
  }, []);

  // Filter the batches based on criteria
  const filteredBatches = batches
    .filter(batch => {
      if (filterStatus !== 'All') {
        return batch.status === filterStatus;
      }
      return true;
    })
    .filter(batch => {
      if (scanFilter > 0) {
        const scanPercentage = (batch.scanned / batch.quantity) * 100;
        return scanPercentage >= scanFilter;
      }
      return true;
    })
    .filter(batch => {
      if (searchTerm) {
        return (
          batch.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.qrPrefix.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      return true;
    });
    
  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBatches = filteredBatches.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  
  // Function to handle viewing history
  const handleViewHistory = (batch) => {
    setSelectedBatch(batch);
    const batchScans = bagHistory.filter(scan => scan.batchId === batch.id);
    setBatchScanHistory(batchScans.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt)));
    setShowHistoryModal(true);
  };
  
  // Close history modal
  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedBatch(null);
    setBatchScanHistory([]);
  };
  
  // Page change handler
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Bag History</h1>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Live Bag Requests Card */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" style={{ height: '340px' }}>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Live Bag Requests</h3>
          
          <div className="flex items-center justify-between mb-4">
            <div className="text-3xl font-bold text-green-600">27</div>
            <div className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">+5 this week</div>
          </div>
          
          <div className="text-sm text-gray-500 mb-4">Collection trend over time</div>
          
          {/* Simple Chart Visualization */}
          <div className="flex items-end space-x-2 h-32 mb-2">
            <div className="bg-green-200 w-1/7 rounded-t" style={{ height: '30%' }} title="Monday: 8"></div>
            <div className="bg-green-300 w-1/7 rounded-t" style={{ height: '45%' }} title="Tuesday: 12"></div>
            <div className="bg-green-400 w-1/7 rounded-t" style={{ height: '60%' }} title="Wednesday: 16"></div>
            <div className="bg-green-500 w-1/7 rounded-t" style={{ height: '75%' }} title="Thursday: 20"></div>
            <div className="bg-green-600 w-1/7 rounded-t" style={{ height: '90%' }} title="Friday: 24"></div>
            <div className="bg-green-700 w-1/7 rounded-t" style={{ height: '85%' }} title="Saturday: 22"></div>
            <div className="bg-green-800 w-1/7 rounded-t" style={{ height: '100%' }} title="Sunday: 27"></div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-400">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>
        </div>
        
        {/* Collector Status Card */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" style={{ height: '340px' }}>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Collector Status</h3>
          
          <div className="flex items-center justify-between mb-4">
            <div className="text-3xl font-bold text-blue-600">8/10</div>
            <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">80% Active</div>
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
                  80%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
              <div style={{ width: '80%' }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-100 p-3 rounded text-center">
              <div className="text-2xl font-bold text-green-700">8</div>
              <div className="text-sm text-green-800">Active</div>
            </div>
            <div className="bg-red-100 p-3 rounded text-center">
              <div className="text-2xl font-bold text-red-700">2</div>
              <div className="text-sm text-red-800">Inactive</div>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">Last updated: Today at 10:45 AM</div>
        </div>
        
        {/* Performance Timeline Card */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200" style={{ height: '340px' }}>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Performance Timeline</h3>
          
          <div className="flex items-center justify-between mb-4">
            <div className="text-3xl font-bold text-indigo-600">92%</div>
            <div className="text-sm bg-indigo-100 text-indigo-800 px-2 py-1 rounded">+3% from last month</div>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Response Time</span>
                <span className="font-medium">12 min</span>
              </div>
              <div className="h-2 bg-gray-200 rounded">
                <div className="h-2 bg-green-500 rounded" style={{ width: '92%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Completion Rate</span>
                <span className="font-medium">98%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded">
                <div className="h-2 bg-blue-500 rounded" style={{ width: '98%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Scan Accuracy</span>
                <span className="font-medium">95%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded">
                <div className="h-2 bg-indigo-500 rounded" style={{ width: '95%' }}></div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Daily Average: 87%</span>
              <span>Weekly Goal: 90%</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
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
                onChange={(e) => setSearchTerm(e.target.value)}
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
              onChange={(e) => setFilterStatus(e.target.value)}
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
      
      {/* History Table */}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trash Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bag Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number of Bags</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generation Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bags Scanned</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Scan</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentBatches.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                        No batches match your filter criteria
                      </td>
                    </tr>
                  ) : (
                    currentBatches.map((batch) => {
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
                            {batch.scanned > 0 ? new Date(bagHistory.find(h => h.batchId === batch.id)?.scannedAt || batch.createdAt).toLocaleDateString() : 'N/A'}
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
                Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredBatches.length)} of {filteredBatches.length} entries
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Previous
                  </button>
                  
                  {[...Array(totalPages).keys()].map(number => (
                    <button
                      key={number + 1}
                      onClick={() => paginate(number + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${currentPage === number + 1 ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      {number + 1}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => paginate(currentPage + 1)}
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
      <Modal show={showHistoryModal} onHide={closeHistoryModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Scan History for Batch: {selectedBatch?.id}
            <span className="ml-2 text-sm text-gray-500">
              ({selectedBatch?.scanned} of {selectedBatch?.quantity} bags scanned)
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBatch && (
            <div>
              <div className="mb-4 p-3 border-bottom">
                <div className="row">
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Batch ID:</strong> {selectedBatch.id}</p>
                    <p className="mb-1"><strong>QR Prefix:</strong> {selectedBatch.qrPrefix}</p>
                    <p className="mb-1">
                      <strong>Type:</strong> 
                      <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${selectedBatch.type === 'Organic' ? 'bg-green-100 text-green-800' : selectedBatch.type === 'Recyclable' ? 'bg-blue-100 text-blue-800' : selectedBatch.type === 'Hazardous' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        {selectedBatch.type}
                      </span>
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Created:</strong> {new Date(selectedBatch.createdAt).toLocaleString()}</p>
                    <p className="mb-1"><strong>Size:</strong> {selectedBatch.size}</p>
                    <p className="mb-1"><strong>Status:</strong> {selectedBatch.status}</p>
                  </div>
                </div>
              </div>
              
              {batchScanHistory.length === 0 ? (
                <div className="text-center py-5 text-gray-500">
                  <FontAwesomeIcon icon={faQrcode} size="3x" className="mb-3" />
                  <p>No scan history available for this batch</p>
                </div>
              ) : (
                <div>
                  <h6 className="mb-3">Scan Timeline</h6>
                  <div className="scan-timeline">
                    {batchScanHistory.map((scan, index) => (
                      <div key={scan.id} className="timeline-item mb-4">
                        <div className="d-flex">
                          <div className="timeline-marker bg-indigo-500 rounded-circle" style={{ width: '12px', height: '12px', marginTop: '6px', marginRight: '12px' }}></div>
                          <div className="timeline-content p-3 border rounded-lg shadow-sm" style={{ flex: '1' }}>
                            <div className="d-flex justify-content-between mb-2">
                              <span className="font-weight-bold">QR Code: {scan.qrCode}</span>
                              <small className="text-muted">{new Date(scan.scannedAt).toLocaleString()}</small>
                            </div>
                            <div className="mb-2">
                              <FontAwesomeIcon icon={faUser} className="mr-2 text-gray-500" />
                              <span>Scanned by: {scan.scannedBy}</span>
                            </div>
                            <div className="mb-2">
                              <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2 text-gray-500" />
                              <span>Location: {scan.location}</span>
                            </div>
                            {scan.notes && (
                              <div className="mt-2 py-2 px-3 bg-gray-50 rounded">
                                <small>{scan.notes}</small>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={closeHistoryModal}>
            Close
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default BagHistory;
