import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import mock data
import { dumpingReports, getCleanupMetrics } from '../mock/illegalDumping';

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

// Create custom markers based on severity
const getMarkerIcon = (severity) => {
  // Color coding based on severity
  const iconColor = 
    severity === 'Low' ? '#4CAF50' :
    severity === 'Medium' ? '#FF9800' :
    severity === 'High' ? '#F44336' :
    severity === 'Critical' ? '#9C27B0' : '#9E9E9E';
  
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div style="background-color: ${iconColor}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
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
  const mapContainerRef = useRef(null);
  const mapRef = useRef();

  // Load map data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // In a real app, this would fetch from Supabase
        setTimeout(() => {
          setDumpingReportData(dumpingReports);
          setMetrics(getCleanupMetrics());
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

  // Filter reports based on current filters
  const filteredReports = dumpingReportData.filter(report => {
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
  
  // Assign cleanup team
  const assignCleanupTeam = (reportId, teamName) => {
    setDumpingReportData(prev => 
      prev.map(report => {
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
    
    setToastMessage(`Cleanup assigned to ${teamName}`);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };
  
  return (
    <div className="p-4">
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
            <p className="text-2xl font-bold">{metrics.verificationRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Cleaned Up</p>
            <p className="text-2xl font-bold">{metrics.cleanedUpReports}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Avg Cleanup Time</p>
            <p className="text-2xl font-bold">{metrics.avgCleanupTimeHours.toFixed(1)} hrs</p>
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
              {['Reported', 'Under Investigation', 'Cleanup Scheduled', 'Cleaned Up'].map(status => {
                const isActive = filters.status.includes(status);
                const statusColor = 
                  status === 'Reported' ? '#9C27B0' : 
                  status === 'Under Investigation' ? '#FF9800' :
                  status === 'Cleanup Scheduled' ? '#2196F3' :
                  status === 'Cleaned Up' ? '#4CAF50' : '#9E9E9E';
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
          
          {/* Severity filters */}
          <div>
            <p className="text-sm font-medium mb-2">Severity</p>
            <div className="flex flex-wrap gap-2">
              {['Low', 'Medium', 'High', 'Critical'].map(severity => {
                const isActive = filters.severity.includes(severity);
                const severityColor = 
                  severity === 'Low' ? '#4CAF50' :
                  severity === 'Medium' ? '#FF9800' :
                  severity === 'High' ? '#F44336' :
                  severity === 'Critical' ? '#9C27B0' : '#9E9E9E';
                return (
                  <button
                    key={severity}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isActive ? 'text-white' : 'text-gray-700'}`}
                    style={{ 
                      backgroundColor: isActive ? severityColor : 'white',
                      borderColor: severityColor
                    }}
                    onClick={() => handleFilterChange('severity', severity)}
                  >
                    {severity}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Waste type filters */}
          <div>
            <p className="text-sm font-medium mb-2">Waste Type</p>
            <div className="flex flex-wrap gap-2">
              {['Household', 'Construction', 'Industrial', 'Hazardous', 'Electronic', 'Green', 'Bulky', 'Mixed'].map(type => {
                const isActive = filters.wasteType.includes(type);
                return (
                  <button
                    key={type}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
                    style={{ borderColor: '#2196F3' }}
                    onClick={() => handleFilterChange('wasteType', type)}
                  >
                    {type}
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
              
              {/* Map invalidation fix */}
              <MapInvalidator />
              
              {/* Markers for dumping reports */}
              {filteredReports.map(report => (
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
                            onClick={() => assignCleanupTeam(report.id, 'Team Alpha')}
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
              ))}
            </MapContainer>
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
                    onClick={() => assignCleanupTeam(selectedDumping.id, 'Team Alpha')}
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
    </div>
  );
};

export default IllegalDumpingMap;
