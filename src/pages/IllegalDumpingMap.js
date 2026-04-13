import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import configuration
import { appConfig, APP_CONSTANTS } from '../config';
import { SEVERITY, WASTE_TYPE, STATUS } from '../config/constants';

// Import Supabase utilities
import { fetchIllegalDumpingReports, fetchDashboardStats } from '../utils/databaseUtils';
import EnhancedImage from '../components/common/EnhancedImage';
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsReport, setDetailsReport] = useState(null);

  const openDetailsModal = (report) => {
    setDetailsReport(report);
    setShowDetailsModal(true);
  };

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
  const assignCleanupTeamHandler = async (collectorId, collectorName) => {
    if (!selectedReportForAssignment) return;
    
    try {
      // Update in Supabase - save collector UUID to assigned_to column
      // Database constraint only allows: 'pending', 'verified', 'in_progress', 'completed'
      const { error } = await supabase
        .from('illegal_dumping_mobile')
        .update({ 
          status: 'in_progress',
          assigned_to: collectorId,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReportForAssignment.id);
      
      if (error) throw error;
      
      // Update local state with collector info (not persisted to DB until column is added)
      setDumpingReportData(prev => 
        prev.map(report => {
          if (report.id === selectedReportForAssignment.id) {
            return { 
              ...report, 
              cleanupAssigned: true,
              cleanupTeam: collectorName,
              collectorId: collectorId,
              status: 'in_progress',
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
  
  // Human-readable labels for status filter chips
  const STATUS_LABELS = {
    [STATUS.ILLEGAL_DUMPING.REPORTED]: 'Pending',
    [STATUS.ILLEGAL_DUMPING.VERIFIED]: 'Verified',
    [STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED]: 'In Progress',
    [STATUS.ILLEGAL_DUMPING.CLEANED_UP]: 'Completed',
    [STATUS.ILLEGAL_DUMPING.CANCELLED]: 'Cancelled',
  };

  return (
    <div className="bg-gray-50 min-h-screen">

      {/* Page Header + Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Illegal Dumping Map</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor and manage illegal dumping reports geographically</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none bg-white border border-gray-200 rounded-md px-3 py-2">
            <input
              type="checkbox"
              className="accent-green-600 h-3.5 w-3.5"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
            />
            Auto-Refresh (60s)
          </label>
          <button
            onClick={() => refreshData(false)}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
            }`}
          >
            <i className={`fas fa-sync-alt text-xs ${loading ? 'fa-spin' : ''}`}></i>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Reports', value: loading ? '—' : (metrics?.totalReports ?? 0), icon: 'fa-flag', bg: 'bg-blue-50', color: 'text-blue-600', border: 'border-blue-100' },
          { label: 'Verification Rate', value: loading ? '—' : `${(metrics?.verificationRate || 0).toFixed(1)}%`, icon: 'fa-shield-alt', bg: 'bg-green-50', color: 'text-green-600', border: 'border-green-100' },
          { label: 'Cleaned Up', value: loading ? '—' : (metrics?.cleanedUpReports ?? 0), icon: 'fa-broom', bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Avg Cleanup Time', value: loading ? '—' : `${(metrics?.avgCleanupTimeHours || 0).toFixed(1)} hrs`, icon: 'fa-clock', bg: 'bg-orange-50', color: 'text-orange-600', border: 'border-orange-100' },
        ].map(({ label, value, icon, bg, color, border }) => (
          <div key={label} className={`bg-white rounded-xl shadow-sm border ${border} p-4 flex items-center gap-4`}>
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${icon} ${color}`}></i>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-gray-800 leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-20 right-4 bg-gray-800 text-white shadow-xl rounded-lg px-4 py-3 z-[10000] flex items-center gap-3 max-w-sm">
          <i className="fas fa-info-circle text-blue-300 flex-shrink-0"></i>
          <span className="text-sm">{toastMessage}</span>
          <button className="ml-auto text-gray-400 hover:text-white" onClick={() => setShowToast(false)}>
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>
      )}
      
      {/* Filters section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 mb-5">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <i className="fas fa-filter text-gray-400 text-sm"></i>
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
            {(filters.status.length + filters.severity.length + filters.wasteType.length) > 0 && (
              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {filters.status.length + filters.severity.length + filters.wasteType.length} active
              </span>
            )}
          </div>
          <button
            className="text-xs text-gray-500 flex items-center gap-1 hover:text-red-500 transition-colors"
            onClick={resetFilters}
          >
            <i className="fas fa-times-circle text-xs"></i> Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          {/* Status filters */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</p>
            <div className="flex flex-nowrap overflow-x-auto gap-1 pb-0.5" style={{scrollbarWidth:'none'}}>
              {Object.entries(STATUS.ILLEGAL_DUMPING).map(([key, value]) => {
                const isActive = filters.status.includes(value);
                const statusColor =
                  value === STATUS.ILLEGAL_DUMPING.REPORTED ? '#9C27B0' :
                  value === STATUS.ILLEGAL_DUMPING.VERIFIED ? '#F59E0B' :
                  value === STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED ? '#3B82F6' :
                  value === STATUS.ILLEGAL_DUMPING.CLEANED_UP ? '#10B981' :
                  '#6B7280';
                const label = STATUS_LABELS[value] || value;
                return (
                  <button
                    key={value}
                    className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-all whitespace-nowrap ${
                      isActive ? 'shadow-sm' : 'hover:shadow-sm'
                    }`}
                    style={{
                      backgroundColor: isActive ? statusColor : '#F9FAFB',
                      borderColor: isActive ? statusColor : '#E5E7EB',
                      color: isActive ? 'white' : '#374151',
                    }}
                    onClick={() => handleFilterChange('status', value)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity filters */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Severity</p>
            <div className="flex flex-nowrap overflow-x-auto gap-1 pb-0.5" style={{scrollbarWidth:'none'}}>
              {Object.entries(SEVERITY).map(([key, value]) => {
                const isActive = filters.severity.includes(value);
                const severityColor =
                  value === SEVERITY.LOW ? '#10B981' :
                  value === SEVERITY.MEDIUM ? '#F59E0B' :
                  value === SEVERITY.HIGH ? '#EF4444' :
                  '#9C27B0';
                return (
                  <button
                    key={value}
                    className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-all whitespace-nowrap ${
                      isActive ? 'shadow-sm' : 'hover:shadow-sm'
                    }`}
                    style={{
                      backgroundColor: isActive ? severityColor : '#F9FAFB',
                      borderColor: isActive ? severityColor : '#E5E7EB',
                      color: isActive ? 'white' : '#374151',
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Waste Type</p>
            <div className="flex flex-nowrap overflow-x-auto gap-1 pb-0.5" style={{scrollbarWidth:'none'}}>
              {Object.entries(WASTE_TYPE).map(([key, value]) => {
                const isActive = filters.wasteType.includes(value);
                return (
                  <button
                    key={value}
                    className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-all whitespace-nowrap ${
                      isActive ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-700 hover:shadow-sm'
                    }`}
                    onClick={() => handleFilterChange('wasteType', value)}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Date range + report count */}
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-end gap-2 flex-1 min-w-[260px]">
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">From</p>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
                value={dateRange.start || ''}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
              />
            </div>
            <span className="text-gray-400 mb-2 text-sm">→</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">To</p>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
                value={dateRange.end || ''}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-0.5">
            <i className="fas fa-map-marker-alt text-green-600 text-xs"></i>
            <span className="text-sm font-semibold text-green-700">{filteredReports ? filteredReports.length : 0}</span>
            <span className="text-xs text-green-600">of {dumpingReportData.length} reports shown</span>
          </div>
        </div>
      </div>
      
      {/* Map + Sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Map container */}
        <div className="md:col-span-2 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative" style={{ height: "600px" }}>
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
                    <Popup className="custom-popup" minWidth={220}>
                      <div className="p-2">
                        <p className="text-xs text-gray-400 font-mono truncate mb-1" style={{maxWidth: 200}}>{report.id}</p>
                        <div className="space-y-1 text-sm mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                              report.status === 'completed' ? 'bg-green-500' :
                              report.status === 'in_progress' ? 'bg-blue-500' :
                              report.status === 'verified' ? 'bg-yellow-500' :
                              report.status === 'cancelled' ? 'bg-gray-400' : 'bg-purple-500'
                            }`}></span>
                            <span className="font-medium text-gray-700 capitalize">{STATUS_LABELS[report.status] || report.status}</span>
                          </div>
                          <p className="text-gray-600"><span className="font-medium">Type:</span> {report.wasteType}</p>
                          <p className="text-gray-600"><span className="font-medium">Severity:</span> <span className={`font-semibold ${
                            report.severity === 'high' || report.severity === 'High' ? 'text-red-600' :
                            report.severity === 'medium' || report.severity === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                          }`}>{report.severity}</span></p>
                          <p className="text-gray-600 text-xs leading-snug">{report.location.address}</p>
                        </div>
                        <div className="flex gap-1.5 pt-1.5 border-t border-gray-100">
                          {!report.cleanupAssigned && (
                            <button
                              className="flex-1 bg-blue-600 text-white text-xs px-2 py-1.5 rounded-md hover:bg-blue-700 font-medium"
                              onClick={() => openCollectorModal(report)}
                            >
                              Assign
                            </button>
                          )}
                          <button
                            className="flex-1 bg-green-600 text-white text-xs px-2 py-1.5 rounded-md hover:bg-green-700 font-medium"
                            onClick={() => openDetailsModal(report)}
                          >
                            Details
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
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-[500] pointer-events-none">
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
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-1.5 z-[400] flex gap-1">
            <button
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${mapMode === 'default' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setMapMode('default')}
              title="Default map view"
            >
              <i className="fas fa-map"></i>
            </button>
            <button
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${mapMode === 'satellite' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setMapMode('satellite')}
              title="Satellite view"
            >
              <i className="fas fa-satellite"></i>
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-md text-sm bg-white text-gray-500 hover:bg-gray-100 transition-colors"
              onClick={centerMap}
              title="Center map"
            >
              <i className="fas fa-crosshairs"></i>
            </button>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-y-auto" style={{ height: '600px' }}>
          {selectedDumping ? (
            <div>
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 rounded-t-xl">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Report Details</h3>
                <p className="text-green-200 text-xs mt-0.5 font-mono truncate">{selectedDumping.id}</p>
              </div>
              <div className="p-4">
              <div className="space-y-3">
                  {/* Status + Severity badges */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400 mb-1">Status</p>
                      <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${
                        selectedDumping.status === 'completed' ? 'bg-green-100 text-green-800' :
                        selectedDumping.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        selectedDumping.status === 'verified' ? 'bg-yellow-100 text-yellow-800' :
                        selectedDumping.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {STATUS_LABELS[selectedDumping.status] || selectedDumping.status}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400 mb-1">Severity</p>
                      <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${
                        (selectedDumping.severity || '').toLowerCase() === 'low' ? 'bg-green-100 text-green-800' :
                        (selectedDumping.severity || '').toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        (selectedDumping.severity || '').toLowerCase() === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedDumping.severity}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3 space-y-2.5">
                    <div>
                      <p className="text-xs text-gray-400">Reported At</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">
                        {selectedDumping.reportedAt ? new Date(selectedDumping.reportedAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Waste Type</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5 capitalize">{selectedDumping.wasteType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Location</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5 leading-snug">{selectedDumping.location.address}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {selectedDumping.location.lat.toFixed(4)}, {selectedDumping.location.lng.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Description</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{selectedDumping.description}</p>
                    </div>
                    {selectedDumping.cleanupTeam && (
                      <div>
                        <p className="text-xs text-gray-400">Assigned Collector</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{selectedDumping.cleanupTeam}</p>
                      </div>
                    )}
                    {selectedDumping.estimatedCleanupDate && (
                      <div>
                        <p className="text-xs text-gray-400">Est. Cleanup Date</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{new Date(selectedDumping.estimatedCleanupDate).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
              </div>
              
              {/* Action buttons */}
              <div className="mt-4 space-y-2">
                {!selectedDumping.cleanupAssigned && selectedDumping.status !== 'cancelled' && selectedDumping.status !== 'completed' && (
                  <button
                    onClick={() => openCollectorModal(selectedDumping)}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-user-plus text-xs"></i>
                    Assign Cleanup Team
                  </button>
                )}
                <button
                  onClick={() => openDetailsModal(selectedDumping)}
                  className="w-full px-4 py-2.5 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <i className="fas fa-expand-alt text-xs"></i>
                  View Full Details
                </button>
              </div>
            </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 p-6">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <i className="fas fa-map-marker-alt text-3xl text-gray-300"></i>
              </div>
              <p className="text-sm font-medium text-gray-400 text-center">Click a marker on the map</p>
              <p className="text-xs text-gray-300 text-center mt-1">Report details will appear here</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Report Details Modal */}
      {showDetailsModal && detailsReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-green-600 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">Report Details</h3>
                <p className="text-green-200 text-xs mt-0.5 font-mono">{detailsReport.id}</p>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="text-white hover:text-gray-200">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              {/* Status + Severity row */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${
                    detailsReport.status === 'completed' ? 'bg-green-100 text-green-800' :
                    detailsReport.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    detailsReport.status === 'verified' ? 'bg-yellow-100 text-yellow-800' :
                    detailsReport.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {detailsReport.status}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Severity</p>
                  <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${
                    (detailsReport.severity || '').toLowerCase() === 'low' ? 'bg-green-100 text-green-800' :
                    (detailsReport.severity || '').toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    (detailsReport.severity || '').toLowerCase() === 'high' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {detailsReport.severity}
                  </span>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Reported At</p>
                  <p className="font-medium text-sm mt-0.5">
                    {detailsReport.reportedAt ? new Date(detailsReport.reportedAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Waste Type</p>
                  <p className="font-medium text-sm mt-0.5 capitalize">{detailsReport.wasteType || 'N/A'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="font-medium text-sm mt-0.5">{detailsReport.location?.address || 'Unknown Location'}</p>
                  {detailsReport.location?.lat && detailsReport.location?.lng && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Lat: {detailsReport.location.lat.toFixed(4)}, Lng: {detailsReport.location.lng.toFixed(4)}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500">Description</p>
                  <p className="font-medium text-sm mt-0.5">{detailsReport.description || 'No description provided'}</p>
                </div>
                {detailsReport.reportedBy && (
                  <div>
                    <p className="text-xs text-gray-500">Reported By</p>
                    <p className="font-medium text-sm mt-0.5">{detailsReport.reportedBy}</p>
                  </div>
                )}
                {detailsReport.cleanupTeam && (
                  <div>
                    <p className="text-xs text-gray-500">Assigned Collector</p>
                    <p className="font-medium text-sm mt-0.5">{detailsReport.cleanupTeam}</p>
                  </div>
                )}
                {detailsReport.estimatedCleanupDate && (
                  <div>
                    <p className="text-xs text-gray-500">Est. Cleanup Date</p>
                    <p className="font-medium text-sm mt-0.5">{new Date(detailsReport.estimatedCleanupDate).toLocaleDateString()}</p>
                  </div>
                )}
                {detailsReport.resolvedAt && (
                  <div>
                    <p className="text-xs text-gray-500">Resolved At</p>
                    <p className="font-medium text-sm mt-0.5">{new Date(detailsReport.resolvedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Images */}
              {detailsReport.images && detailsReport.images.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs text-gray-500 mb-2">Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {detailsReport.images.map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block w-20 h-20">
                        <EnhancedImage
                          src={img}
                          alt={`Evidence ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded-md border border-gray-200"
                          style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center flex-shrink-0">
              {!detailsReport.cleanupAssigned && detailsReport.status !== 'cancelled' && detailsReport.status !== 'completed' && (
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    openCollectorModal(detailsReport);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                  Assign Cleanup Team
                </button>
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="ml-auto px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                      onClick={() => assignCleanupTeamHandler(collector.id, `${collector.first_name} ${collector.last_name}`)}
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
