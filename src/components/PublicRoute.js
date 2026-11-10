import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';
import { landingPathFor } from '../lib/permissions';

// Public route - sends a signed-in account to its starting page
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, authInitialized, forceResetMode, role, accessLoading } = useAuth();
  const currentPath = window.location.pathname;
  
  logger.log('PublicRoute check:', { 
    path: currentPath,
    isAuthenticated,
    loading,
    authInitialized
  });
  
  // Don't redirect until auth is fully initialized
  if (loading || !authInitialized) {
    logger.log('PublicRoute: Auth not initialized or loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  if (isAuthenticated && !forceResetMode) {
    // Straight to the account's own starting page (not via /dashboard, which
    // most roles can't open), once its access level is known
    if (accessLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-green-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      );
    }
    logger.log('PublicRoute: Already authenticated, redirecting to the starting page');
    return <Navigate to={landingPathFor(role)} replace />;
  }
  
  logger.log('PublicRoute: User not authenticated, rendering public content');
  return children;
};

export default PublicRoute;
