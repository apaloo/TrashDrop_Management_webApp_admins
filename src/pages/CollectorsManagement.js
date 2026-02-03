import React, { useState, useEffect } from 'react';
import { fetchCollectors, updateCollectorStatus } from '../utils/collectorService';
import { createCollector, updateCollector } from '../utils/databaseUtils';
import { STATUS } from '../config/constants';

// All collector data is fetched from Supabase - no mock data

const CollectorsManagement = () => {
  // State for collectors data
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for filtering and sorting
  const [filters, setFilters] = useState({
    status: 'all', // 'all', STATUS.COLLECTOR.ACTIVE.toLowerCase(), STATUS.COLLECTOR.INACTIVE.toLowerCase()
    searchQuery: '',
    region: 'all'
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'name',
    direction: 'asc'
  });
  
  // State for modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  // Load collector data from Supabase
  useEffect(() => {
    const loadCollectors = async () => {
      try {
        setLoading(true);
        
        // Fetch collectors from Supabase using service options
        const data = await fetchCollectors({
          status: filters.status !== 'all' ? filters.status : null,
          region: filters.region !== 'all' ? filters.region : null,
          limit: 100
        });

        // Transform data to match the expected structure used in this component
        const formattedCollectors = (data || []).map(collector => {
          // The service returns a UI-friendly object with fields like name, profilePic, joined_date, total_collections, etc.
          const vehicleInfo = collector.vehicle
            ? `${collector.vehicle.type || 'Vehicle'} - ${collector.vehicle.plate || 'N/A'} - ${collector.vehicle.capacity || ''}`.trim()
            : (collector.vehicle_info || '');

          return {
            id: collector.id,
            name: collector.name || `${collector.first_name || ''} ${collector.last_name || ''}`.trim() || 'Unknown',
            email: collector.email,
            phone: collector.phone,
            status: collector.status,
            region: collector.region,
            completedPickups: collector.total_collections ?? collector.completed_pickups ?? 0,
            rating: collector.rating ?? 5.0,
            joinDate: collector.joined_date || collector.join_date,
            lastActive: collector.last_active,
            vehicleInfo,
            notes: collector.notes || '',
            avatar: collector.profilePic || collector.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'
          };
        });

        setCollectors(formattedCollectors);
      } catch (err) {
        console.error('Error fetching collectors:', err);
        setError('Failed to load collectors. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadCollectors();
  }, [filters.status, filters.region]);  // Re-fetch when status or region filter changes
  
  // Handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  // Apply sorting to collectors
  const sortedCollectors = React.useMemo(() => {
    const sortableCollectors = [...collectors];
    if (sortConfig.key) {
      sortableCollectors.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableCollectors;
  }, [collectors, sortConfig]);
  
  // Filter collectors based on current filters
  const filteredCollectors = React.useMemo(() => {
    return sortedCollectors.filter(collector => {
      // Status filter
      if (filters.status !== 'all' && collector.status !== filters.status) {
        return false;
      }
      
      // Region filter
      if (filters.region !== 'all' && collector.region !== filters.region) {
        return false;
      }
      
      // Search query filter (match name, email, ID)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          collector.name.toLowerCase().includes(query) ||
          collector.email.toLowerCase().includes(query) ||
          collector.id.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [sortedCollectors, filters]);
  
  // Get unique regions for filter dropdown
  const regions = React.useMemo(() => {
    const regionSet = new Set(collectors.map(c => c.region));
    return ['all', ...Array.from(regionSet)];
  }, [collectors]);
  
  // Handler for filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };
  
  // State for new/edited collector
  const [collectorForm, setCollectorForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: STATUS.COLLECTOR.ACTIVE.toLowerCase(),
    region: 'North District',
    vehicleInfo: '',
    notes: '',
    avatar: 'https://randomuser.me/api/portraits/lego/1.jpg' // Default avatar
  });

  // Handle form changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setCollectorForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add new collector
  const handleAddCollector = async () => {
    // Validate form fields
    if (!collectorForm.name || !collectorForm.email || !collectorForm.phone) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      // Parse name into first_name and last_name
      const nameParts = collectorForm.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      
      // Prepare data for database
      const collectorData = {
        first_name: firstName,
        last_name: lastName || '',
        email: collectorForm.email,
        phone: collectorForm.phone,
        status: collectorForm.status,
        region: collectorForm.region,
        vehicle_info: collectorForm.vehicleInfo,
        notes: collectorForm.notes,
        avatar_url: collectorForm.avatar,
        join_date: new Date().toISOString().split('T')[0],
        last_active: new Date().toISOString(),
        completed_pickups: 0,
        rating: 5.0
      };
      
      // Submit to Supabase
      const newCollector = await createCollector(collectorData);
      
      // Add to UI state with proper formatting
      const formattedNewCollector = {
        id: newCollector.id,
        name: `${newCollector.first_name} ${newCollector.last_name}`,
        email: newCollector.email,
        phone: newCollector.phone,
        status: newCollector.status,
        region: newCollector.region,
        completedPickups: newCollector.completed_pickups || 0,
        rating: newCollector.rating || 5.0,
        joinDate: newCollector.join_date,
        lastActive: newCollector.last_active,
        vehicleInfo: newCollector.vehicle_info,
        notes: newCollector.notes || '',
        avatar: newCollector.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'
      };
      
      setCollectors([...collectors, formattedNewCollector]);
      setShowAddModal(false);
      
      // Reset form
      setCollectorForm({
        name: '',
        email: '',
        phone: '',
        status: STATUS.COLLECTOR.ACTIVE.toLowerCase(),
        region: 'North District',
        vehicleInfo: '',
        notes: '',
        avatar: 'https://randomuser.me/api/portraits/lego/1.jpg'
      });
    } catch (error) {
      console.error('Error creating collector:', error);
      alert('Failed to create collector. Please try again.');
    }
  };

  // Update existing collector
  const handleUpdateCollector = async () => {
    if (!selectedCollector) return;
    
    // Validate form fields
    if (!collectorForm.name || !collectorForm.email || !collectorForm.phone) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      // Parse name into first_name and last_name
      const nameParts = collectorForm.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      
      // Prepare data for database
      const collectorData = {
        id: selectedCollector.id,
        first_name: firstName,
        last_name: lastName || '',
        email: collectorForm.email,
        phone: collectorForm.phone,
        status: collectorForm.status,
        region: collectorForm.region,
        vehicle_info: collectorForm.vehicleInfo,
        notes: collectorForm.notes,
        avatar_url: collectorForm.avatar
      };
      
      // Submit update to Supabase
      await updateCollector(collectorData);
      
      // Update the collector in the UI
      const updatedCollectors = collectors.map(c => 
        c.id === selectedCollector.id ? { ...c, ...collectorForm } : c
      );
      
      setCollectors(updatedCollectors);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating collector:', error);
      alert('Failed to update collector. Please try again.');
    }
  };

  // Set form data when edit modal opens
  useEffect(() => {
    if (selectedCollector && showEditModal) {
      setCollectorForm({
        name: selectedCollector.name,
        email: selectedCollector.email,
        phone: selectedCollector.phone,
        status: selectedCollector.status,
        region: selectedCollector.region,
        vehicleInfo: selectedCollector.vehicleInfo,
        notes: selectedCollector.notes,
        avatar: selectedCollector.avatar
      });
    }
  }, [selectedCollector, showEditModal]);
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Collectors Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center"
        >
          <i className="fas fa-plus mr-2"></i>
          Add Collector
        </button>
      </div>
      
      {/* Filters and search section */}
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
                placeholder="Search by name, email or ID..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
              />
            </div>
          </div>
          
          {/* Status filter */}
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value={STATUS.COLLECTOR.ACTIVE.toLowerCase()}>{STATUS.COLLECTOR.ACTIVE}</option>
              <option value={STATUS.COLLECTOR.INACTIVE.toLowerCase()}>{STATUS.COLLECTOR.INACTIVE}</option>
            </select>
          </div>
          
          {/* Region filter */}
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <select
              className="w-full py-2 px-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
            >
              <option value="all">All Regions</option>
              {regions.filter(r => r !== 'all').map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          
          {/* Clear filters button */}
          <button
            className="px-4 py-2 text-blue-600 hover:text-blue-800 border border-blue-600 hover:border-blue-800 rounded-md"
            onClick={() => setFilters({ status: 'all', searchQuery: '', region: 'all' })}
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

      {/* View Details Modal */}
      {showDetailsModal && selectedCollector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="border-b p-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Collector Details</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowDetailsModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-4">
                <img src={selectedCollector.avatar} alt={selectedCollector.name} className="w-16 h-16 rounded-full object-cover border" />
                <div>
                  <h3 className="text-xl font-medium">{selectedCollector.name}</h3>
                  <p className="text-sm text-gray-600">{selectedCollector.region}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium break-words">{selectedCollector.email}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium">{selectedCollector.phone}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium capitalize">{selectedCollector.status}</p>
                </div>
                <div>
                  <p className="text-gray-500">Join Date</p>
                  <p className="font-medium">{new Date(selectedCollector.joinDate).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Vehicle</p>
                  <p className="font-medium">{selectedCollector.vehicleInfo || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Notes</p>
                  <p className="font-medium whitespace-pre-wrap">{selectedCollector.notes || '—'}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button className="px-4 py-2 border text-gray-700 rounded-md hover:bg-gray-50" onClick={() => setShowDetailsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Pickups Modal */}
      {showAssignModal && selectedCollector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="border-b p-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Assign Pickups</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowAssignModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">Assign pickups to <span className="font-medium">{selectedCollector.name}</span>.</p>
              {/* Placeholder content - integrate with real assignment flow later */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
                <textarea className="w-full p-2 border rounded" rows="3" placeholder="Add assignment notes..." />
              </div>
              <div className="flex justify-end space-x-3">
                <button className="px-4 py-2 border text-gray-700 rounded-md hover:bg-gray-50" onClick={() => setShowAssignModal(false)}>Cancel</button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" onClick={() => setShowAssignModal(false)}>Assign</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border-0 p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading collectors...</p>
        </div>
      ) : filteredCollectors.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border-0 p-6 text-center">
          <div className="rounded-full bg-gray-200 h-16 w-16 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-user-slash text-gray-400 text-2xl"></i>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No collectors found</h3>
          <p className="text-gray-500 mt-1">
            {filters.searchQuery || filters.status !== 'all' || filters.region !== 'all'
              ? 'Try adjusting your filters or search query'
              : 'Add a collector to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
          {/* Collectors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredCollectors.map((collector) => (
              <div 
                key={collector.id} 
                className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex items-center p-4 border-b relative">
                  <div className="relative">
                    <img
                      src={collector.avatar}
                      alt={collector.name}
                      className="w-16 h-16 rounded-full object-cover border-2"
                      style={{ borderColor: collector.status === STATUS.COLLECTOR.ACTIVE.toLowerCase() ? '#4CAF50' : '#9E9E9E' }}
                    />
                    <span 
                      className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${collector.status === STATUS.COLLECTOR.ACTIVE.toLowerCase() ? 'bg-green-500' : 'bg-gray-400'}`}
                    ></span>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-medium text-lg">{collector.name}</h3>
                    <p className="text-sm text-gray-600">{collector.region}</p>
                    <span 
                      className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${collector.status === STATUS.COLLECTOR.ACTIVE.toLowerCase() ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {collector.status === STATUS.COLLECTOR.ACTIVE.toLowerCase() ? STATUS.COLLECTOR.ACTIVE : STATUS.COLLECTOR.INACTIVE}
                    </span>
                  </div>
                  <div>
                    <button 
                      className="p-1 hover:bg-gray-100 rounded-full"
                      onClick={() => {
                        setSelectedCollector(collector);
                        setShowEditModal(true);
                      }}
                    >
                      <i className="fas fa-pen text-gray-500"></i>
                    </button>
                  </div>
                </div>
                
                <div className="p-4 grid grid-cols-2 gap-y-2 text-sm">
                  <div>
                    <p className="text-gray-500">ID</p>
                    <p className="font-medium">{collector.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Join Date</p>
                    <p className="font-medium">{new Date(collector.joinDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium truncate">{collector.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="font-medium">{collector.phone}</p>
                  </div>
                </div>
                
                <div className="border-t px-4 py-3 bg-gray-50 flex justify-between items-center">
                  <div>
                    <div className="flex items-center">
                      <i className="fas fa-star text-yellow-400 mr-1 text-xs"></i>
                      <span className="font-medium">{collector.rating}</span>
                      <span className="text-gray-500 text-sm ml-1">rating</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-sm">Pickups</p>
                    <p className="font-medium">{collector.completedPickups}</p>
                  </div>
                </div>
                
                <div className="border-t px-4 py-3 flex justify-center">
                  <button 
                    className="text-blue-600 hover:text-blue-800 mr-6 text-sm flex items-center"
                    onClick={() => {
                      setSelectedCollector(collector);
                      setShowDetailsModal(true);
                    }}
                  >
                    <i className="fas fa-eye mr-1"></i> View Details
                  </button>
                  
                  <button 
                    className="text-blue-600 hover:text-blue-800 mr-6 text-sm flex items-center"
                    onClick={() => {
                      setSelectedCollector(collector);
                      setShowAssignModal(true);
                    }}
                  >
                    <i className="fas fa-tasks mr-1"></i> Assign Pickups
                  </button>
                  
                  <button 
                    className={`${collector.status === STATUS.COLLECTOR.ACTIVE.toLowerCase() ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'} text-sm flex items-center`}
                    onClick={async () => {
                      const newStatus = collector.status === STATUS.COLLECTOR.ACTIVE.toLowerCase()
                        ? STATUS.COLLECTOR.INACTIVE.toLowerCase()
                        : STATUS.COLLECTOR.ACTIVE.toLowerCase();
                      try {
                        await updateCollectorStatus(collector.id, newStatus);
                        setCollectors(prev => prev.map(c => c.id === collector.id ? { ...c, status: newStatus } : c));
                      } catch (e) {
                        console.error('Failed to toggle status', e);
                        alert('Failed to update status.');
                      }
                    }}
                  >
                    <i className={`fas ${collector.status === STATUS.COLLECTOR.ACTIVE.toLowerCase() ? 'fa-user-slash' : 'fa-user-check'} mr-1`}></i> 
                    {collector.status === STATUS.COLLECTOR.ACTIVE.toLowerCase() ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Results summary */}
          <div className="bg-gray-50 px-4 py-3 border-t">
            <p className="text-sm text-gray-600">
              Showing {filteredCollectors.length} of {collectors.length} collectors
              {(filters.status !== 'all' || filters.searchQuery || filters.region !== 'all') && ' (filtered)'}
            </p>
          </div>
        </div>
      )}
      
      {/* Add Collector Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="border-b p-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Add New Collector</h2>
              <button 
                className="text-gray-500 hover:text-gray-700" 
                onClick={() => setShowAddModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={collectorForm.name}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={collectorForm.email}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    name="phone"
                    value={collectorForm.phone}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={collectorForm.status}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={STATUS.COLLECTOR.ACTIVE.toLowerCase()}>{STATUS.COLLECTOR.ACTIVE}</option>
                    <option value={STATUS.COLLECTOR.INACTIVE.toLowerCase()}>{STATUS.COLLECTOR.INACTIVE}</option>
                  </select>
                </div>
                
                {/* Region */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                  <select
                    name="region"
                    value={collectorForm.region}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option>North District</option>
                    <option>South District</option>
                    <option>East District</option>
                    <option>West District</option>
                    <option>Central District</option>
                  </select>
                </div>
                
                {/* Vehicle Info */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Information</label>
                  <input
                    type="text"
                    name="vehicleInfo"
                    value={collectorForm.vehicleInfo}
                    onChange={handleFormChange}
                    placeholder="Vehicle make, model, color, license plate"
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    name="notes"
                    value={collectorForm.notes}
                    onChange={handleFormChange}
                    rows="3"
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add any relevant notes about this collector"
                  ></textarea>
                </div>
              </div>
              
              <div className="flex justify-end mt-6 space-x-3">
                <button
                  className="px-4 py-2 border text-gray-700 rounded-md hover:bg-gray-50"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  onClick={handleAddCollector}
                >
                  Add Collector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Collector Modal */}
      {showEditModal && selectedCollector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="border-b p-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Edit Collector</h2>
              <button 
                className="text-gray-500 hover:text-gray-700" 
                onClick={() => setShowEditModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={collectorForm.name}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={collectorForm.email}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    name="phone"
                    value={collectorForm.phone}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={collectorForm.status}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={STATUS.COLLECTOR.ACTIVE.toLowerCase()}>{STATUS.COLLECTOR.ACTIVE}</option>
                    <option value={STATUS.COLLECTOR.INACTIVE.toLowerCase()}>{STATUS.COLLECTOR.INACTIVE}</option>
                  </select>
                </div>
                
                {/* Region */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                  <select
                    name="region"
                    value={collectorForm.region}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option>North District</option>
                    <option>South District</option>
                    <option>East District</option>
                    <option>West District</option>
                    <option>Central District</option>
                  </select>
                </div>
                
                {/* Vehicle Info */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Information</label>
                  <input
                    type="text"
                    name="vehicleInfo"
                    value={collectorForm.vehicleInfo}
                    onChange={handleFormChange}
                    placeholder="Vehicle make, model, color, license plate"
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    name="notes"
                    value={collectorForm.notes}
                    onChange={handleFormChange}
                    rows="3"
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add any relevant notes about this collector"
                  ></textarea>
                </div>
                
                {/* ID Display (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                  <input
                    type="text"
                    value={selectedCollector.id}
                    className="w-full p-2 border rounded bg-gray-50"
                    disabled
                  />
                </div>
                
                {/* Join Date Display (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
                  <input
                    type="text"
                    value={new Date(selectedCollector.joinDate).toLocaleDateString()}
                    className="w-full p-2 border rounded bg-gray-50"
                    disabled
                  />
                </div>
              </div>
              
              <div className="flex justify-end mt-6 space-x-3">
                <button
                  className="px-4 py-2 border text-gray-700 rounded-md hover:bg-gray-50"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={handleUpdateCollector}
                >
                  Update Collector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CollectorsManagementComponent = CollectorsManagement;
export { CollectorsManagementComponent as default };
