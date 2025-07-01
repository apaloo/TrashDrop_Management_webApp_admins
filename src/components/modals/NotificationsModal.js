import React, { useState } from 'react';
import { notifications as allNotifications } from '../../mock/messages';

const NotificationsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState(allNotifications);

  if (!isOpen) return null;

  const filteredNotifications = activeTab === 'all' 
    ? notifications 
    : notifications.filter(notification => notification.category === activeTab);

  const markAllAsRead = () => {
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true
    }));
    setNotifications(updatedNotifications);
  };

  const markAsRead = (id) => {
    const updatedNotifications = notifications.map(notification => 
      notification.id === id ? { ...notification, read: true } : notification
    );
    setNotifications(updatedNotifications);
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
        return <i className="fas fa-exclamation-triangle text-red-500"></i>;
      case 'info':
        return <i className="fas fa-info-circle text-blue-500"></i>;
      case 'success':
        return <i className="fas fa-check-circle text-green-500"></i>;
      default:
        return <i className="fas fa-bell text-gray-500"></i>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Notifications</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b">
          <button 
            className={`px-4 py-3 font-medium text-sm relative ${
              activeTab === 'all' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('all')}
          >
            All
            {getTabCount('all') > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getTabCount('all')}
              </span>
            )}
          </button>
          <button 
            className={`px-4 py-3 font-medium text-sm relative ${
              activeTab === 'alerts' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('alerts')}
          >
            Alerts
            {getTabCount('alerts') > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getTabCount('alerts')}
              </span>
            )}
          </button>
          <button 
            className={`px-4 py-3 font-medium text-sm ${
              activeTab === 'pickup' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('pickup')}
          >
            Pickup
            {getTabCount('pickup') > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getTabCount('pickup')}
              </span>
            )}
          </button>
          <button 
            className={`px-4 py-3 font-medium text-sm ${
              activeTab === 'reports' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
            {getTabCount('reports') > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getTabCount('reports')}
              </span>
            )}
          </button>
          <div className="flex-1"></div>
          <button 
            className="px-4 py-3 text-sm text-primary hover:text-primary-dark font-medium"
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>
        </div>
        
        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length > 0 ? (
            <div className="divide-y">
              {filteredNotifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`p-4 flex hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className={`mt-1 mr-4 rounded-full p-2 ${
                    notification.type === 'alert' ? 'bg-red-100' : 
                    notification.type === 'info' ? 'bg-blue-100' : 
                    'bg-green-100'
                  }`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <span className="h-2 w-2 bg-primary rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{notification.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
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
