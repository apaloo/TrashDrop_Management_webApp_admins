import { supabase } from './supabase';
import { isDevMode, devModeSignIn, getDevModeUser, clearDevModeUser } from './devAuth';

// Authentication functions
export const signIn = async ({ email, password }) => {
  // Use dev mode authentication if enabled
  if (isDevMode()) {
    console.log('Using development mode authentication');
    const result = devModeSignIn();
    // Save this for debugging
    window.lastAuthResult = result;
    console.log('Dev mode auth result:', result);
    return result;
  }
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error signing in:', error.message);
    return { data: null, error };
  }
};

export const signUp = async ({ email, password, name, role = 'user', metadata = {} }) => {
  try {
    console.log('Starting signup process for:', email);
    
    // Create the user in Supabase auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role,
          ...metadata,
          onboardingCompleted: false // Default to false for new users
        }
      }
    });
    
    console.log('Signup response:', { data, error: error?.message });
    
    // Check if this is a duplicate email scenario
    if (data?.user && !data.user.email_confirmed_at) {
      console.log('User created but email not confirmed - checking if this is duplicate');
      
      // For existing users, Supabase often returns success but doesn't send confirmation
      // Let's check if there's any indication this is an existing user
      if (data.user.identities?.length === 0) {
        console.log('No identities found - likely existing user');
        const duplicateError = { 
          message: 'An account with this email already exists. Please try logging in or reset your password.',
          status: 400
        };
        throw duplicateError;
      }
    }
    
    if (error) {
      console.log('Signup error:', error.message);
      
      // Check for specific error patterns that indicate duplicate email
      if (error.message.includes('already registered') || 
          error.message.includes('already been registered') ||
          error.message.includes('user_already_exists') ||
          error.message.includes('duplicate')) {
        const duplicateError = { 
          message: 'An account with this email already exists. Please try logging in or reset your password.',
          status: 400
        };
        throw duplicateError;
      }
      
      throw error;
    }
    
    console.log('Signup successful for new user');
    return { data, error: null };
  } catch (error) {
    console.error('Error signing up:', error.message);
    return { data: null, error };
  }
};

export const signOut = async () => {
  try {
    // Remove any stored onboarding data
    localStorage.removeItem('trashdrop_onboarding_user');
    localStorage.removeItem('trashdrop_onboarding_completed');
    localStorage.removeItem('trashdrop_user_preferences');
    
    // Clear dev mode user if applicable
    clearDevModeUser();
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error signing out:', error.message);
    return { error };
  }
};

export const resetPassword = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error resetting password:', error.message);
    return { error };
  }
};

export const updatePassword = async (newPassword) => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error updating password:', error.message);
    return { error };
  }
};

export const getCurrentUser = async () => {
  // Check for dev mode user first
  const devUser = getDevModeUser();
  if (devUser) {
    return { user: devUser, error: null };
  }
  
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    
    // Check if the user has completed onboarding
    if (data.user && data.user.user_metadata) {
      const isOnboardingComplete = data.user.user_metadata.onboardingCompleted || false;
      localStorage.setItem('trashdrop_onboarding_completed', isOnboardingComplete.toString());
    }
    
    return { user: data.user, error: null };
  } catch (error) {
    console.error('Error getting current user:', error.message);
    return { user: null, error };
  }
};

/**
 * Get current user session that works in both dev and production modes
 * @returns {Promise<{session: object|null, user: object|null, error: Error|null}>}
 */
export const getCurrentSession = async () => {
  // Check for dev mode first
  if (isDevMode()) {
    const devUser = getDevModeUser();
    if (devUser) {
      // Create a mock session structure
      const mockSession = {
        access_token: 'dev-mock-token',
        refresh_token: 'dev-mock-refresh-token',
        expires_at: new Date().getTime() + 3600000,
        user: devUser
      };
      return { session: mockSession, user: devUser, error: null };
    }
  }
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { session, user: session?.user || null, error: null };
  } catch (error) {
    console.error('Error getting session:', error.message);
    return { session: null, user: null, error };
  }
};

/**
 * Get current user ID that works in both dev and production modes
 * @returns {Promise<string|null>}
 */
export const getCurrentUserId = async () => {
  const { user } = await getCurrentSession();
  return user?.id || null;
};

export const getUserRole = async () => {
  try {
    const { user, error } = await getCurrentUser();
    if (error) throw error;
    return { role: user?.user_metadata?.role || 'user', error: null };
  } catch (error) {
    console.error('Error getting user role:', error.message);
    return { role: 'user', error };
  }
};

// New function to update user metadata with session check
export const updateUserMetadata = async (metadata) => {
  try {
    // First check if there's an active session
    const { data: sessionData } = await supabase.auth.getSession();
    
    // If no session exists and we're in dev mode, use local storage only
    if (!sessionData?.session && isDevMode()) {
      console.log('Dev mode: Storing metadata in localStorage only');
      
      // Update localStorage for development mode
      if (metadata.onboardingCompleted !== undefined) {
        localStorage.setItem('trashdrop_onboarding_completed', metadata.onboardingCompleted.toString());
      }
      
      // Store user preferences in localStorage
      if (metadata.notificationPreferences || metadata.dashboardPreferences) {
        const currentPrefs = localStorage.getItem('trashdrop_user_preferences');
        const userPrefs = currentPrefs ? JSON.parse(currentPrefs) : {};
        
        localStorage.setItem('trashdrop_user_preferences', JSON.stringify({
          ...userPrefs,
          notifications: metadata.notificationPreferences || userPrefs.notifications,
          dashboard: metadata.dashboardPreferences || userPrefs.dashboard
        }));
      }
      
      // Return mock success for dev mode
      return { data: { ...getDevModeUser(), user_metadata: metadata }, error: null };
    }
    
    // If no session and not in dev mode, return error
    if (!sessionData?.session) {
      throw new Error('No active authentication session');
    }
    
    // If we have a session, update the user metadata
    const { data, error } = await supabase.auth.updateUser({
      data: metadata
    });
    
    if (error) throw error;
    
    // If we're setting onboarding completed, update localStorage too
    if (metadata.onboardingCompleted !== undefined) {
      localStorage.setItem('trashdrop_onboarding_completed', metadata.onboardingCompleted.toString());
    }
    
    return { data: data.user, error: null };
  } catch (error) {
    console.error('Error updating user metadata:', error);
    return { data: null, error };
  }
};

// Check if user has completed onboarding
export const hasCompletedOnboarding = async () => {
  // Check localStorage first for faster access
  const localStorageValue = localStorage.getItem('trashdrop_onboarding_completed');
  
  if (localStorageValue !== null) {
    return localStorageValue === 'true';
  }
  
  // Fallback to checking user metadata
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.user_metadata) {
      const isCompleted = !!data.user.user_metadata.onboardingCompleted;
      localStorage.setItem('trashdrop_onboarding_completed', isCompleted.toString());
      return isCompleted;
    }
  } catch (error) {
    console.error('Error checking onboarding status:', error.message);
  }
  
  return false;
};

// Session management
export const setupSessionListener = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (typeof callback === 'function') {
        callback(event, session);
      }
    }
  );
  
  return () => {
    subscription.unsubscribe();
  };
};
