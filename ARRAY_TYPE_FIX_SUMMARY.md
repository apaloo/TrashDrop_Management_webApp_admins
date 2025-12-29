# Array Type Fix Summary

## Issue Discovered

The `photos` column in `illegal_dumping_mobile` table is **`text[]`** (PostgreSQL text array), not `jsonb`.

### Error Message:
```
ERROR: 42883: function jsonb_array_elements_text(text[]) does not exist
```

## Changes Made

All SQL files have been updated to handle **`text[]`** arrays instead of `jsonb`:

### 1. `fix_blob_urls_and_coordinates.sql`

| Step | Old (jsonb) | New (text[]) |
|------|-------------|--------------|
| **Step 3** | `jsonb_array_elements_text()` | `UNNEST()` |
| | `jsonb_agg()` | `ARRAY_AGG()` |
| | `photos::text LIKE` | `ARRAY_TO_STRING(photos, ',') LIKE` |
| **Step 4** | `'[]'::jsonb` | `'{}'::text[]` |
| | `jsonb_array_length()` | `ARRAY_LENGTH(photos, 1)` |
| **Step 7** | `jsonb_array_length()` | `ARRAY_LENGTH(photos, 1)` |
| | `photos::text LIKE` | `ARRAY_TO_STRING(photos, ',') LIKE` |
| **Summary** | `jsonb_array_length()` | `ARRAY_LENGTH(photos, 1)` |

### 2. `create_coordinate_extraction_function.sql`

#### Function: `get_illegal_dumping_with_coordinates()`
- **Return type**: `photos jsonb` → `photos text[]`
- **Default value**: `'[]'::jsonb` → `'{}'::text[]`

#### Function: `clean_blob_urls_from_photos()`
- **Variable**: `cleaned_photos jsonb` → `cleaned_photos text[]`
- **Array operations**: 
  - `jsonb_array_elements_text()` → `UNNEST()`
  - `jsonb_agg()` → `ARRAY_AGG()`
  - `jsonb_array_length()` → `ARRAY_LENGTH()`
- **Empty array**: `'[]'::jsonb` → `'{}'::text[]`
- **Detection**: `photos::text LIKE` → `ARRAY_TO_STRING(photos, ',') LIKE`

#### Function: `validate_photo_urls()`
- **All checks**: Use `ARRAY_TO_STRING(photos, ',')` instead of `photos::text`
- **Count**: `jsonb_array_length()` → `ARRAY_LENGTH()`
- **Iteration**: `jsonb_array_elements_text()` → `UNNEST()`

## PostgreSQL Array Functions Reference

### Text Array Operations

| Operation | Function | Example |
|-----------|----------|---------|
| **Expand array** | `UNNEST(array)` | `SELECT * FROM UNNEST('{a,b,c}'::text[])` |
| **Aggregate to array** | `ARRAY_AGG(value)` | `SELECT ARRAY_AGG(x) FROM (VALUES ('a'), ('b')) t(x)` |
| **Get length** | `ARRAY_LENGTH(array, 1)` | `ARRAY_LENGTH('{a,b,c}'::text[], 1)` → `3` |
| **Convert to string** | `ARRAY_TO_STRING(array, delim)` | `ARRAY_TO_STRING('{a,b,c}'::text[], ',')` → `'a,b,c'` |
| **Empty array** | `'{}'::text[]` | Empty text array literal |

### Key Differences: text[] vs jsonb

| Feature | text[] | jsonb |
|---------|--------|-------|
| **Type** | Native PostgreSQL array | JSON document |
| **Expand** | `UNNEST()` | `jsonb_array_elements_text()` |
| **Aggregate** | `ARRAY_AGG()` | `jsonb_agg()` |
| **Length** | `ARRAY_LENGTH(arr, 1)` | `jsonb_array_length()` |
| **Empty** | `'{}'::text[]` | `'[]'::jsonb` |
| **Search** | `ARRAY_TO_STRING(arr, ',') LIKE` | `arr::text LIKE` |

## Testing

### Before Running SQL:

Check your column type:
```sql
SELECT 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns 
WHERE table_name = 'illegal_dumping_mobile' 
AND column_name = 'photos';
```

**Expected Result**:
- `data_type`: `ARRAY`
- `udt_name`: `_text` (underscore prefix indicates array)

### After Running SQL:

Verify the fixes:
```sql
-- Check if blob URLs were removed
SELECT 
    id,
    photos,
    ARRAY_LENGTH(photos, 1) as photo_count,
    CASE 
        WHEN ARRAY_TO_STRING(photos, ',') LIKE '%blob:%' THEN 'Has blob URLs'
        ELSE 'Clean'
    END as status
FROM illegal_dumping_mobile;
```

## Updated Files

✅ **fix_blob_urls_and_coordinates.sql** - All steps updated for text[] arrays
✅ **create_coordinate_extraction_function.sql** - All functions updated for text[] arrays
✅ **src/utils/fixBlobUrls.js** - JavaScript utilities (already compatible)

## Ready to Execute

Both SQL files are now compatible with PostgreSQL `text[]` arrays and can be executed in Supabase SQL Editor:

1. **First**: `fix_blob_urls_and_coordinates.sql`
2. **Second**: `create_coordinate_extraction_function.sql`

The scripts will:
- ✅ Extract coordinates from PostGIS geometry
- ✅ Remove blob URLs from text arrays
- ✅ Add latitude/longitude columns
- ✅ Update location descriptions
- ✅ Create helper functions for text array operations
