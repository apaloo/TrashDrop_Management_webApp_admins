import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUserMetadata } from '../utils/auth';

const Settings = () => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Form state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  
  const [notificationPreferences, setNotificationPreferences] = useState({
    email: true,
    push: false,
    sms: false
  });
  
  const [dashboardPreferences, setDashboardPreferences] = useState({
    showKpis: true,
    showRecentActivity: true,
    defaultView: 'map'
  });
  
  const [regionSettings, setRegionSettings] = useState({
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    measurementUnit: 'metric'
  });

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      // Extract user metadata
      const metadata = user.user_metadata || {};
      const [firstName = '', lastName = ''] = (metadata.full_name || '').split(' ');
      
      // Set profile data
      setProfileData({
        firstName: metadata.firstName || firstName,
        lastName: metadata.lastName || lastName,
        email: user.email || '',
        phone: metadata.phone || ''
      });
      
      // Set preferences
      if (metadata.notificationPreferences) {
        setNotificationPreferences(metadata.notificationPreferences);
      }
      
      if (metadata.dashboardPreferences) {
        setDashboardPreferences(metadata.dashboardPreferences);
      }
      
      if (metadata.regionSettings) {
        setRegionSettings(metadata.regionSettings);
      }
    }
  }, [user]);

  // Handle profile form changes
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle notification preferences changes
  const handleNotificationChange = (e) => {
    const { name, checked } = e.target;
    setNotificationPreferences(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Handle dashboard preferences changes
  const handleDashboardChange = (e) => {
    const { name, checked, value, type } = e.target;
    setDashboardPreferences(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle region settings changes
  const handleRegionChange = (e) => {
    const { name, value } = e.target;
    setRegionSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save all settings
  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      setSaveError(null);
      setSaveSuccess(false);
      
      // Prepare metadata update
      const metadata = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        full_name: `${profileData.firstName} ${profileData.lastName}`.trim(),
        phone: profileData.phone,
        notificationPreferences,
        dashboardPreferences,
        regionSettings
      };
      
      // Update metadata in Supabase
      const { error } = await updateUserMetadata(metadata);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Also save in localStorage for redundancy
      localStorage.setItem('trashdrop_preferences', JSON.stringify({
        notificationPreferences,
        dashboardPreferences,
        regionSettings
      }));
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>
      
      {/* Settings tabs and content */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-4 text-sm font-medium ${
              activeTab === 'profile'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <i className="fas fa-user mr-2"></i>
            Profile
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-4 text-sm font-medium ${
              activeTab === 'notifications'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <i className="fas fa-bell mr-2"></i>
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-4 text-sm font-medium ${
              activeTab === 'dashboard'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <i className="fas fa-chart-line mr-2"></i>
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('region')}
            className={`px-4 py-4 text-sm font-medium ${
              activeTab === 'region'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <i className="fas fa-globe mr-2"></i>
            Regional
          </button>
        </div>
        
        {/* Tab content */}
        <div className="p-6">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
              <p className="mt-1 text-sm text-gray-500">
                Update your account information and contact details.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    value={profileData.firstName}
                    onChange={handleProfileChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    value={profileData.lastName}
                    onChange={handleProfileChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={profileData.email}
                    readOnly
                    disabled
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    To change your email, please contact support.
                  </p>
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    value={profileData.phone}
                    onChange={handleProfileChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose how you'd like to receive notifications and alerts.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="email-notifications"
                      name="email"
                      type="checkbox"
                      checked={notificationPreferences.email}
                      onChange={handleNotificationChange}
                      className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="email-notifications" className="font-medium text-gray-700">Email Notifications</label>
                    <p className="text-gray-500">Receive updates and alerts via email</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="push-notifications"
                      name="push"
                      type="checkbox"
                      checked={notificationPreferences.push}
                      onChange={handleNotificationChange}
                      className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="push-notifications" className="font-medium text-gray-700">Push Notifications</label>
                    <p className="text-gray-500">Receive browser push notifications</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="sms-notifications"
                      name="sms"
                      type="checkbox"
                      checked={notificationPreferences.sms}
                      onChange={handleNotificationChange}
                      className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="sms-notifications" className="font-medium text-gray-700">SMS Notifications</label>
                    <p className="text-gray-500">Receive text message alerts for critical events</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-yellow-50 rounded-md border border-yellow-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <i className="fas fa-info-circle text-yellow-400"></i>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      SMS notifications may incur additional charges depending on your mobile carrier.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Dashboard Settings */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Dashboard Preferences</h3>
              <p className="mt-1 text-sm text-gray-500">
                Customize how your dashboard looks and what information is displayed.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="show-kpis"
                      name="showKpis"
                      type="checkbox"
                      checked={dashboardPreferences.showKpis}
                      onChange={handleDashboardChange}
                      className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="show-kpis" className="font-medium text-gray-700">Show KPI Cards</label>
                    <p className="text-gray-500">Display key performance indicators on your dashboard</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="show-recent-activity"
                      name="showRecentActivity"
                      type="checkbox"
                      checked={dashboardPreferences.showRecentActivity}
                      onChange={handleDashboardChange}
                      className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="show-recent-activity" className="font-medium text-gray-700">Show Recent Activity</label>
                    <p className="text-gray-500">Display your recent activity feed on the dashboard</p>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="default-view" className="block text-sm font-medium text-gray-700">Default View</label>
                  <select
                    id="default-view"
                    name="defaultView"
                    value={dashboardPreferences.defaultView}
                    onChange={handleDashboardChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 rounded-md"
                  >
                    <option value="map">Map View</option>
                    <option value="list">List View</option>
                    <option value="grid">Grid View</option>
                    <option value="analytics">Analytics View</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {/* Regional Settings */}
          {activeTab === 'region' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Regional Settings</h3>
              <p className="mt-1 text-sm text-gray-500">
                Adjust regional preferences like timezone, date format and measurement units.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">Timezone</label>
                  <select
                    id="timezone"
                    name="timezone"
                    value={regionSettings.timezone}
                    onChange={handleRegionChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 rounded-md"
                  >
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                    <option value="America/Chicago">Central Time (US & Canada)</option>
                    <option value="America/Denver">Mountain Time (US & Canada)</option>
                    <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700">Date Format</label>
                  <select
                    id="dateFormat"
                    name="dateFormat"
                    value={regionSettings.dateFormat}
                    onChange={handleRegionChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 rounded-md"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Europe)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="measurementUnit" className="block text-sm font-medium text-gray-700">Measurement Unit</label>
                  <select
                    id="measurementUnit"
                    name="measurementUnit"
                    value={regionSettings.measurementUnit}
                    onChange={handleRegionChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 rounded-md"
                  >
                    <option value="metric">Metric (kg, km)</option>
                    <option value="imperial">Imperial (lbs, miles)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {/* Action buttons and status messages */}
          <div className="mt-8 border-t border-gray-200 pt-5">
            {saveSuccess && (
              <div className="mb-4 p-4 bg-green-50 rounded-md border border-green-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <i className="fas fa-check-circle text-green-400"></i>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">
                      Your settings have been saved successfully.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {saveError && (
              <div className="mb-4 p-4 bg-red-50 rounded-md border border-red-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <i className="fas fa-exclamation-circle text-red-400"></i>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">
                      Error saving settings: {saveError}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={loading}
                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
