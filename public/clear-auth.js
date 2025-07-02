// Run this in your browser's console to clear authentication data
const clearAuthData = () => {
  localStorage.removeItem('trashdrop_authenticated');
  localStorage.removeItem('trashdrop_session_active');
  localStorage.removeItem('trashdrop_user_data');
  localStorage.removeItem('trashdrop_remembered_email');
  localStorage.removeItem('trashdrop_dev_user');
  sessionStorage.clear();
  console.log('Authentication data cleared. Please refresh the page.');
  return 'Authentication data cleared. Please refresh the page.';
};

clearAuthData();
