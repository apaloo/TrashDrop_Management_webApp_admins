import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { appConfig } from '../../config';
import { FONT } from '../../theme/brand';
import { toTitle } from '../../utils/illegalDumpingReportUtils';
import { fetchPublicDumpingReports, timeAgo, cleanupDurationText, describeArea } from '../../services/publicDumpingReportsService';

/**
 * Public, read-only illegal dumping map for the landing page (logged-out view).
 * Shows real reports from the public_illegal_dumping_reports view: active reports
 * coloured by severity, completed ones as "cleaned up". Clicking a marker shows
 * details only; there are no edit or status actions here. "View more details"
 * goes to detailsHref (sign-up for visitors). With expandable, a button opens
 * the map full screen.
 */

// Matches the landing page's "Risk Level" legend
export const RISK_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#eab308', low: '#22c55e' };
const CLEANED_COLOR = '#15803d';
const UNKNOWN_COLOR = '#9ca3af';
const REFRESH_MS = 60000;
// Greater Accra
const DEFAULT_CENTER = appConfig.services.maps.defaultCenter;
const DEFAULT_ZOOM = appConfig.services.maps.defaultZoom;

const FONT_BODY = FONT;
const FONT_LABEL = FONT;

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

// The selected report's details, pinned to its marker with a pointer. The page
// owns opening and closing (close button, a click on the map, Escape), so
// Leaflet's own auto-close is off. It still pans the map to fit the card,
// clear of the full-screen button above it.
const PopupAtReport = ({ report, isDark, onClose, children }) => {
  useMapEvents({ click: onClose });
  const { lat, lng } = report.location;
  // A new array each render would reopen the popup; only a new place should
  const position = useMemo(() => [lat, lng], [lat, lng]);
  return (
    <Popup position={position} offset={[0, -8]} closeButton={false} closeOnClick={false} autoClose={false}
      closeOnEscapeKey={false} autoPanPaddingTopLeft={[16, 64]} autoPanPaddingBottomRight={[16, 16]} maxWidth={800} minWidth={0}
      className={`td-pub-popup${isDark ? ' td-pub-popup-dark' : ''}`}>
      {children}
    </Popup>
  );
};

// Leaflet measures its box once; tell it when the box changes size
const ResizeWith = ({ expanded }) => {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map, expanded]);
  return null;
};

const VIEWS = [
  { key: 'active', label: 'Active' },
  { key: 'cleaned', label: 'Cleaned up' },
  { key: 'all', label: 'All' },
];

/**
 * Loads the public reports once for the whole map section, so the map and the
 * stats row always show the same data. Refreshes every 60s while the tab is visible.
 */
