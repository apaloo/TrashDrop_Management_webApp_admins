import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import configuration
import { appConfig, APP_CONSTANTS } from '../config';
import { SEVERITY, WASTE_TYPE, STATUS } from '../config/constants';

// Import Supabase utilities
import { fetchIllegalDumpingReports, fetchDashboardStats } from '../utils/databaseUtils';
import { supabase } from '../utils/supabase';

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

// Helper component to auto-fit map bounds to markers
function MapBoundsUpdater({ reports }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !reports || reports.length === 0) return;
    
    // Extract valid coordinates
    const validCoords = reports
      .filter(report => {
        const latValid = Number.isFinite(report.location?.lat);
        const lngValid = Number.isFinite(report.location?.lng);
        return latValid && lngValid;
      })
      .map(report => [report.location.lat, report.location.lng]);
    
    if (validCoords.length === 0) {
      // No valid coordinates, use default center
      map.setView(appConfig.services.maps.defaultCenter, appConfig.services.maps.defaultZoom);
      return;
    }
    
    if (validCoords.length === 1) {
      // Single marker, center on it with default zoom
      map.setView(validCoords[0], 13);
      return;
    }
    
    // Multiple markers, fit bounds
    const bounds = L.latLngBounds(validCoords);
    map.fitBounds(bounds, { 
      padding: [50, 50],  // Add padding around markers
      maxZoom: 15,        // Don't zoom in too close
      animate: true,
      duration: 0.5
    });
  }, [map, reports]);
  
  return null;
}

// Create custom markers based on severity
const getMarkerIcon = (severity) => {
  // Color coding based on severity
  const iconColor = 
    severity === SEVERITY.LOW ? '#4CAF50' :
    severity === SEVERITY.MEDIUM ? '#FF9800' :
    severity === SEVERITY.HIGH ? '#F44336' :
    severity === SEVERITY.CRITICAL ? '#9C27B0' : '#9E9E9E';
  
  const { iconSize, iconAnchor } = appConfig.services.maps.markers.dumpingReport;
  
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div style="background-color: ${iconColor}; width: ${iconSize[0]}px; height: ${iconSize[1]}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: iconSize,
    iconAnchor: iconAnchor
  });
};

