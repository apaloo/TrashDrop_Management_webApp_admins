/**
 * TrashDrop Admin Dashboard - Dashboard Controller
 * Handles dashboard functionality and UI updates
 */

const DashboardController = {
    init: function() {
        this.loadDashboardData();
        this.setupEventListeners();
        this.initializeCharts();
    },

    loadDashboardData: function() {
        // Load metrics data
        const metricsData = DataService.getMetricsData();
        this.updateMetricsUI(metricsData);

        // Load recent requests
        const recentRequests = DataService.getRecentRequests();
        this.updateRecentRequestsUI(recentRequests);

        // Load priority alerts
        const priorityAlerts = DataService.getPriorityAlerts();
        this.updatePriorityAlertsUI(priorityAlerts);

        // Initialize map data
        const mapData = DataService.getMapData();
        this.initializeMap(mapData);
    },

    updateMetricsUI: function(data) {
        // Update active requests card
        document.getElementById('active-requests-count').textContent = data.activeRequests.total;
        document.getElementById('new-requests-count').textContent = data.activeRequests.new;
        document.getElementById('en-route-requests-count').textContent = data.activeRequests.enRoute;
        document.getElementById('completed-requests-count').textContent = data.activeRequests.completed;
        
        // Update progress bars
        const totalRequests = data.activeRequests.total;
        document.getElementById('new-requests-bar').style.width = 
            Math.round((data.activeRequests.new / totalRequests) * 100) + '%';
        document.getElementById('en-route-requests-bar').style.width = 
            Math.round((data.activeRequests.enRoute / totalRequests) * 100) + '%';
        document.getElementById('completed-requests-bar').style.width = 
            Math.round((data.activeRequests.completed / totalRequests) * 100) + '%';
        
        // Update trend indicator
        const trendElement = document.getElementById('requests-trend');
        if (data.activeRequests.trend > 0) {
            trendElement.innerHTML = `<i class="fas fa-arrow-up text-green-500 mr-1"></i>+${data.activeRequests.trend}%`;
            trendElement.classList.add('text-green-500');
            trendElement.classList.remove('text-red-500');
        } else {
            trendElement.innerHTML = `<i class="fas fa-arrow-down text-red-500 mr-1"></i>${data.activeRequests.trend}%`;
            trendElement.classList.add('text-red-500');
            trendElement.classList.remove('text-green-500');
        }

        // Update collector status
        document.getElementById('active-collectors').textContent = data.collectorStatus.active;
        document.getElementById('idle-collectors').textContent = data.collectorStatus.idle;
        document.getElementById('offline-collectors').textContent = data.collectorStatus.offline;
        document.getElementById('fleet-utilization').textContent = data.collectorStatus.utilization + '%';

        // Update response time
        document.getElementById('avg-response-time').textContent = data.responseTime.average + ' min';
        
        // Update completion rate
        document.getElementById('completion-rate').textContent = data.completionRate.rate + '%';
    },

    updateRecentRequestsUI: function(requests) {
        const tableBody = document.getElementById('recent-requests-table-body');
        if (!tableBody) {
            console.error('Recent requests table body not found');
            return;
        }

        // Clear existing rows
        tableBody.innerHTML = '';

        // Add new rows
        requests.forEach(request => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-100 hover:bg-gray-50';
            
            // Status class mapping
            const statusClasses = {
                'new': 'status-pill new',
                'en-route': 'status-pill route',
                'completed': 'status-pill completed',
                'issue': 'status-pill issue'
            };

            row.innerHTML = `
                <td class="px-4 py-3 text-sm font-medium">#${request.id}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center">
                        <img src="${request.customer.avatar}" alt="User" class="w-7 h-7 rounded-full mr-2">
                        <span class="text-sm">${request.customer.name}</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm">${request.address}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center">
                        <img src="${request.collector.avatar}" alt="User" class="w-7 h-7 rounded-full mr-2">
                        <span class="text-sm">${request.collector.name}</span>
                    </div>
                </td>
                <td class="px-4 py-3"><span class="${statusClasses[request.status] || ''}">${this.capitalizeFirstLetter(request.status)}</span></td>
                <td class="px-4 py-3 text-sm">${request.created}</td>
                <td class="px-4 py-3 text-sm">${request.eta}</td>
                <td class="px-4 py-3 text-center">
                    <button class="text-gray-500 hover:text-blue-600 mx-1">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="text-gray-500 hover:text-green-600 mx-1">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    },

    updatePriorityAlertsUI: function(alerts) {
        const alertsContainer = document.getElementById('priority-alerts-container');
        if (!alertsContainer) {
            console.error('Priority alerts container not found');
            return;
        }

        // Clear existing alerts
        alertsContainer.innerHTML = '';

        // Add new alerts
        alerts.forEach((alert, index) => {
            const isLast = index === alerts.length - 1;
            const alertElement = document.createElement('div');
            alertElement.className = isLast ? 'p-3' : 'p-3 border-b border-gray-100';
            
            alertElement.innerHTML = `
                <div class="flex items-start">
                    <div class="${alert.bgClass} p-2 rounded-lg mr-3">
                        <i class="fas fa-${alert.icon} ${alert.iconClass}"></i>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-sm font-medium">${alert.title}</h4>
                        <p class="text-xs text-gray-500 mt-1">${alert.description}</p>
                        <div class="flex mt-2">
                            ${alert.actions.map(action => 
                                `<button class="text-xs ${action.class} px-2 py-1 rounded-md mr-2">${action.label}</button>`
                            ).join('')}
                        </div>
                    </div>
                    <span class="text-xs text-gray-400">${alert.time}</span>
                </div>
            `;
            
            alertsContainer.appendChild(alertElement);
        });
    },

    initializeMap: function(mapData) {
        // This is a placeholder for map initialization
        // In a real implementation, this would integrate with Google Maps or Mapbox
        console.log('Map data loaded:', mapData);
        
        // For now, we'll just update the map legend counts
        document.getElementById('new-marker-count').textContent = 
            mapData.markers.filter(m => m.type === 'new').length;
        document.getElementById('en-route-marker-count').textContent = 
            mapData.markers.filter(m => m.type === 'en-route').length;
        document.getElementById('completed-marker-count').textContent = 
            mapData.markers.filter(m => m.type === 'completed').length;
        document.getElementById('issue-marker-count').textContent = 
            mapData.markers.filter(m => m.type === 'issue').length;
        document.getElementById('priority-marker-count').textContent = 
            mapData.markers.filter(m => m.type === 'priority').length;
    },

    initializeCharts: function() {
        // This would initialize charts using a library like Chart.js
        // For now, this is just a placeholder
        console.log('Charts would be initialized here');
    },

    setupEventListeners: function() {
        // Set up event listeners for dashboard interactions
        
        // Date range selector
        const dateRangeSelector = document.getElementById('date-range-selector');
        if (dateRangeSelector) {
            dateRangeSelector.addEventListener('change', function(e) {
                console.log('Date range changed:', e.target.value);
                // This would trigger a data reload with the new date range
            });
        }
        
        // Map filter buttons
        const mapFilterButtons = document.querySelectorAll('.map-filter-btn');
        mapFilterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const filterType = this.getAttribute('data-filter');
                console.log('Map filter clicked:', filterType);
                // This would update the map display
            });
        });
    },

    // Utility functions
    capitalizeFirstLetter: function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
};

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    DashboardController.init();
});

// Export for use in other scripts
window.DashboardController = DashboardController;
