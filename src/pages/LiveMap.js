import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import CollectorMapMarker from '../components/maps/CollectorMapMarker';
import ServiceAreaLayer from '../components/maps/ServiceAreaLayer';
import MapControls from '../components/maps/MapControls';
import CollectorDetailPanel from '../components/maps/CollectorDetailPanel';

import mockCollectorLocations from '../data/mockCollectorLocations';
import mockServiceAreas from '../data/mockServiceAreas';

// Mock data - would be replaced with Supabase data
const pickupLocations = [
  {
    id: 'req-001',
    location: { lat: 37.7749, lng: -122.4194 },
    status: 'New',
    address: '123 Main St, San Francisco, CA',
    customer: 'John Doe',
    phone: '(555) 123-4567',
    requestTime: '2025-06-21T09:15:00',
    priority: 'High',
    collector: null,
    wasteType: 'Recyclable'
  },
  {
    id: 'req-002',
    location: { lat: 37.7833, lng: -122.4167 },
    status: 'En Route',
    address: '456 Market St, San Francisco, CA',
    customer: 'Jane Smith',
    phone: '(555) 987-6543',
    requestTime: '2025-06-21T10:30:00',
    priority: 'Normal',
    collector: 'Mike Johnson',
    wasteType: 'Organic'
  },
  {
    id: 'req-003',
    location: { lat: 37.7694, lng: -122.4862 },
    status: 'Completed',
    address: '789 Sunset Ave, San Francisco, CA',
    customer: 'Robert Brown',
    phone: '(555) 246-8101',
    requestTime: '2025-06-20T14:45:00',
    priority: 'Normal',
    collector: 'Sarah Miller',
    wasteType: 'General Waste'
  },
  {
    id: 'req-004',
    location: { lat: 37.8044, lng: -122.4241 },
    status: 'Flagged',
    address: '321 Lombard St, San Francisco, CA',
    customer: 'Emma Wilson',
    phone: '(555) 135-7924',
    requestTime: '2025-06-22T08:00:00',
    priority: 'High',
    collector: 'James Taylor',
    wasteType: 'Hazardous'
  }
];

// Mock collectors data
const collectors = [
  { id: 1, name: 'Mike Johnson', active: true },
  { id: 2, name: 'Sarah Miller', active: true },
  { id: 3, name: 'James Taylor', active: true },
  { id: 4, name: 'Linda Davis', active: false },
  { id: 5, name: 'Carlos Rodriguez', active: true }
];

// Helper component to fix map invalidation issues
function MapInvalidator() {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }, [map]);
  
  return null;
}

