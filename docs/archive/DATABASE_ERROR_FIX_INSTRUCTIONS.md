# Database Error Fix Instructions

## Current Errors Summary

Your TrashDrop Admin Portal is experiencing the following database errors:

### 1. Missing Table Error (CRITICAL)
- **Error**: `illegal_dumping_mobile` table not found
- **Impact**: All illegal dumping features failing
- **Status Code**: 400/404

### 2. Missing RPC Functions (CRITICAL)
- **Missing Functions**:
  - `fetch_illegal_dumping_reports` (404)
  - `update_illegal_dumping_status` (404)
  - `assign_cleanup_team` (404)
- **Impact**: Cannot fetch, update, or assign illegal dumping reports

### 3. Type Mismatch Error
- **Error**: `get_user_contacts` return type mismatch (42804)
- **Details**: "Returned type character varying(255) does not match expected type text in column 4"
- **Impact**: User contacts cannot be fetched

## Solution

I've created a comprehensive SQL fix file that resolves ALL these issues:

**File**: `COMPLETE_DATABASE_FIX_2025.sql`

## How to Apply the Fix

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the **SQL Editor** section

### Step 2: Run the Fix Script
1. Open the file `COMPLETE_DATABASE_FIX_2025.sql`
2. Copy the ENTIRE contents of the file
3. Paste it into the Supabase SQL Editor
4. Click **Run** to execute the script

### Step 3: Verify the Fix
The script includes verification queries at the end that will show:
- ✅ Table created successfully
- ✅ All RPC functions created
- ✅ Sample data inserted
- ✅ Functions tested and working

### Step 4: Restart Your Application
1. Stop your development server (Ctrl+C)
2. Clear browser cache (optional but recommended)
3. Restart: `npm start`

## What the Fix Does

### 1. Creates `illegal_dumping_mobile` Table
- Full schema with all required columns
- Proper foreign key relationships to `profiles` table
- Indexes for performance
- Row Level Security (RLS) policies
- Sample data for testing

### 2. Fixes `get_user_contacts` Function
- Corrects return type to match profiles table schema
- Explicitly casts all varchar(255) columns to TEXT
- Handles NULL values safely
- Works with or without user_id parameter

### 3. Creates `fetch_illegal_dumping_reports` Function
- Queries the new `illegal_dumping_mobile` table
- Joins with profiles for reporter and collector names
- Supports status filtering
- Includes pagination (limit/offset)
- Returns all necessary fields

### 4. Creates `update_illegal_dumping_status` Function
- Updates report status with validation
- Automatically sets `resolved_at` when status is 'resolved'
- Returns JSON response with success/error
- Includes audit trail

### 5. Creates `assign_cleanup_team` Function
- Assigns collector to report
- Automatically updates status to 'cleanup_scheduled'
- Returns JSON response with success/error

### 6. Sets Proper Permissions
- Grants authenticated users full access
- Grants anonymous users read-only access
- Applies to both tables and functions

## Expected Results After Fix

### Before Fix:
```
❌ Error: Required table 'illegal_dumping_mobile' not found
❌ Failed to load resource: 404 (fetch_illegal_dumping_reports)
❌ Failed to load resource: 404 (update_illegal_dumping_status)
❌ Failed to load resource: 404 (assign_cleanup_team)
❌ Error: structure of query does not match function result type (42804)
```

### After Fix:
```
✅ Database schema check complete
✅ All RPC functions working
✅ Illegal dumping reports loading successfully
✅ User contacts fetching correctly
✅ No database errors in console
```

## Troubleshooting

### If you still see errors after applying the fix:

1. **Clear Supabase Cache**
   - The script includes `NOTIFY pgrst, 'reload schema'`
   - Wait 10-30 seconds for cache to clear
   - Refresh your browser

2. **Check Profiles Table**
   - Ensure `profiles` table exists
   - Verify it has columns: `id`, `first_name`, `last_name`, `email`, `phone`, `role`, `status`

3. **Verify Function Creation**
   - In Supabase Dashboard, go to **Database** > **Functions**
   - You should see all 4 functions listed

4. **Check Permissions**
   - Ensure you're logged in as an authenticated user
   - Check RLS policies are enabled

## Additional Notes

- The fix includes sample data (3 reports) for immediate testing
- All functions use `SECURITY DEFINER` for proper permissions
- Foreign keys are set to `ON DELETE SET NULL` to prevent cascade issues
- The table supports photo arrays for multiple images per report

## Need Help?

If you encounter any issues:
1. Check the Supabase logs for detailed error messages
2. Verify your Supabase project URL and keys are correct in `.env.development`
3. Ensure your database has the `profiles` table with proper schema
4. Check that your user has proper permissions in Supabase

## Success Indicators

After applying the fix, you should see:
- ✅ Illegal Dumping Map loads with markers
- ✅ Illegal Dumping Management shows reports
- ✅ Illegal Dumping History displays data
- ✅ No 404 or 400 errors in console
- ✅ User contacts load in messaging features
- ✅ Status updates work correctly
- ✅ Team assignment functions properly
