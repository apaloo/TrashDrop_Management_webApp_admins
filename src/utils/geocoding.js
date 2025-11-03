/**
 * Reverse Geocoding Utility
 * Converts latitude/longitude coordinates to human-readable addresses
 */

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

/**
 * Format coordinates for display
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Formatted coordinates
 */
export const formatCoordinates = (lat, lng) => {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return 'N/A';
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

/**
 * Validate if coordinates are within Ghana's approximate bounds
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean}
 */
export const isValidGhanaCoordinates = (lat, lng) => {
  // Ghana approximate bounds
  const GHANA_BOUNDS = {
    minLat: 4.5,
    maxLat: 11.5,
    minLng: -3.5,
    maxLng: 1.5
  };

  return (
    lat >= GHANA_BOUNDS.minLat &&
    lat <= GHANA_BOUNDS.maxLat &&
    lng >= GHANA_BOUNDS.minLng &&
    lng <= GHANA_BOUNDS.maxLng
  );
};

/**
 * Batch reverse geocode multiple coordinates
 * @param {Array<{lat: number, lng: number, id: string}>} coordinates
 * @returns {Promise<Map<string, string>>} Map of id -> address
 */
export const batchReverseGeocode = async (coordinates) => {
  const results = new Map();
  
  // Nominatim requires 1 second delay between requests (rate limiting)
  for (let i = 0; i < coordinates.length; i++) {
    const { lat, lng, id } = coordinates[i];
    
    const address = await reverseGeocodeWithCache(lat, lng);
    if (address) {
      results.set(id, address);
    }
    
    // Rate limiting: wait 1 second between requests
    if (i < coordinates.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
};
