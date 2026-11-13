/**
 * Reverse Geocoding Utility
 * Converts latitude/longitude coordinates to human-readable addresses
 */
import { SUPPORTED_COUNTRIES } from './mapCoordinates';

/**
 * Reverse geocode coordinates to address using OpenStreetMap Nominatim (free)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} Formatted address
 */
export const reverseGeocode = async (lat, lng) => {
  try {
    // Validate coordinates
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return null;
    }

    // Using OpenStreetMap Nominatim API (free, no API key needed)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TrashDrop Admin Portal'
        }
      }
    );

    if (!response.ok) {
      console.error('Geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data && data.display_name) {
      // Format the address nicely
      const address = data.address || {};
      
      // Build address from components (Ghana-specific formatting)
      const parts = [];
      
      if (address.road || address.street) {
        parts.push(address.road || address.street);
      }
      
      if (address.suburb || address.neighbourhood) {
        parts.push(address.suburb || address.neighbourhood);
      }
      
      if (address.city || address.town || address.village) {
        parts.push(address.city || address.town || address.village);
      }
      
      if (address.state || address.region) {
        parts.push(address.state || address.region);
      }
      
      if (address.country) {
        parts.push(address.country);
      }

      // Return formatted address or fallback to display_name
      return parts.length > 0 ? parts.join(', ') : data.display_name;
    }

    return null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
};

/**
 * Reverse geocode with caching to avoid repeated API calls
 */
const geocodeCache = new Map();

export const reverseGeocodeWithCache = async (lat, lng) => {
  const key = `${lat},${lng}`;
  
  // Check cache first
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }

  // Call API
  const address = await reverseGeocode(lat, lng);
  
  // Cache result
  if (address) {
    geocodeCache.set(key, address);
  }

  return address;
};

const SEARCH_COUNTRY_CODES = SUPPORTED_COUNTRIES.map(c => c.code.toLowerCase()).join(',');

/**
 * Address search in the supported countries (OpenStreetMap Nominatim, same provider as reverseGeocode)
 * @param {string} query
 * @returns {Promise<Array<{ label: string, lat: number, lng: number }>>}
 */
export const searchAddress = async (query) => {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=${SEARCH_COUNTRY_CODES}&format=json&limit=6&addressdetails=0`,
    { headers: { 'Accept-Language': 'en' } }
  );
  if (!response.ok) throw new Error(`Address search failed (${response.status})`);
  const data = await response.json();
  return (Array.isArray(data) ? data : [])
    .map(d => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }))
    .filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lng));
};

