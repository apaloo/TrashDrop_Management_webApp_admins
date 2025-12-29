import React, { useMemo } from 'react';

const AlertStats = ({ alerts }) => {
  const stats = useMemo(() => {
    return {
      total: alerts.length,
      open: alerts.filter(alert => alert.status === 'open').length,
      resolved: alerts.filter(alert => alert.status === 'resolved').length,
      critical: alerts.filter(alert => alert.priority === 'critical' && alert.status === 'open').length,
      high: alerts.filter(alert => alert.priority === 'high' && alert.status === 'open').length,
      medium: alerts.filter(alert => alert.priority === 'medium' && alert.status === 'open').length,
      low: alerts.filter(alert => alert.priority === 'low' && alert.status === 'open').length,
      byType: {
        pickup_request: alerts.filter(alert => alert.relatedTo?.type === 'pickup_request').length,
        collector: alerts.filter(alert => alert.relatedTo?.type === 'collector').length,
        system: alerts.filter(alert => alert.relatedTo?.type === 'system').length,
        region: alerts.filter(alert => alert.relatedTo?.type === 'region').length,
      }
    };
  }, [alerts]);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* Total Alerts */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="rounded-full p-2 mr-3 bg-gray-100">
              <i className="fas fa-bell text-gray-500"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Alerts</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {stats.open} Open • {stats.resolved} Resolved
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="rounded-full p-2 mr-3" style={{ backgroundColor: 'rgba(220, 53, 69, 0.1)' }}>
              <i className="fas fa-exclamation-circle text-red-600"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500">Critical</p>
              <p className="text-2xl font-bold">{stats.critical}</p>
            </div>
          </div>
          <div className="mt-2 text-xs">
            <span className={stats.critical > 0 ? "text-red-600" : "text-gray-500"}>
              {stats.critical > 0 ? 'Needs immediate attention' : 'No critical alerts'}
            </span>
          </div>
        </div>

        {/* High Priority */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="rounded-full p-2 mr-3" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}>
              <i className="fas fa-exclamation-triangle text-yellow-500"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500">High Priority</p>
              <p className="text-2xl font-bold">{stats.high}</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {Math.round((stats.high / (stats.open || 1)) * 100)}% of open alerts
          </div>
        </div>

        {/* Latest 24h */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="rounded-full p-2 mr-3 bg-blue-100">
              <i className="fas fa-clock text-blue-500"></i>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last 24 Hours</p>
              <p className="text-2xl font-bold">
                {alerts.filter(alert => {
                  const oneDayAgo = new Date();
                  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                  return new Date(alert.createdAt) > oneDayAgo;
                }).length}
              </p>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            New alerts in the past day
          </div>
        </div>

        {/* By Category */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-sm text-gray-500 mb-2">Alerts by Type</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs">Pickup Requests</span>
              <span className="text-xs font-medium">{stats.byType.pickup_request}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ 
                width: `${(stats.byType.pickup_request / stats.total) * 100}%` 
              }}></div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs">Collectors</span>
              <span className="text-xs font-medium">{stats.byType.collector}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full" style={{ 
                width: `${(stats.byType.collector / stats.total) * 100}%` 
              }}></div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs">System</span>
              <span className="text-xs font-medium">{stats.byType.system}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full" style={{ 
                width: `${(stats.byType.system / stats.total) * 100}%` 
              }}></div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs">Regions</span>
              <span className="text-xs font-medium">{stats.byType.region}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-yellow-500 h-1.5 rounded-full" style={{ 
                width: `${(stats.byType.region / stats.total) * 100}%` 
              }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertStats;
