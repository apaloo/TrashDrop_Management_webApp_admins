import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';
import { ThemeProvider } from './context/ThemeContext';
import Settings from './pages/Settings';
import IllegalDumpingMap from './pages/IllegalDumpingMap';
import IllegalDumpingHistory from './pages/IllegalDumpingHistory';
import Layout from './components/Layout';
import ModalManager from './components/modals/ModalManager';
import { safeDatabaseService } from './utils/safeDatabaseService';
import { supabase } from './utils/supabase';
import { SECTIONS, ROLES, canAccessSection } from './constants/accessControl';
import HomePage from './pages/HomePage';

// Public marketing pages
const FAQPage                = lazy(() => import('./pages/FAQPage'));
const HowItWorksPage         = lazy(() => import('./pages/HowItWorksPage'));
const CollectorsPage         = lazy(() => import('./pages/CollectorsPage'));
const IllegalDumpingPublicPage = lazy(() => import('./pages/IllegalDumpingPublicPage'));
const UsersPage              = lazy(() => import('./pages/UsersPage'));
const CityWasteCollectionPage = lazy(() => import('./pages/CityWasteCollectionPage'));
const WastePickupPage = lazy(() => import('./pages/WastePickupPage'));
const AccountApprovals = lazy(() => import('./pages/AccountApprovals'));
const MediaReports = lazy(() => import('./pages/MediaReports'));
const AboutPage              = lazy(() => import('./pages/AboutPage'));
const BlogPage               = lazy(() => import('./pages/BlogPage'));
const BlogPostPage           = lazy(() => import('./pages/blog/BlogPostPage'));

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
// The dashboard is TrashDrop's own operations view; Media accounts start on the reports data
const MediaHome = ({ children }) => {
  const { role } = useAuth();
  return role === ROLES.MEDIA ? <Navigate to="/media-data" replace /> : children;
};

const ProtectedRoute = ({ children, section }) => {
  const { isAuthenticated, loading, onboardingCompleted, authInitialized, role, user, accessLoading } = useAuth();
  const currentPath = window.location.pathname;
  
  console.log('ProtectedRoute check:', { 
    path: currentPath,
    isAuthenticated,
    loading,
    onboardingCompleted,
    authInitialized,
    role,
    section
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
  
  // Wait for the access level from the database before checking a section
  if (section && accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (section && !canAccessSection(section, role, user)) {
    console.warn('ProtectedRoute: Access denied for section', section, { role, email: user?.email });
    return <Navigate to="/dashboard" replace />;
  }
  
  console.log('ProtectedRoute: All checks passed, rendering children');
  return children;
};

// Public route - redirects to dashboard if already authenticated
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, authInitialized, forceResetMode } = useAuth();
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
  
  if (isAuthenticated && !forceResetMode) {
    console.log('PublicRoute: Already authenticated, redirecting to dashboard');
    // Make sure we only redirect once after authenticated state is confirmed
    if (currentPath !== '/dashboard') {
      return <Navigate to="/dashboard" replace />;
    }
  }
  
  console.log('PublicRoute: User not authenticated, rendering public content');
  return children;
};

// Auth and admin routes must stay out of search results.
// Keep in sync with the X-Robots-Tag headers in netlify.toml.
const NOINDEX_PATHS = [
  '/login', '/signup', '/forgot-password', '/reset-password', '/onboarding',
  '/dashboard', '/settings', '/request-pickup', '/bin-management',
  '/illegal-dumping/map', '/illegal-dumping/reports', '/illegal-dumping/history',
];

const RobotsMeta = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const noindex = NOINDEX_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    meta.setAttribute('content', noindex ? 'noindex' : 'index, follow');
  }, [pathname]);
  return null;
};

function App() {
  // Initialize database safety checks on app start
  useEffect(() => {
    const initializeDatabaseCheck = async () => {
      try {
        // Only for signed-in users: anonymous visitors must not probe internal tables
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (!session) return;
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
      <ThemeProvider>
      <ModalProvider>
        <Router>
          <RobotsMeta />
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
              {/* Homepage - public landing page */}
              <Route path="/" element={<HomePage />} />

              {/* Public marketing / AI Answer pages */}
              <Route path="/faq"             element={<FAQPage />} />
              <Route path="/how-it-works"    element={<HowItWorksPage />} />
              <Route path="/collectors"      element={<CollectorsPage />} />
              <Route path="/illegal-dumping" element={<IllegalDumpingPublicPage />} />
              <Route path="/users"           element={<UsersPage />} />
              {/* Old Accra page; netlify.toml also 301s it */}
              <Route path="/accra"           element={<Navigate to="/waste-collection-accra" replace />} />
              {['accra', 'kumasi', 'takoradi', 'tamale'].map(slug => (
                <Route key={slug} path={`/waste-collection-${slug}`} element={<CityWasteCollectionPage slug={slug} />} />
              ))}
              <Route path="/waste-pickup"    element={<WastePickupPage />} />
              <Route path="/about"           element={<AboutPage />} />
              <Route path="/blog"            element={<BlogPage />} />
              <Route path="/blog/:slug"      element={<BlogPostPage />} />
              
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
                <ProtectedRoute section={SECTIONS.DASHBOARD}>
                  <MediaHome><Dashboard /></MediaHome>
                </ProtectedRoute>
              } />
              
              {/* Request Pickup Management Routes */}
              <Route path="/request-pickup/live-map" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP}>
                  <LiveMap />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/requests" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP}>
                  <RequestPickupManagement />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/collectors" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP}>
                  <CollectorsManagement />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/alerts" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP}>
                  <AlertsManagement />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/logs" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP}>
                  <LogsManagement />
                </ProtectedRoute>
              } />
              
              {/* Bin Management Routes */}
              <Route path="/bin-management/generate" element={
                <ProtectedRoute section={SECTIONS.BIN_MANAGEMENT}>
                  <GenerateBag />
                </ProtectedRoute>
              } />
              <Route path="/bin-management/manage" element={
                <ProtectedRoute section={SECTIONS.BIN_MANAGEMENT}>
                  <BagManagement />
                </ProtectedRoute>
              } />
              <Route path="/bin-management/history" element={
                <ProtectedRoute section={SECTIONS.BIN_MANAGEMENT}>
                  <BagHistory />
                </ProtectedRoute>
              } />
              
              {/* Illegal Dumping Routes */}
              <Route path="/illegal-dumping/map" element={
                <ProtectedRoute section={SECTIONS.ILLEGAL_DUMPING}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <IllegalDumpingMap />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/illegal-dumping/reports" element={
                <ProtectedRoute section={SECTIONS.ILLEGAL_DUMPING}>
                  <IllegalDumpingManagement />
                </ProtectedRoute>
              } />
              <Route path="/illegal-dumping/history" element={
                <ProtectedRoute section={SECTIONS.ILLEGAL_DUMPING}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <IllegalDumpingHistory />
                  </Suspense>
                </ProtectedRoute>
              } />
              
              <Route path="/media-data" element={
                <ProtectedRoute section={SECTIONS.MEDIA_DATA}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <MediaReports />
                  </Suspense>
                </ProtectedRoute>
              } />
              {/* Settings route */}
              <Route path="/accounts" element={
                <ProtectedRoute section={SECTIONS.ACCOUNTS}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <AccountApprovals />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute section={SECTIONS.SETTINGS}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <Settings />
                  </Suspense>
                </ProtectedRoute>
              } />
              
              {/* Default redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            {/* Modal Manager to handle all modals across the application */}
            <ModalManager />
          </Layout>
        </Router>
      </ModalProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
