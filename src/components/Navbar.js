import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import MessagesModal from './modals/MessagesModal';
import NotificationsModal from './modals/NotificationsModal';
import { notifications, getUnreadCount, getUnreadMessageCount } from '../mock/messages';

const Navbar = ({ toggleMobileMenu, isMobileMenuOpen }) => {
  const { user } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showMessagesDropdown, setShowMessagesDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  
  // Get counts from mock data
  const unreadNotificationsCount = getUnreadCount();
  const unreadMessagesCount = getUnreadMessageCount();
  
  // Recent notifications (just first 3)
  const recentNotifications = notifications.slice(0, 3);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  const toggleProfileMenu = () => {
    setShowProfileMenu(!showProfileMenu);
    if (showNotificationsDropdown) setShowNotificationsDropdown(false);
    if (showMessagesDropdown) setShowMessagesDropdown(false);
  };

  const toggleNotificationsDropdown = () => {
    setShowNotificationsDropdown(!showNotificationsDropdown);
    if (showProfileMenu) setShowProfileMenu(false);
    if (showMessagesDropdown) setShowMessagesDropdown(false);
  };
  
  const toggleMessagesDropdown = () => {
    setShowMessagesDropdown(!showMessagesDropdown);
    if (showProfileMenu) setShowProfileMenu(false);
    if (showNotificationsDropdown) setShowNotificationsDropdown(false);
  };
  
  const openNotificationsModal = () => {
    setShowNotificationsModal(true);
    setShowNotificationsDropdown(false);
  };
  
  const openMessagesModal = () => {
    setShowMessagesModal(true);
    setShowMessagesDropdown(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 md:left-64 right-0 h-14 bg-white shadow z-10">
        <div className="h-full px-4 flex justify-between items-center">
          {/* Mobile hamburger menu */}
          <button
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            onClick={toggleMobileMenu}
          >
            <span className="sr-only">Open sidebar</span>
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Brand logo and name (visible on mobile when sidebar is hidden) */}
          <div className="flex items-center md:hidden">
            <Link to="/dashboard" className="flex items-center">
              <img src="/logo.svg" alt="TrashDrop Logo" className="h-8 w-auto" />
              <span className="ml-2 text-lg font-semibold text-green-600">TrashDrop</span>
            </Link>
          </div>
          
          {/* Search bar */}
          <div className="relative w-1/3 max-w-md hidden md:block">
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button className="absolute right-2 top-2 text-gray-500">
              <i className="fas fa-search"></i>
            </button>
          </div>
          
          {/* Right side icons */}
          <div className="flex items-center space-x-4">
            {/* Messages icon */}
            <div className="relative">
              <button
                onClick={toggleMessagesDropdown}
                className="p-2 text-gray-600 hover:text-green-500 focus:outline-none"
                aria-label="Messages"
              >
                <i className="fas fa-comment-alt"></i>
                {unreadMessagesCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadMessagesCount}
                  </span>
                )}
              </button>
              
              {/* Messages dropdown */}
              {showMessagesDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden z-20">
                  <div className="px-4 py-3 bg-gray-100 border-b flex justify-between items-center">
                    <h3 className="font-semibold">Messages</h3>
                    <button 
                      onClick={openMessagesModal}
                      className="text-sm text-green-600 hover:text-green-700"
                    >
                      View all
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {/* Preview of recent messages would go here */}
                    <div className="p-4 text-center">
                      <button
                        onClick={openMessagesModal}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Open Messages
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Notification icon */}
            <div className="relative">
              <button
                onClick={toggleNotificationsDropdown}
                className="p-2 text-gray-600 hover:text-green-500 focus:outline-none"
                aria-label="Notifications"
              >
                <i className="fas fa-bell"></i>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
              
              {/* Notification dropdown */}
              {showNotificationsDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden z-20">
                  <div className="px-4 py-3 bg-gray-100 border-b flex justify-between items-center">
                    <h3 className="font-semibold">Notifications</h3>
                    <button 
                      onClick={openNotificationsModal}
                      className="text-sm text-green-600 hover:text-green-700"
                    >
                      View all
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {recentNotifications.map(notification => (
                      <div key={notification.id} className="px-4 py-3 border-b hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-start">
                          <div className={`mt-1 mr-3 rounded-full p-2 ${
                            notification.type === 'alert' ? 'bg-red-100 text-red-500' : 
                            notification.type === 'info' ? 'bg-blue-100 text-blue-500' : 
                            'bg-green-100 text-green-500'
                          }`}>
                            <i className={`fas ${
                              notification.type === 'alert' ? 'fa-exclamation-triangle' : 
                              notification.type === 'info' ? 'fa-info-circle' : 
                              'fa-check-circle'
                            } text-sm`}></i>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{notification.message}</p>
                            <p className="text-xs text-gray-500">{notification.time}</p>
                          </div>
                          {!notification.read && (
                            <span className="h-2 w-2 bg-blue-500 rounded-full mt-2"></span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="p-3 text-center border-t">
                      <button
                        onClick={openNotificationsModal}
                        className="text-green-600 hover:text-green-700 font-medium text-sm"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* User profile */}
            <div className="relative">
              <button
                onClick={toggleProfileMenu}
                className="flex items-center space-x-2 focus:outline-none"
              >
                <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center">
                  {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-semibold">{user?.user_metadata?.full_name || 'User'}</div>
                  <div className="text-xs text-gray-500">{user?.user_metadata?.role || 'user'}</div>
                </div>
                <i className="fas fa-chevron-down text-xs text-gray-500"></i>
              </button>
              
              {/* Profile dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg overflow-hidden z-20">
                  <div className="px-4 py-3 border-b">
                    <p className="text-sm font-semibold">{user?.user_metadata?.full_name || 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <div>
                    <Link to="/profile" className="block px-4 py-2 hover:bg-gray-100">
                      <i className="fas fa-user-circle mr-2"></i> Profile
                    </Link>
                    <Link to="/settings" className="block px-4 py-2 hover:bg-gray-100">
                      <i className="fas fa-cog mr-2"></i> Settings
                    </Link>
                    <button 
                      onClick={handleSignOut} 
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                    >
                      <i className="fas fa-sign-out-alt mr-2"></i> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      
      {/* Modals */}
      <MessagesModal isOpen={showMessagesModal} onClose={() => setShowMessagesModal(false)} />
      <NotificationsModal isOpen={showNotificationsModal} onClose={() => setShowNotificationsModal(false)} />
    </>
  );
};

export default Navbar;
