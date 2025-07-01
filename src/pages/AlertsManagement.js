import React, { useState, useEffect, useMemo } from 'react';
import AlertDetailsModal from '../components/alerts/AlertDetailsModal';
import AlertsFilter from '../components/alerts/AlertsFilter';
import AlertsTable from '../components/alerts/AlertsTable';
import AlertStats from '../components/alerts/AlertStats';
import BulkActionModal from '../components/alerts/BulkActionModal';
import CreateAlertModal from '../components/alerts/CreateAlertModal';
import AlertExport from '../components/alerts/AlertExport';
import mockAlerts from '../data/mockAlerts';

// Note: Supabase integration will be added later
// import { supabase } from '../utils/supabaseClient';

const AlertsManagement = () => {
  // State management
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [selectedAlerts, setSelectedAlerts] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkActionModalOpen, setIsBulkActionModalOpen] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    type: 'all',
    searchQuery: '',
    dateRange: 'all',
    dateFrom: '',
    dateTo: '',
  });
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({
    key: 'createdAt',
    direction: 'desc'
  });
  
  // Fetch alerts data (currently using mock data)
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // Simulate API delay
        setTimeout(() => {
          setAlerts(mockAlerts);
          setLoading(false);
        }, 800);
        
        // In the future, replace with Supabase call:
        // const { data, error } = await supabase.from('alerts').select('*');
        // if (error) throw error;
        // setAlerts(data);
      } catch (error) {
        console.error('Error fetching alerts:', error);
        setLoading(false);
      }
    };
    
    fetchAlerts();
  }, []);
  
  // Handle filter changes
  const handleFilterChange = (filterName, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [filterName]: value
    }));
  };
  
  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      type: 'all',
      searchQuery: '',
      dateRange: 'all',
      dateFrom: '',
      dateTo: '',
    });
  };
  
  // Handle alert selection for bulk actions
  const handleSelectAlert = (id, isSelected) => {
    setSelectedAlerts(prevSelected => {
      if (isSelected) {
        return [...prevSelected, id];
      } else {
        return prevSelected.filter(alertId => alertId !== id);
      }
    });
  };
  
  // Handle bulk selection of all visible alerts
  const handleSelectAllAlerts = (isSelected) => {
    if (isSelected) {
      setSelectedAlerts(filteredAlerts.map(alert => alert.id));
    } else {
      setSelectedAlerts([]);
    }
  };
  
  // Toggle alert status (open/resolved)
  const toggleAlertStatus = (id) => {
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => 
        alert.id === id 
          ? { 
              ...alert, 
              status: alert.status === 'open' ? 'resolved' : 'open',
              updatedAt: new Date().toISOString()
            } 
          : alert
      )
    );
  };
  
  // Update alert assignment
  const updateAlertAssignment = (id, assignedTo) => {
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => 
        alert.id === id 
          ? { 
              ...alert, 
              assignedTo,
              updatedAt: new Date().toISOString()
            } 
          : alert
      )
    );
  };
  
  // Add comment to alert
  const addCommentToAlert = (id, comment) => {
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => 
        alert.id === id 
          ? { 
              ...alert, 
              comments: [
                ...alert.comments || [],
                {
                  id: `comment-${alert.id}-${new Date().getTime()}`,
                  text: comment,
                  createdAt: new Date().toISOString(),
                  createdBy: 'Admin',
                  isSystem: false
                }
              ],
              updatedAt: new Date().toISOString()
            } 
          : alert
      )
    );
  };
  
  // Handle bulk actions
  const handleBulkAction = (action, value) => {
    if (action === 'status') {
      setAlerts(prevAlerts => 
        prevAlerts.map(alert => 
          selectedAlerts.includes(alert.id)
            ? { ...alert, status: value, updatedAt: new Date().toISOString() }
            : alert
        )
      );
    } else if (action === 'assign') {
      setAlerts(prevAlerts => 
        prevAlerts.map(alert => 
          selectedAlerts.includes(alert.id)
            ? { ...alert, assignedTo: value, updatedAt: new Date().toISOString() }
            : alert
        )
      );
    }
    
    // Clear selections after bulk action
    setSelectedAlerts([]);
    setIsBulkActionModalOpen(false);
  };
  
  // Handle create alert
  const handleCreateAlert = (newAlert) => {
    const alertToAdd = {
      ...newAlert,
      id: `alert-${new Date().getTime()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'open',
      comments: []
    };
    
    setAlerts(prevAlerts => [alertToAdd, ...prevAlerts]);
    setIsCreateModalOpen(false);
  };
  
  // Apply date range filter
  const getDateFilteredAlerts = (alerts) => {
    if (filters.dateRange === 'all') return alerts;
    
    const now = new Date();
    let startDate;
    
    switch(filters.dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(now);
        endOfYesterday.setDate(endOfYesterday.getDate() - 1);
        endOfYesterday.setHours(23, 59, 59, 999);
        return alerts.filter(alert => {
          const date = new Date(alert.createdAt);
          return date >= startDate && date <= endOfYesterday;
        });
      case 'last7Days':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last30Days':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return alerts.filter(alert => {
          const date = new Date(alert.createdAt);
          return date >= startDate && date <= endOfLastMonth;
        });
      case 'custom':
        if (!filters.dateFrom && !filters.dateTo) return alerts;
        
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
        const toDate = filters.dateTo ? new Date(filters.dateTo) : null;
        
        return alerts.filter(alert => {
          const date = new Date(alert.createdAt);
          if (fromDate && toDate) {
            // Set end of day for toDate
            toDate.setHours(23, 59, 59, 999);
            return date >= fromDate && date <= toDate;
          } else if (fromDate) {
            return date >= fromDate;
          } else if (toDate) {
            // Set end of day for toDate
            toDate.setHours(23, 59, 59, 999);
            return date <= toDate;
          }
          return true;
        });
      default:
        return alerts;
    }
    
    return alerts.filter(alert => new Date(alert.createdAt) >= startDate);
  };
  
  // Apply combined filters
  const filteredAlerts = useMemo(() => {
    let filtered = [...alerts];
    
    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(alert => alert.status === filters.status);
    }
    
    // Apply priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(alert => alert.priority === filters.priority);
    }
    
    // Apply type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(alert => alert.relatedTo.type === filters.type);
    }
    
    // Apply search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(alert => {
        return (
          alert.title.toLowerCase().includes(query) ||
          alert.description.toLowerCase().includes(query) ||
          (alert.relatedTo.location && alert.relatedTo.location.toLowerCase().includes(query)) ||
          alert.relatedTo.id.toLowerCase().includes(query)
        );
      });
    }
    
    // Apply date range filter
    filtered = getDateFilteredAlerts(filtered);
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    return filtered;
  }, [alerts, filters, sortConfig]);
  
  // Get the selected alert by ID
  const selectedAlert = useMemo(() => {
    return alerts.find(alert => alert.id === selectedAlertId) || null;
  }, [alerts, selectedAlertId]);
  
  // List of potential users to assign to alerts
  const assignmentOptions = [
    { value: 'admin@trashdrop.com', label: 'Admin' },
    { value: 'operations@trashdrop.com', label: 'Operations Team' },
    { value: 'support@trashdrop.com', label: 'Support Team' },
    { value: 'manager@trashdrop.com', label: 'Regional Manager' },
    { value: null, label: 'Unassigned' }
  ];
  
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts Management</h1>
          <p className="text-gray-600 text-sm">
            Monitor and manage system alerts and notifications
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          {selectedAlerts.length > 0 && (
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
              onClick={() => setIsBulkActionModalOpen(true)}
            >
              <i className="fas fa-tasks mr-2"></i>
              Bulk Actions ({selectedAlerts.length})
            </button>
          )}
          
          <button 
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <i className="fas fa-plus-circle mr-2"></i>
            Create Alert
          </button>
        </div>
      </div>
      
      {/* Alert Statistics */}
      <AlertStats alerts={alerts} />
      
      {/* Filters */}
      <AlertsFilter 
        filters={filters} 
        handleFilterChange={handleFilterChange} 
        clearFilters={clearFilters}
      />
      
      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border-0 p-6">
        {/* Table header with bulk actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div className="flex items-center mb-4 md:mb-0">
            <h2 className="text-lg font-semibold mr-2">All Alerts</h2>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {filteredAlerts.length} {filteredAlerts.length === 1 ? 'result' : 'results'}
            </span>
          </div>
          
          {/* Export options */}
          <div className="relative">
            <AlertExport alerts={alerts} filteredAlerts={filteredAlerts} />
          </div>
        </div>
        
        {/* Alerts Table */}
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex rounded-full bg-gray-100 p-4 mb-4">
              <i className="fas fa-bell-slash text-2xl text-gray-500"></i>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No alerts found</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {filters.searchQuery || filters.status !== 'all' || filters.priority !== 'all' || filters.type !== 'all' || filters.dateRange !== 'all' 
                ? 'Try adjusting your filters to see more results.'
                : 'There are currently no alerts in the system. Create a new alert to get started.'}
            </p>
            {(filters.searchQuery || filters.status !== 'all' || filters.priority !== 'all' || filters.type !== 'all' || filters.dateRange !== 'all') && (
              <button 
                className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-800"
                onClick={clearFilters}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <AlertsTable 
            alerts={filteredAlerts} 
            onViewDetails={(id) => setSelectedAlertId(id)}
            toggleAlertStatus={toggleAlertStatus}
            selectedAlerts={selectedAlerts}
            onSelectAlert={handleSelectAlert}
            onSelectAll={handleSelectAllAlerts}
            sortConfig={sortConfig}
            onSort={(key) => {
              setSortConfig(prevConfig => ({
                key,
                direction: prevConfig.key === key && prevConfig.direction === 'desc' ? 'asc' : 'desc'
              }));
            }}
          />
        )}
      </div>
      
      {/* Alert Details Modal */}
      {selectedAlert && (
        <AlertDetailsModal 
          alert={selectedAlert} 
          onClose={() => setSelectedAlertId(null)}
          toggleAlertStatus={toggleAlertStatus}
          updateAlertAssignment={updateAlertAssignment}
          addComment={addCommentToAlert}
          assignmentOptions={assignmentOptions}
        />
      )}
      
      {/* Create Alert Modal */}
      {isCreateModalOpen && (
        <CreateAlertModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreateAlert={handleCreateAlert}
          assignmentOptions={assignmentOptions}
        />
      )}
      
      {/* Bulk Action Modal */}
      {isBulkActionModalOpen && (
        <BulkActionModal
          selectedCount={selectedAlerts.length}
          onClose={() => setIsBulkActionModalOpen(false)}
          onBulkAction={handleBulkAction}
          assignmentOptions={assignmentOptions}
        />
      )}
    </div>
  );
};

export default AlertsManagement;
