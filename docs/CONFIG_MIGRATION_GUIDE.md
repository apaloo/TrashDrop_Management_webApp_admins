# TrashDrop Management WebApp Admin Portal Configuration Migration Guide

This document outlines the process for migrating hardcoded values to the new configuration system to improve maintainability and deployment flexibility.

## Configuration Structure

We have implemented a centralized configuration structure with the following components:

1. **`appConfig.js`**: Main application configuration with environment-specific settings
2. **`constants.js`**: Application-wide constants (status values, types, prefixes, etc.)
3. **`envConfig.js`**: Loads and validates environment variables
4. **`.env.template`**: Template for environment variables needed for deployment

## Migration Checklist

### Components Already Migrated

- ✅ `IllegalDumpingMap.js`: Map settings, tile providers, coordinates, status constants
- ✅ `databaseUtils.js`: Database query limits, URL construction, ID prefixes

### Components Requiring Migration

#### High Priority

- [ ] `AlertsManagement.js`: Replace hardcoded email addresses and status values
- [ ] `CollectorsManagement.js`: Replace avatar URLs and default values
- [ ] `LiveMap.js`: Replace map coordinates and tile provider URLs
- [ ] `GenerateBag.js`: Replace URL construction and QR code generation
- [ ] `MessagesModal.js`: Replace avatar URLs and fallback image logic

#### Medium Priority

- [ ] `LogsManagement.js`: Replace hardcoded log levels and source values
- [ ] `RequestPickupManagement.js`: Replace status values and default assignments
- [ ] `BagManagement.js`: Replace hardcoded status values and URLs
- [ ] Mock data files: Replace hardcoded emails and domain values

#### Low Priority

- [ ] Components with color-coded status indicators
- [ ] Dropdown option values in form components
- [ ] Fixed pagination values

## Migration Steps

### 1. Import Configuration

Replace:
```javascript
// Old import (or none)
```

With:
```javascript
import { appConfig, APP_CONSTANTS } from '../config';
// For specific constants
import { STATUS, SEVERITY, LOG_LEVEL } from '../config/constants';
```

### 2. Replace Hardcoded URLs

Replace:
```javascript
const url = `https://trashdrop.com/bag/${qrId}`;
```

With:
```javascript
const url = `https://${appConfig.app.domain}/bag/${qrId}`;
```

### 3. Replace Map Settings

Replace:
```javascript
<MapContainer center={[37.7749, -122.4194]} zoom={13}>
  <TileLayer
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
</MapContainer>
```

With:
```javascript
<MapContainer 
  center={appConfig.services.maps.defaultCenter} 
  zoom={appConfig.services.maps.defaultZoom}>
  <TileLayer
    attribution={appConfig.services.maps.tileProviders.openStreetMap.attribution}
    url={appConfig.services.maps.tileProviders.openStreetMap.url}
  />
</MapContainer>
```

### 4. Replace Status Values

Replace:
```javascript
const statusOptions = [
  { value: 'Reported', label: 'Reported' },
  { value: 'Verified', label: 'Verified' },
  // ...
];
```

With:
```javascript
const statusOptions = Object.entries(APP_CONSTANTS.STATUS.ILLEGAL_DUMPING).map(([key, value]) => ({
  value: value,
  label: value
}));
```

### 5. Replace Email Addresses

Replace:
```javascript
const defaultEmail = 'admin@trashdrop.com';
```

With:
```javascript
const defaultEmail = appConfig.app.adminEmail;
```

### 6. Replace Avatar URLs and Fallbacks

Replace:
```javascript
const defaultAvatar = 'https://randomuser.me/api/portraits/lego/1.jpg';
```

With:
```javascript
const defaultAvatar = `${appConfig.services.avatar.randomUserUrl}lego/1.jpg`;
```

For fallback images:
```javascript
e.target.src = appConfig.services.avatar.fallbackUrl;
```

### 7. Replace Database Query Limits

Replace:
```javascript
query = query.limit(200);
```

With:
```javascript
query = query.limit(appConfig.database.queryLimits.logs);
```

## Environment Configuration

When deploying to production, make sure to:

1. Copy `.env.template` to `.env.production`
2. Fill in all required environment variables
3. Set `NODE_ENV=production`

For development environments:

1. Copy `.env.template` to `.env.local`
2. Set appropriate development values
3. Use `REACT_APP_USE_DEV_AUTH=true` if needed

## Cypress Testing Considerations

When running Cypress tests:

1. Create a `.env.test` file for test-specific configurations
2. In Cypress configuration, ensure that environment variables are appropriately mocked
3. Update HTML fixtures if they reference hardcoded values that have been migrated to configuration

## Additional Resources

- React Environment Variables: https://create-react-app.dev/docs/adding-custom-environment-variables/
- Supabase Environment Setup: https://supabase.com/docs/guides/auth/auth-helpers/nextjs#environment-variables
