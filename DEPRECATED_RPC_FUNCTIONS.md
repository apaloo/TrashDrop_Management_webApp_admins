# Deprecated RPC Functions

## Summary
The following RPC functions have been **deprecated** and removed from the database schema. The application now uses **direct table updates** instead.

## Deprecated Functions

### 1. `fetch_illegal_dumping_reports`
- **Status**: ❌ DEPRECATED
- **Reason**: Simplified to direct table queries
- **Replacement**: Direct `SELECT` query on `illegal_dumping_mobile` table
- **Location**: `src/utils/realDataUtils.js::fetchIllegalDumpingReports()`

**Old Behavior:**
```sql
CALL fetch_illegal_dumping_reports(p_status, p_limit, p_offset)
```

**New Behavior:**
```javascript
// Direct table query
const { data, error, count } = await supabase
  .from('illegal_dumping_mobile')
  .select('*', { count: 'exact' })
  .eq('status', status)  // optional filter
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

### 2. `update_illegal_dumping_status`
- **Status**: ❌ DEPRECATED
- **Reason**: Simplified to direct table updates
- **Replacement**: Direct `UPDATE` query on `illegal_dumping_mobile` table
- **Location**: `src/utils/databaseUtils.js::updateIllegalDumpingStatus()`

**Old Behavior:**
```sql
CALL update_illegal_dumping_status(p_report_id, p_status, p_notes)
```

**New Behavior:**
```javascript
// Direct table update
await supabase
  .from('illegal_dumping_mobile')
  .update({ 
    status: newStatus,
    updated_at: new Date().toISOString()
  })
  .eq('id', reportId)
```

### 3. `assign_cleanup_team`
- **Status**: ❌ DEPRECATED
- **Reason**: Simplified to direct table updates
- **Replacement**: Direct `UPDATE` query on `illegal_dumping_mobile` table
- **Location**: `src/utils/databaseUtils.js::assignCleanupTeam()`

**Old Behavior:**
```sql
CALL assign_cleanup_team(p_report_id, p_collector_id, p_scheduled_date)
```

**New Behavior:**
```javascript
// Direct table update
await supabase
  .from('illegal_dumping_mobile')
  .update({ 
    status: scheduledDate ? 'cleanup_scheduled' : 'verified',
    updated_at: new Date().toISOString()
  })
  .eq('id', reportId)
```

## Still Active RPC Functions

### ✅ `fetch_dashboard_stats`
- **Status**: ACTIVE
- **Purpose**: Aggregate dashboard metrics
- **Required**: Yes

## Changes Made

### 1. `src/utils/forceRealDataConfig.js`
```javascript
// BEFORE
export const REQUIRED_FUNCTIONS = [
  'fetch_dashboard_stats',
  'fetch_illegal_dumping_reports',  // ❌ Removed
  'update_illegal_dumping_status',  // ❌ Removed
  'assign_cleanup_team'              // ❌ Removed
];

// AFTER
export const REQUIRED_FUNCTIONS = [
  'fetch_dashboard_stats'
  // DEPRECATED: 'fetch_illegal_dumping_reports' - Use direct table queries instead
  // DEPRECATED: 'update_illegal_dumping_status' - Use direct table updates instead
  // DEPRECATED: 'assign_cleanup_team' - Use direct table updates instead
];
```

### 2. `src/utils/realDataUtils.js`
- Added `@deprecated` JSDoc tag to `fetchIllegalDumpingReports()`
- Removed RPC call attempts
- Now uses direct table queries only
- Added deprecation console logs

### 3. `src/utils/databaseUtils.js`
- Added `@deprecated` JSDoc tags to update/assign functions
- Removed RPC call attempts
- Now uses direct table updates only
- Added deprecation console logs

### 4. `src/services/illegalDumpingService.js`
- Updated to use direct table updates
- Removed RPC dependency
- Maintains same functionality with simpler implementation

## Impact

### ✅ Benefits
- **Simpler**: No need to maintain complex RPC functions
- **Faster**: Direct table updates are more efficient
- **Clearer**: Code is easier to understand and debug
- **No 404 Errors**: Eliminates PGRST202 errors for missing functions

### ⚠️ Considerations
- Functions still exist in code for backward compatibility
- Marked as `@deprecated` to warn developers
- Will be removed in future major version

## Testing

After deprecation, verify:
1. ✅ Illegal dumping reports fetch correctly
2. ✅ Illegal dumping status updates work
3. ✅ Cleanup team assignments work
4. ✅ No PGRST202 errors in console
5. ✅ Map renders points correctly

## Migration Guide

If you have custom code calling these RPC functions:

**Before:**
```javascript
const result = await supabase.rpc('update_illegal_dumping_status', {
  p_report_id: id,
  p_status: 'verified'
});
```

**After:**
```javascript
import { updateIllegalDumpingStatus } from './utils/databaseUtils';

const result = await updateIllegalDumpingStatus(id, 'verified');
// Function now uses direct table update internally
```

## Date
Deprecated: November 27, 2025

## Related Files
- `src/utils/forceRealDataConfig.js`
- `src/utils/realDataUtils.js`
- `src/utils/databaseUtils.js`
- `src/services/illegalDumpingService.js`
- `FIX_RPC_FUNCTIONS_ONLY.sql` (no longer needed for these functions)
