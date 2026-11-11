# Database Schema Fixes Applied

## Issue 1: ✅ FIXED - Missing `qr_prefix` Column

### Problem
```
Error: Could not find the 'qr_prefix' column of 'batches' in the schema cache
```

### Root Cause
Code was trying to insert columns that don't exist in the actual database schema.

### Actual Schema (from `final_database_fix.sql`)
```sql
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number TEXT,
    bag_count INTEGER NOT NULL DEFAULT 0,  -- NOT 'quantity'!
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);
```

**Columns that DON'T exist:**
- ❌ `qr_prefix` 
- ❌ `type`
- ❌ `size`
- ❌ `quantity` (use `bag_count` instead)

### Solution Applied
Updated `createBagBatch()` in `/src/utils/databaseUtils.js`:

**Before:**
```javascript
const batchPayload = {
  batch_number: batchData.batch_number,
  bag_count: batchData.bag_count,
  type: batchData.type,        // ❌ Doesn't exist
  size: batchData.size,         // ❌ Doesn't exist
  qr_prefix: batchData.qrPrefix, // ❌ Doesn't exist
  status: 'Generated'
};
```

**After:**
```javascript
const batchPayload = {
  batch_number: batchData.batch_number || `BATCH-${Date.now()}`,
  bag_count: Number(batchData.bag_count ?? batchData.quantity ?? 0),
  status: 'active',
  notes: `Type: ${batchData.type}, Size: ${batchData.size}` // Store in notes
};

// Get current user for created_by
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  batchPayload.created_by = user.id;
}
```

**Bags Table Schema:**
```sql
CREATE TABLE bags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    qr_code TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    scanned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Updated Bag Creation:**
```javascript
const qrPrefix = batchData.qrPrefix || 'BAG';
const qrCode = `${qrPrefix}-${batch.batch_number}-${String(i).padStart(4, '0')}`;

bags.push({
  batch_id: batch.id,
  qr_code: qrCode,      // Stored here, not in batches table
  status: 'active',
  scanned: false
});
```

---

## Issue 2: ✅ FIXED - Multiple GoTrueClient Instances

### Problem
```
Multiple GoTrueClient instances detected in the same browser context
```

### Root Cause
The admin client was being initialized during module load even when not needed, creating a second auth client with the same storage key.

### Solution Applied
**File**: `/src/utils/supabase.js`

**Before:**
```javascript
export const supabase = getSupabaseClient();
export const supabaseAdmin = supabaseServiceKey ? getSupabaseAdminClient() : null;
// ☝️ This calls getSupabaseAdminClient() immediately during module load
```

**After:**
```javascript
export const supabase = getSupabaseClient();
export const supabaseAdmin = null; // Don't auto-initialize

// Export getter function for manual initialization only when needed
export { getSupabaseAdminClient };
```

**Usage (if you need admin client):**
```javascript
import { getSupabaseAdminClient } from './utils/supabase';

// Only call when you actually need admin privileges
const adminClient = getSupabaseAdminClient();
```

---

## Summary of Changes

| Issue | File | Status |
|-------|------|--------|
| Missing `qr_prefix` column | `databaseUtils.js` | ✅ FIXED |
| Missing `type`, `size` columns | `databaseUtils.js` | ✅ FIXED |
| Using `quantity` instead of `bag_count` | `databaseUtils.js` | ✅ FIXED |
| Multiple GoTrueClient instances | `supabase.js` | ✅ FIXED |
| Missing `created_by` in insert | `databaseUtils.js` | ✅ FIXED |

## Testing

### Test Batch Creation
1. Go to `/bin-management/generate`
2. Fill in form (Type: Organic, Size: Medium, Quantity: 10)
3. Click "Generate Bags"
4. Should see success without schema errors

### Expected Console Output
```
✅ Supabase main client initialized and cached globally
🎉 Batch created successfully!
```

### Should NOT See
```
❌ Multiple GoTrueClient instances detected
❌ Could not find the 'qr_prefix' column
❌ Could not find the 'type' column
```

## Database Schema Reference

If you need to verify your schema, run this SQL:
```sql
-- Check batches table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'batches'
ORDER BY ordinal_position;

-- Check bags table columns
SELECT column_name, data_type, is_nullable  
FROM information_schema.columns
WHERE table_name = 'bags'
ORDER BY ordinal_position;
```
