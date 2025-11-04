import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../utils/supabase';
import { getCurrentUser, hasCompletedOnboarding } from '../utils/auth';
import { getDevModeUser, isDevMode } from '../utils/devAuth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Only use localStorage in dev mode, otherwise rely on Supabase session
  const devMode = isDevMode();
  const initialAuthState = devMode ? localStorage.getItem('trashdrop_authenticated') === 'true' : false;
  const initialOnboardingState = devMode ? localStorage.getItem('trashdrop_onboarding_completed') === 'true' : false;
  const initialUserData = devMode ? JSON.parse(localStorage.getItem('trashdrop_user_data') || 'null') : null;
  
  // Get current authenticated user state - only use localStorage in dev mode
  const [user, setUser] = useState(initialUserData);
  const [role, setRole] = useState(initialUserData?.user_metadata?.role || 'user');
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(initialOnboardingState);
  const [authInitialized, setAuthInitialized] = useState(false);
  // Explicitly track authentication status in its own state variable instead of derived
  const [isAuthenticated, setIsAuthenticated] = useState(devMode && (!!initialUserData || initialAuthState));

  // Function to update user data on auth events
  const setAuthData = (session) => {
    if (session?.user) {
      // Set user data
      setUser(session.user);
      setRole(session.user.user_metadata?.role || 'user');
      const onboardingStatus = session.user.user_metadata?.onboardingCompleted || false;
      setOnboardingCompleted(onboardingStatus);
      
      // Explicitly set authenticated state
      setIsAuthenticated(true);
      
      // Only store in localStorage if in dev mode
      if (isDevMode()) {
        localStorage.setItem('trashdrop_authenticated', 'true');
        localStorage.setItem('trashdrop_session_active', 'true');
        localStorage.setItem('trashdrop_onboarding_completed', onboardingStatus.toString());
        localStorage.setItem('trashdrop_user_data', JSON.stringify(session.user));
      }
      
      console.log('AuthContext: User authenticated, state updated');
    } else {
      // Clear user data
      setUser(null);
      setRole('user');
      setOnboardingCompleted(false);
      setIsAuthenticated(false);
      
      // Clear all auth data from localStorage (always clear to ensure clean state)
      localStorage.removeItem('trashdrop_authenticated');
      localStorage.removeItem('trashdrop_session_active');
      localStorage.removeItem('trashdrop_onboarding_completed');
      localStorage.removeItem('trashdrop_user_data');
      
      console.log('AuthContext: User deauthenticated, state updated');
    }
    
    // Mark auth as initialized and not loading
    setAuthInitialized(true);
    setLoading(false);
  };

  // Function to manually set authenticated status for development purposes
  const setDevAuth = () => {
    if (isDevMode()) {
      const devModeUser = getDevModeUser();
      if (devModeUser) {
        console.log('AuthContext: Setting dev auth state from stored user');
        setUser(devModeUser);
        setRole(devModeUser.user_metadata?.role || 'user');
        setOnboardingCompleted(devModeUser.user_metadata?.onboardingCompleted || false);
        localStorage.setItem('trashdrop_authenticated', 'true');
        localStorage.setItem('trashdrop_session_active', 'true');
        localStorage.setItem('trashdrop_user_data', JSON.stringify(devModeUser));
        
        if (devModeUser.user_metadata?.onboardingCompleted) {
          localStorage.setItem('trashdrop_onboarding_completed', 'true');
        }
        
        setAuthInitialized(true);
        setLoading(false);
        return true;
      }
    }
    return false;
  };
  
  useEffect(() => {
    let isMounted = true;
    
    // Get initial session and user
    const initializeAuth = async () => {
      try {
        console.log('AuthContext: Checking for existing user session');
        
        // Force check for development mode flag and update state immediately if in dev mode
        if (isDevMode()) {
          console.log('AuthContext: Development mode detected, forcing dev auth');
          // Force dev auth even if localStorage doesn't have the user yet
          const devModeUser = getDevModeUser();
          
          // If no dev user in storage, simulate a sign-in to create one
          if (!devModeUser) {
            console.log('AuthContext: No dev user found, creating one');
            const { devModeSignIn } = await import('../utils/devAuth').then(module => module);
            const signInResult = devModeSignIn();
            
            if (signInResult?.data?.user) {
              setUser(signInResult.data.user);
              setRole(signInResult.data.user.user_metadata?.role || 'admin');
              setOnboardingCompleted(true); // Default to completed for dev mode
              setIsAuthenticated(true); // Explicitly set authenticated state
              setAuthInitialized(true);
              setLoading(false);
              console.log('AuthContext: Created new dev user and authenticated');
              return;
            }
          } 
          // Use existing dev user data
          else if (isMounted) {
            console.log('AuthContext: Using existing dev user');
            setUser(devModeUser);
            setRole(devModeUser.user_metadata?.role || 'admin');
            setOnboardingCompleted(devModeUser.user_metadata?.onboardingCompleted || true);
            setIsAuthenticated(true); // Explicitly set authenticated state
            setAuthInitialized(true);
            setLoading(false);
            console.log('AuthContext: Using dev user - isAuthenticated set to true');
            return;
          }
        }
        
        // Check for existing session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log("AuthContext: Session check:", session ? "Active session" : "No active session");
        
        if (session) {
          // We have a valid session, use it
          console.log('AuthContext: Using active session data');
          if (isMounted) {
            setAuthData(session);
          }
        } else if (isDevMode() && localStorage.getItem('trashdrop_authenticated') === 'true') {
          // Only use localStorage fallback in dev mode
          console.log('AuthContext: Dev mode - Using localStorage auth state');
          const localUser = JSON.parse(localStorage.getItem('trashdrop_user_data') || 'null');
          
          if (localUser) {
            // Create a pseudo-session for the local user in dev mode
            if (isMounted) {
              setUser(localUser);
              setRole(localUser.user_metadata?.role || 'user');
              setOnboardingCompleted(localStorage.getItem('trashdrop_onboarding_completed') === 'true');
              setIsAuthenticated(true);
              setAuthInitialized(true);
              setLoading(false);
            }
          } else {
            // No local user data, can't restore session
            if (isMounted) {
              localStorage.removeItem('trashdrop_authenticated'); // Clear the flag
              setAuthInitialized(true);
              setLoading(false);
            }
          }
        } else {
          // No session - in production mode, this means not authenticated
          console.log('AuthContext: No active Supabase session found');
          if (isMounted) {
            setAuthData(null); // Clear any stale state
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (isMounted) {
          setAuthInitialized(true);
          setLoading(false);
        }
      }
    };
    
    try {
      initializeAuth();
    } catch (error) {
      console.error("Error initializing auth:", error);
      if (isMounted) {
        setUser(null);
        setLoading(false);
      }
    }
    
    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event, session ? "Session exists" : "No session");
        
        if (isMounted) {
          // Special handling for development mode
          if (isDevMode() && event === 'INITIAL_SESSION' && !session) {
            // In dev mode, if we get INITIAL_SESSION with no session but localStorage indicates auth
            // this is likely because we're using mock auth that Supabase doesn't know about
            if (localStorage.getItem('trashdrop_authenticated') === 'true') {
              console.log('AuthContext: Dev mode override for INITIAL_SESSION with no session');
              const devUser = JSON.parse(localStorage.getItem('trashdrop_user_data') || 'null');
              if (devUser) {
                setUser(devUser);
                setRole(devUser.user_metadata?.role || 'admin');
                setOnboardingCompleted(devUser.user_metadata?.onboardingCompleted || true);
                setIsAuthenticated(true);
                setAuthInitialized(true);
                setLoading(false);
                return;
              }
            }
          }
          
          // Normal auth state handling
          setAuthData(session);
        }
      }
    );

    return () => {
      isMounted = false;
      if (authListener && typeof authListener.subscription?.unsubscribe === 'function') {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Function to refresh auth state (called after login/signup)
  const refreshAuthState = async () => {
    console.log('AuthContext: Refreshing auth state');
    setLoading(true);
    
    // Force development mode check on refresh
    if (isDevMode()) {
      console.log('AuthContext: Development mode detected during refresh');
      const devModeUser = getDevModeUser();
      
      if (devModeUser) {
        console.log('AuthContext: Dev user found during refresh');
        setUser(devModeUser);
        setRole(devModeUser.user_metadata?.role || 'admin');
        setOnboardingCompleted(devModeUser.user_metadata?.onboardingCompleted || true);
        setIsAuthenticated(true);
        localStorage.setItem('trashdrop_authenticated', 'true');
        localStorage.setItem('trashdrop_session_active', 'true');
        setAuthInitialized(true);
        setLoading(false);
        console.log('AuthContext: Dev mode authentication complete - isAuthenticated=true');
        return;
      }
    }
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session) {
        console.log('AuthContext: Session refreshed successfully');
        setAuthData(session);
        
        // Also check onboarding status
        const onboardingStatus = await hasCompletedOnboarding();
        setOnboardingCompleted(onboardingStatus);
      } else {
        // Before clearing auth state, check if we're in dev mode and should use local storage
        if (isDevMode() && localStorage.getItem('trashdrop_authenticated') === 'true') {
          console.log('AuthContext: No session but dev mode active, using localStorage');
          const localUser = JSON.parse(localStorage.getItem('trashdrop_user_data') || 'null');
          if (localUser) {
            setUser(localUser);
            setRole(localUser.user_metadata?.role || 'admin');
            setOnboardingCompleted(localStorage.getItem('trashdrop_onboarding_completed') === 'true');
            setIsAuthenticated(true);
            setAuthInitialized(true);
            setLoading(false);
            console.log('AuthContext: Dev mode local auth restored - isAuthenticated=true');
            return;
          }
        }
        
        console.log('AuthContext: No session found during refresh');
        setAuthData(null);
      }
    } catch (error) {
      console.error('Error refreshing auth state:', error);
      setAuthInitialized(true);
      setLoading(false);
    }
  };

  const value = {
    user,
    role,
    loading,
    isAuthenticated,
    onboardingCompleted,
    authInitialized,
    refreshAuthState
  };


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
