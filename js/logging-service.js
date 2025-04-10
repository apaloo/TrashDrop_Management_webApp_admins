/**
 * TrashDrop Admin Dashboard - Logging Service
 * Handles system logs, audit trail, and accountability tracking
 */

const LoggingService = {
    logs: [],
    filters: {
        eventType: [],
        user: '',
        startDate: null,
        endDate: null,
        searchTerm: ''
    },
    
    init: function() {
        // Load initial log data
        this.loadLogs();
        
        // Set up event listeners
        this.setupEventListeners();
    },
    
    loadLogs: function() {
        // In a real implementation, this would fetch data from the server
        // For now, we'll generate mock logs
        this.logs = this.generateMockLogs();
        
        // Apply filters and update UI
        this.applyFilters();
    },
    
    generateMockLogs: function() {
        // Generate a set of mock logs for demonstration
        const mockLogs = [];
        
        // Event types
        const eventTypes = [
            'login', 'logout', 'request_created', 'request_updated', 
            'request_completed', 'collector_assigned', 'system_error',
            'security_alert', 'config_changed', 'report_generated'
        ];
        
        // Users
        const users = [
            'Sarah Johnson', 'Miguel Rodriguez', 'David Kim', 
            'System', 'Jennifer Parker', 'Alex Martinez'
        ];
        
        // Generate logs for the past 7 days
        const now = new Date();
        for (let i = 0; i < 100; i++) {
            // Random date within the past 7 days
            const date = new Date(now);
            date.setDate(date.getDate() - Math.floor(Math.random() * 7));
            date.setHours(Math.floor(Math.random() * 24));
            date.setMinutes(Math.floor(Math.random() * 60));
            date.setSeconds(Math.floor(Math.random() * 60));
            
            // Random event type
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            
            // Random user
            const user = users[Math.floor(Math.random() * users.length)];
            
            // Generate log message based on event type
            let message = '';
            let severity = 'info';
            let details = {};
            
            switch (eventType) {
                case 'login':
                    message = `User ${user} logged in`;
                    details = { ip: `192.168.1.${Math.floor(Math.random() * 255)}`, device: 'Web Browser' };
                    break;
                    
                case 'logout':
                    message = `User ${user} logged out`;
                    details = { ip: `192.168.1.${Math.floor(Math.random() * 255)}`, device: 'Web Browser' };
                    break;
                    
                case 'request_created':
                    const requestId = 3800 + Math.floor(Math.random() * 100);
                    message = `Pickup request #${requestId} created`;
                    details = { requestId, address: '123 Main St', customer: 'John Smith' };
                    break;
                    
                case 'request_updated':
                    const updatedRequestId = 3800 + Math.floor(Math.random() * 100);
                    message = `Pickup request #${updatedRequestId} updated`;
                    details = { 
                        requestId: updatedRequestId, 
                        changes: ['status', 'eta'],
                        oldValues: { status: 'new', eta: '10:30 AM' },
                        newValues: { status: 'en-route', eta: '10:45 AM' }
                    };
                    break;
                    
                case 'request_completed':
                    const completedRequestId = 3800 + Math.floor(Math.random() * 100);
                    message = `Pickup request #${completedRequestId} completed`;
                    details = { 
                        requestId: completedRequestId, 
                        completedBy: users[Math.floor(Math.random() * (users.length - 1)) + 1],
                        duration: Math.floor(Math.random() * 30) + 15
                    };
                    break;
                    
                case 'collector_assigned':
                    const assignedRequestId = 3800 + Math.floor(Math.random() * 100);
                    const collector = users[Math.floor(Math.random() * (users.length - 1)) + 1];
                    message = `Collector ${collector} assigned to request #${assignedRequestId}`;
                    details = { 
                        requestId: assignedRequestId, 
                        collector,
                        assignedBy: user
                    };
                    break;
                    
                case 'system_error':
                    message = 'System error occurred';
                    severity = 'error';
                    details = { 
                        errorCode: `ERR${Math.floor(Math.random() * 1000)}`,
                        component: ['database', 'api', 'frontend', 'scheduler'][Math.floor(Math.random() * 4)],
                        message: 'An unexpected error occurred while processing the request'
                    };
                    break;
                    
                case 'security_alert':
                    message = 'Security alert detected';
                    severity = 'warning';
                    details = { 
                        alertType: ['failed_login', 'suspicious_activity', 'permission_violation'][Math.floor(Math.random() * 3)],
                        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
                        attempts: Math.floor(Math.random() * 5) + 1
                    };
                    break;
                    
                case 'config_changed':
                    message = 'System configuration changed';
                    details = { 
                        component: ['notification', 'security', 'mapping', 'scheduling'][Math.floor(Math.random() * 4)],
                        changedBy: user,
                        changes: ['timeout', 'frequency', 'threshold'][Math.floor(Math.random() * 3)]
                    };
                    break;
                    
                case 'report_generated':
                    message = 'Report generated';
                    details = { 
                        reportType: ['performance', 'activity', 'compliance'][Math.floor(Math.random() * 3)],
                        generatedBy: user,
                        format: ['pdf', 'csv', 'excel'][Math.floor(Math.random() * 3)]
                    };
                    break;
            }
            
            // Add log entry
            mockLogs.push({
                id: `log-${i}`,
                timestamp: date,
                eventType,
                user,
                message,
                severity,
                details
            });
        }
        
        // Sort logs by timestamp (newest first)
        mockLogs.sort((a, b) => b.timestamp - a.timestamp);
        
        return mockLogs;
    },
    
    applyFilters: function() {
        let filtered = [...this.logs];
        
        // Apply event type filter
        if (this.filters.eventType.length > 0) {
            filtered = filtered.filter(log => 
                this.filters.eventType.includes(log.eventType)
            );
        }
        
        // Apply user filter
        if (this.filters.user) {
            filtered = filtered.filter(log => 
                log.user.toLowerCase().includes(this.filters.user.toLowerCase())
            );
        }
        
        // Apply date range filter
        if (this.filters.startDate) {
            filtered = filtered.filter(log => 
                log.timestamp >= this.filters.startDate
            );
        }
        
        if (this.filters.endDate) {
            filtered = filtered.filter(log => 
                log.timestamp <= this.filters.endDate
            );
        }
        
        // Apply search term
        if (this.filters.searchTerm) {
            const searchTerm = this.filters.searchTerm.toLowerCase();
            filtered = filtered.filter(log => 
                log.message.toLowerCase().includes(searchTerm) ||
                log.user.toLowerCase().includes(searchTerm) ||
                log.eventType.toLowerCase().includes(searchTerm) ||
                JSON.stringify(log.details).toLowerCase().includes(searchTerm)
            );
        }
        
        // Update UI with filtered logs
        this.updateLogsTable(filtered);
        
        return filtered;
    },
    
    updateLogsTable: function(logs) {
        const tableBody = document.getElementById('logs-table-body');
        if (!tableBody) {
            console.error('Logs table body not found');
            return;
        }
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Add new rows
        logs.forEach(log => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-100 hover:bg-gray-50';
            
            // Format timestamp
            const timestamp = new Date(log.timestamp);
            const formattedDate = timestamp.toLocaleDateString();
            const formattedTime = timestamp.toLocaleTimeString();
            
            // Severity class
            const severityClasses = {
                'info': 'bg-blue-100 text-blue-800',
                'warning': 'bg-yellow-100 text-yellow-800',
                'error': 'bg-red-100 text-red-800'
            };
            
            row.innerHTML = `
                <td class="px-4 py-3 text-sm">${formattedDate} ${formattedTime}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full ${severityClasses[log.severity] || severityClasses.info}">
                        ${log.eventType.replace('_', ' ')}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm">${log.user}</td>
                <td class="px-4 py-3 text-sm">${log.message}</td>
                <td class="px-4 py-3 text-center">
                    <button class="text-gray-500 hover:text-blue-600 view-log-details" data-log-id="${log.id}">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners to view buttons
        const viewButtons = document.querySelectorAll('.view-log-details');
        viewButtons.forEach(button => {
            button.addEventListener('click', () => {
                const logId = button.getAttribute('data-log-id');
                this.viewLogDetails(logId);
            });
        });
    },
    
    viewLogDetails: function(logId) {
        // Find the log
        const log = this.logs.find(l => l.id === logId);
        if (!log) {
            console.error(`Log with ID ${logId} not found`);
            return;
        }
        
        // Format timestamp
        const timestamp = new Date(log.timestamp);
        const formattedDate = timestamp.toLocaleDateString();
        const formattedTime = timestamp.toLocaleTimeString();
        
        // Format details
        const formattedDetails = JSON.stringify(log.details, null, 2);
        
        // Show details in a modal
        const modal = document.getElementById('log-details-modal');
        if (modal) {
            // Update modal content
            const timestampEl = modal.querySelector('.log-timestamp');
            if (timestampEl) timestampEl.textContent = `${formattedDate} ${formattedTime}`;
            
            const eventTypeEl = modal.querySelector('.log-event-type');
            if (eventTypeEl) eventTypeEl.textContent = log.eventType.replace('_', ' ');
            
            const userEl = modal.querySelector('.log-user');
            if (userEl) userEl.textContent = log.user;
            
            const messageEl = modal.querySelector('.log-message');
            if (messageEl) messageEl.textContent = log.message;
            
            const detailsEl = modal.querySelector('.log-details');
            if (detailsEl) detailsEl.textContent = formattedDetails;
            
            // Show modal
            modal.classList.remove('hidden');
        } else {
            // Fallback if modal doesn't exist
            alert(`Log Details:\nTimestamp: ${formattedDate} ${formattedTime}\nEvent Type: ${log.eventType}\nUser: ${log.user}\nMessage: ${log.message}\nDetails: ${formattedDetails}`);
        }
    },
    
    closeLogDetailsModal: function() {
        const modal = document.getElementById('log-details-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },
    
    setupEventListeners: function() {
        // Set up event listeners for filters and actions
        
        // Event type filter
        const eventTypeFilters = document.querySelectorAll('.event-type-filter');
        eventTypeFilters.forEach(filter => {
            filter.addEventListener('change', () => {
                // Update filters
                this.filters.eventType = Array.from(document.querySelectorAll('.event-type-filter:checked'))
                    .map(checkbox => checkbox.value);
                
                // Apply filters
                this.applyFilters();
            });
        });
        
        // User filter
        const userFilter = document.getElementById('user-filter');
        if (userFilter) {
            userFilter.addEventListener('input', () => {
                this.filters.user = userFilter.value;
                this.applyFilters();
            });
        }
        
        // Date range filters
        const startDateFilter = document.getElementById('start-date-filter');
        if (startDateFilter) {
            startDateFilter.addEventListener('change', () => {
                this.filters.startDate = startDateFilter.value ? new Date(startDateFilter.value) : null;
                this.applyFilters();
            });
        }
        
        const endDateFilter = document.getElementById('end-date-filter');
        if (endDateFilter) {
            endDateFilter.addEventListener('change', () => {
                if (endDateFilter.value) {
                    const date = new Date(endDateFilter.value);
                    date.setHours(23, 59, 59, 999); // End of day
                    this.filters.endDate = date;
                } else {
                    this.filters.endDate = null;
                }
                this.applyFilters();
            });
        }
        
        // Search filter
        const searchFilter = document.getElementById('log-search-filter');
        if (searchFilter) {
            searchFilter.addEventListener('input', () => {
                this.filters.searchTerm = searchFilter.value;
                this.applyFilters();
            });
        }
        
        // Close modal button
        const closeModalButton = document.querySelector('.close-log-details-modal');
        if (closeModalButton) {
            closeModalButton.addEventListener('click', () => {
                this.closeLogDetailsModal();
            });
        }
        
        // Export logs button
        const exportButton = document.getElementById('export-logs-button');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                this.exportLogs();
            });
        }
    },
    
    exportLogs: function() {
        // Get filtered logs
        const filteredLogs = this.applyFilters();
        
        // Format logs for export
        const exportData = filteredLogs.map(log => {
            const timestamp = new Date(log.timestamp);
            return {
                timestamp: timestamp.toISOString(),
                eventType: log.eventType,
                user: log.user,
                message: log.message,
                severity: log.severity,
                details: log.details
            };
        });
        
        // Convert to JSON string
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create download link
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "trashdrop_logs.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
};

// Export for use in other scripts
window.LoggingService = LoggingService;
