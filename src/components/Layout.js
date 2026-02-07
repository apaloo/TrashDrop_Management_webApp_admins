import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../context/AuthContext';
import PageTransitionLoader from './PageTransitionLoader';

const Layout = ({ children }) => {
  const { user, role, isAuthenticated, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const previousPathRef = useRef('');
  const location = useLocation();
  
  // Check if current path is auth-related (login, signup, etc.)
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname);
  
  // Get user's first name from metadata for header greeting
  const firstName = user?.user_metadata?.firstName || user?.user_metadata?.full_name?.split(' ')[0] || 'User';
  
  // Check localStorage as a fallback for authentication state
  const localAuthState = localStorage.getItem('trashdrop_authenticated') === 'true';
  const effectiveAuthState = isAuthenticated || localAuthState;
  
  // Handle page transitions - show loader when navigating between pages
  useEffect(() => {
    if (previousPathRef.current && previousPathRef.current !== location.pathname && !isAuthPage) {
      setIsPageTransitioning(true);
      // Hide loader after a short delay to allow lazy component to load
      const timer = setTimeout(() => {
        setIsPageTransitioning(false);
      }, 300);
      return () => clearTimeout(timer);
    }
    previousPathRef.current = location.pathname;
  }, [location.pathname, isAuthPage]);
  
  useEffect(() => {
    // Only show layout if not on auth page and either authenticated or loading is complete
    setShowLayout(!isAuthPage && effectiveAuthState);
  }, [isAuthPage, effectiveAuthState, loading]);
  
  // If we're on an auth page, only render children without layout
  if (isAuthPage) {
    return <div className="bg-gray-50">{children}</div>;
  }
  
  // For authenticated pages, render the full layout with sidebar and navbar
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar for authenticated users - 250px width */}
      {showLayout && (
        <>
          {/* Desktop sidebar - fixed position */}
          <div className="hidden md:block fixed top-0 left-0 w-64 h-full">
            <Sidebar />
          </div>
          
          {/* Mobile sidebar overlay */}
          <div className={`fixed inset-0 z-40 md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsMobileMenuOpen(false)}></div>
            <div className="relative flex-1 flex flex-col max-w-xs w-64 bg-green-700">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                <Sidebar />
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Main content area */}
      <div className={`flex-1 flex flex-col ${showLayout ? 'md:ml-64' : ''} overflow-hidden`}>
        {/* Top navigation bar - 56px height */}
        {showLayout && (
          <Navbar 
            toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            isMobileMenuOpen={isMobileMenuOpen}
          />
        )}
        
        {/* Main content area - with correct top margin and padding */}
        <main className={`flex-1 overflow-y-auto ${showLayout ? 'mt-14' : ''} p-4 min-h-screen relative`}>
          {/* Page transition loader overlay */}
          {isPageTransitioning && <PageTransitionLoader />}
          
          {loading ? (
            <div className="min-h-screen flex items-center justify-center bg-green-50">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : (
            children
          )}
        </main>
        
        {/* Footer */}
        {showLayout && (
          <footer className="bg-white border-t border-gray-200 py-3 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
              <p>© {new Date().getFullYear()} TrashDrop. All rights reserved.</p>
              <div className="flex space-x-4 mt-2 md:mt-0">
                <a href="#" className="hover:text-green-600">Privacy Policy</a>
                <a href="#" className="hover:text-green-600">Terms of Service</a>
                <a href="#" className="hover:text-green-600">Contact Support</a>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

export default Layout;
