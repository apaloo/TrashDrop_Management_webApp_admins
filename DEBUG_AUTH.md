# 🐛 Debug Authentication Issues

## Current Errors

1. **Multiple GoTrueClient** - Supabase client instantiated multiple times
2. **User not authenticated** - Session not found
3. **Table not found** - Supabase cache issue

---

## Quick Fixes

### **Fix 1: Clear Browser Completely**

```bash
# In browser DevTools (F12):
1. Application tab
2. Clear Storage → Clear site data
3. Cmd+Shift+R (hard refresh)
```

### **Fix 2: Re-login**

Your session expired. Simply:
1. Logout
2. Login again
3. Refresh page

### **Fix 3: Check Session in Console**

```javascript
// Paste in browser console:
const checkSession = async () => {
  const { data: { session } } = await window.supabase.auth.getSession();
  if (session) {
    console.log('✅ Session valid:', session.user.email);
  } else {
    console.log('❌ No session - please login');
  }
};
checkSession();
```

---

## Permanent Fix

### **1. Update supabase.js (Already Done)**

The file should have:
```javascript
// Direct singleton (no IIFE)
if (!supabaseInstance) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);
  console.log('✅ Supabase client initialized (singleton)');
}

export const supabase = supabaseInstance;
```

### **2. Update auth calls (Already Done)**

```javascript
// Correct way
const { data: { session } } = await supabase.auth.getSession();
const userId = session?.user?.id;
```

---

## Test Auth Status

Run this in console after hard refresh:

```javascript
// Full auth test
const fullAuthTest = async () => {
  console.log('=== AUTH TEST ===');
  
  // 1. Check session
  const { data: { session }, error } = await window.supabase.auth.getSession();
  console.log('1. Session:', session ? '✅ EXISTS' : '❌ NULL');
  console.log('   Error:', error);
  
  // 2. Check user
  if (session) {
    console.log('2. User ID:', session.user.id);
    console.log('   Email:', session.user.email);
  }
  
  // 3. Test notification fetch
  try {
    const result = await window.supabase.auth.getSession();
    console.log('3. Can access auth:', result ? '✅ YES' : '❌ NO');
  } catch (e) {
    console.log('3. Auth error:', e.message);
  }
  
  // 4. Check localStorage
  const localAuth = localStorage.getItem('supabase.auth.token');
  console.log('4. LocalStorage auth:', localAuth ? '✅ EXISTS' : '❌ EMPTY');
  
  console.log('=== END TEST ===');
};

fullAuthTest();
```

---

## Expected Output

### **If Logged In:**
```
=== AUTH TEST ===
1. Session: ✅ EXISTS
   Error: null
2. User ID: xxx-xxx-xxx
   Email: admin@example.com
3. Can access auth: ✅ YES
4. LocalStorage auth: ✅ EXISTS
=== END TEST ===
```

### **If Not Logged In:**
```
=== AUTH TEST ===
1. Session: ❌ NULL
   Error: null
2. (skipped - no session)
3. Can access auth: ✅ YES
4. LocalStorage auth: ❌ EMPTY
=== END TEST ===
```

---

## Solutions Based on Test

### **Scenario 1: Session NULL + LocalStorage EMPTY**
→ **You need to login again**

### **Scenario 2: Session EXISTS but errors persist**
→ **Hard refresh not working, try incognito mode**

### **Scenario 3: Multiple GoTrueClient warning**
→ **Browser cached old code, clear cache completely**

---

## Manual Session Fix

If you're stuck, manually set dev mode session:

```javascript
// ONLY for development
localStorage.setItem('supabase.auth.token', JSON.stringify({
  access_token: 'dev-token',
  refresh_token: 'dev-refresh',
  user: {
    id: 'dev-user-id',
    email: 'admin@dev.local'
  }
}));

// Refresh page
location.reload();
```

---

## Contact Points

**If still not working, check:**
1. ✅ Server restarted? (npm start)
2. ✅ Hard refresh done? (Cmd+Shift+R)
3. ✅ Cache cleared? (DevTools → Clear site data)
4. ✅ Logged in? (Check auth test above)
5. ✅ Supabase URL correct? (Check .env.development)

**The most common issue is expired session - just re-login!**
