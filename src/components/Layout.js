import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user, role, isAuthenticated, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  // Check if current path is auth-related (login, signup, etc.)
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname);
  
  // Get user's first name from metadata for header greeting
  const firstName = user?.user_metadata?.firstName || user?.user_metadata?.full_name?.split(' ')[0] || 'User';
  
  // If we're on an auth page or app is loading, only render children without layout
  if (isAuthPage || loading) {
    return <div className="bg-gray-50">{children}</div>;
  }
  
  // For authenticated pages, render the full layout with sidebar and navbar
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar for authenticated users - 250px width */}
      {isAuthenticated && (
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
      <div className="flex-1 flex flex-col md:ml-64 overflow-hidden">
        {/* Top navigation bar - 56px height */}
        {isAuthenticated && (
          <Navbar 
            toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            isMobileMenuOpen={isMobileMenuOpen}
          />
        )}
        
        {/* Main content area - with correct top margin and padding */}
        <main className="flex-1 overflow-y-auto mt-14 p-4 min-h-screen">
          {children}
        </main>
        
        {/* Footer */}
        {isAuthenticated && (
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