export const usePublicDumpingReports = () => {
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
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

  useEffect(() => {
    // The build's pre-render snapshot has no network: keep the loading state
    if (window.__PRERENDER__) return undefined;
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const reload = useCallback(() => { setStatus('loading'); load(); }, [load]);
  return { reports, status, reload };
};

const PublicDumpingMap = ({ lp, isDark, data, children, detailsHref = '/signup', expandable = false }) => {
  const { reports, status, reload } = data;
  const [view, setView] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Escape closes the photo first, then leaves full screen
  useEffect(() => {
    if (!lightbox && !expanded && !selectedId) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (lightbox) setLightbox(null);
      else if (selectedId) setSelectedId(null);
      else setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, expanded, selectedId]);

  // The page behind doesn't scroll while the map fills the screen
  useEffect(() => {
    if (!expanded) return undefined;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [expanded]);

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
    ? { bg: '#111a13', border: 'rgba(182,238,105,0.18)', text: '#f3f4f6', sub: 'rgba(255,255,255,0.55)', chipBg: 'rgba(255,255,255,0.06)', photoBg: 'rgba(255,255,255,0.04)' }
    : { bg: '#ffffff', border: 'rgba(22,101,52,0.15)', text: '#111827', sub: '#6b7280', chipBg: '#f3f4f6', photoBg: '#f3f4f6' };

  const emptyText = view === 'cleaned' ? 'No cleaned-up reports yet' : view === 'active' ? 'No active reports right now' : 'No reports yet';

  const fullScreen = expanded
    ? { position: 'fixed', inset: 0, zIndex: 3500, padding: 12, background: isDark ? '#0a0f0a' : '#f4f7f2' }
    : { height: '100%' };

  return (
    <div data-testid="public-map" data-expanded={expanded ? 'true' : 'false'}
      role={expanded ? 'dialog' : undefined} aria-modal={expanded ? 'true' : undefined} aria-label={expanded ? 'Trash map, full screen' : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, ...fullScreen }}>
      <style>{`
        .td-pub-marker, .td-pub-cluster { background: transparent; border: none; }
        .td-pub-popup .leaflet-popup-content-wrapper { padding: 0; border-radius: 16px; background: #ffffff; box-shadow: 0 20px 50px rgba(0,0,0,0.35); overflow: hidden; }
        .td-pub-popup .leaflet-popup-content { margin: 0; width: auto !important; font: inherit; line-height: 1.5; }
        /* The card sets its own size: photo on top on phones, beside the details on
           wider screens, and larger again in full screen */
        .td-pub-card { position: relative; width: min(340px, calc(100vw - 80px)); }
        .td-pub-photo { position: relative; display: block; width: 100%; padding: 0; border: none; cursor: zoom-in; }
        .td-pub-photo-img { display: block; width: 100%; height: 200px; object-fit: cover; }
        .td-pub-photo-hint { position: absolute; left: 10px; bottom: 10px; display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.62); color: #fff; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
        [data-expanded="true"] .td-pub-photo-img { height: 260px; }
        @media (min-width: 768px) {
          .td-pub-card.td-has-photo { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); width: min(620px, calc(100vw - 112px)); }
          .td-has-photo .td-pub-photo { height: 100%; }
          .td-has-photo .td-pub-photo-img { height: 100%; min-height: 300px; }
          .td-has-photo .td-pub-details { align-self: center; padding: 20px 52px 20px 22px !important; }
          [data-expanded="true"] .td-pub-card.td-has-photo { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); width: min(780px, calc(100vw - 64px)); }
          [data-expanded="true"] .td-has-photo .td-pub-photo-img { min-height: 400px; }
        }
        /* Phones: a taller map so the card, photo on top, fits under the full-screen button */
        @media (max-width: 767px) {
          [data-expanded="false"] [data-testid="public-map-frame"], [data-expanded="false"] .leaflet-container { min-height: 580px !important; }
        }
        .td-pub-popup .leaflet-popup-tip { background: #ffffff; }
        /* Map popups sit below the map's own buttons, so the ones low on the map step aside while a card is open */
        [data-card-open="true"] .td-map-hide-with-card { display: none !important; }
        .td-pub-popup-dark .leaflet-popup-content-wrapper, .td-pub-popup-dark .leaflet-popup-tip { background: #111a13; }
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
              style={{ fontFamily: FONT_LABEL, fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', background: active ? '#b6ee69' : 'transparent', color: active ? '#0a0f0a' : lp.mapLegendText }}
            >
              {v.label} <span style={{ opacity: 0.7, fontWeight: 600 }}>{status === 'ready' ? counts[v.key] : ''}</span>
            </button>
          );
        })}
      </div>

      <div data-testid="public-map-frame" data-card-open={selected ? 'true' : 'false'} style={{ position: 'relative', borderRadius: expanded ? 16 : 24, overflow: 'hidden', border: '1px solid rgba(182,238,105,0.14)', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', flex: 1, minHeight: expanded ? 0 : 500 }}>
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%', minHeight: expanded ? 0 : 500 }} scrollWheelZoom>
          <TileLayer
            url={appConfig.services.maps.tileProviders.openStreetMap.url}
            attribution={appConfig.services.maps.tileProviders.openStreetMap.attribution}
          />
          <FitToReports reports={shown} />
          <ResizeWith expanded={expanded} />
          {selected && (
            <PopupAtReport report={selected} isDark={isDark} onClose={() => setSelectedId(null)}>
            <div className={`td-pub-card${selected.photos.length ? ' td-has-photo' : ''}`} role="dialog" aria-label="Report details" data-testid="public-report-card"
              style={{ background: card.bg, fontFamily: FONT_BODY, color: card.text }}>
                {selected.photos.length > 0 ? (
                  <button className="td-pub-photo" onClick={() => setLightbox(selected.photos[0])} title="View larger photo" style={{ background: card.photoBg }}>
                    <img className="td-pub-photo-img" src={selected.photos[0]} alt={`${toTitle(selected.wasteType)} waste reported, ${describeArea(selected)}`} loading="lazy" decoding="async" />
                    <span className="td-pub-photo-hint"><i className="fas fa-expand" aria-hidden="true" />View photo</span>
                  </button>
                ) : (
                  <div data-testid="no-photo-strip" style={{ height: 44, background: card.photoBg, display: 'flex', alignItems: 'center', padding: '0 18px', fontSize: 13, color: card.sub }}>
                    <i className="fas fa-camera" style={{ marginRight: 6 }} />No photo
                  </div>
                )}
                <button onClick={() => setSelectedId(null)} aria-label="Close details" style={{ position: 'absolute', zIndex: 2, top: selected.photos.length ? 10 : 6, right: 10, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer' }}>
                  <i className="fas fa-times" aria-hidden="true" />
                </button>
              <div className="td-pub-details" style={{ padding: '16px 18px 18px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {selected.isCleanedUp ? (
                    <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: CLEANED_COLOR, color: '#fff' }}>✓ Cleaned up</span>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: `${RISK_COLORS[selected.severity] || UNKNOWN_COLOR}22`, color: RISK_COLORS[selected.severity] || UNKNOWN_COLOR, border: `1px solid ${RISK_COLORS[selected.severity] || UNKNOWN_COLOR}55` }}>
                      {toTitle(selected.severity)} risk
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: card.chipBg, color: card.sub }}>{toTitle(selected.status)}</span>
                </div>
                <p style={{ fontFamily: FONT_LABEL, fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>{toTitle(selected.wasteType)} waste</p>
                <p style={{ fontSize: 15, color: card.sub, margin: '0 0 14px' }}>
                  <i className="fas fa-map-marker-alt" style={{ marginRight: 6 }} />{describeArea(selected)}
                </p>
                <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px', fontSize: 15, margin: 0 }}>
                  <dt style={{ color: card.sub }}>Severity</dt><dd style={{ margin: 0 }}>{toTitle(selected.severity)}</dd>
                  <dt style={{ color: card.sub }}>Reported</dt><dd style={{ margin: 0 }} title={new Date(selected.createdAt).toLocaleString()}>{timeAgo(selected.createdAt)}</dd>
                  {selected.isCleanedUp && cleanupDurationText(selected.createdAt, selected.completedAt) && (
                    <><dt style={{ color: card.sub }}>Cleanup</dt><dd style={{ margin: 0 }}>{cleanupDurationText(selected.createdAt, selected.completedAt)}</dd></>
                  )}
                </dl>
                <Link to={detailsHref} data-testid="view-more-details"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, marginTop: 16, fontFamily: FONT_LABEL, fontSize: 16, fontWeight: 700, background: isDark ? '#b6ee69' : '#1b6e35', color: isDark ? '#0a0f0a' : '#fff', borderRadius: 12, padding: '12px 16px', textDecoration: 'none' }}>
                  View more details <i className="fas fa-arrow-right" style={{ fontSize: 13 }} aria-hidden="true" />
                </Link>
              </div>
            </div>
            </PopupAtReport>
          )}
          <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} spiderfyOnMaxZoom maxClusterRadius={45} iconCreateFunction={clusterIcon}>
            {shown.map(r => (
              <Marker
                key={r.id}
                position={[r.location.lat, r.location.lng]}
                icon={markerIcon(r)}
                severity={r.severity}
                cleaned={r.isCleanedUp}
                title={`${r.isCleanedUp ? 'Cleaned up' : `${toTitle(r.severity)} risk`} · ${describeArea(r)}`}
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
                  <button onClick={reload} style={{ display: 'block', margin: '10px auto 0', fontFamily: FONT_LABEL, fontSize: 12, fontWeight: 700, background: '#1b6e35', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>Try again</button>
                </>
              )}
              {status === 'ready' && emptyText}
            </div>
          </div>
        ) : null}

        {/* Legend */}
        <div data-testid="public-map-legend" className="td-map-hide-with-card" style={{ position: 'absolute', bottom: 16, left: 16, background: lp.mapLegendBg, backdropFilter: 'blur(14px)', border: `1px solid ${lp.mapLegendBorder}`, borderRadius: 12, padding: '12px 16px', zIndex: 1100 }}>
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


        {expandable && (
          <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 1100 }}>
            <button type="button" onClick={() => setExpanded(e => !e)} aria-pressed={expanded}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1b6e35', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: FONT_LABEL, fontSize: 12, fontWeight: 700, padding: '10px 18px', borderRadius: 10, boxShadow: '0 4px 20px rgba(27,110,53,0.38)' }}>
              <i className={`fas ${expanded ? 'fa-compress-arrows-alt' : 'fa-expand-arrows-alt'}`} aria-hidden="true" />
              {expanded ? 'Exit full screen' : 'Full Analytics Map'}
            </button>
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
