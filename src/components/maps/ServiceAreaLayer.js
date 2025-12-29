import React from 'react';
import { Polygon, Tooltip } from 'react-leaflet';

// Component to display service area boundaries on the map
const ServiceAreaLayer = ({ area }) => {
  console.log('ServiceAreaLayer rendering:', { 
    name: area?.name, 
    hasCoords: !!area?.coordinates,
    coordsLength: area?.coordinates?.length,
    coordsType: Array.isArray(area?.coordinates) ? 'array' : typeof area?.coordinates
  });
  
  // Check if area is a valid object first
  if (!area || typeof area !== 'object') {
    console.warn('Invalid service area object. Skipping polygon rendering.');
    return null;
  }

  // Validate coordinates before mapping them
  // This ensures we only process valid coordinate arrays
  if (!area.coordinates || !Array.isArray(area.coordinates) || area.coordinates.length < 3) {
    console.warn(`Invalid coordinates for service area ${area.name || 'unknown'}. Skipping polygon rendering.`, {
      coordinates: area.coordinates,
      isArray: Array.isArray(area.coordinates),
      length: area.coordinates?.length
    });
    return null;
  }
  
  try {
    // Safely map coordinates with enhanced validation
    const positions = area.coordinates
      .filter((coord, index) => {
        // Check if coordinate is valid - can be array [lat, lng] or object {lat, lng}
        let isValid = false;
        
        if (Array.isArray(coord) && coord.length >= 2) {
          // Array format: [lat, lng]
          isValid = typeof coord[0] === 'number' && 
                    typeof coord[1] === 'number' &&
                    !isNaN(coord[0]) && !isNaN(coord[1]) &&
                    isFinite(coord[0]) && isFinite(coord[1]);
        } else if (coord && typeof coord === 'object' && 'lat' in coord && 'lng' in coord) {
          // Object format: {lat, lng}
          isValid = typeof coord.lat === 'number' && 
                    typeof coord.lng === 'number' &&
                    !isNaN(coord.lat) && !isNaN(coord.lng) &&
                    isFinite(coord.lat) && isFinite(coord.lng);
        }
        
        return isValid;
      })
      .map(coord => {
        // Normalize to array format [lat, lng]
        if (Array.isArray(coord)) {
          return [coord[0], coord[1]];
        } else {
          return [coord.lat, coord.lng];
        }
      });
    
    // Only render if we have at least 3 valid points (minimum for a polygon)
    if (positions.length < 3) {
      console.warn(`Insufficient valid coordinates for service area ${area.name || 'unknown'}. Found ${positions.length} valid points, need at least 3. Skipping polygon rendering.`);
      return null;
    }
    
    // Check for duplicate first/last point to ensure polygon is closed
    const firstPoint = positions[0];
    const lastPoint = positions[positions.length - 1];
    const finalPositions = positions.slice();
    
    // If first and last points aren't the same, close the polygon by duplicating first point
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      finalPositions.push(firstPoint);
    }
    
    return (
      <Polygon
        positions={finalPositions}
        pathOptions={{
          color: area.color,
          weight: area.strokeWidth,
          fillOpacity: area.fillOpacity
        }}
      >
        <Tooltip direction="center" permanent={false} sticky>
          <div className="p-1">
            <p className="font-medium text-sm">{area.name}</p>
            <div className="flex justify-between text-xs mt-1">
              <span>Collectors: {area.activeCollectors}</span>
              <span className="ml-2">Requests: {area.requestsInProgress}</span>
            </div>
          </div>
        </Tooltip>
      </Polygon>
    );
  } catch (err) {
    console.error(`Error processing coordinates for service area ${area.name || 'unknown'}:`, err);
    return null;
  }
};

export default ServiceAreaLayer;
