import logger from '../utils/logger';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import configuration
import { appConfig } from '../config';
import { STATUS } from '../config/constants';
import { canManageDumping } from '../constants/accessControl';
import { can } from '../lib/permissions';
import { usesAreaActions, areaVerifyReport, areaMarkCleaned, areaAssignTeam, fetchAreaTeams } from '../services/dumpingAreaService';
import AreaScopeNote from '../components/illegalDumping/AreaScopeNote';
import { useAuth } from '../context/AuthContext';

// Import Supabase utilities
import { fetchIllegalDumpingReports, assignCleanupTeam } from '../utils/databaseUtils';
import AssignCleanupModal from '../components/illegalDumping/AssignCleanupModal';
import {
  SEVERITY_OPTIONS, WASTE_TYPE_OPTIONS, UNKNOWN_SEVERITY_COLOR, GHANA_BOUNDS,
  normalizeEnum, toTitle, getSeverityColor, hasCoordinates, isOutsideGhana,
  matchesFilters, computeReportStats, statusLabel, statusBadgeClass, severityBadgeClass, formatDuration,
  assignmentBlockReason, assignmentFailedMessage,
} from '../utils/illegalDumpingReportUtils';
import EnhancedImage from '../components/common/EnhancedImage';
import { secureUrls } from '../utils/secureUrl';
import { supabase } from '../utils/supabase';

// Enough for every report; the fetch defaults to 10 per page.
const REPORT_FETCH_LIMIT = 1000;

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

