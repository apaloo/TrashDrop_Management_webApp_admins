// Development mode authentication helper
// This file provides mock authentication for development purposes only
// It should NOT be used in production

// Mock user object that mimics Supabase auth user structure
// Using a valid UUID format that matches PostgreSQL requirements
export const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001', // Valid UUID format for dev mode
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
  localStorage.setItem('trashdrop_authenticated', 'true');
  localStorage.setItem('trashdrop_session_active', 'true');
  localStorage.setItem('trashdrop_user_data', JSON.stringify(MOCK_USER));
  
  // Create a mock session structure that mimics Supabase's session structure
  const mockSession = {
    access_token: 'dev-mock-token',
    refresh_token: 'dev-mock-refresh-token',
    expires_at: new Date().getTime() + 3600000, // 1 hour from now
    user: MOCK_USER
  };
  
  return {
    data: { user: MOCK_USER, session: mockSession },
    error: null
  };
};

// Function to check if development mode is enabled
export const isDevMode = () => {
  // SECURITY: Never allow dev auth in production builds
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  // Only allow dev auth in development environment with explicit flag
  return process.env.REACT_APP_USE_DEV_AUTH === 'true';
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
