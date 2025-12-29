import React from 'react';

const CompletionStep = ({ formData, onComplete, onPrevious, isLoading, error }) => {
  return (
    <div>
      <h3 className="text-xl font-medium text-gray-900">Review and Complete</h3>
      <p className="mt-1 text-sm text-gray-600">
        Please review your information before completing setup
      </p>

      <div className="mt-6 space-y-6">
        {/* Company Information Review */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-medium text-gray-700 mb-2">Company Information</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Company Name</p>
              <p className="font-medium">{formData.companyName}</p>
            </div>
            <div>
              <p className="text-gray-500">Company Type</p>
              <p className="font-medium">
                {formData.companyType === 'waste_management' && 'Waste Management'}
                {formData.companyType === 'recycling' && 'Recycling'}
                {formData.companyType === 'municipality' && 'Municipality'}
                {formData.companyType === 'nonprofit' && 'Non-Profit Organization'}
                {formData.companyType === 'other' && 'Other'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Operating Area</p>
              <p className="font-medium">{formData.operatingArea}</p>
            </div>
          </div>
        </div>
        
        {/* Preferences Review */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-medium text-gray-700 mb-2">Your Preferences</h4>
          
          <div className="space-y-4">
            <div className="text-sm">
              <p className="text-gray-500">Notifications</p>
              <ul className="list-disc list-inside font-medium mt-1 ml-2">
                {formData.notificationPreferences.email && <li>Email Notifications</li>}
                {formData.notificationPreferences.push && <li>Push Notifications</li>}
                {formData.notificationPreferences.sms && <li>SMS Notifications</li>}
                {!formData.notificationPreferences.email && 
                 !formData.notificationPreferences.push && 
                 !formData.notificationPreferences.sms && <li>No notifications selected</li>}
              </ul>
            </div>
            
            <div className="text-sm">
              <p className="text-gray-500">Dashboard Display</p>
              <ul className="list-disc list-inside font-medium mt-1 ml-2">
                {formData.dashboardPreferences.showKpis && <li>Show KPI Cards</li>}
                {formData.dashboardPreferences.showRecentActivity && <li>Show Recent Activity</li>}
                <li>Default View: {formData.dashboardPreferences.defaultView.charAt(0).toUpperCase() + formData.dashboardPreferences.defaultView.slice(1)}</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Dashboard Preview */}
        <div className="border border-green-200 rounded-lg p-4">
          <h4 className="text-md font-medium text-gray-700 mb-2">Dashboard Preview</h4>
          <div className="bg-gray-100 rounded p-4 h-48 flex justify-center items-center">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-700">Dashboard preview will be available after setup</p>
            </div>
          </div>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={onPrevious}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Completing Setup...
              </>
            ) : (
              <>
                Complete Setup
                <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompletionStep;
