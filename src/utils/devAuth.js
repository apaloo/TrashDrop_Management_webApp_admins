// Development mode authentication helper
// This file provides mock authentication for development purposes only
// It should NOT be used in production

// Mock user object that mimics Supabase auth user structure
export const MOCK_USER = {
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
};

// Function to use instead of real signIn during development
export const devModeSignIn = () => {
  // Store the mock user in localStorage to persist across page refreshes
  localStorage.setItem('trashdrop_dev_user', JSON.stringify(MOCK_USER));
  localStorage.setItem('trashdrop_onboarding_completed', 'true');
  
  return {
    data: { user: MOCK_USER, session: { access_token: 'mock-token' } },
    error: null
  };
};

// Function to check if development mode is enabled
export const isDevMode = () => {
  return process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_DEV_AUTH === 'true';
};

// Function to get the mock user if it exists in localStorage
export const getDevModeUser = () => {
  if (!isDevMode()) return null;
  
  const storedUser = localStorage.getItem('trashdrop_dev_user');
  return storedUser ? JSON.parse(storedUser) : null;
};

// Clear dev mode user on logout
export const clearDevModeUser = () => {
  localStorage.removeItem('trashdrop_dev_user');
};
