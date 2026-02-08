/* eslint-disable no-console */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import CollectorMapMarker from '../components/maps/CollectorMapMarker';
import CollectorDetailPanel from '../components/maps/CollectorDetailPanel';
import { fetchCollectors, updateCollectorStatus, fetchCollectorById } from '../utils/collectorService';
import { fetchPickupRequests, subscribeToPickupUpdates } from '../utils/pickupService';
import { digitalBinService } from '../services/digitalBinService';
import { supabase } from '../utils/supabase';

// Default coordinates for Accra, Ghana
const DEFAULT_COORDINATES = {
  lat: 5.6037,
  lng: -0.1870,
  zoom: 12
};

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
    status === 'available' ? '#4CAF50' :  // Green for available
    status === 'New' ? '#2196F3' :        // Blue for new
    status === 'En Route' ? '#FF9800' :   // Orange for en route
    status === 'Completed' ? '#4CAF50' :  // Green for completed
    status === 'Flagged' ? '#dc3545' :    // Red for flagged
    '#9E9E9E';                            // Gray for unknown
  
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div style="background-color: ${iconColor}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const LiveMap = () => {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]); // pickup_requests
  const [digitalBins, setDigitalBins] = useState([]); // digital_bins
  const [collectors, setCollectors] = useState([]);
  const [filters, setFilters] = useState({
    status: [],
    collector: [],
    priority: []
  });
  
  // Map display options
  const [mapMode, setMapMode] = useState('default'); // default or satellite
  const [showCollectors, setShowCollectors] = useState(true);
  const [showPickups, setShowPickups] = useState(true);
  const [showDigitalBins, setShowDigitalBins] = useState(true);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const mapContainerRef = useRef(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Load map data
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all data in parallel
        const [collectorsData, pickupRequests, digitalBinsResponse] = await Promise.all([
          fetchCollectors(),
          fetchPickupRequests({ limit: 50 }), // Limit to 50 most recent requests
          digitalBinService.fetchDigitalBins({ limit: 100, status: 'all' }).catch(err => {
            console.error('❌ Digital bins fetch failed:', err);
            console.error('Error details:', err.message, err.stack);
            return { data: [], totalCount: 0 };
          })
        ]);
        
        if (!isMounted) return;
        
        // Extract data array from paginated response
        console.log('🗑️ Digital bins response:', digitalBinsResponse);
        const digitalBinsData = digitalBinsResponse?.data || [];
        console.log('🗑️ Raw digital bins data:', digitalBinsData.length, 'bins');
        console.log('🗑️ Sample digital bin:', digitalBinsData[0]);
        
        const processedPickupRequests = pickupRequests;
        const processedDigitalBins = digitalBinsData;
        
        setCollectors(collectorsData);
        setLocations(processedPickupRequests);
        setDigitalBins(processedDigitalBins);
        
        console.log('📍 LiveMap data loaded:', {
          pickupRequests: processedPickupRequests.length,
          digitalBins: processedDigitalBins.length,
          collectors: collectorsData.length
        });
        
      } catch (error) {
        console.error('Error loading map data:', error);
        setToastMessage('Failed to load data. Some features may be limited.');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Set up real-time subscriptions
    const subscriptions = [];
    
    // Subscribe to collector updates
    const collectorChannel = supabase.channel('collector_profile_updates');
    collectorChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collector_profiles' },
        async () => {
          try {
            const updatedCollectors = await fetchCollectors();
            if (isMounted) {
              setCollectors(updatedCollectors);
            }
          } catch (error) {
            console.error('Error updating collectors:', error);
          }
        }
      )
      .subscribe();
    
    // Subscribe to pickup request updates
    const pickupSubscription = subscribeToPickupUpdates(async () => {
      try {
        const updatedPickups = await fetchPickupRequests({ limit: 50 });
        if (isMounted) {
          setLocations(updatedPickups);
        }
      } catch (error) {
        console.error('Error updating pickup requests:', error);
      }
    });
    
    // Subscribe to digital bin updates
    const digitalBinSubscription = digitalBinService.subscribe('bin_updated', async () => {
      try {
        const response = await digitalBinService.fetchDigitalBins({ limit: 100, status: 'active' });
        if (isMounted) {
          setDigitalBins(response?.data || []);
        }
      } catch (error) {
        console.error('Error updating digital bins:', error);
      }
    });
    
    // Store subscriptions for cleanup
    subscriptions.push(
      { unsubscribe: () => supabase.removeChannel(collectorChannel) },
      pickupSubscription,
      digitalBinSubscription
    );
    
    // Clean up on unmount
    return () => {
      isMounted = false;
      subscriptions.forEach(sub => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
    };
  }, []);
  
  // Reset map view to show all points (pickup requests + digital bins)
  const centerMap = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      
      // Collect all points from both pickup requests and digital bins
      const allPoints = [];
      
      // Add pickup request locations
      if (locations && locations.length > 0) {
        locations.forEach(loc => {
          if (loc.location?.lat && loc.location?.lng) {
            allPoints.push([loc.location.lat, loc.location.lng]);
          }
        });
      }
      
      // Add digital bin locations
      if (digitalBins && digitalBins.length > 0) {
        digitalBins.forEach(bin => {
          if (bin.location?.lat && bin.location?.lng) {
            allPoints.push([bin.location.lat, bin.location.lng]);
          } else if (bin.latitude && bin.longitude) {
            // Alternative field names
            allPoints.push([bin.latitude, bin.longitude]);
          }
        });
      }
      
      // Calculate bounds from all points
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        
        if (!bounds.isValid()) {
          // Fallback to default coordinates if bounds are invalid
          map.setView([DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lng], DEFAULT_COORDINATES.zoom);
        } else if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          // If all points are the same, just center on that point
          map.setView(bounds.getCenter(), 15);
        } else {
          // Fit bounds with padding
          map.fitBounds(bounds, { 
            padding: [50, 50],
            maxZoom: 15
          });
        }
      } else {
        // Fallback to default coordinates if no points
        map.setView([DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lng], DEFAULT_COORDINATES.zoom);
      }
    }
  }, [locations, digitalBins]);
  
  const mapRef = useRef();
  
  // Auto-center map when data loads or changes
  useEffect(() => {
    if (!loading && (locations.length > 0 || digitalBins.length > 0)) {
      // Small delay to ensure map is fully rendered
      const timer = setTimeout(() => {
        centerMap();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, locations, digitalBins, centerMap]);
  
  // Handle collector selection
  const openCollectorDetailPanel = async (collector) => {
    try {
      // Fetch the latest collector data when selected
      const updatedCollector = await fetchCollectorById(collector.id);
      setSelectedCollector(updatedCollector || collector);
      setShowDetailModal(false); // Close other details if open
    } catch (error) {
      console.error('Error fetching collector details:', error);
      // Fallback to the passed collector data if there's an error
      setSelectedCollector(collector);
      setShowDetailModal(false);
    }
  };
  
  // Handle collector status change
  const handleStatusChange = async (collectorId, newStatus) => {
    try {
      await updateCollectorStatus(collectorId, newStatus);
      // The subscription will handle the UI update
      setToastMessage(`Status updated to ${newStatus}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error updating collector status:', error);
      setToastMessage('Failed to update status');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  // Filter locations based on current filters
  const filteredLocations = locations.filter(location => {
    if (!location?.location?.lat || !location?.location?.lng) {
      return false;
    }

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
  const handleMarkerClick = useCallback((location) => {
    if (!location?.location?.lat || !location?.location?.lng) {
      console.warn('Invalid location data:', location);
      return;
    }
    
    setSelectedLocation(location);
    
    // Pan to the clicked location
    if (mapRef.current) {
      const map = mapRef.current;
      map.flyTo([location.location.lat, location.location.lng], 15, {
        duration: 1
      });
    }
  }, [mapRef]);
  
  // Open detail modal
  const openDetailModal = (location) => {
    setSelectedLocation(location);
    setShowDetailModal(true);
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const ii = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${ii}:${ss}`;
  };
  
  return (
    <>
      <div className="h-full flex flex-col">
        {/* Map container */}
        <div className="flex-[2] relative min-h-0">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading map data...</p>
              </div>
            </div>
          ) : (
          <MapContainer 
            center={[DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lng]} 
            zoom={DEFAULT_COORDINATES.zoom}
            style={{ height: "100%", width: "100%" }}
            whenCreated={mapInstance => { 
              mapRef.current = mapInstance;
              // Center the map once it's loaded
              setTimeout(centerMap, 100);
            }}
            zoomControl={false}
            className="z-0"
          >
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
            
            {/* Pickup Request Markers */}
            {showPickups && filteredLocations.map(location => (
              <Marker
                key={`pickup-${location.id}`}
                position={[location.location.lat, location.location.lng]}
                icon={getMarkerIcon(location.status)}
                eventHandlers={{
                  click: () => handleMarkerClick(location)
                }}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold">{location.location?.address || location.address || 'N/A'}</h3>
                    <p className="text-sm text-gray-600">Status: {location.status}</p>
                    <p className="text-sm">Customer: {location.requestedBy?.name || location.customer || 'N/A'}</p>
                    <p className="text-sm">Type: {location.wasteType}</p>
                    <button
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetailModal(location);
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* Digital Bin Markers */}
            {showDigitalBins && digitalBins.filter(bin => (bin.location?.lat && bin.location?.lng) || (bin.latitude && bin.longitude)).map(bin => (
              <Marker
                key={`bin-${bin.id}`}
                position={bin.location?.lat && bin.location?.lng ? [bin.location.lat, bin.location.lng] : [bin.latitude, bin.longitude]}
                icon={L.divIcon({
                  className: 'custom-marker-icon',
                  html: `<div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M3 6h18v2H3V6m0 4h18v10c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V10m8-6h2v2h-2V4z"/>
                    </svg>
                  </div>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14]
                })}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold">🗑️ Digital Bin</h3>
                    <p className="text-sm text-gray-600">ID: {bin.bin_id || bin.id}</p>
                    <p className="text-sm">Location: {bin.location?.address || bin.address || 'N/A'}</p>
                    <p className="text-sm">Status: <span className="font-medium text-green-600">{bin.status}</span></p>
                    {bin.waste_type && <p className="text-sm">Type: {bin.waste_type}</p>}
                    {bin.frequency && <p className="text-sm">Frequency: {bin.frequency}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* Collector Markers */}
            {showCollectors && collectors.map(collector => (
              <React.Fragment key={collector.id}>
                <CollectorMapMarker
                  collector={collector}
                  onClick={() => openCollectorDetailPanel(collector)}
                  isSelected={selectedCollector?.id === collector.id}
                />
                {collector.locationHistory?.length > 1 && (
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
        <div className="flex-1 min-h-0 overflow-y-auto">
          {selectedCollector ? (
            <CollectorDetailPanel 
              collector={selectedCollector} 
              onClose={() => setSelectedCollector(null)}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border-0 p-4 h-full flex flex-col">
              <div className="flex items-center mb-4">
                <i className="fas fa-truck-moving text-blue-500 text-xl mr-3"></i>
                <h3 className="font-semibold">Collector Status</h3>
              </div>
              
              <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: '100px' }}>
                <div className="space-y-3">
                  {(collectors || [])
                    .filter(c => c?.status === 'active')
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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              (collector.capacityRemaining || 0) < 30 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {collector.capacityRemaining || 0}% Cap
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between text-xs">
                          <div>
                            <span className="text-gray-500">Completed: </span>
                            <span className="font-medium">{collector.stats?.completedToday || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Pending: </span>
                            <span className="font-medium">{collector.stats?.pendingPickups || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Last update: </span>
                            <span className="font-medium">
                              {formatDateTime(collector.lastUpdated)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                  {(collectors || []).filter(c => c?.status === 'active').length === 0 && (
                    <div className="text-center py-6">
                      <div className="inline-flex rounded-full bg-gray-100 p-3 mb-3">
                        <i className="fas fa-user-clock text-gray-500 text-xl"></i>
                      </div>
                      <p className="text-gray-500">No active collectors</p>
                    </div>
                  )}

                  {/* Inactive collectors section */}
                  {(collectors || []).filter(c => c?.status === 'inactive').length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium text-sm text-gray-500 mb-2">Inactive Collectors</h4>
                      <div className="space-y-2">
                        {(collectors || [])
                          .filter(c => c?.status === 'inactive')
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
              </div>
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
                  <p className="font-medium">{selectedLocation.requestedBy?.name || selectedLocation.customer || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{selectedLocation.requestedBy?.phone || selectedLocation.phone || 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{selectedLocation.location?.address || selectedLocation.address || 'N/A'}</p>
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
                  <p className="font-medium">{selectedLocation.assignedTo?.name || selectedLocation.collectorName || selectedLocation.collector || 'Not assigned'}</p>
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
    </>
  );
};

export default LiveMap;
