import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import CollectorMapMarker from '../components/maps/CollectorMapMarker';
import CollectorDetailPanel from '../components/maps/CollectorDetailPanel';
import { fetchCollectorsForMap, updateCollectorStatus } from '../utils/collectorService';
import { fetchPickupRequests } from '../utils/pickupService';
import { supabase } from '../utils/supabase';
import { DEFAULT_MAP_VIEW } from '../utils/mapCoordinates';
import useEscapeKey from '../hooks/useEscapeKey';
import {
  STATUS_GROUPS, OTHER_STATUS_GROUP, statusGroupOf, statusText, withRequestPosition, withCollectorPosition,
  matchesRequestFilters, summarize, relativeTime, capacityBadgeClass, localDateKey, collectorLastSeen,
  COLLECTOR_ONLINE_COLOR, COLLECTOR_OFFLINE_COLOR,
} from '../utils/liveMapUtils';

const REFRESH_MS = 30000;
const REQUEST_LIMIT = 500; // newest rows per request table
const FIT_OPTIONS = { padding: [40, 40], maxZoom: 15 };

// Theme-aware surfaces (the app's dark mode is driven by these CSS variables)
const card = { background: 'var(--td-card-bg)', borderColor: 'var(--td-card-border)', color: 'var(--td-text-primary)' };
const input = { background: 'var(--td-input-bg)', borderColor: 'var(--td-input-border)', color: 'var(--td-input-text)' };
const muted = { color: 'var(--td-text-secondary)' };

const iconCache = {};
const requestIcon = (status) => {
  const { key, color } = statusGroupOf(status);
  if (!iconCache[key]) {
    iconCache[key] = L.divIcon({
      className: 'custom-marker-icon',
      html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -10],
    });
  }
  return iconCache[key];
};

const clusterIcon = (cluster) => {
  const count = cluster.getChildCount();
  const size = count < 10 ? 34 : count < 50 ? 40 : 46;
  return L.divIcon({
    className: 'live-map-cluster-icon',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#1F2937;color:#fff;border:3px solid rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;font:600 13px/1 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.35)">${count}</div>`,
    iconSize: [size, size],
  });
};

const formatDateTime = (value) => {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const StatusPill = ({ status }) => {
  const group = statusGroupOf(status);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: group.color }}>
      {statusText(status)}
    </span>
  );
};

/** Gives the parent the map, enables scroll zoom only after a click (or with Ctrl/Cmd) */
function MapBridge({ onReady, onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (!onMapClick) return undefined;
    map.on('click', onMapClick);
    return () => { map.off('click', onMapClick); };
  }, [map, onMapClick]);
  useEffect(() => {
    onReady(map);
    const container = map.getContainer();
    const enable = () => map.scrollWheelZoom.enable();
    const disable = () => map.scrollWheelZoom.disable();
    const ctrlWheel = (e) => {
      if (map.scrollWheelZoom.enabled() || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      map.setZoom(map.getZoom() + (e.deltaY < 0 ? 1 : -1));
    };
    map.on('click', enable);
    container.addEventListener('mouseleave', disable);
    container.addEventListener('wheel', ctrlWheel, { passive: false });
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => {
      clearTimeout(t);
      map.off('click', enable);
      container.removeEventListener('mouseleave', disable);
      container.removeEventListener('wheel', ctrlWheel);
    };
  }, [map, onReady]);
  return null;
}

const todayKey = () => localDateKey(new Date());
const DEFAULT_FILTERS = () => ({ statusGroups: [], dateFrom: todayKey(), dateTo: todayKey(), collectorId: 'all', showCollectors: true });

