import React, { useState, useEffect } from 'react';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../utils/notificationService';

/** onRead(id) after one is saved as read, onRead(null) after all are */
const NotificationsModal = ({ isOpen, onClose, onRead }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setIsLoading(true);
        const notificationsData = await fetchNotifications();
        setNotifications(notificationsData);
        setError(null);
      } catch (err) {
        console.error('Error loading notifications:', err);
        setError('Failed to load notifications');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNotifications = activeTab === 'all' 
    ? notifications 
    : notifications.filter(notification => notification.category === activeTab);

  const markAllAsRead = async () => {
    try {
      const ok = await markAllNotificationsAsRead();
      if (!ok) {
        setError('Failed to mark all as read');
        return;
      }
      // Update local state only after the database saved it
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        read: true
      })));
      onRead?.(null);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError('Failed to mark all as read');
    }
  };

  const markAsRead = async (id) => {
    try {
      const ok = await markNotificationAsRead(id);
      if (!ok) return;
      // Update local state only after the database saved it
      setNotifications(prev => prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      ));
      onRead?.(id);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // We don't set the error state here to avoid disrupting the UI for a single notification
    }
  };

  const getTabCount = (tabName) => {
    if (tabName === 'all') {
      return notifications.filter(n => !n.read).length;
    }
    return notifications.filter(n => !n.read && n.category === tabName).length;
  };

  const getIcon = (type) => {
    switch(type) {
      case 'alert':
        return <i className="fas fa-exclamation-triangle text-red-700"></i>;
      case 'info':
        return <i className="fas fa-info-circle text-td-forest"></i>;
      case 'success':
        return <i className="fas fa-check-circle text-green-600"></i>;
      default:
        return <i className="fas fa-bell text-td-sage"></i>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl h-[600px] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="notifications-modal-title">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 id="notifications-modal-title" className="text-xl font-semibold text-td-ink">Notifications</h2>
          <button 
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-td-sage hover:text-td-ink"
          >
            <i className="fas fa-times text-xl" aria-hidden="true"></i>
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b">
          <button 
            className={`px-4 py-3 font-medium text-sm relative ${
              activeTab === 'all' 
                ? 'text-td-forest border-b-2 border-td-forest' 
                : 'text-td-sage hover:text-td-ink'
            }`}
            onClick={() => setActiveTab('all')}
          >
            All
            {getTabCount('all') > 0 && (
              <span className="ml-2 bg-red-700 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getTabCount('all')}
              </span>
            )}
          </button>
          <button 
            className={`px-4 py-3 font-medium text-sm relative ${
              activeTab === 'alerts' 
                ? 'text-td-forest border-b-2 border-td-forest' 
                : 'text-td-sage hover:text-td-ink'
            }`}
            onClick={() => setActiveTab('alerts')}
          >
            Alerts
            {getTabCount('alerts') > 0 && (
              <span className="ml-2 bg-red-700 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getTabCount('alerts')}
              </span>
            )}
          </button>
          <button 
            className={`px-4 py-3 font-medium text-sm ${
              activeTab === 'pickup' 
                ? 'text-td-forest border-b-2 border-td-forest' 
                : 'text-td-sage hover:text-td-ink'
            }`}
            onClick={() => setActiveTab('pickup')}
          >
            Pickup
            {getTabCount('pickup') > 0 && (
              <span className="ml-2 bg-red-700 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getTabCount('pickup')}
              </span>
            )}
          </button>
          <button 
            className={`px-4 py-3 font-medium text-sm ${
              activeTab === 'reports' 
                ? 'text-td-forest border-b-2 border-td-forest' 
                : 'text-td-sage hover:text-td-ink'
            }`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
            {getTabCount('reports') > 0 && (
              <span className="ml-2 bg-red-700 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getTabCount('reports')}
              </span>
            )}
          </button>
          <div className="flex-1"></div>
          <button 
            className="px-4 py-3 text-sm text-td-forest hover:text-td-forest-dk font-medium"
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>
        </div>
        
        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length > 0 ? (
            <div className="divide-y">
              {isLoading ? (
                <div className="p-6 text-center">
                  <p className="text-td-sage">Loading notifications...</p>
                </div>
              ) : error ? (
                <div className="p-6 text-center">
                  <p className="text-red-700">{error}</p>
                  <button 
                    onClick={() => {
                      setError(null);
                      setIsLoading(true);
                      fetchNotifications().then(data => {
                        setNotifications(data);
                        setIsLoading(false);
                      }).catch(err => {
                        setError('Failed to reload notifications');
                        setIsLoading(false);
                      });
                    }} 
                    className="mt-2 px-4 py-2 bg-gray-200 text-td-ink rounded-md hover:bg-gray-300"
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-td-sage">No notifications in this category</p>
                </div>
              ) : filteredNotifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`p-4 flex hover:bg-gray-50 ${!notification.read ? 'bg-td-tonal' : ''}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className={`mt-1 mr-4 rounded-full p-2 ${
                    notification.type === 'alert' ? 'bg-red-100' : 
                    notification.type === 'info' ? 'bg-blue-100' : 
                    'bg-td-tonal'
                  }`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className={`font-medium ${!notification.read ? 'text-td-ink' : 'text-td-ink'}`}>
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <span className="h-2 w-2 bg-green-600 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-td-sage mt-1">{notification.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-td-sage">
              <i className="fas fa-bell-slash text-4xl mb-2"></i>
              <p>No notifications</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