// Create custom markers based on status
const getMarkerIcon = (status) => {
  // Color coding based on status
  const iconColor = 
    status === 'New' ? '#2196F3' :
    status === 'En Route' ? '#FF9800' :
    status === 'Completed' ? '#4CAF50' :
    status === 'Flagged' ? '#dc3545' : '#9E9E9E';
  
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div style="background-color: ${iconColor}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const LiveMap = () => {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [filters, setFilters] = useState({
    status: [],
    collector: [],
    priority: []
  });
  
  // Map display options
  const [mapMode, setMapMode] = useState('default'); // default or satellite
  const [showCollectors, setShowCollectors] = useState(true);
  const [showPickups, setShowPickups] = useState(true);
  const [showServiceAreas, setShowServiceAreas] = useState(true);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const mapContainerRef = useRef(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Load map data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // In a real app, this would fetch from Supabase
        setTimeout(() => {
          setLocations(pickupLocations);
          setCollectors(mockCollectorLocations);
          setServiceAreas(mockServiceAreas);
          setLoading(false);
        }, 800);
      } catch (error) {
        console.error('Error loading map data:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Reset map view to show all points
  const centerMap = () => {
    if (mapRef.current) {
      const map = mapRef.current;
      // San Francisco coordinates
      map.setView([37.7749, -122.4194], 13);
    }
  };
  
  const mapRef = useRef();
  
  // Handle collector selection
  const openCollectorDetailPanel = (collector) => {
    setSelectedCollector(collector);
    setShowDetailModal(false); // Close other details if open
  };

  // Filter locations based on current filters
  const filteredLocations = locations.filter(location => {
    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(location.status)) {
      return false;
    }
    
    // Collector filter (check if assigned to selected collector or any collector if none selected)
    if (filters.collector.length > 0) {
      if (!location.collector) return false;
      const collectorName = location.collector;
      const collectorExists = collectors.some(c => c.name === collectorName && filters.collector.includes(c.id.toString()));
      if (!collectorExists) return false;
    }
    
    // Priority filter
    if (filters.priority.length > 0 && !filters.priority.includes(location.priority)) {
      return false;
    }
    
    return true;
  });
  
  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    // Toggle the filter value
    const updatedFilters = { ...filters };
    
    if (updatedFilters[filterType].includes(value)) {
      updatedFilters[filterType] = updatedFilters[filterType].filter(item => item !== value);
    } else {
      updatedFilters[filterType].push(value);
    }
    
    setFilters(updatedFilters);
    
    // Show toast notification about filter results
    const activeFilterCount = Object.values(updatedFilters).flat().length;
    const filteredCount = locations.filter(location => {
      if (updatedFilters.status.length > 0 && !updatedFilters.status.includes(location.status)) return false;
      if (updatedFilters.priority.length > 0 && !updatedFilters.priority.includes(location.priority)) return false;
      if (updatedFilters.collector.length > 0) {
        if (!location.collector) return false;
        const collectorName = location.collector;
        return collectors.some(c => c.name === collectorName && updatedFilters.collector.includes(c.id.toString()));
      }
      return true;
    }).length;
    
    setToastMessage(`Showing ${filteredCount} of ${locations.length} locations ${activeFilterCount > 0 ? `(${activeFilterCount} filters applied)` : ''}`);
    setShowToast(true);
    
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };
  
  // Reset all filters
  const resetFilters = () => {
    setFilters({
      status: [],
      collector: [],
      priority: []
    });
    setToastMessage(`Showing all ${locations.length} locations`);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };
  
  // Handle marker click
  const handleMarkerClick = (location) => {
    setSelectedLocation(location);
  };
  
  // Open detail modal
  const openDetailModal = (location) => {
    setSelectedLocation(location);
    setShowDetailModal(true);
  };
  
  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Live Pickup Map</h1>
        <p className="text-gray-600">Real-time tracking of pickup requests and collectors</p>
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
      
      {/* Filters section - horizontal layout with 3-column grid */}
      <div className="bg-white rounded-lg shadow-sm border-0 p-4 mb-4">
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
          {/* Status filters */}
          <div>
            <p className="text-sm font-medium mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {['New', 'En Route', 'Completed', 'Flagged'].map(status => {
                const isActive = filters.status.includes(status);
                const statusColor = 
                  status === 'New' ? '#2196F3' :
                  status === 'En Route' ? '#FF9800' :
                  status === 'Completed' ? '#4CAF50' :
                  status === 'Flagged' ? '#dc3545' : '#9E9E9E';
                return (
                  <button
                    key={status}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isActive ? 'text-white' : 'text-gray-700'}`}
                    style={{ 
                      backgroundColor: isActive ? statusColor : 'white',
                      borderColor: statusColor
                    }}
                    onClick={() => handleFilterChange('status', status)}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Collector filters */}
          <div>
            <p className="text-sm font-medium mb-2">Collector</p>
            <div className="flex flex-wrap gap-2">
              {collectors
                .filter(c => c.active)
                .map(collector => {
                  const isActive = filters.collector.includes(collector.id.toString());
                  return (
                    <button
                      key={collector.id}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        isActive ? 'bg-blue-600 text-white' : 'text-gray-700'
                      }`}
                      style={{ borderColor: '#2196F3' }}
                      onClick={() => handleFilterChange('collector', collector.id.toString())}
                    >
                      {collector.name}
                    </button>
                  );
              })}
            </div>
          </div>
          
          {/* Priority filters */}
          <div>
            <p className="text-sm font-medium mb-2">Priority</p>
            <div className="flex flex-wrap gap-2">
              {['High', 'Normal', 'Low'].map(priority => {
                const isActive = filters.priority.includes(priority);
                const priorityColor = 
                  priority === 'High' ? '#dc3545' :
                  priority === 'Normal' ? '#FF9800' :
                  '#4CAF50';
                return (
                  <button
                    key={priority}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isActive ? 'text-white' : 'text-gray-700'}`}
                    style={{ 
                      backgroundColor: isActive ? priorityColor : 'white',
                      borderColor: priorityColor
                    }}
                    onClick={() => handleFilterChange('priority', priority)}
                  >
                    {priority}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Map Controls */}
      <MapControls 
        mapMode={mapMode}
        setMapMode={setMapMode}
        showCollectors={showCollectors}
        setShowCollectors={setShowCollectors}
        showPickups={showPickups}
        setShowPickups={setShowPickups}
        showServiceAreas={showServiceAreas}
        setShowServiceAreas={setShowServiceAreas}
        centerMap={centerMap}
      />
      
      {/* Map container and collector panel grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Map container - 2/3 width on md+ screens */}
        <div className="md:col-span-2 rounded-lg overflow-hidden" style={{ height: "600px" }}>
          {loading ? (
            <div className="bg-gray-100 h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <MapContainer 
              center={[37.7749, -122.4194]} 
              zoom={13} 
              style={{ height: "100%", width: "100%" }}
              ref={(ref) => {
                mapContainerRef.current = ref;
                mapRef.current = ref;
              }}
              preferCanvas={true}
            >
              {/* Map Tile Layer based on selected mode */}
              {mapMode === 'default' ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com">Esri</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}
              
              {/* Service Area Boundaries */}
              {showServiceAreas && serviceAreas.map(area => (
                <ServiceAreaLayer key={area.id} area={area} />
              ))}
              
              {/* Pickup Request Markers */}
              {showPickups && filteredLocations.map(location => (
                <Marker 
                  key={location.id} 
                  position={[location.location.lat, location.location.lng]}
                  icon={getMarkerIcon(location.status)}
                  eventHandlers={{
                    click: () => handleMarkerClick(location)
                  }}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-semibold">{location.address}</h3>
                      <p className="text-sm">Customer: {location.customer}</p>
                      <p className="text-sm">Status: <span className={`font-medium ${
                        location.status === 'Completed' ? 'text-green-600' :
                        location.status === 'En Route' ? 'text-orange-500' :
                        location.status === 'New' ? 'text-blue-600' :
                        'text-red-600'
                      }`}>{location.status}</span></p>
                      <button 
                        className="mt-2 text-blue-600 text-sm hover:underline"
                        onClick={() => openDetailModal(location)}
                      >
                        View Details
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              
              {/* Collector Markers */}
              {showCollectors && collectors.map(collector => (
                <React.Fragment key={collector.id}>
                  <CollectorMapMarker 
                    collector={collector} 
                    openDetailModal={openCollectorDetailPanel} 
                  />
                  
                  {/* Location history trail for active collectors */}
                  {collector.status === 'active' && collector.locationHistory && collector.locationHistory.length > 1 && (
                    <Polyline
                      positions={collector.locationHistory.map(pos => [pos.lat, pos.lng])}
                      pathOptions={{ color: '#3388ff', weight: 3, opacity: 0.6, dashArray: '10, 10' }}
                    />
                  )}
                </React.Fragment>
              ))}
              
              <MapInvalidator />
            </MapContainer>
        )}
        </div>
        
        {/* Collector side panel - 1/3 width on md+ screens */}
        <div className="md:col-span-1">
          {selectedCollector ? (
            <CollectorDetailPanel 
              collector={selectedCollector} 
              onClose={() => setSelectedCollector(null)} 
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border-0 p-4 h-full">
              <div className="flex items-center mb-4">
                <i className="fas fa-truck-moving text-blue-500 text-xl mr-3"></i>
                <h3 className="font-semibold">Collector Status</h3>
              </div>
              
              {/* Collector summary cards */}
              <div className="space-y-3">
                {collectors
                  .filter(c => c.status === 'active')
                  .map(collector => (
                    <div 
                      key={collector.id}
                      className="border border-gray-200 rounded p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => openCollectorDetailPanel(collector)}
                    >
                      <div className="flex items-center mb-2">
                        <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden mr-2">
                          <img 
                            src={collector.profilePic} 
                            alt={collector.name}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/40';
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{collector.name}</h4>
                          <p className="text-xs text-gray-500">{collector.assignedRegion}</p>
                        </div>
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${collector.capacityRemaining < 30 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {collector.capacityRemaining}% Cap
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between text-xs">
                        <div>
                          <span className="text-gray-500">Completed: </span>
                          <span className="font-medium">{collector.stats.completedToday}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Pending: </span>
                          <span className="font-medium">{collector.stats.pendingPickups}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Last update: </span>
                          <span className="font-medium">{new Date(collector.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                {collectors.filter(c => c.status === 'active').length === 0 && (
                  <div className="text-center py-6">
                    <div className="inline-flex rounded-full bg-gray-100 p-3 mb-3">
                      <i className="fas fa-user-clock text-gray-500 text-xl"></i>
                    </div>
                    <p className="text-gray-500">No active collectors</p>
                  </div>
                )}
              </div>
              
              {/* Inactive collectors section */}
              {collectors.filter(c => c.status === 'inactive').length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-sm text-gray-500 mb-2">Inactive Collectors</h4>
                  <div className="space-y-2">
                    {collectors
                      .filter(c => c.status === 'inactive')
                      .map(collector => (
                        <div 
                          key={collector.id}
                          className="border border-gray-100 bg-gray-50 rounded p-2 flex items-center"
                          onClick={() => openCollectorDetailPanel(collector)}
                        >
                          <div className="h-6 w-6 rounded-full bg-gray-200 overflow-hidden mr-2">
                            <img 
                              src={collector.profilePic} 
                              alt={collector.name}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/30';
                              }}
                            />
                          </div>
                          <p className="text-xs">{collector.name}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Detail Modal */}
      {showDetailModal && selectedLocation && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Pickup Request Details</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowDetailModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Request ID</p>
                  <p className="font-medium">{selectedLocation.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className={`font-medium ${
                    selectedLocation.status === 'Completed' ? 'text-green-600' :
                    selectedLocation.status === 'En Route' ? 'text-orange-500' :
                    selectedLocation.status === 'New' ? 'text-blue-600' :
                    'text-red-600'
                  }`}>{selectedLocation.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{selectedLocation.customer}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{selectedLocation.phone}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{selectedLocation.address}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Priority</p>
                  <p className={`font-medium ${
                    selectedLocation.priority === 'High' ? 'text-red-600' :
                    selectedLocation.priority === 'Normal' ? 'text-orange-500' :
                    'text-green-600'
                  }`}>{selectedLocation.priority}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Waste Type</p>
                  <p className="font-medium">{selectedLocation.wasteType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Request Time</p>
                  <p className="font-medium">{new Date(selectedLocation.requestTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Assigned Collector</p>
                  <p className="font-medium">{selectedLocation.collector || 'Not assigned'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Coordinates</p>
                  <p className="font-medium">{selectedLocation.location.lat}, {selectedLocation.location.lng}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <button 
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  onClick={() => setShowDetailModal(false)}
                >
                  Close
                </button>
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => {
                    alert('This would assign or update a collector in a real application');
                    setShowDetailModal(false);
                  }}
                >
                  Assign Collector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMap;
