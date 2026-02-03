import React, { useState } from 'react';

const UserPreferencesStep = ({ formData, updateFormData, onNext, onPrevious }) => {
  const [notificationPreferences, setNotificationPreferences] = useState(
    formData.notificationPreferences || {
      email: true,
      push: false,
      sms: false
    }
  );
  
  const [dashboardPreferences, setDashboardPreferences] = useState(
    formData.dashboardPreferences || {
      showKpis: true,
      showRecentActivity: true,
      defaultView: 'map'
    }
  );

  const handleNotificationChange = (e) => {
    const { name, checked } = e.target;
    setNotificationPreferences(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleDashboardChange = (e) => {
    const { name, checked, value, type } = e.target;
    setDashboardPreferences(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    updateFormData({
      notificationPreferences,
      dashboardPreferences
    });
    
    onNext();
  };

  return (
    <div className="py-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900">User Preferences</h3>
        <p className="mt-2 text-md text-gray-600 max-w-md mx-auto">
          Customize your TrashDrop experience with these personalized settings
        </p>
      </div>

      <form className="mt-6 space-y-8 max-w-lg mx-auto" onSubmit={handleSubmit}>
        {/* Notification Preferences */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center mb-3">
            <div className="h-8 w-8 rounded-md bg-green-100 flex items-center justify-center text-green-600 mr-3">
              <i className="fas fa-bell"></i>
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-800">Notification Preferences</h4>
              <p className="text-sm text-gray-500">Select how you'd like to be notified</p>
            </div>
          </div>
          
          <div className="mt-4 space-y-4">
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
                <p className="text-gray-500">Receive text message alerts (additional setup required)</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Dashboard Preferences */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center mb-3">
            <div className="h-8 w-8 rounded-md bg-green-100 flex items-center justify-center text-green-600 mr-3">
              <i className="fas fa-columns"></i>
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-800">Dashboard Display</h4>
              <p className="text-sm text-gray-500">Customize your dashboard layout</p>
            </div>
          </div>
          
          <div className="mt-4 space-y-4">
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
                <p className="text-gray-500">Display key performance indicators on dashboard</p>
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
                <p className="text-gray-500">Display recent activity feed on dashboard</p>
              </div>
            </div>
            
            <div className="mt-6">
              <label htmlFor="default-view" className="block text-sm font-medium text-gray-700">Default Dashboard View</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-desktop text-gray-400"></i>
                </div>
                <select
                  id="default-view"
                  name="defaultView"
                  value={dashboardPreferences.defaultView}
                  onChange={handleDashboardChange}
                  className="block w-full pl-10 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                >
                <option value="map">Map View</option>
                <option value="list">List View</option>
                <option value="analytics">Analytics View</option>
              </select>
            </div>
          </div>
        </div>
      </div>

        <div className="flex justify-between mt-10">
          <button
            type="button"
            onClick={onPrevious}
            className="inline-flex items-center px-5 py-2.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Company Info
          </button>
          <button
            type="submit"
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150"
          >
            Continue to Final Step
            <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserPreferencesStep;
