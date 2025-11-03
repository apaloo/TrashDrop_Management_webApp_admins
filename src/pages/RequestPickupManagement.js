import React, { useState, useEffect } from 'react';
import { fetchPickupRequests, updatePickupRequest } from '../utils/pickupService';
import { fetchCollectors } from '../utils/collectorService';
import { alertsNotificationService } from '../services/alertsNotificationService';
import { STATUS } from '../config/constants';

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
  
  // Function to filter requests by status
  const getRequestsByStatus = (status) => {
    return requests.filter(request => request.status === status);
  };
  const [filterPriority, setFilterPriority] = useState('All');
  const [systemAlerts, setSystemAlerts] = useState([]);

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        console.log('Loading pickup requests with filter:', filterStatus !== 'All' ? filterStatus : null);
        // Fetch pickup requests
        const requestsData = await fetchPickupRequests({ status: filterStatus !== 'All' ? filterStatus : null });
        
        // Transform the data to match the expected structure with proper nested objects
        const formattedRequests = (requestsData || []).map(req => {
          // Handle customer/requester information
          const customerName = req?.customer || req?.requester?.name || 
            (req?.requestor?.first_name && req?.requestor?.last_name ? 
              `${req.requestor.first_name} ${req.requestor.last_name}` : 'Unknown');
          
          const customerEmail = req?.requester?.email || req?.requestor?.email || 'unknown@example.com';
          const customerPhone = req?.requester?.phone || req?.requestor?.phone || req?.phone || 'N/A';
          
          // Handle collector assignment information
          const collectorName = req?.collector ? 
            `${req.collector.first_name} ${req.collector.last_name}` : 
            req?.collectorName || null;
          
          return {
            id: req?.id || `request-${Math.random()}`,
            requesterId: req?.requester_id || req?.requested_by,
            
            // Create requestedBy object structure expected by UI
            requestedBy: {
              id: req?.requester_id || req?.requested_by,
              name: customerName,
              email: customerEmail,
              phone: customerPhone
            },
            
            // Create assignedTo object structure expected by UI  
            assignedTo: req?.collector_id ? {
              id: req?.collector_id,
              name: collectorName || 'Unknown Collector'
            } : null,
            
            status: req?.status || 'pending',
            priority: req?.priority || 'medium',
            location: {
              address: req?.location?.address || req?.address || 'Address not provided',
              coordinates: {
                lat: req?.location?.lat || req?.latitude || 5.6037,
                lng: req?.location?.lng || req?.longitude || -0.1870
              }
            },
            scheduledDate: req?.scheduled_date,
            createdAt: req?.created_at || req?.requestTime,
            updatedAt: req?.updated_at,
            notes: req?.notes || req?.specialInstructions || '',
            bagCount: req?.bag_count || req?.bags || 1,
            collectorId: req?.collector_id,
            wasteType: req?.waste_type || req?.wasteType || 'General',
            estimatedWeight: req?.estimated_weight || 'Not specified'
          };
        });
        
        setRequests(formattedRequests);
        
        // Fetch collectors - use new parameter format
        const collectorsData = await fetchCollectors({ 
          status: STATUS.COLLECTOR.ACTIVE, 
          limit: 50 
        });
        
        console.log('Loaded collectors:', collectorsData?.length || 0);
        
        // Only show active collectors for assignment
        setActiveCollectors(collectorsData.filter(c => c?.status === STATUS.COLLECTOR.ACTIVE));

        // Fetch alerts using alerts notification service
        const { data: alertsData, error } = await alertsNotificationService.getAlerts({
          limit: 50, // Get the most recent 50 alerts
          status: 'active',
          orderBy: 'created_at',
          order: 'desc'
        });
        
        if (error) {
          console.error('Error loading alerts:', error);
          setSystemAlerts([]);
        } else {
          setSystemAlerts(alertsData || []);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setRequests([]);
        setActiveCollectors([]);
        setSystemAlerts([]);
        setLoading(false);
      }
    };
    
    loadData();
  }, [filterStatus]);

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
    const matchesSearch = searchTerm === '' ||
      (request.requestedBy?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request.location?.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request.assignedTo?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = filterStatus === 'All' || request.status === filterStatus;
    const matchesPriority = filterPriority === 'All' || request.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Handle updating request status
  const updateRequestStatus = async (requestId, newStatus) => {
    if (!requestId) {
      console.error('No request ID provided for status update');
      return;
    }
    
    try {
      setLoading(true);
      console.log(`Updating request ${requestId} to status: ${newStatus}`);
      
      // Call the enhanced updatePickupRequest with status object
      const response = await updatePickupRequest(requestId, { status: newStatus });
      
      if (response && response.success) {
        console.log(`Successfully updated request ${requestId} status to ${newStatus}`, response);
        
        // Update local state
        setRequests(requests.map(req => 
          req.id === requestId ? { ...req, status: newStatus } : req
        ));
        
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest({ ...selectedRequest, status: newStatus });
        }
        
        // If it's a mock response, show a friendly notification
        if (response.mock) {
          console.info(`Using mock data for request ${requestId} update (database table may be unavailable)`);
        }
      } else {
        console.error('Error updating request status:', response?.error || 'Unknown error');
        // Show user-friendly toast/notification here if needed
      }
      
      setLoading(false);
      setShowRequestModal(false);
    } catch (error) {
      console.error('Error updating request status:', error);
      setLoading(false);
    }
  };

  // Handle assigning collector to request
  const assignCollector = async (requestId, collector) => {
    if (!requestId || !collector) {
      console.error('Missing request ID or collector for assignment');
      return;
    }
    
    try {
      setLoading(true);
      console.log(`Assigning collector ${collector?.id || 'unknown'} to request ${requestId}`);
      
      // Prepare update data with collector info and timestamps
      const updateData = { 
        collector_id: collector?.id || 'unknown',
        status: STATUS.COLLECTOR.ASSIGNED,
        assigned_at: new Date().toISOString(),
        collector_name: collector?.name || 'Unknown Collector',
        collector_phone: collector?.phone || null,
        collector_rating: collector?.rating || 0,
        collector_vehicle_type: collector?.vehicle?.type || 'Unknown',
        collector_vehicle_plate: collector?.vehicle?.plate || 'Unknown'
      };
      
      // Call enhanced updatePickupRequest with structured data
      const response = await updatePickupRequest(requestId, updateData);
      
      if (response && response.success) {
        console.log(`Successfully assigned collector to request ${requestId}:`, response);
        
        // Get vehicle data with safe fallbacks
        const vehicleType = collector?.vehicle?.type || 'Standard';
        const vehiclePlate = collector?.vehicle?.plate || 'Unknown';
        
        // Update local state with comprehensive object structure
        setRequests(requests.map(req => {
          if (req.id === requestId) {
            return { 
              ...req, 
              collectorId: collector?.id || 'unknown',
              assignedTo: {
                id: collector?.id || 'unknown',
                name: collector?.name || 'Unknown Collector',
                phone: collector?.phone || null,
                email: collector?.email || null,
                vehicle: {
                  type: vehicleType,
                  plate: vehiclePlate,
                  capacity: collector?.vehicle?.capacity || 'Standard'
                },
                rating: collector?.rating || 0
              },
              status: STATUS.COLLECTOR.ASSIGNED,
              assignedAt: response.assigned_at || new Date().toISOString()
            };
          }
          return req;
        }));
        
        // Update selected request if this is the one being viewed
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest({
            ...selectedRequest,
            collectorId: collector?.id || 'unknown',
            assignedTo: {
              id: collector?.id || 'unknown',
              name: collector?.name || 'Unknown Collector',
              phone: collector?.phone || null,
              email: collector?.email || null,
              vehicle: {
                type: collector?.vehicle?.type || 'Standard',
                plate: collector?.vehicle?.plate || 'Unknown',
                capacity: collector?.vehicle?.capacity || 'Standard'
              },
              rating: collector?.rating || 0
            },
            status: STATUS.COLLECTOR.ASSIGNED,
            assignedAt: response.assigned_at || new Date().toISOString()
          });
        }
        
        // If it was a mock response, log it
        if (response.mock) {
          console.info(`Using mock data for collector assignment (database table may be unavailable)`);
        }
      } else {
        console.error('Error assigning collector:', response?.error || 'Unknown error');
        // Show user-friendly toast/notification here if needed
      }
      
      setLoading(false);
      setShowRequestModal(false);
    } catch (error) {
      console.error('Error assigning collector:', error);
      setLoading(false);
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
            <p className="text-2xl font-bold">{getRequestsByStatus(STATUS.PICKUP_REQUEST.PENDING).length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">In Progress</p>
            <p className="text-2xl font-bold">{getRequestsByStatus(STATUS.PICKUP_REQUEST.IN_PROGRESS).length}</p>
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
              .filter(alert => alert.status === STATUS.ALERT.ACTIVE)
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
            <option value={STATUS.PICKUP_REQUEST.PENDING}>Pending</option>
            <option value={STATUS.PICKUP_REQUEST.IN_PROGRESS}>In Progress</option>
            <option value={STATUS.PICKUP_REQUEST.COMPLETED}>Completed</option>
            <option value={STATUS.PICKUP_REQUEST.CANCELLED}>Cancelled</option>
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
                    <span 
                      className="cursor-pointer text-blue-600 hover:text-blue-800"
                      onClick={() => handleViewRequest(request)}
                    >
                      {request.id}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.requestedBy?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="truncate max-w-xs">
                      {request.location?.address || 'Address not provided'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.wasteType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      request.status === STATUS.PICKUP_REQUEST.COMPLETED ? 'bg-green-100 text-green-800' :
                      request.status === STATUS.PICKUP_REQUEST.IN_PROGRESS ? 'bg-blue-100 text-blue-800' :
                      request.status === STATUS.PICKUP_REQUEST.PENDING ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.assignedTo ? (
                      <span 
                        className="cursor-pointer text-blue-600 hover:text-blue-800"
                        onClick={() => handleViewCollector(request.assignedTo)}
                      >
                        {request.assignedTo?.name || 'Unknown Collector'}
                      </span>
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
                <h3 className="font-medium">{collector?.name || 'Unknown Collector'}</h3>
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
                <p className="font-medium">{selectedRequest.requestedBy?.name || 'Unknown Customer'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Customer Contact</p>
                <p className="font-medium">{selectedRequest.requestedBy?.email || 'No email provided'}</p>
                <p className="text-sm">{selectedRequest.requestedBy?.phone || 'No phone provided'}</p>
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
                  selectedRequest.status === STATUS.PICKUP_REQUEST.COMPLETED ? 'text-green-600' : 
                  selectedRequest.status === STATUS.PICKUP_REQUEST.CANCELLED ? 'text-red-600' : 
                  selectedRequest.status === STATUS.PICKUP_REQUEST.IN_PROGRESS ? 'text-blue-600' :
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
                <p className="font-medium">{selectedRequest.location?.address || 'Address not provided'}</p>
                <p className="text-sm text-gray-500">
                  Lat: {selectedRequest.location?.lat?.toFixed(4) || 'N/A'}, Lng: {selectedRequest.location?.lng?.toFixed(4) || 'N/A'}
                </p>
              </div>
              {selectedRequest.assignedTo && (
                <div>
                  <p className="text-gray-600 text-sm">Assigned To</p>
                  <p className="font-medium">{selectedRequest.assignedTo?.name || 'Unknown Collector'}</p>
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
            {selectedRequest.status !== STATUS.PICKUP_REQUEST.COMPLETED && selectedRequest.status !== STATUS.PICKUP_REQUEST.CANCELLED && (
              <div className="border-t pt-4 mb-4">
                <h3 className="font-medium mb-2">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {/* Assign a collector dropdown */}
                  {selectedRequest.status === STATUS.PICKUP_REQUEST.PENDING && (
                    <div className="mt-4">
                      <label className="text-gray-600 text-sm">Assign Collector</label>
                      <div className="flex space-x-2 mt-1">
                        <select 
                          className="form-select flex-grow px-3 py-2 border rounded"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const collector = activeCollectors.find(c => c.id === e.target.value);
                              if (collector) {
                                // Validate collector data before assignment
                                if (!collector.id) {
                                  console.error('Cannot assign collector with invalid ID');
                                  return;
                                }
                                assignCollector(selectedRequest.id, collector);
                              } else {
                                console.warn(`Collector with ID ${e.target.value} not found in active collectors list`);
                              }
                            }
                          }}
                          disabled={loading}
                        >
                          <option value="">{loading ? 'Assigning...' : 'Select a collector'}</option>
                          {activeCollectors.map(collector => (
                            <option 
                              key={collector?.id || `collector-${Math.random()}`} 
                              value={collector?.id || ''}
                              disabled={!collector?.id}
                            >
                              {collector?.name || 'Unknown'} ({collector?.activeRequests || 0} active)
                              {collector?.vehicle?.type ? ` - ${collector?.vehicle?.type}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  {selectedRequest.status === STATUS.PICKUP_REQUEST.PENDING && (
                    <button
                      onClick={() => updateRequestStatus(selectedRequest.id, STATUS.PICKUP_REQUEST.IN_PROGRESS)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Start Pickup
                    </button>
                  )}
                  
                  {selectedRequest.status === STATUS.PICKUP_REQUEST.IN_PROGRESS && (
                    <button
                      onClick={() => updateRequestStatus(selectedRequest.id, STATUS.PICKUP_REQUEST.COMPLETED)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Mark as Completed
                    </button>
                  )}
                  
                  <button
                    onClick={() => updateRequestStatus(selectedRequest.id, STATUS.PICKUP_REQUEST.CANCELLED)}
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
              <h2 className="text-xl font-semibold">Collector Profile: {selectedCollector?.name || 'Unknown'}</h2>
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
                <p className="font-medium">{selectedCollector?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <p className={`font-medium ${
                  selectedCollector?.status === STATUS.COLLECTOR.ACTIVE ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {selectedCollector?.status || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Email</p>
                <p className="font-medium">{selectedCollector?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Phone</p>
                <p className="font-medium">{selectedCollector?.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Vehicle</p>
                <p className="font-medium">{selectedCollector?.vehicle?.type || 'N/A'} ({selectedCollector?.vehicle?.plate || 'N/A'})</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Capacity</p>
                <p className="font-medium">{selectedCollector?.vehicle?.capacity || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Rating</p>
                <p className="font-medium flex items-center">
                  <span className="mr-1">{selectedCollector?.rating || 'N/A'}</span>
                  <span className="text-yellow-500">⭐</span>
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Today's Performance</p>
                <p className="font-medium">{selectedCollector?.completedToday || 0} completed, {selectedCollector?.activeRequests || 0} active</p>
              </div>
            </div>
            
            {/* Map with current location - In a real app, this would be an actual map */}
            {selectedCollector?.currentLocation && (
              <div className="mb-6">
                <p className="text-gray-600 text-sm mb-2">Current Location</p>
                <div className="h-48 bg-gray-200 flex items-center justify-center rounded">
                  <p className="text-gray-500">Map with live location would be displayed here</p>
                  <p className="text-gray-500 text-sm">
                    Lat: {selectedCollector?.currentLocation?.lat?.toFixed(4) || 'N/A'}, 
                    Lng: {selectedCollector?.currentLocation?.lng?.toFixed(4) || 'N/A'}
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
