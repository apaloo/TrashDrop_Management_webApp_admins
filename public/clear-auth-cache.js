// Clear all authentication cache and localStorage data
// This script should be run once to clean up any cached auth data
(function() {
  console.log('🧹 Clearing authentication cache...');
  
  // List of all auth-related localStorage keys
  const authKeys = [
    'trashdrop_authenticated',
    'trashdrop_session_active',
    'trashdrop_onboarding_completed',
    'trashdrop_user_data',
    'trashdrop_dev_user',
    'trashdrop_onboarding_user',
    'trashdrop_user_preferences'
  ];
  
  // Clear each key
  authKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      console.log(`  ✓ Removed: ${key}`);
      localStorage.removeItem(key);
    }
  });
  
  // Clear any Supabase-related items
  Object.keys(localStorage).forEach(key => {
    if (key.includes('supabase') || key.includes('sb-')) {
      console.log(`  ✓ Removed Supabase key: ${key}`);
      localStorage.removeItem(key);
    }
  });
  
  console.log('✅ Authentication cache cleared successfully!');
  console.log('🔄 Please refresh the page to start with clean auth state.');
})();
