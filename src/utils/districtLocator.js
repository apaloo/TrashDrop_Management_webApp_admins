/**
 * Suggests the Ghana region and district for a GPS position, for the sign-up
 * "Use my location" button. Only a suggestion: the person confirms it, and an
 * admin approves district-bound access. Boundaries are loaded on first use
 * from public/data/gh-districts.json (simplified geoBoundaries, CC BY 4.0).
 */

let boundaries = null;

const loadBoundaries = async () => {
  if (boundaries) return boundaries;
  const res = await fetch('/data/gh-districts.json');
  if (!res.ok) throw new Error('District boundaries could not be loaded');
  boundaries = (await res.json()).features || [];
  return boundaries;
};

/** Ray casting on one ring of [lng, lat] points */
const inRing = (lng, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Inside the outer ring and not in a hole */
const inPolygon = (lng, lat, rings) => inRing(lng, lat, rings[0]) && !rings.slice(1).some(h => inRing(lng, lat, h));

export const pointInGeometry = (lng, lat, geometry) => {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return inPolygon(lng, lat, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(p => inPolygon(lng, lat, p));
  return false;
};

/** { region, district } for the position, or null when outside Ghana's districts */
export const findDistrict = (lat, lng, features) => {
  const hit = (features || []).find(f => pointInGeometry(lng, lat, f.geometry));
  return hit ? { region: hit.properties.region, district: hit.properties.district } : null;
};

/** Browser position (asks permission) → suggested { region, district } */
export const suggestDistrictFromDevice = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(new Error('Location is not available on this device')); return; }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const found = findDistrict(pos.coords.latitude, pos.coords.longitude, await loadBoundaries());
      if (!found) reject(new Error('Your location is not inside a Ghana district we know. Please choose it from the list.'));
      else resolve(found);
    } catch (e) {
      reject(e);
    }
  }, (err) => reject(new Error(err.code === 1 ? 'Location permission was not given. Please choose your district from the list.' : 'Your location could not be found. Please choose your district from the list.')),
  { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
});
