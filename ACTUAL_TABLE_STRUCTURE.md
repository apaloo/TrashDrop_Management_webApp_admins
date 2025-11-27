# Actual Table Structure - illegal_dumping_mobile

## Confirmed Columns (from Supabase)

Based on the actual data from your database:

```json
{
  "id": "uuid",
  "reported_by": "uuid",
  "location": "text - e.g., 'Accra, Ghana (Coordinates: 5.6248, -0.2350)'",
  "coordinates": "geometry - PostGIS binary format",
  "waste_type": "text - e.g., 'household'",
  "severity": "text - e.g., 'medium'",
  "size": "text - e.g., 'large'",
  "photos": "text[] - array of photo URLs",
  "status": "text - e.g., 'pending'",
  "created_at": "timestamptz",
  "updated_at": "timestamptz",
  "latitude": "text/varchar - e.g., '5.62482163'",
  "longitude": "text/varchar - e.g., '-0.23503799'"
}
```

## Key Findings

### ✅ Columns That Exist:
- `id` - UUID primary key
- `reported_by` - UUID (user reference)
- `location` - Text field with formatted address
- `coordinates` - PostGIS geometry (binary)
- `waste_type` - Text (household, construction, etc.)
- `severity` - Text (low, medium, high, critical)
- `size` - Text (small, medium, large)
- `photos` - Text array (empty in sample: `[]`)
- `status` - Text (pending, verified, cleaned_up, etc.)
- `created_at` - Timestamp with timezone
- `updated_at` - Timestamp with timezone
- `latitude` - **Text/Varchar** (not numeric!)
- `longitude` - **Text/Varchar** (not numeric!)

### ❌ Columns That DON'T Exist:
- `address` - Use `location` instead
- `description` - Generate from waste_type and severity
- `images` - Use `photos` instead
- `estimated_volume` - Not in schema

## Data Transformation Strategy

### Coordinates:
```javascript
// latitude and longitude are stored as TEXT, need parsing
let lat = parseFloat(report.latitude);  // "5.62482163" → 5.62482163
let lng = parseFloat(report.longitude); // "-0.23503799" → -0.23503799
```

### Location:
```javascript
// location field contains formatted address with coordinates
// e.g., "Accra, Ghana (Coordinates: 5.6248, -0.2350)"
const address = report.location;
```

### Photos:
```javascript
// photos is a text[] array
const images = Array.isArray(report.photos) ? report.photos : [];
```

### Description:
```javascript
// No description column, generate from available data
const description = `${report.waste_type} dumping - ${report.severity} severity`;
```

## Updated Code

### Query (realDataUtils.js):
```javascript
let query = supabase
  .from('illegal_dumping_mobile')
  .select('*', { count: 'exact' });
```

### Transformation (realDataUtils.js):
```javascript
const transformedData = (data || []).map(report => {
  // Parse coordinates from text fields
  let lat = report.latitude ? parseFloat(report.latitude) : null;
  let lng = report.longitude ? parseFloat(report.longitude) : null;
  
  // Fallback to Accra if invalid
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    lat = 5.5800;
    lng = -0.2300;
  }
  
  return {
    id: report.id,
    location: {
      address: report.location || 'Location not specified',
      lat: lat,
      lng: lng
    },
    status: report.status || 'pending',
    severity: report.severity || 'medium',
    waste_type: report.waste_type || 'household',
    size: report.size || 'medium',
    description: `${report.waste_type || 'Waste'} dumping - ${report.severity || 'medium'} severity`,
    images: Array.isArray(report.photos) ? report.photos : [],
    reported_at: report.created_at,
    resolved_at: report.status === 'cleaned_up' ? report.updated_at : null
  };
});
```

## Status Values

Based on the sample data and typical workflow:
- `pending` - Initial report (seen in sample)
- `verified` - Admin has verified the report
- `cleanup_scheduled` - Cleanup team assigned
- `cleaned_up` - Site has been cleaned
- `cancelled` - Report cancelled

## Sample Data

```json
{
  "id": "07cf6f95-86ea-46f0-9b4c-efb9cbea8933",
  "reported_by": "ffca6594-0657-4eec-b473-3006630bdaef",
  "location": "Accra, Ghana (Coordinates: 5.6248, -0.2350)",
  "coordinates": "0101000020E610000052B06C8BB915CEBF6FC1FE3DD17F1640",
  "waste_type": "household",
  "severity": "medium",
  "size": "large",
  "photos": [],
  "status": "pending",
  "created_at": "2025-09-18T08:32:28.324003+00:00",
  "updated_at": "2025-11-25T19:27:48.390722+00:00",
  "latitude": "5.62482163",
  "longitude": "-0.23503799"
}
```

## Notes

1. **Latitude/Longitude Type**: Stored as TEXT/VARCHAR, not NUMERIC
   - Must use `parseFloat()` to convert to numbers
   - SQL fix script added these columns and populated them from PostGIS geometry

2. **Photos Array**: Currently empty (`[]`) in sample
   - Blob URLs have been cleaned
   - Array is ready for proper photo URLs

3. **Location Field**: Contains formatted address with embedded coordinates
   - Format: "City, Country (Coordinates: lat, lng)"
   - Use as-is for display

4. **No Description Field**: Generate description from available fields
   - Combine waste_type and severity for meaningful description

## All Fixes Applied ✅

- ✅ Query uses `SELECT *` to avoid column errors
- ✅ Transformation parses text coordinates to numbers
- ✅ Uses `photos` array instead of `images`
- ✅ Uses `location` field instead of `address`
- ✅ Generates description from waste_type and severity
- ✅ Proper fallback for missing/invalid coordinates