const LiveMap = () => {
  const [requests, setRequests] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showIssues, setShowIssues] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());

  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const hasFitted = useRef(false);
  const collectorMarkers = useRef({});
  const loadingRef = useRef(false);

  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Data ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);
    try {
      const [requestRows, collectorRows] = await Promise.all([
        fetchPickupRequests({ limit: REQUEST_LIMIT, strict: true }),
        fetchCollectorsForMap(),
      ]);
      setRequests(requestRows.map(withRequestPosition));
      setCollectors(collectorRows.map(withCollectorPosition));
      setLastUpdated(new Date());
      setNow(Date.now());
      setLoadError(null);
    } catch (error) {
      console.error('Live map: failed to load data', error);
      setLoadError(error?.message || 'Could not load map data');
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  // First load, a 30 s refresh while the tab is visible, and realtime nudges
  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadData();
    }, REFRESH_MS);

    let debounce;
    const nudge = () => {
      clearTimeout(debounce);
      debounce = setTimeout(loadData, 1500);
    };
    const channel = supabase.channel(`live_map_${Date.now()}`);
    ['pickup_requests', 'digital_bins', 'collector_profiles'].forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, nudge);
    });
    channel.subscribe();

    return () => {
      clearInterval(timer);
      clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredRequests = useMemo(() => requests.filter(r => matchesRequestFilters(r, filters)), [requests, filters]);
  const mappedRequests = useMemo(() => filteredRequests.filter(r => r.position), [filteredRequests]);
  const invalidRequests = useMemo(() => filteredRequests.filter(r => !r.position), [filteredRequests]);
  const swappedRequests = useMemo(() => mappedRequests.filter(r => r.swapped), [mappedRequests]);

  const visibleCollectors = useMemo(
    () => (filters.collectorId === 'all' ? collectors : collectors.filter(c => String(c.id) === String(filters.collectorId))),
    [collectors, filters.collectorId]
  );
  const mappedCollectors = useMemo(
    () => (filters.showCollectors ? visibleCollectors.filter(c => c.position) : []),
    [visibleCollectors, filters.showCollectors]
  );
  const counts = summarize(mappedRequests, collectors);

  // ── Map view ──────────────────────────────────────────────────────────────
  const fitToMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const points = [...mappedRequests.map(r => r.position), ...mappedCollectors.map(c => c.position)];
    if (points.length === 0) {
      map.setView([DEFAULT_MAP_VIEW.lat, DEFAULT_MAP_VIEW.lng], DEFAULT_MAP_VIEW.zoom);
    } else if (points.length === 1) {
      map.setView(points[0], FIT_OPTIONS.maxZoom);
    } else {
      map.fitBounds(L.latLngBounds(points), FIT_OPTIONS);
    }
  }, [mappedRequests, mappedCollectors]);

  const onMapReady = useCallback((map) => { mapRef.current = map; setMapReady(true); }, []);

  // Fit once, after the first successful load. Refreshes keep the user's view.
  useEffect(() => {
    if (!initialLoading && lastUpdated && mapReady && !hasFitted.current) {
      hasFitted.current = true;
      fitToMarkers();
    }
  }, [initialLoading, lastUpdated, mapReady, fitToMarkers]);

  const closeRequest = useCallback(() => setSelectedRequest(null), []);
  const closeIssues = useCallback(() => setShowIssues(false), []);
  useEscapeKey(Boolean(selectedRequest), closeRequest);

  const focusCollector = (collector) => {
    if (!collector.position || !mapRef.current) {
      setSelectedCollector(collector);
      return;
    }
    if (!filters.showCollectors) setFilters(f => ({ ...f, showCollectors: true }));
    mapRef.current.flyTo(collector.position, 16, { duration: 0.8 });
    mapRef.current.once('moveend', () => collectorMarkers.current[collector.id]?.openPopup());
    mapRef.current.getContainer().scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleStatusChange = async (collectorId, newStatus) => {
    try {
      await updateCollectorStatus(collectorId, newStatus);
      notify(`Status updated to ${newStatus}`);
      loadData();
    } catch (error) {
      notify('Failed to update status');
    }
  };

  const toggleStatusGroup = (key) => setFilters(f => ({
    ...f,
    statusGroups: f.statusGroups.includes(key) ? f.statusGroups.filter(k => k !== key) : [...f.statusGroups, key],
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading live map">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg border" style={card} />)}
        </div>
        <div className="h-10 rounded-lg border" style={card} />
        <div className="h-[60vh] min-h-[360px] rounded-lg bg-gray-300 opacity-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-lg border" style={card} />)}
        </div>
      </div>
    );
  }

  if (loadError && !lastUpdated) {
    return (
      <div className="rounded-lg border p-8 text-center" style={card} role="alert">
        <i className="fas fa-exclamation-triangle text-3xl text-red-500 mb-3"></i>
        <h2 className="text-lg font-semibold mb-1">Couldn't load the live map</h2>
        <p className="text-sm mb-4" style={muted}>{loadError}</p>
        <button onClick={loadData} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Retry</button>
      </div>
    );
  }

  const legendGroups = [...STATUS_GROUPS, ...(requests.some(r => statusGroupOf(r.status) === OTHER_STATUS_GROUP) ? [OTHER_STATUS_GROUP] : [])];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Requests on map', value: counts.total, icon: 'fa-map-marker-alt', color: '#1F2937' },
          { label: 'Pending', value: counts.pending, icon: 'fa-clock', color: STATUS_GROUPS[0].color },
          { label: 'In progress', value: counts.inProgress, icon: 'fa-truck-moving', color: STATUS_GROUPS[2].color },
          { label: 'Collectors online', value: `${counts.collectorsOnline} / ${counts.collectorsTotal}`, icon: 'fa-user-check', color: COLLECTOR_ONLINE_COLOR },
        ].map(s => (
          <div key={s.label} className="rounded-lg border px-4 py-3 flex items-center gap-3" style={card}>
            <i className={`fas ${s.icon}`} style={{ color: s.color }}></i>
            <div>
              <p className="text-xs" style={muted}>{s.label}</p>
              <p className="text-xl font-bold leading-tight" data-testid={`summary-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-lg border px-4 py-3 flex flex-wrap items-end gap-x-5 gap-y-3" style={card}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={muted}>Status</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_GROUPS.map(g => {
              const active = filters.statusGroups.includes(g.key);
              return (
                <button key={g.key} type="button" aria-pressed={active} onClick={() => toggleStatusGroup(g.key)}
                  className="text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5"
                  style={active ? { background: g.color, borderColor: g.color, color: '#fff' } : input}>
                  <span className="w-2 h-2 rounded-full" style={{ background: active ? '#fff' : g.color }}></span>
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="text-xs">
          <span className="block font-semibold uppercase tracking-wider mb-1.5" style={muted}>From</span>
          <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined}
            onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
            className="px-2 py-1.5 text-sm border rounded" style={input} />
        </label>
        <label className="text-xs">
          <span className="block font-semibold uppercase tracking-wider mb-1.5" style={muted}>To</span>
          <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined}
            onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
            className="px-2 py-1.5 text-sm border rounded" style={input} />
        </label>
        <label className="text-xs">
          <span className="block font-semibold uppercase tracking-wider mb-1.5" style={muted}>Collector</span>
          <select value={filters.collectorId} onChange={e => setFilters(f => ({ ...f, collectorId: e.target.value }))}
            className="px-2 py-1.5 text-sm border rounded min-w-[150px]" style={input}>
            <option value="all">All collectors</option>
            {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none pb-1.5">
          <input type="checkbox" className="accent-green-600" checked={filters.showCollectors}
            onChange={e => setFilters(f => ({ ...f, showCollectors: e.target.checked }))} />
          Show collectors
        </label>
        <button type="button" onClick={() => setFilters(DEFAULT_FILTERS())} className="text-xs underline pb-2" style={muted}>Reset</button>
        <div className="ml-auto flex items-center gap-3 pb-1">
          <span className="text-xs" style={muted} data-testid="last-updated">
            Last updated {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          </span>
          <button type="button" onClick={loadData} disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
            <i className={`fas fa-sync-alt text-xs ${refreshing ? 'fa-spin' : ''}`}></i> Refresh
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-2 text-sm flex items-center justify-between" role="alert">
          <span>Couldn't refresh: {loadError}. Showing data from {lastUpdated?.toLocaleTimeString()}.</span>
          <button onClick={loadData} className="underline font-medium">Retry</button>
        </div>
      )}

      {/* Map */}
      <div className="relative w-full h-[60vh] min-h-[360px] rounded-lg overflow-hidden border" style={{ borderColor: 'var(--td-card-border)' }}>
        <MapContainer
          center={[DEFAULT_MAP_VIEW.lat, DEFAULT_MAP_VIEW.lng]}
          zoom={DEFAULT_MAP_VIEW.zoom}
          scrollWheelZoom={false}
          keyboard
          zoomControl
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <MapBridge onReady={onMapReady} onMapClick={closeIssues} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} spiderfyOnMaxZoom zoomToBoundsOnClick maxClusterRadius={45} iconCreateFunction={clusterIcon}>
            {mappedRequests.map(request => (
              <Marker key={`${request.source}-${request.id}`} position={request.position} icon={requestIcon(request.status)}>
                <Tooltip direction="top" offset={[0, -10]}>
                  {request.requestedBy?.name && request.requestedBy.name !== 'Unknown Customer' ? request.requestedBy.name : `#${String(request.id).slice(0, 8)}`}
                </Tooltip>
                <Popup>
                  <div className="text-sm min-w-[220px] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-gray-500" title={request.id}>#{String(request.id).slice(0, 8)}</span>
                      <StatusPill status={request.status} />
                    </div>
                    <p className="font-semibold text-gray-900">{request.requestedBy?.name || 'Unknown customer'}</p>
                    <p className="text-gray-700">{request.location?.address && request.location.address !== 'Unknown Location' ? request.location.address : 'No address given'}</p>
                    <p className="text-gray-700">
                      {request.wasteType || 'General'}{request.bags ? ` · ${request.bags} bag${request.bags > 1 ? 's' : ''}` : ''}
                      {request.source === 'digital_bins' ? ' · Digital bin' : request.source === 'scheduled_pickups' ? ' · Scheduled' : ''}
                    </p>
                    <p className="text-gray-500 text-xs">Requested {formatDateTime(request.requestTime)} ({relativeTime(request.requestTime, now)})</p>
                    <p className="text-gray-700 text-xs">Collector: {request.collectorName || 'Not assigned'}</p>
                    {request.swapped && <p className="text-amber-700 text-xs">Stored with latitude/longitude swapped; shown corrected.</p>}
                    <button type="button" className="text-blue-600 hover:underline text-xs font-medium" onClick={() => setSelectedRequest(request)}>
                      View request →
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {mappedCollectors.map(collector => (
            <CollectorMapMarker
              key={`collector-${collector.id}`}
              collector={collector}
              onViewDetails={setSelectedCollector}
              markerRef={(m) => { if (m) collectorMarkers.current[collector.id] = m; else delete collectorMarkers.current[collector.id]; }}
            />
          ))}
        </MapContainer>

        {/* Recenter + invalid-location warning (top right) */}
        <div className="absolute top-3 right-3 z-[500] flex flex-col items-end gap-2">
          <button type="button" onClick={fitToMarkers} className="px-3 py-1.5 rounded shadow text-sm font-medium border" style={card} title="Fit the map to all markers">
            <i className="fas fa-crosshairs mr-1.5"></i>Recenter
          </button>
          {(invalidRequests.length > 0 || swappedRequests.length > 0) && (
            <button type="button" onClick={() => setShowIssues(v => !v)} aria-expanded={showIssues}
              className="px-3 py-1.5 rounded shadow text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300">
              <i className="fas fa-exclamation-triangle mr-1.5"></i>
              {invalidRequests.length > 0
                ? `${invalidRequests.length} request${invalidRequests.length > 1 ? 's have' : ' has'} invalid locations`
                : `${swappedRequests.length} location${swappedRequests.length > 1 ? 's' : ''} corrected`}
            </button>
          )}
          {showIssues && (
            <div className="w-72 max-w-[85vw] max-h-64 overflow-y-auto rounded shadow-lg border text-xs" style={card}>
              {invalidRequests.length > 0 && <p className="px-3 pt-2 font-semibold">Not shown on the map</p>}
              {invalidRequests.map(r => (
                <div key={`bad-${r.source}-${r.id}`} className="px-3 py-1.5 border-b last:border-b-0" style={{ borderColor: 'var(--td-card-border)' }}>
                  <span className="font-mono">#{String(r.id).slice(0, 8)}</span> · {r.requestedBy?.name || 'Unknown'} · {formatDateTime(r.requestTime)}
                  <span className="block text-red-600">{r.locationIssue}</span>
                </div>
              ))}
              {swappedRequests.length > 0 && <p className="px-3 pt-2 font-semibold">Lat/lng swapped (shown corrected)</p>}
              {swappedRequests.map(r => (
                <div key={`swap-${r.source}-${r.id}`} className="px-3 py-1.5 border-b last:border-b-0" style={{ borderColor: 'var(--td-card-border)' }}>
                  <span className="font-mono">#{String(r.id).slice(0, 8)}</span> · {r.requestedBy?.name || 'Unknown'} · {formatDateTime(r.requestTime)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend (bottom left) */}
        <div className="absolute bottom-6 left-3 z-[500] rounded shadow border px-3 py-2 text-xs space-y-1" style={card} aria-label="Map legend">
          {legendGroups.map(g => (
            <div key={g.key} className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border border-white" style={{ background: g.color }}></span>{g.label}</div>
          ))}
          <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--td-card-border)' }}>
            <span className="w-3 h-3 rounded-full" style={{ background: COLLECTOR_ONLINE_COLOR }}></span>Collector online
          </div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: COLLECTOR_OFFLINE_COLOR }}></span>Collector offline (&gt;10 min)</div>
        </div>

        {/* Empty state */}
        {mappedRequests.length === 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] rounded shadow border px-4 py-2 text-sm text-center pointer-events-none" style={card}>
            No requests on the map for these filters
            {filteredRequests.length > 0 && <span className="block text-xs" style={muted}>({filteredRequests.length} without a valid location)</span>}
          </div>
        )}
      </div>
      <p className="text-xs -mt-2" style={muted}>Click the map to zoom with the scroll wheel, or hold Ctrl/⌘ while scrolling.</p>

      {/* Collectors */}
      {selectedCollector ? (
        <CollectorDetailPanel collector={selectedCollector} onClose={() => setSelectedCollector(null)} onStatusChange={handleStatusChange} />
      ) : (
        <div className="rounded-lg border p-4" style={card}>
          <div className="flex items-center mb-3">
            <i className="fas fa-truck-moving text-blue-500 text-lg mr-2"></i>
            <h3 className="font-semibold">Collector Status</h3>
            <span className="ml-2 text-xs" style={muted}>{counts.collectorsOnline} online of {counts.collectorsTotal}</span>
          </div>
          {collectors.length === 0 ? (
            <p className="text-sm text-center py-6" style={muted}>No collectors found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[...collectors].sort((a, b) => (b.status === 'active') - (a.status === 'active') || b.online - a.online).map(collector => {
                const capacity = collector.capacityUsed ?? 0;
                return (
                  <button
                    type="button"
                    key={collector.id}
                    onClick={() => focusCollector(collector)}
                    className={`text-left border rounded p-3 hover:shadow transition-shadow ${collector.status === 'active' ? '' : 'opacity-70'}`}
                    style={{ borderColor: 'var(--td-card-border)' }}
                    data-testid="collector-card"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: collector.online ? COLLECTOR_ONLINE_COLOR : COLLECTOR_OFFLINE_COLOR }} title={collector.online ? 'Online' : 'Offline'}></span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{collector.name}</h4>
                        <p className="text-xs truncate" style={muted}>
                          {collector.online ? 'Online' : 'Offline'} · {collector.assignedRegion}{collector.status !== 'active' ? ' · inactive account' : ''}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${capacityBadgeClass(capacity)}`}>{capacity}% cap</span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3 text-xs">
                      <span><span style={muted}>Completed </span><strong>{collector.stats?.completedToday || 0}</strong></span>
                      <span><span style={muted}>Pending </span><strong>{collector.stats?.pendingPickups || 0}</strong></span>
                      <span style={muted}>Updated {relativeTime(collectorLastSeen(collector), now)}</span>
                    </div>
                    {!collector.position && (
                      <span className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700" title={collector.locationIssue || ''}>
                        <i className="fas fa-map-marker-alt"></i> No location{collector.locationIssue && collector.locationIssue !== 'Missing coordinates' ? ` (${collector.locationIssue.toLowerCase()})` : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed top-20 right-4 z-[10000] bg-gray-800 text-white rounded-lg shadow-xl px-4 py-3 text-sm" role="status">{toast}</div>
      )}

      {/* Request details */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={() => setSelectedRequest(null)}>
          <div className="rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border" style={card}
            role="dialog" aria-modal="true" aria-labelledby="request-details-title" onClick={e => e.stopPropagation()}>
            <div className="border-b p-4 flex justify-between items-center" style={{ borderColor: 'var(--td-card-border)' }}>
              <h3 className="text-lg font-semibold" id="request-details-title">Pickup Request Details</h3>
              <button type="button" onClick={() => setSelectedRequest(null)} aria-label="Close" style={muted}><i className="fas fa-times"></i></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                ['Request ID', <span className="font-mono break-all">{selectedRequest.id}</span>],
                ['Status', <StatusPill status={selectedRequest.status} />],
                ['Customer', selectedRequest.requestedBy?.name || 'N/A'],
                ['Phone', selectedRequest.requestedBy?.phone || 'N/A'],
                ['Address', selectedRequest.location?.address || 'N/A', true],
                ['Waste type', `${selectedRequest.wasteType || 'General'}${selectedRequest.bags ? ` · ${selectedRequest.bags} bags` : ''}`],
                ['Source', selectedRequest.source === 'digital_bins' ? 'Digital bin' : selectedRequest.source === 'scheduled_pickups' ? 'Scheduled pickup' : 'Pickup request'],
                ['Requested', formatDateTime(selectedRequest.requestTime)],
                ['Assigned collector', selectedRequest.collectorName || 'Not assigned'],
                ['Coordinates', selectedRequest.position ? `${selectedRequest.position[0].toFixed(5)}, ${selectedRequest.position[1].toFixed(5)}` : (selectedRequest.locationIssue || 'N/A'), true],
              ].map(([label, value, wide]) => (
                <div key={label} className={wide ? 'md:col-span-2' : ''}>
                  <p className="text-xs" style={muted}>{label}</p>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={() => setSelectedRequest(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMap;
