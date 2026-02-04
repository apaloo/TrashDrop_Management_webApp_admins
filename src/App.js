import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';
import Settings from './pages/Settings';
import IllegalDumpingMap from './pages/IllegalDumpingMap';
import IllegalDumpingHistory from './pages/IllegalDumpingHistory';
import Layout from './components/Layout';
import ModalManager from './components/modals/ModalManager';
import { safeDatabaseService } from './utils/safeDatabaseService';

// Lazy load components for better performance
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Feature pages
const BagManagement = lazy(() => import('./pages/BagManagement'));
const GenerateBag = lazy(() => import('./pages/GenerateBag'));
const BagHistory = lazy(() => import('./pages/BagHistory'));
const IllegalDumpingManagement = lazy(() => import('./pages/IllegalDumpingManagement'));
const RequestPickupManagement = lazy(() => import('./pages/RequestPickupManagement'));
const LiveMap = lazy(() => import('./pages/LiveMap'));
const CollectorsManagement = lazy(() => import('./pages/CollectorsManagement'));
const AlertsManagement = lazy(() => import('./pages/AlertsManagement'));
const LogsManagement = lazy(() => import('./pages/LogsManagement'));

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, onboardingCompleted, authInitialized, refreshAuthState } = useAuth();
  const currentPath = window.location.pathname;
  
  console.log('ProtectedRoute check:', { 
    path: currentPath,
    isAuthenticated,
    loading,
    onboardingCompleted,
    authInitialized
  });
  
  // Don't try to redirect or refresh until auth is fully initialized
  // This prevents premature redirects that could cause loops
  if (loading || !authInitialized) {
    console.log('ProtectedRoute: Auth not initialized or loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  // Only attempt refresh if auth is initialized but user is not authenticated
  if (authInitialized && !isAuthenticated) {
    console.log('ProtectedRoute: Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  // Check onboarding status
  const localOnboardingCompleted = localStorage.getItem('trashdrop_onboarding_completed') === 'true';
  const effectiveOnboardingStatus = onboardingCompleted || localOnboardingCompleted;
  
  // Redirect to onboarding if needed, but only if we're not already there
  if (!effectiveOnboardingStatus && currentPath !== '/onboarding') {
    console.log('ProtectedRoute: Onboarding not completed, redirecting to onboarding');
    return <Navigate to="/onboarding" replace />;
  }
  
  console.log('ProtectedRoute: All checks passed, rendering children');
  return children;
};

// Public route - redirects to dashboard if already authenticated
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, authInitialized } = useAuth();
  const currentPath = window.location.pathname;
  
  console.log('PublicRoute check:', { 
    path: currentPath,
    isAuthenticated,
    loading,
    authInitialized
  });
  
  // Don't redirect until auth is fully initialized
  if (loading || !authInitialized) {
    console.log('PublicRoute: Auth not initialized or loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    console.log('PublicRoute: User is authenticated, redirecting to dashboard');
    // Make sure we only redirect once after authenticated state is confirmed
    if (currentPath !== '/dashboard') {
      return <Navigate to="/dashboard" replace />;
    }
  }
  
  console.log('PublicRoute: User not authenticated, rendering public content');
  return children;
};

function App() {
  // Initialize database safety checks on app start
  useEffect(() => {
    const initializeDatabaseCheck = async () => {
      try {
        console.log('Initializing database schema check...');
        await safeDatabaseService.initializeSchemaCheck();
        console.log('Database schema check completed');
      } catch (error) {
        console.warn('Database schema check failed:', error.message);
      }
    };
    
    initializeDatabaseCheck();
  }, []);
  
  return (
    <AuthProvider>
      <ModalProvider>
        <Router>
          <Layout>
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-200 border-t-green-600"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-4 w-4 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-green-700 font-medium text-sm">Loading...</p>
                </div>
              </div>
            }>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } />
              <Route path="/signup" element={
                <PublicRoute>
                  <SignUp />
                </PublicRoute>
              } />
              <Route path="/forgot-password" element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              } />
              <Route path="/reset-password" element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              } />
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              {/* Request Pickup Management Routes */}
              <Route path="/request-pickup/live-map" element={
                <ProtectedRoute>
                  <LiveMap />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/requests" element={
                <ProtectedRoute>
                  <RequestPickupManagement />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/collectors" element={
                <ProtectedRoute>
                  <CollectorsManagement />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/alerts" element={
                <ProtectedRoute>
                  <AlertsManagement />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/logs" element={
                <ProtectedRoute>
                  <LogsManagement />
                </ProtectedRoute>
              } />
              
              {/* Bin Management Routes */}
              <Route path="/bin-management/generate" element={
                <ProtectedRoute>
                  <GenerateBag />
                </ProtectedRoute>
              } />
              <Route path="/bin-management/manage" element={
                <ProtectedRoute>
                  <BagManagement />
                </ProtectedRoute>
              } />
              <Route path="/bin-management/history" element={
                <ProtectedRoute>
                  <BagHistory />
                </ProtectedRoute>
              } />
              
              {/* Illegal Dumping Routes */}
              <Route path="/illegal-dumping/map" element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <IllegalDumpingMap />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/illegal-dumping/reports" element={
                <ProtectedRoute>
                  <IllegalDumpingManagement />
                </ProtectedRoute>
              } />
              <Route path="/illegal-dumping/history" element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <IllegalDumpingHistory />
                  </Suspense>
                </ProtectedRoute>
              } />
              
              {/* Settings route */}
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <Settings />
                  </Suspense>
                </ProtectedRoute>
              } />
              
              {/* Default redirect */}
              <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
            {/* Modal Manager to handle all modals across the application */}
            <ModalManager />
          </Layout>
        </Router>
      </ModalProvider>
    </AuthProvider>
  );
}

export default App;
