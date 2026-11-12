import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';
import { canAccessSection } from '../constants/accessControl';
import { can, landingPathFor, isAccountSetUp } from '../lib/permissions';

// Protected route component
// `section` is who may open the area; `capability` narrows a single page inside it.
const ProtectedRoute = ({ children, section, capability }) => {
  const { isAuthenticated, loading, authInitialized, role, user, access, accessLoading, forceResetMode } = useAuth();
  const location = useLocation();
  const currentPath = window.location.pathname;
  const isSetupForm = currentPath === '/onboarding';

  logger.log('ProtectedRoute check:', {
    path: currentPath,
    isAuthenticated,
    loading,
    authInitialized,
    role,
    section
  });
  
  // Don't try to redirect or refresh until auth is fully initialized
  // This prevents premature redirects that could cause loops
  if (loading || !authInitialized) {
    logger.log('ProtectedRoute: Auth not initialized or loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  // Only attempt refresh if auth is initialized but user is not authenticated
  if (authInitialized && !isAuthenticated) {
    logger.log('ProtectedRoute: Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // A reset link signs the person in, but the new password has to come first
  if (forceResetMode) {
    return <Navigate to="/reset-password" replace />;
  }

  // Wait for the access level from the database before checking a section
  if ((section || isSetupForm) && accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  // The setup form is optional and must never re-ask an account that is already set up
  if (isSetupForm && isAccountSetUp(role, access)) {
    return <Navigate key={location.key} to={landingPathFor(role)} replace />;
  }

  // A role without access goes to its own starting page, not to a page it cannot open either
  if ((section && !canAccessSection(section, role)) || (capability && !can(capability, role))) {
    console.warn('ProtectedRoute: Access denied', { section, capability, role, email: user?.email });
    // Keyed by the navigation: <Navigate> only redirects when it mounts or its
    // target changes, so arriving at the same forbidden page again (the login
    // page sends everyone to /dashboard twice) would otherwise leave it blank
    return <Navigate key={location.key} to={landingPathFor(role)} replace />;
  }
  
  logger.log('ProtectedRoute: All checks passed, rendering children');
  return children;
};

export default ProtectedRoute;
