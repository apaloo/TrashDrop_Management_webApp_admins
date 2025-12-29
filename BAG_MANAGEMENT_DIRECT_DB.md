# Bag Management - Direct Supabase Connection

## Overview
All cache and mock data have been removed from Bag Management. The system now connects directly to Supabase tables with NO fallbacks.

## Changes Made

### 1. Configuration Updates
```javascript
// File: src/utils/databaseUtils.js
const FORCE_LIVE_DATA = true;           // Always use real data
const ALLOW_MOCK_FALLBACK = false;      // NO fallback to mock data
```

### 2. Direct Database Functions

#### `fetchBagBatches(options)`
- **Tables Used**: `batches`, `bags`
- **Operations**: 
  - Reads from `batches` table with pagination, sorting, and filtering
  - Joins with `bags` table to calculate statistics (distributed, scanned, scan_rate)
  - Applies search filters across id, type, and qr_prefix columns
  - **NO mock data fallback** - throws errors directly

#### `fetchBagHistory(batchId)`
- **Tables Used**: `bags`, `scans`
- **Operations**:
  - Fetches bags for specified batch_id
  - Fetches scans for those bags with collector information
  - Joins scanned_by with collectors table for user details
  - **NO mock data fallback** - throws errors directly

#### `createBagBatch(batchData)`
- **Tables Used**: `batches`, `bags`
- **Operations**:
  - Inserts batch record into `batches` table
  - Creates individual bag records in `bags` table (up to bag_count)
  - Generates QR codes for each bag
  - Inserts bags in chunks of 100 to avoid limits
  - **NO mock data fallback** - throws errors directly

## Database Schema Requirements

### `batches` Table
```sql
- id (primary key)
- batch_number (text)
- bag_count (integer)
- type (text)
- size (text)
- qr_prefix (text)
- status (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### `bags` Table
```sql
- id (primary key)
- batch_id (foreign key -> batches.id)
- bag_number (text)
- status (text)
- qr_code (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### `scans` Table
```sql
- id (primary key)
- bag_id (foreign key -> bags.id)
- scanned_at (timestamp)
- scanned_by (foreign key -> collectors.id)
- location (text)
- status (text)
- notes (text)
```

### `collectors` Table (for joins)
```sql
- id (primary key)
- first_name (text)
- last_name (text)
- email (text)
```

## Error Handling

All functions now throw errors directly if database operations fail:

```javascript
try {
  const batches = await fetchBagBatches({ page: 1, limit: 10 });
} catch (error) {
  console.error('Database error:', error);
  // Handle error in UI - show error message to user
}
```

## Usage Examples

### Fetch Batches with Filters
```javascript
const batches = await fetchBagBatches({
  page: 1,
  limit: 10,
  sortBy: 'created_at',
  sortOrder: 'desc',
  filters: {
    status: 'Generated',
    search: 'TD-REC'
  }
});
```

### Fetch Scan History
```javascript
const history = await fetchBagHistory('batch-123');
// Returns array of scans with collector info
```

### Create New Batch
```javascript
const result = await createBagBatch({
  type: 'Recyclable',
  size: 'Medium',
  quantity: 50,
  qrPrefix: 'TD-REC-M'
});
// Returns { batch: {...}, qrCodes: [...] }
```

## Pages Affected

1. **BagManagement.js** - Uses `fetchBagBatches()` to read batches
2. **BagHistory.js** - Uses `fetchBagBatches()` and `fetchBagHistory()` to read data
3. **GenerateBag.js** - Uses `createBagBatch()` to write batches and bags

## Migration Notes

- All mock data generators are still present in the file but are NOT used
- Functions will now throw errors if tables don't exist or queries fail
- UI components must handle errors gracefully and show appropriate messages
- Ensure Supabase tables exist before using these functions

## Performance Considerations

1. **Batch Statistics**: Each batch requires a separate query to `bags` table to calculate stats
2. **Bag Creation**: Large batches (100+ bags) are inserted in chunks of 100
3. **Scan History**: Uses joins to fetch collector information in a single query

## Next Steps

1. Ensure all Supabase tables exist with correct schema
2. Test error handling in UI components
3. Verify pagination and filtering work correctly
4. Test batch creation with various bag counts
5. Monitor query performance for large datasets
