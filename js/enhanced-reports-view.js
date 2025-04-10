/**
 * TrashDrop Admin Dashboard - Enhanced Illegal Dumping Reports View
 * This module enhances the Reports view with a modern design based on the standalone implementation
 */

const EnhancedReportsView = {
    // Initialize the enhanced reports view
    init: function() {
        console.log('Initializing Enhanced Reports View');
        this.createEnhancedReportsContainer();
        this.setupEventListeners();
    },
    
    // Create the enhanced reports container with modern design
    createEnhancedReportsContainer: function() {
        // Get reference to the reports container
        const reportsContainer = $('#illegal-dumping-reports-container');
        
        // Clear existing content
        reportsContainer.empty();
        
        // Create the enhanced reports view HTML
        const enhancedReportsHTML = `
            <div class="filter-section bg-white rounded-lg shadow-sm p-4 mb-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <!-- Status Filter -->
                    <div>
                        <label class="block text-sm font-medium text-gray-500 mb-1">Status</label>
                        <select id="enhanced-status-filter" class="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg appearance-none text-sm">
                            <option value="all">All Statuses</option>
                            <option value="new">New</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="verified">Verified</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>
                    
                    <!-- Date Range Filter -->
                    <div>
                        <label class="block text-sm font-medium text-gray-500 mb-1">Date Range</label>
                        <input type="date" id="enhanced-date-filter" class="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">
                    </div>
                    
                    <!-- Location/Zone Filter -->
                    <div>
                        <label class="block text-sm font-medium text-gray-500 mb-1">Location/Zone</label>
                        <select id="enhanced-zone-filter" class="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg appearance-none text-sm">
                            <option value="all">All Zones</option>
                            <option value="north">North District</option>
                            <option value="south">South District</option>
                            <option value="east">East District</option>
                            <option value="west">West District</option>
                            <option value="central">Central District</option>
                        </select>
                    </div>
                    
                    <!-- Search -->
                    <div>
                        <label class="block text-sm font-medium text-gray-500 mb-1">Search</label>
                        <div class="relative">
                            <input type="text" id="enhanced-search-input" placeholder="Report ID or keywords" class="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">
                            <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                                <svg class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex justify-end">
                    <button id="enhanced-export-btn" class="bg-white border border-gray-300 rounded-lg px-4 py-2 mr-2 flex items-center text-sm">
                        <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Data
                    </button>
                    <button id="enhanced-new-report-btn" class="bg-blue-600 text-white rounded-lg px-4 py-2 flex items-center text-sm">
                        <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        New Report
                    </button>
                </div>
            </div>
            
            <!-- Reports Table -->
            <div class="bg-white rounded-lg shadow-sm overflow-hidden mb-4">
                <table class="w-full" id="enhanced-reports-table">
                    <thead>
                        <tr class="text-xs text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                            <th class="px-4 py-3 text-left">Report ID</th>
                            <th class="px-4 py-3 text-left">Date/Time</th>
                            <th class="px-4 py-3 text-left">Location/Zone</th>
                            <th class="px-4 py-3 text-left">Status</th>
                            <th class="px-4 py-3 text-left">Severity</th>
                            <th class="px-4 py-3 text-left">Assigned To</th>
                            <th class="px-4 py-3 text-left">Action</th>
                        </tr>
                    </thead>
                    <tbody id="enhanced-reports-tbody">
                        <!-- Table rows will be dynamically populated -->
                    </tbody>
                </table>
                
                <!-- Pagination -->
                <div class="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
                    <div class="text-sm text-gray-500">Showing <span id="enhanced-showing-count">0</span> of <span id="enhanced-total-count">0</span> reports</div>
                    <div class="flex space-x-1" id="enhanced-pagination">
                        <button class="px-3 py-1 rounded-md bg-gray-100 text-gray-600 disabled:opacity-50">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button class="px-3 py-1 rounded-md bg-blue-600 text-white">1</button>
                        <button class="px-3 py-1 rounded-md hover:bg-gray-100">2</button>
                        <button class="px-3 py-1 rounded-md hover:bg-gray-100">3</button>
                        <button class="px-3 py-1 rounded-md bg-gray-100 text-gray-600">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Report Detail Panel -->
            <div class="bg-white rounded-lg shadow-sm overflow-hidden" id="enhanced-detail-panel" style="display: none;">
                <!-- Tabs Navigation -->
                <div class="flex border-b border-gray-200">
                    <button class="px-6 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600">Report Details</button>
                    <button class="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">Assignment</button>
                    <button class="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">Verification</button>
                    <button class="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">Payment</button>
                </div>
                
                <!-- Status Flow -->
                <div class="p-4 border-b border-gray-200">
                    <div class="relative pt-8">
                        <!-- Progress Bar -->
                        <div class="absolute top-8 left-0 right-0 h-1 bg-gray-200"></div>
                        
                        <!-- Steps -->
                        <div class="flex justify-between relative">
                            <div class="flex flex-col items-center">
                                <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">1</div>
                                <div class="mt-2 text-xs font-medium">Reported</div>
                            </div>
                            <div class="flex flex-col items-center">
                                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">2</div>
                                <div class="mt-2 text-xs font-medium">Assignment</div>
                            </div>
                            <div class="flex flex-col items-center">
                                <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-sm font-medium">3</div>
                                <div class="mt-2 text-xs font-medium">In Progress</div>
                            </div>
                            <div class="flex flex-col items-center">
                                <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-sm font-medium">4</div>
                                <div class="mt-2 text-xs font-medium">Completed</div>
                            </div>
                            <div class="flex flex-col items-center">
                                <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-sm font-medium">5</div>
                                <div class="mt-2 text-xs font-medium">Verified</div>
                            </div>
                            <div class="flex flex-col items-center">
                                <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-sm font-medium">6</div>
                                <div class="mt-2 text-xs font-medium">Paid</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Report Details Content -->
                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Report Information -->
                        <div>
                            <h3 class="text-lg font-medium text-gray-800 mb-3 flex items-center">
                                <svg class="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Report Information
                            </h3>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <div class="text-sm font-medium text-gray-500">Report ID</div>
                                    <div class="text-sm font-medium" id="detail-report-id">ID-2025-0427</div>
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-gray-500">Date/Time</div>
                                    <div class="text-sm" id="detail-datetime">04/07/2025, 02:45 PM</div>
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-gray-500">Status</div>
                                    <div class="text-sm" id="detail-status">
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                            Assigned
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-gray-500">Severity</div>
                                    <div class="text-sm font-medium text-amber-600" id="detail-severity">Medium</div>
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-gray-500">Reported By</div>
                                    <div class="text-sm" id="detail-reporter">John Citizen</div>
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-gray-500">Contact</div>
                                    <div class="text-sm" id="detail-contact">john@example.com</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Location Information -->
                        <div>
                            <h3 class="text-lg font-medium text-gray-800 mb-3 flex items-center">
                                <svg class="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Location Information
                            </h3>
                            
                            <div class="grid grid-cols-2 gap-4 mb-3">
                                <div>
                                    <div class="text-sm font-medium text-gray-500">Zone</div>
                                    <div class="text-sm" id="detail-zone">Central District</div>
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-gray-500">Address</div>
                                    <div class="text-sm" id="detail-address">123 Main St, Central District</div>
                                </div>
                            </div>
                            
                            <!-- Map Placeholder -->
                            <div class="bg-gray-100 rounded-lg h-40 flex items-center justify-center">
                                <span class="text-gray-500">Location Map</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Report Description -->
                    <div class="mt-4">
                        <h3 class="text-lg font-medium text-gray-800 mb-3 flex items-center">
                            <svg class="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                            Description
                        </h3>
                        <p class="text-sm text-gray-600" id="detail-description">
                            Large pile of construction debris dumped near the community park entrance. Includes broken concrete, wood scraps, and plastic waste. Appears to have been dumped overnight.
                        </p>
                    </div>
                    
                    <!-- Report Images -->
                    <div class="mt-4">
                        <h3 class="text-lg font-medium text-gray-800 mb-3 flex items-center">
                            <svg class="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Images
                        </h3>
                        <div class="grid grid-cols-3 gap-4" id="detail-images">
                            <div class="bg-gray-100 rounded-lg h-24 flex items-center justify-center">
                                <span class="text-gray-500">Image 1</span>
                            </div>
                            <div class="bg-gray-100 rounded-lg h-24 flex items-center justify-center">
                                <span class="text-gray-500">Image 2</span>
                            </div>
                            <div class="bg-gray-100 rounded-lg h-24 flex items-center justify-center">
                                <span class="text-gray-500">Image 3</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="mt-6 flex justify-end space-x-3">
                        <button class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                            Back to List
                        </button>
                        <button class="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700">
                            Update Status
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add the enhanced reports HTML to the container
        reportsContainer.html(enhancedReportsHTML);
    },
    
    // Set up event listeners for the enhanced reports view
    setupEventListeners: function() {
        // Filter change events
        $('#enhanced-status-filter, #enhanced-zone-filter, #enhanced-date-filter').on('change', this.applyFilters.bind(this));
        
        // Search input event
        $('#enhanced-search-input').on('input', this.applyFilters.bind(this));
        
        // Export button click
        $('#enhanced-export-btn').on('click', function() {
            alert('Export functionality will be implemented');
        });
        
        // New report button click
        $('#enhanced-new-report-btn').on('click', function() {
            alert('New report form will be implemented');
        });
        
        // Table row click to show details
        $(document).on('click', '#enhanced-reports-tbody tr', this.showReportDetails.bind(this));
        
        // Back button click to hide details
        $(document).on('click', '#enhanced-detail-panel button:contains("Back to List")', this.hideReportDetails.bind(this));
        
        // Populate the table with sample data
        this.populateReportsTable();
    },
    
    // Apply filters to the reports table
    applyFilters: function() {
        console.log('Applying filters');
        // In a real implementation, this would filter the data based on selected criteria
        // For now, we'll just log the filter values
        const statusFilter = $('#enhanced-status-filter').val();
        const zoneFilter = $('#enhanced-zone-filter').val();
        const dateFilter = $('#enhanced-date-filter').val();
        const searchTerm = $('#enhanced-search-input').val();
        
        console.log('Filters:', { statusFilter, zoneFilter, dateFilter, searchTerm });
        
        // Repopulate the table with filtered data
        this.populateReportsTable();
    },
    
    // Populate the reports table with sample data
    populateReportsTable: function() {
        const sampleData = [
            { id: 'ID-2025-0428', date: '04/08/2025, 09:23 AM', location: 'North District', status: 'new', severity: 'high', assignedTo: '-' },
            { id: 'ID-2025-0427', date: '04/07/2025, 02:45 PM', location: 'Central District', status: 'assigned', severity: 'medium', assignedTo: 'John Doe' },
            { id: 'ID-2025-0426', date: '04/07/2025, 10:12 AM', location: 'East District', status: 'in_progress', severity: 'medium', assignedTo: 'Alice Smith' },
            { id: 'ID-2025-0425', date: '04/06/2025, 03:56 PM', location: 'West District', status: 'completed', severity: 'low', assignedTo: 'Bob Johnson' },
            { id: 'ID-2025-0424', date: '04/06/2025, 11:30 AM', location: 'South District', status: 'verified', severity: 'high', assignedTo: 'Sarah Williams' },
            { id: 'ID-2025-0423', date: '04/05/2025, 04:18 PM', location: 'Central District', status: 'paid', severity: 'medium', assignedTo: 'Michael Brown' }
        ];
        
        const tbody = $('#enhanced-reports-tbody');
        tbody.empty();
        
        sampleData.forEach(report => {
            const statusClass = this.getStatusClass(report.status);
            const severityClass = this.getSeverityClass(report.severity);
            
            const row = `
                <tr class="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" data-report-id="${report.id}">
                    <td class="px-4 py-3 text-sm">${report.id}</td>
                    <td class="px-4 py-3 text-sm">${report.date}</td>
                    <td class="px-4 py-3 text-sm">${report.location}</td>
                    <td class="px-4 py-3 text-sm">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                            ${this.formatStatus(report.status)}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-sm ${severityClass}">${report.severity}</td>
                    <td class="px-4 py-3 text-sm">${report.assignedTo}</td>
                    <td class="px-4 py-3 text-sm">
                        <button class="text-blue-600 hover:text-blue-800">View</button>
                    </td>
                </tr>
            `;
            
            tbody.append(row);
        });
        
        // Update pagination info
        $('#enhanced-showing-count').text(sampleData.length);
        $('#enhanced-total-count').text('42');
    },
    
    // Show report details panel
    showReportDetails: function(e) {
        const reportId = $(e.currentTarget).data('report-id');
        console.log('Showing details for report:', reportId);
        
        // In a real implementation, this would fetch the report details from the server
        // For now, we'll just show the detail panel with sample data
        
        // Update detail fields with sample data
        $('#detail-report-id').text(reportId);
        
        // Show the detail panel
        $('#enhanced-reports-table').closest('.bg-white').hide();
        $('#enhanced-detail-panel').show();
    },
    
    // Hide report details panel
    hideReportDetails: function() {
        $('#enhanced-reports-table').closest('.bg-white').show();
        $('#enhanced-detail-panel').hide();
    },
    
    // Helper function to get status badge class
    getStatusClass: function(status) {
        const statusClasses = {
            'new': 'bg-blue-100 text-blue-800',
            'assigned': 'bg-yellow-100 text-yellow-800',
            'in_progress': 'bg-indigo-100 text-indigo-800',
            'completed': 'bg-green-100 text-green-800',
            'verified': 'bg-teal-100 text-teal-800',
            'paid': 'bg-purple-100 text-purple-800'
        };
        
        return statusClasses[status] || 'bg-gray-100 text-gray-800';
    },
    
    // Helper function to get severity text class
    getSeverityClass: function(severity) {
        const severityClasses = {
            'high': 'text-red-600 font-medium',
            'medium': 'text-amber-600 font-medium',
            'low': 'text-green-600 font-medium'
        };
        
        return severityClasses[severity] || '';
    },
    
    // Helper function to format status text
    formatStatus: function(status) {
        if (status === 'in_progress') return 'In Progress';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
};