const IllegalDumpingMap = () => {
  const [loading, setLoading] = useState(true);
  const [dumpingReportData, setDumpingReportData] = useState([]);
  const [filters, setFilters] = useState({
    status: [],
    severity: [],
    wasteType: []
  });
  const [dateRange, setDateRange] = useState({
    start: null,
    end: null
  });
  const [mapMode, setMapMode] = useState('default'); // default or satellite
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedDumping, setSelectedDumping] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshIntervalMs] = useState(60000);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef();
  const [showCollectorModal, setShowCollectorModal] = useState(false);
  const [collectors, setCollectors] = useState([]);
  const [loadingCollectors, setLoadingCollectors] = useState(false);
  const [selectedReportForAssignment, setSelectedReportForAssignment] = useState(null);

  // Helper to choose status filter for backend (only supports single value)
  const getBackendStatusFilter = () => {
    if (Array.isArray(filters.status) && filters.status.length === 1) {
      return filters.status[0];
    }
    return null;
  };

  // Unified refresh function
  const refreshData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const statusForRequest = getBackendStatusFilter();
      const response = await fetchIllegalDumpingReports({ limit: 100, page: 1, status: statusForRequest });
      const dataArray = Array.isArray(response) ? response : (response?.data || []);

      // Transform data with coordinate validation and address fallback
      const transformedData = dataArray.map(item => {
        // Handle both direct coordinates and nested location object
        const latNum = item.location?.lat ?? parseFloat(item?.latitude);
        const lngNum = item.location?.lng ?? parseFloat(item?.longitude);
        const validLat = Number.isFinite(latNum);
        const validLng = Number.isFinite(lngNum);
        
        return {
          id: item.id,
          reportedAt: item.reported_at,
          reportedBy: item.reporter?.name || item.reporter?.email || 'Anonymous',
          resolvedAt: item.resolved_at,
          location: {
            lat: validLat ? latNum : null,
            lng: validLng ? lngNum : null,
            address: item.location?.address || item.address || item.location_address || 'Unknown Location'
          },
          description: item.description || `${item.waste_type || 'Waste'} dumping`,
          images: item.images || [],
          severity: item.severity || SEVERITY.MEDIUM,
          wasteType: item.waste_type || WASTE_TYPE.MIXED,
          status: item.status,
          verifiedAt: item.verified_at,
          verifiedBy: item.verified_by,
          cleanupAssigned: !!item.assigned_to,
          cleanupTeam: item.team_name || (item.assignee ? `${item.assignee.first_name} ${item.assignee.last_name}` : undefined),
          estimatedCleanupDate: item.estimated_cleanup_date,
          resolutionType: item.resolution_type || ''
        };
      });

      console.log('📍 Illegal Dumping Map - Fetched reports:', transformedData.length);
      console.log('📍 Sample report:', transformedData[0]);
      console.log('📍 Reports with valid coordinates:', transformedData.filter(r => 
        Number.isFinite(r.location?.lat) && Number.isFinite(r.location?.lng)
      ).length);
      
      setDumpingReportData(transformedData);

      // Refresh metrics
      const stats = await fetchDashboardStats();
      const cleanupMetrics = {
        totalReports: stats.totalIllegalDumpingReports || 0,
        openReports: stats.openIllegalDumpingReports || 0,
        resolvedReports: stats.resolvedIllegalDumpingReports || 0,
        avgResolutionTime: stats.avgCleanupTimeInDays || 0,
        verificationRate: stats.verificationRate || 85.2,
        cleanedUpReports: stats.resolvedIllegalDumpingReports || 0,
        avgCleanupTimeHours: (stats.avgCleanupTimeInDays || 2.1) * 24
      };
      setMetrics(cleanupMetrics);

      setLastUpdated(new Date());
      if (!silent) {
        setToastMessage('Data refreshed');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (error) {
      console.error('Error refreshing map data:', error);
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
    refreshData(true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const id = setInterval(() => {
      refreshData(true);
    }, autoRefreshIntervalMs);
    return () => clearInterval(id);
  }, [autoRefreshEnabled, autoRefreshIntervalMs, filters.status]);
  
  // Reset map view to show all points
  const centerMap = () => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    // Extract valid coordinates from filtered reports
    const validCoords = filteredReports
      .filter(report => {
        const latValid = Number.isFinite(report.location?.lat);
        const lngValid = Number.isFinite(report.location?.lng);
        return latValid && lngValid;
      })
      .map(report => [report.location.lat, report.location.lng]);
    
    if (validCoords.length === 0) {
      // No valid coordinates, use default center
      map.setView(appConfig.services.maps.defaultCenter, appConfig.services.maps.defaultZoom);
      return;
    }
    
    if (validCoords.length === 1) {
      // Single marker, center on it
      map.setView(validCoords[0], 13);
      return;
    }
    
    // Multiple markers, fit bounds
    const bounds = L.latLngBounds(validCoords);
    map.fitBounds(bounds, { 
      padding: [50, 50],
      maxZoom: 15,
      animate: true,
      duration: 0.5
    });
  };

  // Filter reports based on current filters and ensure valid coordinates
  const filteredReports = dumpingReportData?.filter(report => {
    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(report.status)) {
      return false;
    }
    
    // Severity filter
    if (filters.severity.length > 0 && !filters.severity.includes(report.severity)) {
      return false;
    }
    
    // Waste type filter
    if (filters.wasteType.length > 0 && !filters.wasteType.includes(report.wasteType)) {
      return false;
    }
    
    // Date range filter
    if (dateRange.start && dateRange.end) {
      const reportDate = new Date(report.reportedAt);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      if (reportDate < startDate || reportDate > endDate) {
        return false;
      }
    }
    
    // Coordinates must be valid for map rendering
    const latValid = Number.isFinite(report.location?.lat);
    const lngValid = Number.isFinite(report.location?.lng);
    if (!latValid || !lngValid) return false;
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
    const filteredCount = dumpingReportData.filter(report => {
      if (updatedFilters.status.length > 0 && !updatedFilters.status.includes(report.status)) return false;
      if (updatedFilters.severity.length > 0 && !updatedFilters.severity.includes(report.severity)) return false;
      if (updatedFilters.wasteType.length > 0 && !updatedFilters.wasteType.includes(report.wasteType)) return false;
      return true;
    }).length;
    
    setToastMessage(`Showing ${filteredCount} of ${dumpingReportData.length} reports ${activeFilterCount > 0 ? `(${activeFilterCount} filters applied)` : ''}`);
    setShowToast(true);
    
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };
  
  // Handle date range change
  const handleDateRangeChange = (type, value) => {
    setDateRange(prev => ({
      ...prev,
      [type]: value
    }));
  };
  
  // Reset all filters
  const resetFilters = () => {
    setFilters({
      status: [],
      severity: [],
      wasteType: []
    });
    setDateRange({
      start: null,
      end: null
    });
    setToastMessage(`Showing all ${dumpingReportData.length} reports`);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };
  
  // Fetch collectors from Supabase
  const fetchCollectors = async () => {
    setLoadingCollectors(true);
    try {
      const { data, error } = await supabase
        .from('collector_profiles')
        .select('id, first_name, last_name, email, phone, status, vehicle_type, vehicle_plate')
        .eq('status', 'active')
        .order('first_name', { ascending: true });
      
      if (error) throw error;
      setCollectors(data || []);
    } catch (error) {
      console.error('Error fetching collectors:', error);
      setToastMessage('Failed to load collectors');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setCollectors([]);
    } finally {
      setLoadingCollectors(false);
    }
  };

  // Open collector selection modal
  const openCollectorModal = (report) => {
    setSelectedReportForAssignment(report);
    setShowCollectorModal(true);
    fetchCollectors();
  };

  // Assign cleanup team
  const assignCleanupTeam = async (collectorId, collectorName) => {
    if (!selectedReportForAssignment) return;
    
    try {
      // Update in Supabase
      const { error } = await supabase
        .from('illegal_dumping_mobile')
        .update({ 
          status: 'cleanup_scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReportForAssignment.id);
      
      if (error) throw error;
      
      // Update local state
      setDumpingReportData(prev => 
        prev.map(report => {
          if (report.id === selectedReportForAssignment.id) {
            return { 
              ...report, 
              cleanupAssigned: true,
              cleanupTeam: collectorName,
              status: 'cleanup_scheduled',
              estimatedCleanupDate: new Date(Date.now() + 2*24*60*60*1000).toISOString()
            };
          }
          return report;
        })
      );
      
      setToastMessage(`Cleanup assigned to ${collectorName}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
      // Close modal
      setShowCollectorModal(false);
      setSelectedReportForAssignment(null);
    } catch (error) {
      console.error('Error assigning cleanup:', error);
      setToastMessage('Failed to assign cleanup');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };
  
  return (
    <div className="p-4" style={{ marginTop: '10px' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Illegal Dumping Map</h1>
        <p className="text-gray-600">Monitor and manage illegal dumping reports geographically</p>
      </div>
      
      {/* KPI Cards */}
      {!loading && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Total Reports</p>
            <p className="text-2xl font-bold">{metrics.totalReports}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Verification Rate</p>
            <p className="text-2xl font-bold">{(metrics.verificationRate || 0).toFixed(1)}%</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Cleaned Up</p>
            <p className="text-2xl font-bold">{metrics.cleanedUpReports}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Avg Cleanup Time</p>
            <p className="text-2xl font-bold">{(metrics.avgCleanupTimeHours || 0).toFixed(1)} hrs</p>
          </div>
        </div>
      )}
      
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
      
      {/* Refresh toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
        </div>
        <div className="flex items-center space-x-4">
          <label className="inline-flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              className="mr-2 accent-blue-600"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
            />
            Auto-Refresh (60s)
          </label>
          <button
            onClick={() => refreshData(false)}
            disabled={loading}
            className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium border transition-colors ${loading ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            title="Refresh data"
          >
            {loading ? (
              <>
                <i className="fas fa-sync-alt fa-spin mr-2"></i>
                Refreshing...
              </>
            ) : (
              <>
                <i className="fas fa-sync-alt mr-2"></i>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Filters section */}
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Status filters */}
          <div>
            <p className="text-sm font-medium mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS.ILLEGAL_DUMPING).map(([key, value]) => {
                const isActive = filters.status.includes(value);
                const statusColor = 
                  value === STATUS.ILLEGAL_DUMPING.REPORTED ? '#9C27B0' : 
                  value === STATUS.ILLEGAL_DUMPING.VERIFIED ? '#FF9800' :
                  value === STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED ? '#2196F3' :
                  value === STATUS.ILLEGAL_DUMPING.CLEANED_UP ? '#4CAF50' : 
                  value === STATUS.ILLEGAL_DUMPING.CANCELLED ? '#9E9E9E' : '#9E9E9E';
                return (
                  <button
                    key={value}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isActive ? 'text-white' : 'text-gray-700'}`}
                    style={{ 
                      backgroundColor: isActive ? statusColor : 'white',
                      borderColor: statusColor
                    }}
                    onClick={() => handleFilterChange('status', value)}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Severity filters */}
          <div>
            <p className="text-sm font-medium mb-2">Severity</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SEVERITY).map(([key, value]) => {
                const isActive = filters.severity.includes(value);
                const severityColor = 
                  value === SEVERITY.LOW ? '#4CAF50' :
                  value === SEVERITY.MEDIUM ? '#FF9800' :
                  value === SEVERITY.HIGH ? '#F44336' :
                  value === SEVERITY.CRITICAL ? '#9C27B0' : '#9E9E9E';
                return (
                  <button
                    key={value}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isActive ? 'text-white' : 'text-gray-700'}`}
                    style={{ 
                      backgroundColor: isActive ? severityColor : 'white',
                      borderColor: severityColor
                    }}
                    onClick={() => handleFilterChange('severity', value)}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Waste type filters */}
          <div>
            <p className="text-sm font-medium mb-2">Waste Type</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(WASTE_TYPE).map(([key, value]) => {
                const isActive = filters.wasteType.includes(value);
                return (
                  <button
                    key={value}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
                    style={{ borderColor: '#2196F3' }}
                    onClick={() => handleFilterChange('wasteType', value)}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Date range filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium mb-2">From Date</p>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={dateRange.start || ''}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">To Date</p>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={dateRange.end || ''}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
            />
          </div>
        </div>
      </div>
      
      {/* Map container with sidebar layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Map container - takes 2/3 of the width on medium+ screens */}
        <div className="md:col-span-2 rounded-lg overflow-hidden" style={{ height: "600px" }}>
          {loading ? (
            <div className="bg-gray-100 h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <MapContainer 
              center={appConfig.services.maps.defaultCenter} 
              zoom={appConfig.services.maps.defaultZoom} 
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
                  attribution={appConfig.services.maps.tileProviders.openStreetMap.attribution}
                  url={appConfig.services.maps.tileProviders.openStreetMap.url}
                />
              ) : (
                <TileLayer
                  attribution={appConfig.services.maps.tileProviders.satellite.attribution}
                  url={appConfig.services.maps.tileProviders.satellite.url}
                />
              )}
              
              {/* Map invalidation fix */}
              <MapInvalidator />
              
              {/* Auto-fit bounds to markers */}
              <MapBoundsUpdater reports={filteredReports} />
              
              {/* Markers for dumping reports */}
              {filteredReports && filteredReports.length > 0 ? (
                filteredReports.map(report => (
                  <Marker 
                    key={report.id} 
                    position={[report.location.lat, report.location.lng]} 
                    icon={getMarkerIcon(report.severity)}
                    eventHandlers={{
                      click: () => setSelectedDumping(report)
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-1">
                        <h4 className="font-bold text-gray-800">{report.id}</h4>
                        <div className="my-1 text-sm">
                          <p className="mb-1"><span className="font-semibold">Status:</span> {report.status}</p>
                          <p className="mb-1"><span className="font-semibold">Type:</span> {report.wasteType}</p>
                          <p className="mb-1"><span className="font-semibold">Severity:</span> {report.severity}</p>
                          <p className="mb-1"><span className="font-semibold">Address:</span> {report.location.address}</p>
                        </div>
                        <div className="flex justify-between mt-2">
                          {!report.cleanupAssigned && (
                            <button 
                              className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600"
                              onClick={() => openCollectorModal(report)}
                            >
                              Assign Cleanup
                            </button>
                          )}
                          <button 
                            className="bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600 ml-2"
                            onClick={() => window.location.href = `/illegal-dumping/reports?id=${report.id}`}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))
              ) : null}
            </MapContainer>
          )}
          
          {/* No reports overlay */}
          {!loading && (!filteredReports || filteredReports.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 z-[500] pointer-events-none">
              <div className="text-center p-8">
                <i className="fas fa-map-marked-alt text-6xl text-gray-300 mb-4"></i>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Reports Found</h3>
                <p className="text-gray-500">
                  {dumpingReportData.length === 0 
                    ? 'No illegal dumping reports in the database yet.' 
                    : 'No reports match the current filters. Try adjusting your filters.'}
                </p>
              </div>
            </div>
          )}
          
          {/* Map mode controls */}
          <div className="absolute bottom-8 left-8 bg-white rounded-lg shadow-md p-2 z-[400]">
            <div className="flex space-x-2">
              <button
                className={`p-2 rounded ${mapMode === 'default' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700'}`}
                onClick={() => setMapMode('default')}
                title="Default map view"
              >
                <i className="fas fa-map"></i>
              </button>
              <button
                className={`p-2 rounded ${mapMode === 'satellite' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700'}`}
                onClick={() => setMapMode('satellite')}
                title="Satellite view"
              >
                <i className="fas fa-satellite"></i>
              </button>
              <button
                className="p-2 rounded bg-white text-gray-700 hover:bg-gray-100"
                onClick={centerMap}
                title="Center map"
              >
                <i className="fas fa-crosshairs"></i>
              </button>
            </div>
          </div>
        </div>
        
        {/* Sidebar for selected report details - 1/3 width */}
        <div className="bg-white p-4 rounded-lg shadow-sm h-600 overflow-y-auto">
          {selectedDumping ? (
            <div>
              <h3 className="font-semibold text-lg mb-4">Report Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Report ID</p>
                  <p className="font-medium">{selectedDumping.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reported At</p>
                  <p className="font-medium">{new Date(selectedDumping.reportedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${selectedDumping.status === 'Cleaned Up' ? 'bg-green-100 text-green-800' : selectedDumping.status === 'Cleanup Scheduled' ? 'bg-blue-100 text-blue-800' : selectedDumping.status === 'Under Investigation' ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'}`}>
                    {selectedDumping.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Severity</p>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${selectedDumping.severity === 'Low' ? 'bg-green-100 text-green-800' : selectedDumping.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' : selectedDumping.severity === 'High' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                    {selectedDumping.severity}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Waste Type</p>
                  <p className="font-medium">{selectedDumping.wasteType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium">{selectedDumping.location.address}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Lat: {selectedDumping.location.lat.toFixed(4)}, Lng: {selectedDumping.location.lng.toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="font-medium">{selectedDumping.description}</p>
                </div>
                {selectedDumping.cleanupTeam && (
                  <div>
                    <p className="text-sm text-gray-500">Cleanup Team</p>
                    <p className="font-medium">{selectedDumping.cleanupTeam}</p>
                  </div>
                )}
                {selectedDumping.estimatedCleanupDate && (
                  <div>
                    <p className="text-sm text-gray-500">Est. Cleanup Date</p>
                    <p className="font-medium">{new Date(selectedDumping.estimatedCleanupDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="mt-6 space-y-2">
                {!selectedDumping.cleanupAssigned && (
                  <button
                    onClick={() => openCollectorModal(selectedDumping)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                  >
                    Assign Cleanup Team
                  </button>
                )}
                <button
                  onClick={() => window.location.href = `/illegal-dumping/reports?id=${selectedDumping.id}`}
                  className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 text-sm font-medium"
                >
                  View Full Details
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <i className="fas fa-map-marker-alt text-5xl mb-4"></i>
              <p>Select a dumping report on the map to view details</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Collector Selection Modal */}
      {showCollectorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" onClick={() => setShowCollectorModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold">Select Collector for Cleanup</h3>
              <button 
                onClick={() => setShowCollectorModal(false)}
                className="text-white hover:text-gray-200"
              >
                <i className="fas fa-times text-2xl"></i>
              </button>
            </div>
            
            {/* Report Info */}
            {selectedReportForAssignment && (
              <div className="px-6 py-3 bg-gray-50 border-b">
                <p className="text-sm text-gray-600">Report ID: <span className="font-medium">{selectedReportForAssignment.id}</span></p>
                <p className="text-sm text-gray-600">Location: <span className="font-medium">{selectedReportForAssignment.location?.address || 'N/A'}</span></p>
              </div>
            )}
            
            {/* Collectors List */}
            <div className="p-6 overflow-y-auto max-h-[500px]">
              {loadingCollectors ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : collectors.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <i className="fas fa-users text-5xl mb-4"></i>
                  <p>No active collectors available</p>
                  <p className="text-sm mt-2">Please check back later or contact admin</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {collectors.map((collector) => (
                    <div 
                      key={collector.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
                      onClick={() => assignCleanupTeam(collector.id, `${collector.first_name} ${collector.last_name}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <i className="fas fa-user-circle text-2xl text-blue-600"></i>
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {collector.first_name} {collector.last_name}
                              </h4>
                              <p className="text-sm text-gray-600">{collector.email}</p>
                            </div>
                          </div>
                          
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Phone:</span>
                              <span className="ml-2 font-medium">{collector.phone || 'N/A'}</span>
                            </div>
                            {collector.vehicle_type && (
                              <div>
                                <span className="text-gray-500">Vehicle:</span>
                                <span className="ml-2 font-medium">{collector.vehicle_type}</span>
                              </div>
                            )}
                            {collector.vehicle_plate && (
                              <div>
                                <span className="text-gray-500">Plate:</span>
                                <span className="ml-2 font-medium">{collector.vehicle_plate}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Status:</span>
                              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                {collector.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <button className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
                          Assign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => setShowCollectorModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IllegalDumpingMap;
