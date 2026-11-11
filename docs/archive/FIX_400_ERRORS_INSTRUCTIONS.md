# Fix 400 Bad Request Errors - Step by Step

## The Problem
You're seeing 400 errors on `illegal_dumping_mobile` because Row Level Security (RLS) policies are blocking access, even though the table exists.

## Solution - 3 Steps

### Step 1: Run RLS Fix in Supabase ⚙️

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Open and run the file: **`fix_rls_policies.sql`**
4. Verify output shows policies created successfully

This will:
- ✅ Enable RLS on the table
- ✅ Create policies for authenticated users
- ✅ Allow full CRUD operations (SELECT, INSERT, UPDATE, DELETE)
- ✅ Grant service_role full access

### Step 2: Clear Browser Cache 🧹

Open your browser console and run:
```javascript
window.safeDatabaseService.clearCache()
```

Then hard refresh the page:
- **Mac**: `Cmd + Shift + R`
- **Windows**: `Ctrl + Shift + R`

### Step 3: Verify Fix ✅

Check the browser console. You should see:
- ✅ `[SafeDB] Table illegal_dumping_mobile exists`
- ✅ Data loading without 400 errors
- ✅ Reports appearing on the map

---

## Expected Results

### Before Fix:
```
[Error] Failed to load resource: 400 (illegal_dumping_mobile)
[Error] Table 'illegal_dumping_mobile' not found
❌ DATABASE ERROR in illegal_dumping_mobile
```

### After Fix:
```
[SafeDB] Table illegal_dumping_mobile exists
✅ Data loaded successfully
Map displays 1 report at coordinates 5.625, -0.235
```

---

## If It Still Doesn't Work

### Check 1: Verify RLS Policies
Run in Supabase SQL Editor:
```sql
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'illegal_dumping_mobile';
```

Should show 6 policies (SELECT, INSERT, UPDATE, DELETE for authenticated, plus service_role and anon)

### Check 2: Verify You're Authenticated
Check browser console:
```javascript
console.log(window.localStorage.getItem('supabase.auth.token'))
```

Should show a JWT token. If null, log in again.

### Check 3: Check Supabase Connection
In `.env` file, verify:
```
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### Check 4: Try Disabling RLS (Testing Only)
**⚠️ ONLY FOR TESTING - Don't use in production!**

Run in Supabase:
```sql
ALTER TABLE public.illegal_dumping_mobile DISABLE ROW LEVEL SECURITY;
```

If this fixes it, the issue is with RLS policies. Re-enable RLS and fix policies properly.

---

## Quick Debugging Commands

### Check table exists:
```javascript
window.safeDatabaseService.checkTableExists('illegal_dumping_mobile')
```

### Clear specific table cache:
```javascript
window.safeDatabaseService.clearTableCache('illegal_dumping_mobile')
```

### Check what's cached:
```javascript
window.safeDatabaseService.tableExists
```

---

## Contact Support
If issues persist after following these steps, provide:
1. Screenshot of Supabase RLS policies
2. Browser console errors
3. Result of table existence check
