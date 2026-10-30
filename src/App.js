import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Settings from './pages/Settings';
import IllegalDumpingMap from './pages/IllegalDumpingMap';
import IllegalDumpingHistory from './pages/IllegalDumpingHistory';
import Layout from './components/Layout';
import { safeDatabaseService } from './utils/safeDatabaseService';
import { supabase } from './utils/supabase';
import logger from './utils/logger';
import { SECTIONS, canAccessSection } from './constants/accessControl';
import { can, landingPathFor } from './lib/permissions';
import PendingInviteRedirect from './components/PendingInviteRedirect';
import HomePage from './pages/HomePageNew';

// Public marketing pages
const FAQPage                = lazy(() => import('./pages/FAQPage'));
const HowItWorksPage         = lazy(() => import('./pages/HowItWorksPage'));
const CollectorsPage         = lazy(() => import('./pages/CollectorsPage'));
const IllegalDumpingPublicPage = lazy(() => import('./pages/IllegalDumpingPublicPage'));
const UsersPage              = lazy(() => import('./pages/UsersPage'));
const CityWasteCollectionPage = lazy(() => import('./pages/CityWasteCollectionPage'));
const WastePickupPage = lazy(() => import('./pages/WastePickupPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const VolunteersPage = lazy(() => import('./pages/VolunteersPage'));
const MediaPage = lazy(() => import('./pages/MediaPage'));
const AccountApprovals = lazy(() => import('./pages/AccountApprovals'));
const RewardRedemptions = lazy(() => import('./pages/RewardRedemptions'));
const MediaReports = lazy(() => import('./pages/MediaReports'));
const MyPerformance = lazy(() => import('./pages/MyPerformance'));
const AccountPerformance = lazy(() => import('./pages/AccountPerformance'));
const PerformanceMetrics = lazy(() => import('./pages/PerformanceMetrics'));
const Team = lazy(() => import('./pages/Team'));
const JoinTeam = lazy(() => import('./pages/JoinTeam'));
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
// `section` is who may open the area; `capability` narrows a single page inside it.
const ProtectedRoute = ({ children, section, capability }) => {
  const { isAuthenticated, loading, onboardingCompleted, authInitialized, role, user, accessLoading } = useAuth();
  const currentPath = window.location.pathname;
  
  logger.log('ProtectedRoute check:', { 
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
  
  // Check onboarding status
  const localOnboardingCompleted = localStorage.getItem('trashdrop_onboarding_completed') === 'true';
  const effectiveOnboardingStatus = onboardingCompleted || localOnboardingCompleted;
  
  // Redirect to onboarding if needed, but only if we're not already there
  if (!effectiveOnboardingStatus && currentPath !== '/onboarding') {
    logger.log('ProtectedRoute: Onboarding not completed, redirecting to onboarding');
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

  // A role without access goes to its own starting page, not to a page it cannot open either
  if ((section && !canAccessSection(section, role, user)) || (capability && !can(capability, role))) {
    console.warn('ProtectedRoute: Access denied', { section, capability, role, email: user?.email });
    return <Navigate to={landingPathFor(role)} replace />;
  }
  
  logger.log('ProtectedRoute: All checks passed, rendering children');
  return children;
};

// Public route - redirects to dashboard if already authenticated
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, authInitialized, forceResetMode } = useAuth();
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
    logger.log('PublicRoute: Already authenticated, redirecting to dashboard');
    // Make sure we only redirect once after authenticated state is confirmed
    if (currentPath !== '/dashboard') {
      return <Navigate to="/dashboard" replace />;
    }
  }
  
  logger.log('PublicRoute: User not authenticated, rendering public content');
  return children;
};

// Auth and admin routes must stay out of search results.
// Keep in sync with the X-Robots-Tag headers in netlify.toml.
const NOINDEX_PATHS = [
  '/login', '/signup', '/forgot-password', '/reset-password', '/onboarding',
  '/dashboard', '/settings', '/request-pickup', '/bin-management',
  '/illegal-dumping/map', '/illegal-dumping/reports', '/illegal-dumping/history',
  '/accounts', '/media-data', '/performance', '/team', '/join',
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
        logger.log('Initializing database schema check...');
        await safeDatabaseService.initializeSchemaCheck();
        logger.log('Database schema check completed');
      } catch (error) {
        console.warn('Database schema check failed:', error.message);
      }
    };
    
    initializeDatabaseCheck();
  }, []);
  
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <RobotsMeta />
          <PendingInviteRedirect />
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
              <Route path="/accra"           element={<Navigate to="/waste-collection-accra/" replace />} />
              {['accra', 'kumasi', 'takoradi', 'tamale'].map(slug => (
                <Route key={slug} path={`/waste-collection-${slug}`} element={<CityWasteCollectionPage slug={slug} />} />
              ))}
              <Route path="/waste-pickup"    element={<WastePickupPage />} />
              <Route path="/partners"        element={<PartnersPage />} />
              <Route path="/volunteers"      element={<VolunteersPage />} />
              <Route path="/media"           element={<MediaPage />} />
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
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              {/* Request Pickup Management Routes */}
              <Route path="/request-pickup/live-map" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP} capability="requests.view">
                  <LiveMap />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/requests" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP} capability="requests.view">
                  <RequestPickupManagement />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/collectors" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP} capability="collectors.view">
                  <CollectorsManagement />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/alerts" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP} capability="alerts.view">
                  <AlertsManagement />
                </ProtectedRoute>
              } />
              <Route path="/request-pickup/logs" element={
                <ProtectedRoute section={SECTIONS.REQUEST_PICKUP} capability="logs.view">
                  <LogsManagement />
                </ProtectedRoute>
              } />
              
              {/* Bin Management Routes */}
              <Route path="/bin-management/generate" element={
                <ProtectedRoute section={SECTIONS.BIN_MANAGEMENT} capability="bags.manage">
                  <GenerateBag />
                </ProtectedRoute>
              } />
              <Route path="/bin-management/manage" element={
                <ProtectedRoute section={SECTIONS.BIN_MANAGEMENT} capability="bags.manage">
                  <BagManagement />
                </ProtectedRoute>
              } />
              <Route path="/bin-management/history" element={
                <ProtectedRoute section={SECTIONS.BIN_MANAGEMENT} capability="bags.view">
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
              {/* Account performance: own page (Volunteer, Authority); comparison and any account's page (Admin) */}
              <Route path="/performance" element={
                <ProtectedRoute section={SECTIONS.MY_PERFORMANCE}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <MyPerformance />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/performance/accounts" element={
                <ProtectedRoute section={SECTIONS.ACCOUNT_PERFORMANCE}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <AccountPerformance />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/team" element={
                <ProtectedRoute section={SECTIONS.TEAM}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <Team />
                  </Suspense>
                </ProtectedRoute>
              } />
              {/* Invite links: open signed in or out (not a PublicRoute, which would send signed-in people away) */}
              <Route path="/join/:token" element={
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <JoinTeam />
                </Suspense>
              } />
              <Route path="/performance/metrics" element={
                <ProtectedRoute section={SECTIONS.ACCOUNT_PERFORMANCE}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <PerformanceMetrics />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/performance/accounts/:accountId" element={
                <ProtectedRoute section={SECTIONS.ACCOUNT_PERFORMANCE}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <MyPerformance />
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
              <Route path="/rewards" element={
                <ProtectedRoute section={SECTIONS.REWARDS}>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                    <RewardRedemptions />
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
          </Layout>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
