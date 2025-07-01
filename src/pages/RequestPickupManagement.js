import React, { useState, useEffect } from 'react';
import { pickupRequests, collectors, alerts, getRequestsByStatus } from '../mock/pickupRequests';

const RequestPickupManagement = () => {
  // State management
  const [requests, setRequests] = useState([]);
  const [activeCollectors, setActiveCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCollectorModal, setShowCollectorModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [systemAlerts, setSystemAlerts] = useState([]);

  // Load data
  useEffect(() => {
    // Simulate API call with timeout
    setTimeout(() => {
      setRequests(pickupRequests);
      setActiveCollectors(collectors.filter(c => c.status === 'Active'));
      setSystemAlerts(alerts);
      setLoading(false);
    }, 1000);
  }, []);

  // Handle viewing request details
  const handleViewRequest = (request) => {
    setSelectedRequest(request);
    setShowRequestModal(true);
  };

  // Handle viewing collector details
  const handleViewCollector = (collector) => {
    setSelectedCollector(collector);
    setShowCollectorModal(true);
  };

  // Filter requests based on search term and filters
  const filteredRequests = requests.filter(request => {
    // Status filter
    if (filterStatus !== 'All' && request.status !== filterStatus) {
      return false;
    }
    
    // Priority filter
    if (filterPriority !== 'All' && request.priority !== filterPriority) {
      return false;
    }
    
    // Search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        request.id.toLowerCase().includes(searchLower) ||
        request.requestedBy.name.toLowerCase().includes(searchLower) ||
        request.location.address.toLowerCase().includes(searchLower) ||
        (request.assignedTo && request.assignedTo.name.toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });

  // Handle request status updates
  const updateRequestStatus = (requestId, newStatus) => {
    setRequests(prevRequests => 
      prevRequests.map(request => {
        if (request.id === requestId) {
          return { ...request, status: newStatus };
        }
        return request;
      })
    );
    
    if (selectedRequest && selectedRequest.id === requestId) {
      setSelectedRequest(prev => ({ ...prev, status: newStatus }));
    }
  };

  // Handle assigning collector to request
  const assignCollector = (requestId, collector) => {
    setRequests(prevRequests => 
      prevRequests.map(request => {
        if (request.id === requestId) {
          return { 
            ...request, 
            assignedTo: {
              id: collector.id,
              name: collector.name
            },
            status: 'In Progress'
          };
        }
        return request;
      })
    );
    
    if (selectedRequest && selectedRequest.id === requestId) {
      setSelectedRequest(prev => ({
        ...prev, 
        assignedTo: {
          id: collector.id,
          name: collector.name
        },
        status: 'In Progress'
      }));
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Request Pickup Management</h1>
        <p className="text-gray-600">Manage pickup requests and collector assignments</p>
      </div>

      {/* Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Total Requests</p>
            <p className="text-2xl font-bold">{requests.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold">{getRequestsByStatus('Pending').length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">In Progress</p>
            <p className="text-2xl font-bold">{getRequestsByStatus('In Progress').length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Active Collectors</p>
            <p className="text-2xl font-bold">{activeCollectors.length}</p>
          </div>
        </div>
      )}

      {/* System Alerts */}
      {systemAlerts.filter(alert => alert.status === 'Active').length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-3">Active Alerts</h2>
          <div className="space-y-2">
            {systemAlerts
              .filter(alert => alert.status === 'Active')
              .map(alert => (
                <div 
                  key={alert.id} 
                  className={`p-3 rounded-lg ${
                    alert.severity === 'High' ? 'bg-red-100 text-red-800' :
                    alert.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}
                >
                  <div className="flex justify-between">
                    <p className="font-medium">{alert.message}</p>
                    <span className="text-sm">{new Date(alert.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">
                    Related to: {alert.relatedTo.type} #{alert.relatedTo.id}
                  </p>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2">
          <input
            type="text"
            placeholder="Search by ID, customer, address or collector..."
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
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div className="w-full md:w-1/4">
          <select
            className="w-full p-2 border border-gray-300 rounded-lg"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="All">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>
      
      {/* Requests Table */}
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
                  Request ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Waste Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {request.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.requestedBy.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="truncate max-w-xs">
                      {request.location.address}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.wasteType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      request.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      request.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      request.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.assignedTo ? (
                      <button
                        onClick={() => handleViewCollector(collectors.find(c => c.id === request.assignedTo.id))}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {request.assignedTo.name}
                      </button>
                    ) : (
                      <span className="text-gray-400">Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleViewRequest(request)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Active Collectors Section */}
      <div className="mt-8 mb-4">
        <h2 className="text-lg font-medium mb-4">Active Collectors</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {activeCollectors.map(collector => (
            <div 
              key={collector.id} 
              onClick={() => handleViewCollector(collector)}
              className="bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">{collector.name}</h3>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Active
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-2">{collector.vehicle.type} • {collector.vehicle.plate}</p>
              <div className="flex justify-between text-sm">
                <span>Active: {collector.activeRequests}</span>
                <span>Completed: {collector.completedToday}</span>
                <span>⭐ {collector.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Request Detail Modal */}
      {showRequestModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Request Details: {selectedRequest.id}</h2>
              <button 
                onClick={() => setShowRequestModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Customer Name</p>
                <p className="font-medium">{selectedRequest.requestedBy.name}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Customer Contact</p>
                <p className="font-medium">{selectedRequest.requestedBy.email}</p>
                <p className="text-sm">{selectedRequest.requestedBy.phone}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Request Date</p>
                <p className="font-medium">
                  {new Date(selectedRequest.requestedAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <p className={`font-medium ${
                  selectedRequest.status === 'Completed' ? 'text-green-600' : 
                  selectedRequest.status === 'Cancelled' ? 'text-red-600' : 
                  selectedRequest.status === 'In Progress' ? 'text-blue-600' :
                  'text-yellow-600'
                }`}>
                  {selectedRequest.status}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Priority</p>
                <p className={`font-medium ${
                  selectedRequest.priority === 'High' ? 'text-red-600' : 
                  selectedRequest.priority === 'Medium' ? 'text-yellow-600' : 
                  'text-green-600'
                }`}>
                  {selectedRequest.priority}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Waste Type</p>
                <p className="font-medium">{selectedRequest.wasteType}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Quantity</p>
                <p className="font-medium">{selectedRequest.quantity} bags</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600 text-sm">Location</p>
                <p className="font-medium">{selectedRequest.location.address}</p>
                <p className="text-sm text-gray-500">
                  Lat: {selectedRequest.location.lat.toFixed(4)}, Lng: {selectedRequest.location.lng.toFixed(4)}
                </p>
              </div>
              {selectedRequest.assignedTo && (
                <div>
                  <p className="text-gray-600 text-sm">Assigned To</p>
                  <p className="font-medium">{selectedRequest.assignedTo.name}</p>
                </div>
              )}
              {selectedRequest.scheduledTime && (
                <div>
                  <p className="text-gray-600 text-sm">Scheduled Pickup</p>
                  <p className="font-medium">
                    {new Date(selectedRequest.scheduledTime).toLocaleString()}
                  </p>
                </div>
              )}
              {selectedRequest.completedTime && (
                <div>
                  <p className="text-gray-600 text-sm">Completed At</p>
                  <p className="font-medium">
                    {new Date(selectedRequest.completedTime).toLocaleString()}
                  </p>
                </div>
              )}
              {selectedRequest.notes && (
                <div className="col-span-2">
                  <p className="text-gray-600 text-sm">Notes</p>
                  <p className="font-medium">{selectedRequest.notes}</p>
                </div>
              )}
            </div>
            
            {/* Map Placeholder - In a real app, this would be an actual map */}
            <div className="mb-6 h-64 bg-gray-200 flex items-center justify-center rounded">
              <p className="text-gray-500">Map view would be displayed here</p>
            </div>
            
            {/* Action Buttons */}
            {selectedRequest.status !== 'Completed' && selectedRequest.status !== 'Cancelled' && (
              <div className="border-t pt-4 mb-4">
                <h3 className="font-medium mb-2">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {!selectedRequest.assignedTo && (
                    <div className="w-full md:w-auto">
                      <select
                        className="p-2 border border-gray-300 rounded mr-2"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            const collector = collectors.find(c => c.id === e.target.value);
                            if (collector) {
                              assignCollector(selectedRequest.id, collector);
                            }
                          }
                        }}
                      >
                        <option value="" disabled>Assign to collector...</option>
                        {activeCollectors.map(collector => (
                          <option key={collector.id} value={collector.id}>
                            {collector.name} ({collector.activeRequests} active)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {selectedRequest.status === 'Pending' && (
                    <button
                      onClick={() => updateRequestStatus(selectedRequest.id, 'In Progress')}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Start Pickup
                    </button>
                  )}
                  
                  {selectedRequest.status === 'In Progress' && (
                    <button
                      onClick={() => updateRequestStatus(selectedRequest.id, 'Completed')}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Mark as Completed
                    </button>
                  )}
                  
                  <button
                    onClick={() => updateRequestStatus(selectedRequest.id, 'Cancelled')}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel Request
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Collector Detail Modal */}
      {showCollectorModal && selectedCollector && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Collector Profile: {selectedCollector.name}</h2>
              <button 
                onClick={() => setShowCollectorModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Name</p>
                <p className="font-medium">{selectedCollector.name}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <p className={`font-medium ${
                  selectedCollector.status === 'Active' ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {selectedCollector.status}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Email</p>
                <p className="font-medium">{selectedCollector.email}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Phone</p>
                <p className="font-medium">{selectedCollector.phone}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Vehicle</p>
                <p className="font-medium">{selectedCollector.vehicle.type} ({selectedCollector.vehicle.plate})</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Capacity</p>
                <p className="font-medium">{selectedCollector.vehicle.capacity}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Rating</p>
                <p className="font-medium flex items-center">
                  <span className="mr-1">{selectedCollector.rating}</span>
                  <span className="text-yellow-500">⭐</span>
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Today's Performance</p>
                <p className="font-medium">{selectedCollector.completedToday} completed, {selectedCollector.activeRequests} active</p>
              </div>
            </div>
            
            {/* Map with current location - In a real app, this would be an actual map */}
            {selectedCollector.currentLocation && (
              <div className="mb-6">
                <p className="text-gray-600 text-sm mb-2">Current Location</p>
                <div className="h-48 bg-gray-200 flex items-center justify-center rounded">
                  <p className="text-gray-500">Map with live location would be displayed here</p>
                  <p className="text-gray-500 text-sm">
                    Lat: {selectedCollector.currentLocation.lat.toFixed(4)}, 
                    Lng: {selectedCollector.currentLocation.lng.toFixed(4)}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowCollectorModal(false)}
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

export default RequestPickupManagement;
