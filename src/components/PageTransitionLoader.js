import React from 'react';

const PageTransitionLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 bg-opacity-90 transition-opacity duration-200">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          {/* Outer spinning ring */}
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-200 border-t-green-600"></div>
          {/* Inner pulsing dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <p className="text-green-700 font-medium text-sm">Loading...</p>
      </div>
    </div>
  );
};

export default PageTransitionLoader;