// Fits the map to the given reports, but only when the set of reports changes
// (not on every render, which used to snap the view back and close popups).
function MapBoundsUpdater({ reports }) {
  const map = useMap();
  const boundsKey = reports.map(r => r.id).join(',');

  useEffect(() => {
    if (!map) return;
    // Frame the reports in Ghana; outliers elsewhere are listed separately.
    const inGhana = reports.filter(r => !isOutsideGhana(r));
    const coords = (inGhana.length ? inGhana : reports).map(r => [r.location.lat, r.location.lng]);

    if (coords.length === 0) {
      map.setView(appConfig.services.maps.defaultCenter, appConfig.services.maps.defaultZoom);
    } else if (coords.length === 1) {
      map.setView(coords[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], maxZoom: 15, animate: true, duration: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, boundsKey]);

  return null;
}

// Marker icons are cached per colour so markers aren't rebuilt on every render
const markerIconCache = {};
const getMarkerIcon = (severity) => {
  const color = getSeverityColor(severity);
  if (!markerIconCache[color]) {
    const { iconSize, iconAnchor } = appConfig.services.maps.markers.dumpingReport;
    markerIconCache[color] = L.divIcon({
      className: 'custom-marker-icon',
      html: `<div data-severity-color style="background-color: ${color}; width: ${iconSize[0]}px; height: ${iconSize[1]}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize,
      iconAnchor
    });
  }
  return markerIconCache[color];
};

// Cluster bubble with the report count, ringed in the colour of its most severe report
const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const createClusterIcon = (cluster) => {
  const children = cluster.getAllChildMarkers();
  const worst = children.reduce((acc, m) => {
    const s = normalizeEnum(m.options.severity);
    return (SEVERITY_RANK[s] || 0) > (SEVERITY_RANK[acc] || 0) ? s : acc;
  }, '');
  const ring = worst ? getSeverityColor(worst) : UNKNOWN_SEVERITY_COLOR;
  const count = cluster.getChildCount();
  const size = count < 10 ? 34 : count < 50 ? 40 : 46;
  return L.divIcon({
    className: 'dumping-cluster-icon',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#1F2937;color:#fff;border:4px solid ${ring};display:flex;align-items:center;justify-content:center;font:600 13px/1 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.35)">${count}</div>`,
    iconSize: [size, size],
  });
};

const formatHours = (hours) => formatDuration(hours);

const IllegalDumpingMap = () => {
  const { role, area } = useAuth();
  const canManageReports = canManageDumping(role); // everything, e.g. cancel (Admin, Manager)
  // What this account may do (src/lib/permissions.js); Media, Volunteer and User
  // read without reporter details, and their actions go through the area functions
  const privateView = !can('dumping.reporters', role);
  const viaArea = usesAreaActions(role);
  const canVerify = can('dumping.verify', role);
  const canAssign = can('dumping.assign', role);
  const canMarkCleaned = can('dumping.markCleaned', role);
  const canSetFee = can('dumping.fee', role);
  const mayDo = (to) => (to === 'verified' ? canVerify : to === 'completed' ? canMarkCleaned : canManageReports);

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
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
  // Selection is kept by id so it stays in sync with refreshed data
  const [selectedId, setSelectedId] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshIntervalMs] = useState(60000);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showOutsideList, setShowOutsideList] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const mapRef = useRef();
  const toastTimer = useRef(null);
  const [showCollectorModal, setShowCollectorModal] = useState(false);
  const [selectedReportForAssignment, setSelectedReportForAssignment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsReport, setDetailsReport] = useState(null);

  const notify = (message, ms = 3000) => {
    setToastMessage(message);
    setShowToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), ms);
  };

  const openDetailsModal = (report) => {
    setDetailsReport(report);
    setShowDetailsModal(true);
  };

  // Fetches every report; filtering happens client-side so the map, counts and
  // cards always work from the same list.
  const refreshData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const response = await fetchIllegalDumpingReports({ limit: REPORT_FETCH_LIMIT, page: 1, area: privateView ? null : area, privateView });
      const dataArray = Array.isArray(response) ? response : (response?.data || []);

      const transformedData = dataArray.map(item => {
        const latNum = item.location?.lat ?? parseFloat(item?.latitude);
        const lngNum = item.location?.lng ?? parseFloat(item?.longitude);

        return {
          id: item.id,
          reportedAt: item.reported_at,
          reportedBy: item.reporter?.hidden ? null : (item.reporter?.name || item.reporter?.email || (item.reporter?.anonymous ? 'Anonymous' : 'Unknown user')),
          reporterEmail: item.reporter?.hidden ? null : (item.reporter?.email || null),
          resolvedAt: item.resolved_at,
          location: {
            lat: Number.isFinite(latNum) ? latNum : null,
            lng: Number.isFinite(lngNum) ? lngNum : null,
            address: item.location?.address || item.address || item.location_address || 'Unknown Location'
          },
          description: item.description_is_generated ? null : item.description,
          images: secureUrls(item.images),
          severity: normalizeEnum(item.severity ?? item.severity_level) || 'medium',
          wasteType: normalizeEnum(item.waste_type ?? item.type) || 'mixed',
          size: item.size || null,
          status: normalizeEnum(item.status) || 'pending',
          cleanupAssigned: !!item.assigned_to,
          cleanupTeam: item.team_name || (item.assignee ? `${item.assignee.first_name} ${item.assignee.last_name}` : undefined),
          estimatedCleanupDate: item.estimated_cleanup_date,
        };
      });

      logger.log('📍 Illegal Dumping Map - Fetched reports:', transformedData.length);
      logger.log('📍 Sample report:', JSON.stringify(transformedData[0] || null));
      logger.log('📍 Reports with valid coordinates:', transformedData.filter(hasCoordinates).length);
      const outside = transformedData.filter(isOutsideGhana);
      if (outside.length) {
        console.warn(`📍 ${outside.length} report(s) plotted outside Ghana:`,
          outside.map(r => ({ id: r.id, lat: r.location.lat, lng: r.location.lng, address: r.location.address })));
      }

      setDumpingReportData(transformedData);
      setLastUpdated(new Date());
      setHasLoaded(true);
      if (!silent) notify('Data refreshed', 2000);
    } catch (error) {
      console.error('Error refreshing map data:', error);
      if (!silent) notify('Failed to refresh data', 2500);
    } finally {
      setLoading(false);
    }
  }, [area, privateView]);

  // Initial load
  useEffect(() => {
    refreshData(true);
  }, [refreshData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const id = setInterval(() => refreshData(true), autoRefreshIntervalMs);
    return () => clearInterval(id);
  }, [autoRefreshEnabled, autoRefreshIntervalMs, refreshData]);

  // Reports matching the filters: the cards and counts use these...
  const matchingReports = useMemo(
    () => dumpingReportData.filter(r => matchesFilters(r, filters, dateRange)),
    [dumpingReportData, filters, dateRange]
  );
  // ...and the map plots the ones that have coordinates.
  const filteredReports = useMemo(() => matchingReports.filter(hasCoordinates), [matchingReports]);
  const stats = useMemo(() => computeReportStats(matchingReports), [matchingReports]);
  const outsideGhanaReports = useMemo(() => filteredReports.filter(isOutsideGhana), [filteredReports]);
  const missingCoordinates = matchingReports.length - filteredReports.length;

  const selectedDumping = useMemo(
    () => dumpingReportData.find(r => r.id === selectedId) || null,
    [dumpingReportData, selectedId]
  );

  // Waste type chips: the known form values plus anything else found in the data
  const wasteTypeOptions = useMemo(() => {
    const known = WASTE_TYPE_OPTIONS.map(o => o.value);
    const extra = [...new Set(dumpingReportData.map(r => r.wasteType))].filter(v => v && !known.includes(v));
    return [...WASTE_TYPE_OPTIONS, ...extra.map(v => ({ value: v, label: toTitle(v) }))];
  }, [dumpingReportData]);

  const countBy = (key) => dumpingReportData.reduce((acc, r) => {
    acc[r[key]] = (acc[r[key]] || 0) + 1;
    return acc;
  }, {});
  const severityCounts = countBy('severity');
  const wasteTypeCounts = countBy('wasteType');
  const statusCounts = countBy('status');

  // Reset map view to show all points
  const centerMap = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const inGhana = filteredReports.filter(r => !isOutsideGhana(r));
    const coords = (inGhana.length ? inGhana : filteredReports).map(r => [r.location.lat, r.location.lng]);

    if (coords.length === 0) {
      map.setView(appConfig.services.maps.defaultCenter, appConfig.services.maps.defaultZoom);
    } else if (coords.length === 1) {
      map.setView(coords[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], maxZoom: 15, animate: true, duration: 0.5 });
    }
  };

  const focusReport = (report) => {
    setSelectedId(report.id);
    if (mapRef.current && hasCoordinates(report)) {
      mapRef.current.setView([report.location.lat, report.location.lng], 15);
    }
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    const current = filters[filterType];
    const updatedFilters = {
      ...filters,
      [filterType]: current.includes(value) ? current.filter(item => item !== value) : [...current, value]
    };
    setFilters(updatedFilters);

    const activeFilterCount = Object.values(updatedFilters).flat().length;
    const filteredCount = dumpingReportData.filter(r => matchesFilters(r, updatedFilters, dateRange)).length;
    notify(`Showing ${filteredCount} of ${dumpingReportData.length} reports ${activeFilterCount > 0 ? `(${activeFilterCount} filters applied)` : ''}`);
  };

  // Handle date range change
  const handleDateRangeChange = (type, value) => {
    setDateRange(prev => ({
      ...prev,
      [type]: value || null
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
    notify(`Showing all ${dumpingReportData.length} reports`);
  };

  // Status change from the details panel
  const updateReportStatus = async (report, newStatus) => {
    if (!mayDo(newStatus) || updatingStatus) return;
    if (newStatus === 'cancelled' && !window.confirm('Cancel this report? It will no longer appear as open.')) return;

    setUpdatingStatus(true);
    try {
      const updatedAt = new Date().toISOString();
      if (viaArea) {
        await (newStatus === 'verified' ? areaVerifyReport(report.id) : areaMarkCleaned(report.id));
      } else {
        const { error } = await supabase
          .from('illegal_dumping_mobile')
          .update({ status: newStatus, updated_at: updatedAt })
          .eq('id', report.id);
        if (error) throw error;
      }

      const cleaned = newStatus === 'completed';
      setDumpingReportData(prev => prev.map(r => (
        r.id === report.id ? { ...r, status: newStatus, resolvedAt: cleaned ? updatedAt : r.resolvedAt } : r
      )));
      notify(`Report marked ${statusLabel(newStatus)}`);
    } catch (error) {
      console.error('Error updating report status:', error);
      notify(`Failed to update status: ${error.message || 'unknown error'}`, 4000);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Open collector selection modal
  const openCollectorModal = (report) => {
    const blocked = assignmentBlockReason(report);
    if (blocked) { notify(blocked, 5000); return; }
    setSelectedReportForAssignment(report);
    setShowCollectorModal(true);
  };

  // Assign cleanup team (from the assignment window); true when assigned.
  // Same as the Reports page: the report stays verified with the team on it,
  // and the collector app moves it to in_progress when the team accepts.
  const assignCleanupTeamHandler = async ({ teamId, teamName, fee, volunteer }) => {
    const report = selectedReportForAssignment;
    if (!report) return false;
    const blocked = assignmentBlockReason(report);
    if (blocked) { notify(blocked, 5000); return false; }

    try {
      const estimatedCleanupDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      if (viaArea) {
        await areaAssignTeam(report.id, teamId, fee);
      } else {
        const result = await assignCleanupTeam(report.id, teamId, estimatedCleanupDate, fee);
        if (result?.error) throw result.error;
      }

      setDumpingReportData(prev => prev.map(r => (r.id === report.id
        ? { ...r, cleanupAssigned: true, cleanupTeam: teamName, collectorId: teamId, status: 'verified' }
        : r)));
      notify(volunteer ? `Cleanup assigned to volunteer group ${teamName}` : `Cleanup assigned to ${teamName}`);
      return true;
    } catch (error) {
      console.error('Error assigning cleanup:', error);
      notify(assignmentFailedMessage(error), 5000);
      return false;
    }
  };

  // Status actions offered for a report in the details panel
  const getStatusActions = (report) => {
    if (!report) return [];
    const s = normalizeEnum(report.status);
    const actions = [];
    if (s === 'pending' && canVerify) actions.push({ key: 'verify', label: 'Verify Report', icon: 'fa-check-circle', className: 'bg-yellow-500 text-white hover:bg-yellow-600', run: () => updateReportStatus(report, 'verified') });
    if (canAssign && (s === 'pending' || s === 'verified') && !report.cleanupAssigned) actions.push({ key: 'assign', label: 'Assign Cleanup Team', icon: 'fa-user-plus', className: 'bg-green-600 text-white hover:bg-green-700', run: () => openCollectorModal(report) });
    if (s === 'in_progress' && canMarkCleaned) actions.push({ key: 'complete', label: 'Mark Completed', icon: 'fa-broom', className: 'bg-green-600 text-white hover:bg-green-700', run: () => updateReportStatus(report, 'completed') });
    if (canManageReports && (s === 'pending' || s === 'verified')) actions.push({ key: 'cancel', label: 'Cancel Report', icon: 'fa-ban', className: 'border border-gray-300 text-gray-600 hover:bg-gray-50', run: () => updateReportStatus(report, 'cancelled') });
    return actions;
  };

  const activeFilterTotal = filters.status.length + filters.severity.length + filters.wasteType.length + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0);

  const kpiCards = [
    { label: 'Total Reports', value: stats.total, sub: activeFilterTotal ? `of ${dumpingReportData.length} (filtered)` : 'all reports', icon: 'fa-flag', bg: 'bg-blue-50', color: 'text-blue-600', border: 'border-blue-100' },
    {
      label: 'Verification Rate',
      value: stats.verificationRate === null ? '—' : `${stats.verificationRate.toFixed(1)}%`,
      sub: `${stats.confirmed} of ${stats.eligibleForVerification} non-cancelled`,
      title: 'Reports verified, in progress or completed, as a share of all reports except cancelled ones',
      icon: 'fa-shield-alt', bg: 'bg-green-50', color: 'text-green-600', border: 'border-green-100'
    },
    { label: 'Cleaned Up', value: stats.cleanedUp, sub: 'status completed', icon: 'fa-broom', bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-100' },
    {
      label: 'Avg Cleanup Time',
      value: formatHours(stats.avgCleanupHours),
      sub: stats.cleanupSampleSize ? `from ${stats.cleanupSampleSize} completed` : 'no completed reports',
      title: 'Average time from report to completion, for completed reports only',
      icon: 'fa-clock', bg: 'bg-orange-50', color: 'text-orange-600', border: 'border-orange-100'
    },
  ];

  const renderChip = ({ key, active, color, label, count, onClick }) => (
    <button
      key={key}
      className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-all whitespace-nowrap ${active ? 'shadow-sm' : 'hover:shadow-sm'}`}
      style={{
        backgroundColor: active ? color : '#F9FAFB',
        borderColor: active ? color : '#E5E7EB',
        color: active ? 'white' : '#374151',
      }}
      onClick={onClick}
    >
      {label} <span className={active ? 'opacity-80' : 'text-gray-500'}>{count || 0}</span>
    </button>
  );

  return (
    <div className="bg-gray-50 min-h-screen">

      <AreaScopeNote area={privateView && role === 'user' ? { level: 'home' } : area} readOnly={!(canVerify || canAssign || canMarkCleaned)} />
      {/* Page Header + Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Illegal Dumping Map</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor and manage illegal dumping reports geographically</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastUpdated && (
            <span className="text-xs text-gray-500" title={lastUpdated.toLocaleString()}>
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
              loading ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
            }`}
          >
            <i className={`fas fa-sync-alt text-xs ${loading ? 'fa-spin' : ''}`}></i>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI Cards: computed from the same filtered list as the map */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {kpiCards.map(({ label, value, sub, title, icon, bg, color, border }) => (
          <div key={label} className={`bg-white rounded-xl shadow-sm border ${border} p-4 flex items-center gap-4`} title={title}>
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${icon} ${color}`}></i>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-gray-800 leading-tight">{hasLoaded ? value : '—'}</p>
              {hasLoaded && sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-20 right-4 bg-gray-800 text-white shadow-xl rounded-lg px-4 py-3 z-[10000] flex items-center gap-3 max-w-sm">
          <i className="fas fa-info-circle text-blue-300 flex-shrink-0"></i>
          <span className="text-sm">{toastMessage}</span>
          <button className="ml-auto text-gray-500 hover:text-white" onClick={() => setShowToast(false)}>
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>
      )}

      {/* Filters section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 mb-5">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <i className="fas fa-filter text-gray-500 text-sm"></i>
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
            {activeFilterTotal > 0 && (
              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {activeFilterTotal} active
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
              {Object.values(STATUS.ILLEGAL_DUMPING).map((value) => renderChip({
                key: value,
                active: filters.status.includes(value),
                color:
                  value === STATUS.ILLEGAL_DUMPING.REPORTED ? '#F59E0B' :
                  value === STATUS.ILLEGAL_DUMPING.VERIFIED ? '#14B8A6' :
                  value === STATUS.ILLEGAL_DUMPING.CLEANUP_SCHEDULED ? '#3B82F6' :
                  value === STATUS.ILLEGAL_DUMPING.CLEANED_UP ? '#10B981' :
                  '#6B7280',
                label: statusLabel(value),
                count: statusCounts[value],
                onClick: () => handleFilterChange('status', value),
              }))}
            </div>
          </div>

          {/* Severity filters */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Severity</p>
            <div className="flex flex-nowrap overflow-x-auto gap-1 pb-0.5" style={{scrollbarWidth:'none'}}>
              {SEVERITY_OPTIONS.map(({ value, label, color }) => renderChip({
                key: value,
                active: filters.severity.includes(value),
                color,
                label,
                count: severityCounts[value],
                onClick: () => handleFilterChange('severity', value),
              }))}
            </div>
          </div>

          {/* Waste type filters */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Waste Type</p>
            <div className="flex flex-nowrap overflow-x-auto gap-1 pb-0.5" style={{scrollbarWidth:'none'}}>
              {wasteTypeOptions.map(({ value, label }) => renderChip({
                key: value,
                active: filters.wasteType.includes(value),
                color: '#2563EB',
                label,
                count: wasteTypeCounts[value],
                onClick: () => handleFilterChange('wasteType', value),
              }))}
            </div>
          </div>
        </div>

        {/* Date range + report count */}
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-end gap-2 flex-1 min-w-[260px]">
            <div className="flex-1">
              <label htmlFor="dump-date-start" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">From</label>
              <input
                id="dump-date-start"
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
                value={dateRange.start || ''}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
              />
            </div>
            <span className="text-gray-500 mb-2 text-sm">→</span>
            <div className="flex-1">
              <label htmlFor="dump-date-end" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">To</label>
              <input
                id="dump-date-end"
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
                value={dateRange.end || ''}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-0.5">
            <i className="fas fa-map-marker-alt text-green-600 text-xs"></i>
            <span className="text-sm font-semibold text-green-700">{matchingReports.length}</span>
            <span className="text-xs text-green-600">of {dumpingReportData.length} reports shown</span>
            {missingCoordinates > 0 && (
              <span className="text-xs text-amber-600 ml-1" title="These reports have no coordinates, so they can't be plotted">
                ({missingCoordinates} without coordinates)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Map container */}
        <div className="md:col-span-2 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative" style={{ height: "600px" }}>
          {!hasLoaded ? (
            <div className="bg-gray-100 h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <MapContainer
              center={appConfig.services.maps.defaultCenter}
              zoom={appConfig.services.maps.defaultZoom}
              style={{ height: "100%", width: "100%" }}
              ref={mapRef}
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

              {/* Auto-fit bounds when the filtered set changes */}
              <MapBoundsUpdater reports={filteredReports} />

              {/* Markers for dumping reports, clustered so stacked reports stay countable */}
              <MarkerClusterGroup
                chunkedLoading
                showCoverageOnHover={false}
                spiderfyOnMaxZoom
                maxClusterRadius={45}
                iconCreateFunction={createClusterIcon}
              >
                {filteredReports.map(report => (
                  <Marker
                    key={report.id}
                    position={[report.location.lat, report.location.lng]}
                    icon={getMarkerIcon(report.severity)}
                    severity={report.severity}
                    title={`Dumping report, ${report.severity || 'unknown'} severity`}
                    eventHandlers={{
                      click: () => setSelectedId(report.id)
                    }}
                  >
                    <Popup className="custom-popup" minWidth={220}>
                      <div className="p-2">
                        <p className="text-xs text-gray-500 font-mono truncate mb-1" style={{maxWidth: 200}}>{report.id}</p>
                        <div className="space-y-1 text-sm mb-2">
                          <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${statusBadgeClass(report.status)}`}>
                            {statusLabel(report.status)}
                          </span>
                          <p className="text-gray-600"><span className="font-medium">Type:</span> {toTitle(report.wasteType)}</p>
                          <p className="text-gray-600"><span className="font-medium">Severity:</span>{' '}
                            <span className="font-semibold" style={{ color: getSeverityColor(report.severity) }}>{toTitle(report.severity)}</span>
                          </p>
                          <p className="text-gray-600 text-xs leading-snug">{report.location.address}</p>
                        </div>
                        <button
                          className="w-full bg-green-600 text-white text-xs px-2 py-1.5 rounded-md hover:bg-green-700 font-medium"
                          onClick={() => openDetailsModal(report)}
                        >
                          Full Details
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          )}

          {/* No reports overlay */}
          {hasLoaded && filteredReports.length === 0 && (
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

          {/* Reports plotted outside Ghana */}
          {hasLoaded && outsideGhanaReports.length > 0 && (
            <div className="absolute top-3 right-3 z-[450] max-w-xs">
              <button
                onClick={() => setShowOutsideList(v => !v)}
                className="bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 ml-auto"
                title={`Outside Ghana's bounds (lat ${GHANA_BOUNDS.minLat}–${GHANA_BOUNDS.maxLat}, lng ${GHANA_BOUNDS.minLng}–${GHANA_BOUNDS.maxLng})`}
              >
                <i className="fas fa-exclamation-triangle"></i>
                {outsideGhanaReports.length} outside Ghana
              </button>
              {showOutsideList && (
                <div className="mt-2 bg-white rounded-lg shadow-lg border border-amber-200 p-2 text-xs space-y-1 max-h-64 overflow-y-auto">
                  <p className="text-gray-500 px-1 pb-1">Check these coordinates (test data or wrong location?)</p>
                  {outsideGhanaReports.map(r => (
                    <button key={r.id} onClick={() => focusReport(r)} className="block w-full text-left px-1.5 py-1 rounded hover:bg-amber-50">
                      <span className="font-mono text-gray-700 block truncate">{r.id}</span>
                      <span className="text-gray-500">{r.location.lat.toFixed(5)}, {r.location.lng.toFixed(5)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Severity legend */}
          {hasLoaded && (
            <div data-testid="severity-legend" className="absolute bottom-4 right-4 bg-white bg-opacity-95 rounded-lg shadow-md px-3 py-2 z-[400] text-xs text-gray-700">
              <p className="font-semibold text-gray-500 uppercase tracking-wider text-xs mb-1">Severity</p>
              {[...SEVERITY_OPTIONS, { value: 'unknown', label: 'Unknown', color: UNKNOWN_SEVERITY_COLOR }].map(o => (
                <div key={o.value} className="flex items-center gap-1.5 leading-5">
                  <span className="inline-block w-3 h-3 rounded-full border border-white shadow" style={{ backgroundColor: o.color }}></span>
                  {o.label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 leading-5 mt-1 pt-1 border-t border-gray-100">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-800 text-white text-xs font-semibold">5</span>
                Cluster (ring = most severe)
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
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 rounded-t-xl flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Report Details</h3>
                  <p className="text-green-200 text-xs mt-0.5 font-mono truncate">{selectedDumping.id}</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-green-100 hover:text-white" title="Close">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="p-4">
                {/* Photo */}
                {selectedDumping.images.length > 0 ? (
                  <div className="mb-3">
                    <a href={selectedDumping.images[0]} target="_blank" rel="noopener noreferrer" className="block">
                      <EnhancedImage
                        src={selectedDumping.images[0]}
                        alt="Reported dumping site"
                        className="w-full h-40 object-cover rounded-lg border border-gray-200"
                        style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                      />
                    </a>
                    {selectedDumping.images.length > 1 && (
                      <div className="flex gap-1.5 mt-1.5">
                        {selectedDumping.images.slice(1, 5).map((img, idx) => (
                          <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block w-12 h-12">
                            <EnhancedImage src={img} alt={`Photo ${idx + 2}`} className="w-12 h-12 object-cover rounded border border-gray-200" style={{ width: '48px', height: '48px', objectFit: 'cover' }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-3 h-24 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-500">
                    <i className="fas fa-camera mr-1.5"></i> No photo submitted
                  </div>
                )}

                {isOutsideGhana(selectedDumping) && (
                  <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">
                    <i className="fas fa-exclamation-triangle mr-1"></i>
                    This report's coordinates are outside Ghana. Check whether it's test data or a wrong location.
                  </div>
                )}

                <div className="space-y-3">
                  {/* Status + Severity badges */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${statusBadgeClass(selectedDumping.status)}`}>
                        {statusLabel(selectedDumping.status)}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-500 mb-1">Severity</p>
                      <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${severityBadgeClass(selectedDumping.severity)}`}>
                        {toTitle(selectedDumping.severity) || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3 space-y-2.5">
                    <div>
                      <p className="text-xs text-gray-500">Description</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{selectedDumping.description || 'No description provided'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-500">Waste Type</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{toTitle(selectedDumping.wasteType) || 'N/A'}</p>
                      </div>
                      {selectedDumping.size && (
                        <div>
                          <p className="text-xs text-gray-500">Size</p>
                          <p className="text-sm font-medium text-gray-800 mt-0.5">{toTitle(selectedDumping.size)}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5 leading-snug">{selectedDumping.location.address}</p>
                      {hasCoordinates(selectedDumping) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {selectedDumping.location.lat.toFixed(5)}, {selectedDumping.location.lng.toFixed(5)}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-500">Reported</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">
                          {selectedDumping.reportedAt ? new Date(selectedDumping.reportedAt).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      {selectedDumping.reportedBy && <div>
                        <p className="text-xs text-gray-500">Reporter</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5 break-words">{selectedDumping.reportedBy}</p>
                        {selectedDumping.reporterEmail && selectedDumping.reporterEmail !== selectedDumping.reportedBy && (
                          <p className="text-xs text-gray-500 break-words">{selectedDumping.reporterEmail}</p>
                        )}
                      </div>}
                    </div>
                    {selectedDumping.cleanupTeam && (
                      <div>
                        <p className="text-xs text-gray-500">Assigned Collector</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{selectedDumping.cleanupTeam}</p>
                      </div>
                    )}
                    {selectedDumping.resolvedAt && (
                      <div>
                        <p className="text-xs text-gray-500">Completed</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{new Date(selectedDumping.resolvedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status actions (managers and admins) */}
                <div className="mt-4 space-y-2">
                  {getStatusActions(selectedDumping).map(action => (
                    <button
                      key={action.key}
                      onClick={action.run}
                      disabled={updatingStatus}
                      className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 ${action.className}`}
                    >
                      <i className={`fas ${action.icon} text-xs`}></i>
                      {action.label}
                    </button>
                  ))}
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
              <p className="text-sm font-medium text-gray-500 text-center">Click a marker on the map</p>
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
                  <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${statusBadgeClass(detailsReport.status)}`}>
                    {statusLabel(detailsReport.status)}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Severity</p>
                  <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${severityBadgeClass(detailsReport.severity)}`}>
                    {toTitle(detailsReport.severity) || 'Unknown'}
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
                  <p className="font-medium text-sm mt-0.5">{toTitle(detailsReport.wasteType) || 'N/A'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="font-medium text-sm mt-0.5">{detailsReport.location?.address || 'Unknown Location'}</p>
                  {hasCoordinates(detailsReport) && (
                    <p className="text-xs text-gray-500 mt-0.5">
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
                    <p className="text-xs text-gray-500">Completed At</p>
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
              {canAssign && !detailsReport.cleanupAssigned && ['pending', 'verified'].includes(normalizeEnum(detailsReport.status)) && (
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    openCollectorModal(detailsReport);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
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


      {showCollectorModal && selectedReportForAssignment && (
        <AssignCleanupModal report={selectedReportForAssignment} onAssign={assignCleanupTeamHandler}
          loadTeams={viaArea ? fetchAreaTeams : undefined} allowFee={canSetFee}
          onClose={() => { setShowCollectorModal(false); setSelectedReportForAssignment(null); }} />
      )}
    </div>
  );
};

export default IllegalDumpingMap;
