import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../utils/supabase';
import { getCurrentUser, setupSessionListener, hasCompletedOnboarding } from '../utils/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('user');
  const [onboardingCompleted, setOnboardingCompleted] = useState(true); // Default to true to avoid unnecessary redirects

  useEffect(() => {
    // Check for existing session
    const fetchUser = async () => {
      setLoading(true);
      try {
        console.log('AuthContext: Checking for existing user session');
        
        // First check if there's a session to prevent "Auth session missing" errors
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData?.session) {
          console.log('AuthContext: No existing session found');
          setLoading(false);
          return;
        }
        
        console.log('AuthContext: Session found, fetching user data');
        const { user: currentUser, error } = await getCurrentUser();
        if (error) throw error;
        
        if (currentUser) {
          console.log('AuthContext: User data retrieved', {
            id: currentUser.id,
            email: currentUser.email,
            role: currentUser?.user_metadata?.role || 'user'
          });
          
          setUser(currentUser);
          setRole(currentUser?.user_metadata?.role || 'user');
          
          // Use the async hasCompletedOnboarding function
          const isOnboardingCompleted = await hasCompletedOnboarding();
          console.log('AuthContext: Onboarding completed status:', isOnboardingCompleted);
          setOnboardingCompleted(isOnboardingCompleted);
          
          // Set authentication flag in localStorage
          localStorage.setItem('trashdrop_authenticated', 'true');
        }
      } catch (error) {
        console.error('AuthContext: Error fetching user:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Set up auth listener
    const unsubscribe = setupSessionListener(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole('user');
        setOnboardingCompleted(false);
      } else if (session?.user) {
        setUser(session.user);
        setRole(session.user?.user_metadata?.role || 'user');
        
        // Use the async hasCompletedOnboarding function
        try {
          const isOnboardingCompleted = await hasCompletedOnboarding();
          setOnboardingCompleted(isOnboardingCompleted);
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          // Default to false if there's an error
          setOnboardingCompleted(false);
        }
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const value = {
    user,
    role,
    loading,
    isAuthenticated: !!user,
    onboardingCompleted,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
