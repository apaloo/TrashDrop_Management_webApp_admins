/**
 * TrashDrop Admin Dashboard - Alerts Service
 * Handles intelligent alert management, notifications, and triggers
 */

const AlertsService = {
    alerts: [],
    filters: {
        severity: ['critical', 'high', 'medium', 'low'],
        category: [],
        status: ['new', 'acknowledged', 'resolved'],
        assignee: ''
    },
    notificationPreferences: {
        email: true,
        inApp: true,
        push: false,
        sms: false,
        criticalOnly: false
    },
    
    init: function() {
        // Load initial alert data
        this.loadAlerts();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load notification preferences from localStorage
        this.loadNotificationPreferences();
        
        // Initialize emergency logout functionality
        this.initializeEmergencyLogout();
    },
    
    loadAlerts: function() {
        // In a real implementation, this would fetch data from the server
        // For now, we'll generate mock alerts
        this.alerts = this.generateMockAlerts();
        
        // Apply filters and update UI
        this.applyFilters();
        
        // Update alert count
        this.updateAlertCount();
    },
    
    generateMockAlerts: function() {
        // Generate a set of mock alerts for demonstration
        const mockAlerts = [];
        
        // Alert categories
        const categories = [
            'pickup_delay', 'route_deviation', 'collector_idle', 
            'system_performance', 'customer_complaint', 'security'
        ];
        
        // Alert severities with weights (higher weight = more likely)
        const severities = [
            { value: 'critical', weight: 1 },
            { value: 'high', weight: 3 },
            { value: 'medium', weight: 5 },
            { value: 'low', weight: 3 }
        ];
        
        // Alert statuses with weights
        const statuses = [
            { value: 'new', weight: 5 },
            { value: 'acknowledged', weight: 3 },
            { value: 'resolved', weight: 2 }
        ];
        
        // Assignees
        const assignees = [
            'Sarah Johnson', 'Miguel Rodriguez', 'David Kim', 
            '', '', '' // Empty strings for unassigned alerts
        ];
        
        // Generate alerts
        const now = new Date();
        for (let i = 0; i < 30; i++) {
            // Random date within the past 24 hours
            const date = new Date(now);
            date.setHours(date.getHours() - Math.floor(Math.random() * 24));
            date.setMinutes(date.getMinutes() - Math.floor(Math.random() * 60));
            
            // Random category
            const category = categories[Math.floor(Math.random() * categories.length)];
            
            // Random severity (weighted)
            const severityIndex = this.weightedRandom(severities.map(s => s.weight));
            const severity = severities[severityIndex].value;
            
            // Random status (weighted)
            const statusIndex = this.weightedRandom(statuses.map(s => s.weight));
            const status = statuses[statusIndex].value;
            
            // Random assignee
            const assignee = assignees[Math.floor(Math.random() * assignees.length)];
            
            // Generate alert details based on category
            let title = '';
            let description = '';
            let actions = [];
            let entityId = '';
            let entityType = '';
            
            switch (category) {
                case 'pickup_delay':
                    const requestId = 3800 + Math.floor(Math.random() * 100);
                    const delayMinutes = Math.floor(Math.random() * 30) + 15;
                    title = `Pickup Delay`;
                    description = `Request #${requestId} is ${delayMinutes} minutes past ETA`;
                    actions = ['Contact Collector', 'Reassign', 'View Request'];
                    entityId = requestId.toString();
                    entityType = 'request';
                    break;
                    
                case 'route_deviation':
                    const collectorId = Math.floor(Math.random() * 50) + 1;
                    title = `Route Deviation`;
                    description = `Collector #${collectorId} is off expected route`;
                    actions = ['View Map', 'Contact', 'Adjust Route'];
                    entityId = collectorId.toString();
                    entityType = 'collector';
                    break;
                    
                case 'collector_idle':
                    const idleCollectorId = Math.floor(Math.random() * 50) + 1;
                    const idleMinutes = Math.floor(Math.random() * 20) + 10;
                    title = `Collector Idle`;
                    description = `Collector #${idleCollectorId} idle for ${idleMinutes}+ minutes`;
                    actions = ['Check Status', 'Contact', 'Reassign Tasks'];
                    entityId = idleCollectorId.toString();
                    entityType = 'collector';
                    break;
                    
                case 'system_performance':
                    const component = ['Database', 'API', 'Map Service', 'Notification System'][Math.floor(Math.random() * 4)];
                    const metric = ['Response Time', 'Error Rate', 'CPU Usage', 'Memory Usage'][Math.floor(Math.random() * 4)];
                    const threshold = Math.floor(Math.random() * 20) + 80;
                    title = `System Performance`;
                    description = `${component} ${metric} exceeded ${threshold}% threshold`;
                    actions = ['View Metrics', 'Restart Service', 'Contact IT'];
                    entityId = component.toLowerCase().replace(' ', '_');
                    entityType = 'system';
                    break;
                    
                case 'customer_complaint':
                    const complaintRequestId = 3800 + Math.floor(Math.random() * 100);
                    const issues = ['Missed Pickup', 'Rude Collector', 'Damaged Property', 'Incorrect Billing'][Math.floor(Math.random() * 4)];
                    title = `Customer Complaint`;
                    description = `Request #${complaintRequestId} received complaint: ${issues}`;
                    actions = ['View Details', 'Contact Customer', 'Escalate'];
                    entityId = complaintRequestId.toString();
                    entityType = 'request';
                    break;
                    
                case 'security':
                    const securityIssue = ['Failed Login Attempts', 'Suspicious Activity', 'Permission Violation', 'API Key Misuse'][Math.floor(Math.random() * 4)];
                    const location = ['Admin Portal', 'Mobile App', 'API Gateway', 'Database'][Math.floor(Math.random() * 4)];
                    title = `Security Alert`;
                    description = `${securityIssue} detected in ${location}`;
                    actions = ['View Logs', 'Lock Account', 'Reset Credentials'];
                    entityId = location.toLowerCase().replace(' ', '_');
                    entityType = 'security';
                    break;
            }
            
            // Add alert
            mockAlerts.push({
                id: `alert-${i}`,
                timestamp: date,
                category,
                severity,
                status,
                assignee,
                title,
                description,
                actions,
                entityId,
                entityType,
                notes: status === 'acknowledged' || status === 'resolved' ? 'Alert has been reviewed by the team.' : ''
            });
        }
        
        // Sort alerts by severity and timestamp (critical and newest first)
        mockAlerts.sort((a, b) => {
            const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return b.timestamp - a.timestamp;
        });
        
        return mockAlerts;
    },
    
    weightedRandom: function(weights) {
        // Select a random index based on weights
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < weights.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return i;
            }
        }
        
        return weights.length - 1;
    },
    
    applyFilters: function() {
        let filtered = [...this.alerts];
        
        // Apply severity filter
        if (this.filters.severity.length > 0) {
            filtered = filtered.filter(alert => 
                this.filters.severity.includes(alert.severity)
            );
        }
        
        // Apply category filter
        if (this.filters.category.length > 0) {
            filtered = filtered.filter(alert => 
                this.filters.category.includes(alert.category)
            );
        }
        
        // Apply status filter
        if (this.filters.status.length > 0) {
            filtered = filtered.filter(alert => 
                this.filters.status.includes(alert.status)
            );
        }
        
        // Apply assignee filter
        if (this.filters.assignee) {
            if (this.filters.assignee === 'unassigned') {
                filtered = filtered.filter(alert => !alert.assignee);
            } else {
                filtered = filtered.filter(alert => 
                    alert.assignee.toLowerCase().includes(this.filters.assignee.toLowerCase())
                );
            }
        }
        
        // Update UI with filtered alerts
        this.updateAlertsTable(filtered);
        
        return filtered;
    },
    
    updateAlertsTable: function(alerts) {
        const tableBody = document.getElementById('alerts-table-body');
        if (!tableBody) {
            console.error('Alerts table body not found');
            return;
        }
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Add new rows
        alerts.forEach(alert => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-100 hover:bg-gray-50';
            
            // Format timestamp
            const timestamp = new Date(alert.timestamp);
            const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const formattedDate = timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            // Severity class
            const severityClasses = {
                'critical': 'bg-red-100 text-red-800',
                'high': 'bg-orange-100 text-orange-800',
                'medium': 'bg-yellow-100 text-yellow-800',
                'low': 'bg-blue-100 text-blue-800'
            };
            
            // Status class
            const statusClasses = {
                'new': 'bg-blue-100 text-blue-800',
                'acknowledged': 'bg-purple-100 text-purple-800',
                'resolved': 'bg-green-100 text-green-800'
            };
            
            row.innerHTML = `
                <td class="px-4 py-3 text-sm">${formattedDate} ${formattedTime}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full ${severityClasses[alert.severity] || ''}">
                        ${alert.severity}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm">${alert.title}</td>
                <td class="px-4 py-3 text-sm">${alert.description}</td>
                <td class="px-4 py-3 text-sm">
                    <span class="px-2 py-1 text-xs rounded-full ${statusClasses[alert.status] || ''}">
                        ${alert.status}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm">${alert.assignee || 'Unassigned'}</td>
                <td class="px-4 py-3 text-center">
                    <button class="text-gray-500 hover:text-blue-600 mx-1 view-alert-btn" data-alert-id="${alert.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="text-gray-500 hover:text-green-600 mx-1 update-alert-btn" data-alert-id="${alert.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners to buttons
        this.addTableRowEventListeners();
    },
    
    addTableRowEventListeners: function() {
        // Add event listeners to view buttons
        const viewButtons = document.querySelectorAll('.view-alert-btn');
        viewButtons.forEach(button => {
            button.addEventListener('click', () => {
                const alertId = button.getAttribute('data-alert-id');
                this.viewAlertDetails(alertId);
            });
        });
        
        // Add event listeners to update buttons
        const updateButtons = document.querySelectorAll('.update-alert-btn');
        updateButtons.forEach(button => {
            button.addEventListener('click', () => {
                const alertId = button.getAttribute('data-alert-id');
                this.updateAlertStatus(alertId);
            });
        });
    },
    
    viewAlertDetails: function(alertId) {
        // Find the alert
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) {
            console.error(`Alert with ID ${alertId} not found`);
            return;
        }
        
        // Format timestamp
        const timestamp = new Date(alert.timestamp);
        const formattedDate = timestamp.toLocaleDateString();
        const formattedTime = timestamp.toLocaleTimeString();
        
        // Show details in a modal
        const modal = document.getElementById('alert-details-modal');
        if (modal) {
            // Update modal content
            const titleEl = modal.querySelector('.alert-title');
            if (titleEl) titleEl.textContent = alert.title;
            
            const descriptionEl = modal.querySelector('.alert-description');
            if (descriptionEl) descriptionEl.textContent = alert.description;
            
            const timestampEl = modal.querySelector('.alert-timestamp');
            if (timestampEl) timestampEl.textContent = `${formattedDate} ${formattedTime}`;
            
            const severityEl = modal.querySelector('.alert-severity');
            if (severityEl) {
                severityEl.textContent = alert.severity;
                severityEl.className = 'alert-severity px-2 py-1 text-xs rounded-full';
                const severityClasses = {
                    'critical': 'bg-red-100 text-red-800',
                    'high': 'bg-orange-100 text-orange-800',
                    'medium': 'bg-yellow-100 text-yellow-800',
                    'low': 'bg-blue-100 text-blue-800'
                };
                severityEl.classList.add(...(severityClasses[alert.severity] || '').split(' '));
            }
            
            const statusEl = modal.querySelector('.alert-status');
            if (statusEl) {
                statusEl.textContent = alert.status;
                statusEl.className = 'alert-status px-2 py-1 text-xs rounded-full';
                const statusClasses = {
                    'new': 'bg-blue-100 text-blue-800',
                    'acknowledged': 'bg-purple-100 text-purple-800',
                    'resolved': 'bg-green-100 text-green-800'
                };
                statusEl.classList.add(...(statusClasses[alert.status] || '').split(' '));
            }
            
            const assigneeEl = modal.querySelector('.alert-assignee');
            if (assigneeEl) assigneeEl.textContent = alert.assignee || 'Unassigned';
            
            const categoryEl = modal.querySelector('.alert-category');
            if (categoryEl) categoryEl.textContent = alert.category.replace('_', ' ');
            
            const notesEl = modal.querySelector('.alert-notes');
            if (notesEl) notesEl.textContent = alert.notes || 'No notes available';
            
            const actionsContainer = modal.querySelector('.alert-actions-container');
            if (actionsContainer) {
                actionsContainer.innerHTML = '';
                alert.actions.forEach(action => {
                    const button = document.createElement('button');
                    button.className = 'text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-md mr-2';
                    button.textContent = action;
                    button.addEventListener('click', () => {
                        this.performAlertAction(alertId, action);
                    });
                    actionsContainer.appendChild(button);
                });
            }
            
            // Show modal
            modal.classList.remove('hidden');
        } else {
            // Fallback if modal doesn't exist
            alert(`Alert Details:\nTitle: ${alert.title}\nDescription: ${alert.description}\nSeverity: ${alert.severity}\nStatus: ${alert.status}\nAssignee: ${alert.assignee || 'Unassigned'}\nCategory: ${alert.category}\nNotes: ${alert.notes || 'No notes available'}`);
        }
    },
    
    updateAlertStatus: function(alertId) {
        // Find the alert
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) {
            console.error(`Alert with ID ${alertId} not found`);
            return;
        }
        
        // Show update modal
        const modal = document.getElementById('update-alert-modal');
        if (modal) {
            // Update modal content
            const titleEl = modal.querySelector('.update-alert-title');
            if (titleEl) titleEl.textContent = alert.title;
            
            const statusSelect = modal.querySelector('#alert-status-select');
            if (statusSelect) {
                statusSelect.value = alert.status;
            }
            
            const assigneeSelect = modal.querySelector('#alert-assignee-select');
            if (assigneeSelect) {
                assigneeSelect.value = alert.assignee || '';
            }
            
            const notesTextarea = modal.querySelector('#alert-notes-textarea');
            if (notesTextarea) {
                notesTextarea.value = alert.notes || '';
            }
            
            // Set alert ID for save button
            const saveButton = modal.querySelector('#save-alert-button');
            if (saveButton) {
                saveButton.setAttribute('data-alert-id', alertId);
            }
            
            // Show modal
            modal.classList.remove('hidden');
        } else {
            // Fallback if modal doesn't exist
            const newStatus = prompt(`Update status for alert "${alert.title}" (new, acknowledged, resolved):`, alert.status);
            if (newStatus && ['new', 'acknowledged', 'resolved'].includes(newStatus.toLowerCase())) {
                alert.status = newStatus.toLowerCase();
                this.applyFilters();
            }
        }
    },
    
    saveAlertUpdate: function(alertId) {
        // Find the alert
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) {
            console.error(`Alert with ID ${alertId} not found`);
            return;
        }
        
        // Get form values
        const statusSelect = document.querySelector('#alert-status-select');
        const assigneeSelect = document.querySelector('#alert-assignee-select');
        const notesTextarea = document.querySelector('#alert-notes-textarea');
        
        if (statusSelect && assigneeSelect && notesTextarea) {
            // Update alert
            alert.status = statusSelect.value;
            alert.assignee = assigneeSelect.value;
            alert.notes = notesTextarea.value;
            
            // Close modal
            const modal = document.getElementById('update-alert-modal');
            if (modal) {
                modal.classList.add('hidden');
            }
            
            // Apply filters to update UI
            this.applyFilters();
            
            // Show success message
            this.showToast('Alert updated successfully');
        }
    },
    
    performAlertAction: function(alertId, action) {
        // Find the alert
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) {
            console.error(`Alert with ID ${alertId} not found`);
            return;
        }
        
        console.log(`Performing action "${action}" on alert ${alertId}`);
        
        // In a real implementation, this would perform the action
        // For now, we'll just show a message
        this.showToast(`Action "${action}" performed on alert "${alert.title}"`);
        
        // If the action is "Acknowledge" or "Resolve", update the alert status
        if (action.toLowerCase() === 'acknowledge') {
            alert.status = 'acknowledged';
            this.applyFilters();
        } else if (action.toLowerCase() === 'resolve') {
            alert.status = 'resolved';
            this.applyFilters();
        }
    },
    
    showToast: function(message) {
        const toast = document.getElementById('toast-notification');
        if (toast) {
            const messageEl = toast.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
            
            // Show toast
            toast.classList.remove('hidden');
            
            // Hide after 3 seconds
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        } else {
            // Fallback if toast doesn't exist
            console.log(message);
        }
    },
    
    updateAlertCount: function() {
        // Count new alerts
        const newAlerts = this.alerts.filter(alert => alert.status === 'new');
        
        // Update count in UI
        const alertCountBadge = document.querySelector('.alert-count-badge');
        if (alertCountBadge) {
            alertCountBadge.textContent = newAlerts.length;
            
            // Show/hide based on count
            if (newAlerts.length > 0) {
                alertCountBadge.classList.remove('hidden');
            } else {
                alertCountBadge.classList.add('hidden');
            }
        }
        
        // Update notification dot
        const notificationDot = document.querySelector('.notification-dot');
        if (notificationDot) {
            if (newAlerts.length > 0) {
                notificationDot.classList.remove('hidden');
            } else {
                notificationDot.classList.add('hidden');
            }
        }
    },
    
    loadNotificationPreferences: function() {
        // Try to load preferences from localStorage
        const savedPreferences = localStorage.getItem('notificationPreferences');
        if (savedPreferences) {
            try {
                const preferences = JSON.parse(savedPreferences);
                this.notificationPreferences = { ...this.notificationPreferences, ...preferences };
            } catch (error) {
                console.error('Error loading notification preferences:', error);
            }
        }
        
        // Update UI checkboxes
        this.updateNotificationPreferencesUI();
    },
    
    saveNotificationPreferences: function() {
        // Save preferences to localStorage
        localStorage.setItem('notificationPreferences', JSON.stringify(this.notificationPreferences));
        
        // Show success message
        this.showToast('Notification preferences saved');
    },
    
    updateNotificationPreferencesUI: function() {
        // Update UI checkboxes based on preferences
        const emailCheckbox = document.getElementById('email-notifications');
        if (emailCheckbox) {
            emailCheckbox.checked = this.notificationPreferences.email;
        }
        
        const inAppCheckbox = document.getElementById('in-app-notifications');
        if (inAppCheckbox) {
            inAppCheckbox.checked = this.notificationPreferences.inApp;
        }
        
        const pushCheckbox = document.getElementById('push-notifications');
        if (pushCheckbox) {
            pushCheckbox.checked = this.notificationPreferences.push;
        }
        
        const smsCheckbox = document.getElementById('sms-notifications');
        if (smsCheckbox) {
            smsCheckbox.checked = this.notificationPreferences.sms;
        }
        
        const criticalOnlyCheckbox = document.getElementById('critical-only-notifications');
        if (criticalOnlyCheckbox) {
            criticalOnlyCheckbox.checked = this.notificationPreferences.criticalOnly;
        }
    },
    
    setupEventListeners: function() {
        // Set up event listeners for filters and actions
        
        // Severity filters
        const severityFilters = document.querySelectorAll('.severity-filter');
        severityFilters.forEach(filter => {
            filter.addEventListener('change', () => {
                // Update filters
                this.filters.severity = Array.from(document.querySelectorAll('.severity-filter:checked'))
                    .map(checkbox => checkbox.value);
                
                // Apply filters
                this.applyFilters();
            });
        });
        
        // Category filters
        const categoryFilters = document.querySelectorAll('.category-filter');
        categoryFilters.forEach(filter => {
            filter.addEventListener('change', () => {
                // Update filters
                this.filters.category = Array.from(document.querySelectorAll('.category-filter:checked'))
                    .map(checkbox => checkbox.value);
                
                // Apply filters
                this.applyFilters();
            });
        });
        
        // Status filters
        const statusFilters = document.querySelectorAll('.status-filter');
        statusFilters.forEach(filter => {
            filter.addEventListener('change', () => {
                // Update filters
                this.filters.status = Array.from(document.querySelectorAll('.status-filter:checked'))
                    .map(checkbox => checkbox.value);
                
                // Apply filters
                this.applyFilters();
            });
        });
        
        // Assignee filter
        const assigneeFilter = document.getElementById('assignee-filter');
        if (assigneeFilter) {
            assigneeFilter.addEventListener('change', () => {
                this.filters.assignee = assigneeFilter.value;
                this.applyFilters();
            });
        }
        
        // Close modal buttons
        const closeModalButtons = document.querySelectorAll('.close-modal');
        closeModalButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modalId = button.getAttribute('data-modal-id');
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.classList.add('hidden');
                }
            });
        });
        
        // Save alert button
        const saveAlertButton = document.getElementById('save-alert-button');
        if (saveAlertButton) {
            saveAlertButton.addEventListener('click', () => {
                const alertId = saveAlertButton.getAttribute('data-alert-id');
                this.saveAlertUpdate(alertId);
            });
        }
        
        // Notification preference checkboxes
        const notificationCheckboxes = document.querySelectorAll('.notification-preference');
        notificationCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const preference = checkbox.getAttribute('data-preference');
                this.notificationPreferences[preference] = checkbox.checked;
            });
        });
        
        // Save notification preferences button
        const savePreferencesButton = document.getElementById('save-notification-preferences');
        if (savePreferencesButton) {
            savePreferencesButton.addEventListener('click', () => {
                this.saveNotificationPreferences();
            });
        }
    },
    
    initializeEmergencyLogout: function() {
        // Initialize emergency logout functionality
        // This integrates with the existing emergency-logout.js from the user account system
        
        // Add keyboard shortcut (Ctrl+Alt+L)
        document.addEventListener('keydown', function(event) {
            if (event.ctrlKey && event.altKey && event.key === 'l') {
                // Trigger emergency logout
                if (typeof window.emergencyLogout === 'function') {
                    window.emergencyLogout();
                } else {
                    // Fallback if emergencyLogout function doesn't exist
                    console.log('Emergency logout triggered (keyboard shortcut)');
                    alert('Emergency Logout Triggered');
                    window.location.href = '/logout';
                }
            }
        });
        
        // Add emergency logout button event listener
        const emergencyLogoutButton = document.getElementById('emergency-logout-button');
        if (emergencyLogoutButton) {
            emergencyLogoutButton.addEventListener('click', function() {
                // Trigger emergency logout
                if (typeof window.emergencyLogout === 'function') {
                    window.emergencyLogout();
                } else {
                    // Fallback if emergencyLogout function doesn't exist
                    console.log('Emergency logout triggered (button)');
                    alert('Emergency Logout Triggered');
                    window.location.href = '/logout';
                }
            });
        }
    }
};

// Export for use in other scripts
window.AlertsService = AlertsService;
