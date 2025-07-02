// Run this in your browser console
localStorage.setItem('trashdrop_dev_user', JSON.stringify({
  id: 'dev-user-123',
  email: 'admin@trashdrop.com',
  user_metadata: {
    full_name: 'Development Admin',
    role: 'admin',
    onboardingCompleted: true
  },
  app_metadata: {
    provider: 'email'
  },
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
}));
localStorage.setItem('trashdrop_authenticated', 'true');
localStorage.setItem('trashdrop_onboarding_completed', 'true');
localStorage.setItem('trashdrop_session_active', 'true');
console.log('Dev authentication enabled!');
// Now reload the page
