import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import MessagesModal from './modals/MessagesModal';
import NotificationsModal from './modals/NotificationsModal';
import { fetchNotifications, subscribeToNotifications, getUnreadNotificationsCount, markNotificationAsRead } from '../utils/notificationService';
import { fetchContacts, getUnreadMessageCount, markAllMessagesFromSenderAsRead, subscribeToMessages } from '../utils/messageService';

const Navbar = ({ toggleMobileMenu, isMobileMenuOpen }) => {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showMessagesDropdown, setShowMessagesDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  
  const [notifications, setNotifications] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [notificationError, setNotificationError] = useState(null);
  const [messageError, setMessageError] = useState(null);
  
  // Get counts from notifications and messages data
  const unreadNotificationsCount = getUnreadNotificationsCount(notifications);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  
  // Recent notifications and contacts (just first 3 of each)
  const recentNotifications = Array.isArray(notifications) ? notifications.slice(0, 3) : [];
  const recentContacts = Array.isArray(contacts) ? contacts.slice(0, 3) : [];
  
  // Fetch notifications on component mount
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setIsLoadingNotifications(true);
        const notificationsData = await fetchNotifications();
        setNotifications(notificationsData);
        setNotificationError(null);
      } catch (err) {
        console.error('Error loading notifications:', err);
        setNotificationError('Failed to load notifications');
      } finally {
        setIsLoadingNotifications(false);
      }
    };
    
    loadNotifications();
    
    // Subscribe to real-time notification updates
    const subscription = subscribeToNotifications((updatedNotifications) => {
      setNotifications(updatedNotifications);
    });
    
    return () => {
      // Clean up subscription when component unmounts
      subscription.unsubscribe();
    };
  }, []);
  
  // Fetch messages and contacts on component mount
  useEffect(() => {
    const loadContacts = async () => {
      try {
        setIsLoadingMessages(true);
        const contactsData = await fetchContacts();
        setContacts(contactsData);
        
        // Get the unread message count
        const count = await getUnreadMessageCount();
        setUnreadMessagesCount(count);
        setMessageError(null);
      } catch (err) {
        console.error('Error loading messages:', err);
        // Set default values for fallback state
        setContacts([]);
        setUnreadMessagesCount(0);
        setMessageError(null); // Don't show error in UI for database setup issues
      } finally {
        setIsLoadingMessages(false);
      }
    };
    
    loadContacts();
    
    // Subscribe to real-time message updates
    const subscription = subscribeToMessages(async () => {
      // When messages change, update contacts and count
      try {
        const contactsData = await fetchContacts();
        setContacts(contactsData);
        const count = await getUnreadMessageCount();
        setUnreadMessagesCount(count);
      } catch (err) {
        console.error('Error in message subscription:', err);
      }
    });
    
    return () => {
      // Clean up subscription when component unmounts
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

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
      <nav className="fixed top-0 left-0 md:left-64 right-0 h-14 z-10" style={{ background: 'var(--td-navbar-bg)', borderBottom: '1px solid var(--td-navbar-border)', boxShadow: isDark ? '0 1px 8px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div className="h-full px-4 flex justify-between items-center">
          {/* Mobile hamburger menu */}
          <button
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ color: 'var(--td-navbar-icon)' }}
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
              className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ background: 'var(--td-input-bg)', border: '1px solid var(--td-input-border)', color: 'var(--td-input-text)' }}
            />
            <button className="absolute right-2 top-2" style={{ color: 'var(--td-navbar-icon)' }}>
              <i className="fas fa-search"></i>
            </button>
          </div>
          
          {/* Right side icons */}
          <div className="flex items-center space-x-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-full transition-colors duration-200 focus:outline-none"
              style={{ color: 'var(--td-navbar-icon)', background: isDark ? 'rgba(168,230,61,0.12)' : 'rgba(0,0,0,0.04)' }}
            >
              {isDark
                ? <i className="fas fa-sun" style={{ fontSize: 16, color: '#a8e63d' }}></i>
                : <i className="fas fa-moon" style={{ fontSize: 15 }}></i>
              }
            </button>
            {/* Messages icon */}
            <div className="relative">
              <button
                onClick={toggleMessagesDropdown}
                className="p-2 hover:text-green-500 focus:outline-none"
                style={{ color: 'var(--td-navbar-icon)' }}
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
                <div className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg overflow-hidden z-20" style={{ background: 'var(--td-dropdown-bg)', border: '1px solid var(--td-dropdown-border)' }}>
                  <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--td-dropdown-border)', background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
                    <h3 className="font-semibold" style={{ color: 'var(--td-text-primary)' }}>Messages</h3>
                    <button 
                      onClick={openMessagesModal}
                      className="text-sm text-green-500 hover:text-green-400"
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
                className="p-2 hover:text-green-500 focus:outline-none"
                style={{ color: 'var(--td-navbar-icon)' }}
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
                <div className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg overflow-hidden z-20" style={{ background: 'var(--td-dropdown-bg)', border: '1px solid var(--td-dropdown-border)' }}>
                  <div className="py-2 px-4 border-b" style={{ borderColor: 'var(--td-dropdown-border)' }}>
                    <h6 className="text-sm font-medium" style={{ color: 'var(--td-text-primary)' }}>Notifications</h6>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {isLoadingNotifications ? (
                      <div className="p-4 text-center">
                        <p className="text-gray-500">Loading notifications...</p>
                      </div>
                    ) : notificationError ? (
                      <div className="p-4 text-center">
                        <p className="text-red-500">{notificationError}</p>
                      </div>
                    ) : recentNotifications.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-gray-500">No notifications</p>
                      </div>
                    ) : recentNotifications.map(notification => (
                      <div 
                        key={notification.id} 
                        className="px-4 py-3 border-b cursor-pointer"
                        style={{ borderColor: 'var(--td-dropdown-border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--td-dropdown-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => markNotificationAsRead(notification.id).then(() => {
                          // Update local state to show notification as read
                          setNotifications(notifications.map(n => 
                            n.id === notification.id ? {...n, read: true} : n
                          ));
                        })}
                      >
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
                            <p className="text-sm font-medium" style={{ color: 'var(--td-text-primary)' }}>{notification.message}</p>
                            <p className="text-xs" style={{ color: 'var(--td-text-muted)' }}>{notification.time}</p>
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
                <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg overflow-hidden z-20" style={{ background: 'var(--td-dropdown-bg)', border: '1px solid var(--td-dropdown-border)' }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--td-dropdown-border)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--td-text-primary)' }}>{user?.user_metadata?.full_name || 'User'}</p>
                    <p className="text-xs" style={{ color: 'var(--td-text-muted)' }}>{user?.email}</p>
                  </div>
                  <div>
                    <Link to="/settings" className="block px-4 py-2 transition-colors" style={{ color: 'var(--td-text-primary)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--td-dropdown-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <i className="fas fa-cog mr-2"></i> Settings
                    </Link>
                    <button 
                      onClick={handleSignOut} 
                      className="w-full text-left px-4 py-2 text-red-500 transition-colors"
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--td-dropdown-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
