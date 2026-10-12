import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { card, input, muted, border } from '../pickupRequests/theme';
import { searchAddress, reverseGeocodeWithCache } from '../../utils/geocoding';
import { DEFAULT_MAP_VIEW, isInGhana } from '../../utils/mapCoordinates';

const pin = L.divIcon({
  className: 'custom-marker-icon',
  html: '<div style="background:#DC2626;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const ClickToPick = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
};
const FlyTo = ({ point }) => {
  const map = useMap();
  useEffect(() => { if (point) map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 15), { duration: 0.6 }); }, [map, point]);
  return null;
};

/**
 * Address search (Ghana) or click on the map. value: { lat, lng, address } | null
 */
const LocationPicker = ({ value, onChange, height = 'h-48' }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const point = value?.lat != null ? value : null;

  const pick = async (lat, lng, address = null) => {
    if (!isInGhana(lat, lng)) { setError('Pick a point in Ghana'); return; }
    setError(null);
    onChange({ lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, address });
    if (!address) {
      const found = await reverseGeocodeWithCache(lat, lng).catch(() => null);
      if (found) onChange({ lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, address: found });
    }
  };

  const search = async (e) => {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const found = await searchAddress(q);
      setResults(found);
      if (!found.length) setError('No places found');
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(e); }}
          placeholder="Search an address or area in Ghana" aria-label="Search address" className="flex-1 border rounded px-3 py-2 text-sm" style={input} />
        <button type="button" onClick={search} disabled={searching || q.trim().length < 3} className="px-3 py-2 rounded border text-sm disabled:opacity-40" style={border}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="rounded border max-h-36 overflow-y-auto text-sm" style={card}>
          {results.map(r => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" className="w-full text-left px-3 py-1.5 hover:bg-black hover:bg-opacity-5 truncate"
                onClick={() => { setResults([]); pick(r.lat, r.lng, r.label); }}>{r.label}</button>
            </li>
          ))}
        </ul>
      )}
      <div className={`${height} rounded overflow-hidden border`} style={border}>
        <MapContainer center={point ? [point.lat, point.lng] : [DEFAULT_MAP_VIEW.lat, DEFAULT_MAP_VIEW.lng]} zoom={point ? 15 : 11}
          scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickToPick onPick={(lat, lng) => pick(lat, lng)} />
          <FlyTo point={point} />
          {point && <Marker position={[point.lat, point.lng]} icon={pin} />}
        </MapContainer>
      </div>
      <p className="text-xs" style={muted}>
        {point ? <>Lat {point.lat.toFixed(5)}, Lng {point.lng.toFixed(5)}{point.address ? ` · ${point.address}` : ''}
          <button type="button" className="ml-2 underline" onClick={() => onChange(null)}>Clear</button></> : 'Click the map or search to set a location.'}
      </p>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
};

export default LocationPicker;
