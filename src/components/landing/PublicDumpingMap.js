import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { appConfig } from '../../config';
import { toTitle } from '../../utils/illegalDumpingReportUtils';
import { fetchPublicDumpingReports, timeAgo, cleanupDurationText } from '../../services/publicDumpingReportsService';

/**
 * Public, read-only illegal dumping map for the landing page (logged-out view).
 * Shows real reports from the public_illegal_dumping_reports view: active reports
 * coloured by severity, completed ones as "cleaned up". Clicking a marker shows
 * details only; there are no edit or status actions here.
 */

// Matches the landing page's "Risk Level" legend
export const RISK_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#eab308', low: '#22c55e' };
const CLEANED_COLOR = '#15803d';
const UNKNOWN_COLOR = '#9ca3af';
const REFRESH_MS = 60000;
// Greater Accra
const DEFAULT_CENTER = appConfig.services.maps.defaultCenter;
const DEFAULT_ZOOM = appConfig.services.maps.defaultZoom;

const FONT_BODY = "'DM Sans', system-ui, sans-serif";
const FONT_LABEL = "'Syne', sans-serif";

const CHECK_SVG = '<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4 8-9"/></svg>';

const iconCache = {};
const markerIcon = (report) => {
  const key = report.isCleanedUp ? 'cleaned' : report.severity;
  if (!iconCache[key]) {
    iconCache[key] = report.isCleanedUp
      ? L.divIcon({
          className: 'td-pub-marker',
          html: `<div data-marker="cleaned" style="width:22px;height:22px;border-radius:50%;background:${CLEANED_COLOR};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;opacity:.92">${CHECK_SVG}</div>`,
          iconSize: [22, 22], iconAnchor: [11, 11],
        })
      : L.divIcon({
          className: 'td-pub-marker',
          html: `<div data-marker="active" data-severity="${report.severity}" style="width:18px;height:18px;border-radius:50%;background:${RISK_COLORS[report.severity] || UNKNOWN_COLOR};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
          iconSize: [18, 18], iconAnchor: [9, 9],
        });
  }
  return iconCache[key];
};

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const clusterIcon = (cluster) => {
  const markers = cluster.getAllChildMarkers();
  const active = markers.filter(m => !m.options.cleaned);
  const worst = active.reduce((acc, m) => ((SEVERITY_RANK[m.options.severity] || 0) > (SEVERITY_RANK[acc] || 0) ? m.options.severity : acc), '');
  const ring = active.length === 0 ? CLEANED_COLOR : (RISK_COLORS[worst] || UNKNOWN_COLOR);
  const count = cluster.getChildCount();
  const size = count < 10 ? 34 : count < 50 ? 40 : 46;
  return L.divIcon({
    className: 'td-pub-cluster',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(10,15,10,.88);color:#fff;border:4px solid ${ring};display:flex;align-items:center;justify-content:center;font:700 13px/1 ${FONT_BODY};box-shadow:0 2px 8px rgba(0,0,0,.4)">${count}</div>`,
    iconSize: [size, size],
  });
};

// Fit the map to the reports when the shown set changes; Greater Accra otherwise.
const FitToReports = ({ reports }) => {
  const map = useMap();
  const key = reports.map(r => r.id).join(',');
  useEffect(() => {
    if (!reports.length) { map.setView(DEFAULT_CENTER, DEFAULT_ZOOM); return; }
    if (reports.length === 1) { map.setView([reports[0].location.lat, reports[0].location.lng], 14); return; }
    map.fitBounds(L.latLngBounds(reports.map(r => [r.location.lat, r.location.lng])), { padding: [40, 40], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
};

const VIEWS = [
  { key: 'active', label: 'Active' },
  { key: 'cleaned', label: 'Cleaned up' },
  { key: 'all', label: 'All' },
];

const PublicDumpingMap = ({ lp, isDark, children }) => {
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [view, setView] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchPublicDumpingReports();
      setReports(data);
      setStatus('ready');
      loadedOnce.current = true;
    } catch (err) {
      console.warn('Public dumping map: could not load reports:', err.message);
      // Keep showing the last good data on a failed background refresh
      if (!loadedOnce.current) setStatus('error');
    }
  }, []);

  // Initial load, then refresh every 60s while the tab is visible
  useEffect(() => {
    // The build's pre-render snapshot has no network: keep the loading state
    if (window.__PRERENDER__) return undefined;
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const counts = useMemo(() => ({
    active: reports.filter(r => !r.isCleanedUp).length,
    cleaned: reports.filter(r => r.isCleanedUp).length,
    all: reports.length,
  }), [reports]);

  const shown = useMemo(() => reports.filter(r => (
    view === 'all' ? true : view === 'cleaned' ? r.isCleanedUp : !r.isCleanedUp
  )), [reports, view]);

  const selected = useMemo(() => reports.find(r => r.id === selectedId) || null, [reports, selectedId]);

  const card = isDark
    ? { bg: '#111a13', border: 'rgba(168,230,61,0.18)', text: '#f3f4f6', sub: 'rgba(255,255,255,0.55)', chipBg: 'rgba(255,255,255,0.06)', photoBg: 'rgba(255,255,255,0.04)' }
    : { bg: '#ffffff', border: 'rgba(22,101,52,0.15)', text: '#111827', sub: '#6b7280', chipBg: '#f3f4f6', photoBg: '#f3f4f6' };

  const emptyText = view === 'cleaned' ? 'No cleaned-up reports yet' : view === 'active' ? 'No active reports right now' : 'No reports yet';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <style>{`
        .td-pub-marker, .td-pub-cluster { background: transparent; border: none; }
        .td-pub-card { position: absolute; top: 14px; left: 58px; width: 300px; max-height: calc(100% - 28px); overflow-y: auto; z-index: 1150; }
        @media (max-width: 640px) {
          .td-pub-card { position: fixed; top: auto; left: 0; right: 0; bottom: 0; width: auto; max-height: 70vh; border-radius: 18px 18px 0 0 !important; z-index: 3000; }
        }
      `}</style>

      {/* View toggle */}
      <div role="tablist" aria-label="Report filter" style={{ display: 'flex', gap: 6, alignSelf: 'flex-start', background: lp.mapLegendBg, border: `1px solid ${lp.mapLegendBorder}`, borderRadius: 999, padding: 4 }}>
        {VIEWS.map(v => {
          const active = view === v.key;
          return (
            <button
              key={v.key}
              role="tab"
              aria-selected={active}
              onClick={() => setView(v.key)}
              style={{ fontFamily: FONT_LABEL, fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', background: active ? '#a8e63d' : 'transparent', color: active ? '#0a0f0a' : lp.mapLegendText }}
            >
              {v.label} <span style={{ opacity: 0.7, fontWeight: 600 }}>{status === 'ready' ? counts[v.key] : ''}</span>
            </button>
          );
        })}
      </div>

      <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(168,230,61,0.14)', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', flex: 1, minHeight: 500 }}>
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%', minHeight: 500 }} scrollWheelZoom>
          <TileLayer
            url={appConfig.services.maps.tileProviders.openStreetMap.url}
            attribution={appConfig.services.maps.tileProviders.openStreetMap.attribution}
          />
          <FitToReports reports={shown} />
          <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} spiderfyOnMaxZoom maxClusterRadius={45} iconCreateFunction={clusterIcon}>
            {shown.map(r => (
              <Marker
                key={r.id}
                position={[r.location.lat, r.location.lng]}
                icon={markerIcon(r)}
                severity={r.severity}
                cleaned={r.isCleanedUp}
                title={`${r.isCleanedUp ? 'Cleaned up' : `${toTitle(r.severity)} risk`}${r.areaName ? ` · ${r.areaName}` : ''}`}
                eventHandlers={{ click: () => setSelectedId(r.id) }}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>

        {/* Loading / empty / error states */}
        {status !== 'ready' || shown.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, pointerEvents: status === 'error' ? 'auto' : 'none' }}>
            <div data-testid="public-map-state" style={{ background: lp.mapLegendBg, border: `1px solid ${lp.mapLegendBorder}`, borderRadius: 14, padding: '14px 20px', fontFamily: FONT_BODY, fontSize: 14, color: lp.mapLegendText, textAlign: 'center', backdropFilter: 'blur(10px)' }}>
              {status === 'loading' && (<><i className="fas fa-circle-notch fa-spin" style={{ marginRight: 8 }} />Loading reports…</>)}
              {status === 'error' && (
                <>
                  Live reports are unavailable right now.
                  <button onClick={() => { setStatus('loading'); load(); }} style={{ display: 'block', margin: '10px auto 0', fontFamily: FONT_LABEL, fontSize: 12, fontWeight: 700, background: '#1b6e35', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>Try again</button>
                </>
              )}
              {status === 'ready' && emptyText}
            </div>
          </div>
        ) : null}

        {/* Legend */}
        <div data-testid="public-map-legend" style={{ position: 'absolute', bottom: 16, left: 16, background: lp.mapLegendBg, backdropFilter: 'blur(14px)', border: `1px solid ${lp.mapLegendBorder}`, borderRadius: 12, padding: '12px 16px', zIndex: 1100 }}>
          <p style={{ fontFamily: FONT_LABEL, fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: lp.mapLegendLabel, textTransform: 'uppercase', margin: '0 0 8px' }}>Risk Level</p>
          {['critical', 'high', 'medium', 'low'].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: RISK_COLORS[s], display: 'inline-block' }} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: lp.mapLegendText }}>{toTitle(s)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${lp.mapLegendBorder}` }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: CLEANED_COLOR, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: CHECK_SVG.replace(/12/g, '9') }} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: lp.mapLegendText }}>Cleaned up</span>
          </div>
        </div>

        {/* Read-only details card */}
        {selected && (
          <div className="td-pub-card" role="dialog" aria-label="Report details" data-testid="public-report-card"
            style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.35)', fontFamily: FONT_BODY, color: card.text }}>
            <div style={{ position: 'relative' }}>
              {selected.photos.length > 0 ? (
                <button onClick={() => setLightbox(selected.photos[0])} title="View larger photo" style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: card.photoBg, cursor: 'zoom-in' }}>
                  <img src={selected.photos[0]} alt={`${toTitle(selected.wasteType)} waste reported${selected.areaName ? ` in ${selected.areaName}` : ''}`} loading="lazy" decoding="async"
                    style={{ display: 'block', width: '100%', height: 160, objectFit: 'cover', borderRadius: '16px 16px 0 0' }} />
                </button>
              ) : (
                <div style={{ height: 70, background: card.photoBg, borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: card.sub }}>
                  <i className="fas fa-camera" style={{ marginRight: 6 }} />No photo
                </div>
              )}
              <button onClick={() => setSelectedId(null)} aria-label="Close details" style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div style={{ padding: '14px 16px 16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {selected.isCleanedUp ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: CLEANED_COLOR, color: '#fff' }}>✓ Cleaned up</span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: `${RISK_COLORS[selected.severity] || UNKNOWN_COLOR}22`, color: RISK_COLORS[selected.severity] || UNKNOWN_COLOR, border: `1px solid ${RISK_COLORS[selected.severity] || UNKNOWN_COLOR}55` }}>
                    {toTitle(selected.severity)} risk
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: card.chipBg, color: card.sub }}>{toTitle(selected.status)}</span>
              </div>
              <p style={{ fontFamily: FONT_LABEL, fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>{toTitle(selected.wasteType)} waste</p>
              <p style={{ fontSize: 13, color: card.sub, margin: '0 0 12px' }}>
                <i className="fas fa-map-marker-alt" style={{ marginRight: 6 }} />{selected.areaName || 'Location shared on map'}
              </p>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 13, margin: 0 }}>
                <dt style={{ color: card.sub }}>Severity</dt><dd style={{ margin: 0 }}>{toTitle(selected.severity)}</dd>
                <dt style={{ color: card.sub }}>Reported</dt><dd style={{ margin: 0 }} title={new Date(selected.createdAt).toLocaleString()}>{timeAgo(selected.createdAt)}</dd>
                {selected.isCleanedUp && cleanupDurationText(selected.createdAt, selected.completedAt) && (
                  <><dt style={{ color: card.sub }}>Cleanup</dt><dd style={{ margin: 0 }}>{cleanupDurationText(selected.createdAt, selected.completedAt)}</dd></>
                )}
              </dl>
            </div>
          </div>
        )}

        {/* Section-specific overlays (analytics button, social feed) */}
        {children}
      </div>

      {/* Photo lightbox */}
      {lightbox && (
        <div role="dialog" aria-label="Photo" onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="Reported dumping site" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
          <button onClick={() => setLightbox(null)} aria-label="Close photo" style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>
            <i className="fas fa-times" />
          </button>
        </div>
      )}
    </div>
  );
};

export default PublicDumpingMap;
