/**
 * TrashDrop Admin Dashboard - Illegal Dumping Management
 * Handles functionality for illegal dumping reporting, tracking, and resolution
 */

const IllegalDumpingManagement = {
    // Data storage
    reports: [],
    activeFilters: {
        status: 'all',
        severity: 'all',
        timeframe: 'week',
        zone: 'all',
        search: ''
    },
    mapMarkers: [],
    selectedReport: null,
    activeView: 'map', // Default view: 'map', 'reports', or 'history'
    historicalData: [],
    
    // Initialize the module
    init: function() {
        console.log('Initializing Illegal Dumping Management module');
        
        // Set initialized flag
        this.initialized = true;
        
        // Initialize filtering and pagination variables
        this.activeFilters = {
            status: 'all',
            severity: 'all',
            timeframe: 'week',
            zone: 'all',
            search: ''
        };
        this.sortField = 'date';
        this.sortDirection = 'desc';
        this.currentPage = 1;
        this.itemsPerPage = 15;
        this.filteredReports = [];
        this.activeReport = null;
        
        // Create the view containers if they don't exist
        this.createViewContainers();
        
        // Load data from DataService
        this.loadReports();
        this.loadHistoricalData();
        
        // Set up event listeners for data changes
        document.addEventListener('reports-updated', this.handleReportsUpdated.bind(this));
        
        // Setup event listeners
        this.setupEventListeners();
        this.updateStatsOverview();
        
        // Initialize the appropriate view based on activeView
        this.switchView(this.activeView);
        
        // Note: removeUnwantedElements is now called from switchView
        // to ensure it's applied after the view is properly initialized
    },
    
    // Create the view containers if they don't exist
    createViewContainers: function() {
        // Check if the map container is empty and create it if needed
        if ($('#illegal-dumping-map-container').children().length <= 1) { // Account for stats overview
            this.createMapContainer();
        }
        
        // Check if the reports container is empty and create it if needed
        if ($('#illegal-dumping-reports-container').length === 0) {
            // Create the container first
            $('#illegal-dumping-section').append('<div id="illegal-dumping-reports-container" class="view-container hidden"></div>');
        }
        
        if ($('#illegal-dumping-reports-container').children().length === 0) {
            this.createReportsContainer();
        }
        
        // Check if the history container is empty and create it if needed
        if ($('#illegal-dumping-history-container').length === 0) {
            // Create the container first
            $('#illegal-dumping-section').append('<div id="illegal-dumping-history-container" class="view-container hidden"></div>');
        }
        
        if ($('#illegal-dumping-history-container').children().length === 0) {
            this.createHistoryContainer();
        }
    },
    
    // Create the map container
    createMapContainer: function() {
        console.log('Creating map container');
        
        // Create the main container for the map view
        const mapContainerHTML = `
            <!-- Map View -->
            <div class="card mb-6">
                <div class="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 class="font-semibold">Illegal Dumping Map</h3>
                    
                    <div class="flex space-x-2">
                        <div class="relative">
                            <select id="map-filter" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg appearance-none pr-8 text-sm">
                                <option value="all">All Reports</option>
                                <option value="new">New Reports</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <i class="fas fa-chevron-down"></i>
                            </div>
                        </div>
                        
                        <button id="refresh-map-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                            <i class="fas fa-sync-alt mr-1"></i> Refresh
                        </button>
                    </div>
                </div>
                
                <div class="p-4">
                    <div id="illegal-dumping-map" class="h-96 bg-gray-100 rounded-lg overflow-hidden">
                        <!-- Map will be initialized here -->
                    </div>
                </div>
            </div>
            
            <!-- Map Legend -->
            <div class="card mb-6">
                <div class="p-4 border-b bg-gray-50">
                    <h3 class="font-semibold">Map Legend</h3>
                </div>
                <div class="p-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex items-center">
                            <div class="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
                            <span class="text-sm">New Reports</span>
                        </div>
                        <div class="flex items-center">
                            <div class="w-4 h-4 rounded-full bg-yellow-500 mr-2"></div>
                            <span class="text-sm">Assigned</span>
                        </div>
                        <div class="flex items-center">
                            <div class="w-4 h-4 rounded-full bg-orange-500 mr-2"></div>
                            <span class="text-sm">In Progress</span>
                        </div>
                        <div class="flex items-center">
                            <div class="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                            <span class="text-sm">Completed</span>
                        </div>
                        <div class="flex items-center">
                            <div class="w-4 h-4 rounded-full bg-purple-500 mr-2"></div>
                            <span class="text-sm">Verified</span>
                        </div>
                        <div class="flex items-center">
                            <div class="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
                            <span class="text-sm">Selected Report</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Append the container to the illegal dumping section
        $('#illegal-dumping-map-container').append(mapContainerHTML);
        
        // Set up event listeners for the map view
        this.setupMapEventListeners();
    },
    
    // Remove unwanted elements from the UI
    removeUnwantedElements: function() {
        // Only remove elements when we're in the history view
        if (this.activeView === 'history') {
            // Remove the date and greeting header section
            $('body > div.flex.h-screen.overflow-hidden > main > div > div.flex.justify-between.mb-6').remove();
            
            // Remove the KPI cards grid
            $('body > div.flex.h-screen.overflow-hidden > main > div > div.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4.gap-6.mb-6').remove();
            
            // Remove the grid in the illegal dumping section
            $('#illegal-dumping-section > div.grid.grid-cols-1.lg\\:grid-cols-3.gap-6.mb-6').remove();
            
            // Remove the card in the illegal dumping section
            $('#illegal-dumping-section > div.card.mb-6').remove();
            
            // Remove the blue button (export report button)
            $('body > div.flex.h-screen.overflow-hidden > main > div > div.flex.justify-between.mb-6 > div > button.bg-blue-600.text-white.rounded-lg.px-4.py-2.flex.items-center.text-sm').remove();
        }
    },
    
    // Switch between different views (map, reports, history)
    switchView: function(view) {
        console.log('Switching to view:', view);
        this.activeView = view;
        
        // Hide all view containers
        $('.view-container').addClass('hidden');
        
        // Show the selected view container
        $(`#illegal-dumping-${view}-container`).removeClass('hidden');
        
        // Apply view-specific UI changes based on the view
        if (view === 'reports') {
            // For Reports view: Initialize if needed
            if ($('#illegal-dumping-reports-container').children().length === 0) {
                // Use the enhanced reports view instead of the original one
                if (typeof EnhancedReportsView !== 'undefined') {
                    EnhancedReportsView.init();
                } else {
                    // Fall back to original implementation if enhanced view is not available
                    this.createReportsContainer();
                }
            }
            
            // Apply filters to show the reports with current filter settings
            if (typeof EnhancedReportsView !== 'undefined') {
                EnhancedReportsView.applyFilters();
            } else {
                this.applyFilters();
            }
            
            // Set up event listeners for the reports view
            if (typeof EnhancedReportsView === 'undefined') {
                this.setupReportsEventListeners();
            }
        } 
        else if (view === 'map') {
            // For Map view: Initialize map if needed
            this.initializeMap();
            this.updateMapMarkers(this.reports);
        } 
        else if (view === 'history') {
            // For History view: Initialize if needed
            if ($('#illegal-dumping-history-container').children().length === 0) {
                this.createHistoryContainer();
            }
            
            // Update history view
            this.updateHistoryView();
        }
        
        // Update active state in the submenu
        $('#illegal-dumping-submenu .submenu-link').removeClass('active');
        $(`#illegal-dumping-submenu .submenu-link[data-content="illegal-dumping-${view}"]`).addClass('active');
        
        // Ensure the parent section is visible
        $('#illegal-dumping-section').removeClass('hidden');
        $('.content-section').not('#illegal-dumping-section').addClass('hidden');
    },
    
    // Create the reports container with all necessary elements
    createReportsContainer: function() {
        console.log('Creating reports container with modern design');
        
        // Create the main container for the reports view
        const reportsContainerHTML = `
        <style>
            /* Modern Reports View Styles */
            .filter-section {
                background: white;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .filter-controls {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                margin-bottom: 15px;
            }
            
            .filter-control {
                flex: 1;
                min-width: 200px;
            }
            
            .filter-label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
                font-size: 14px;
                color: #64748b;
            }
            
            .export-btn {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
            }
            
            .reports-table-container {
                background: white;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                overflow: hidden;
                margin-bottom: 20px;
            }
            
            .status-badge {
                padding: 5px 10px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
                display: inline-block;
            }
            
            .status-new {
                background-color: #dbeafe;
                color: #1e40af;
            }
            
            .status-assigned {
                background-color: #fef3c7;
                color: #92400e;
            }
            
            .status-progress {
                background-color: #e0f2fe;
                color: #0369a1;
            }
            
            .status-completed {
                background-color: #dcfce7;
                color: #166534;
            }
            
            .status-verified {
                background-color: #d1fae5;
                color: #065f46;
            }
            
            .status-paid {
                background-color: #f0fdf4;
                color: #14532d;
            }
            
            .severity-high {
                color: #dc2626;
                font-weight: 600;
            }
            
            .severity-medium {
                color: #ca8a04;
                font-weight: 600;
            }
            
            .severity-low {
                color: #16a34a;
                font-weight: 600;
            }
            
            .detail-panel {
                background: white;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            
            .detail-tabs {
                display: flex;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .detail-tab {
                padding: 15px 20px;
                font-weight: 500;
                cursor: pointer;
                border-bottom: 2px solid transparent;
            }
            
            .detail-tab.active {
                border-bottom-color: #2563eb;
                color: #2563eb;
            }
            
            .status-flow {
                padding: 30px 20px;
                position: relative;
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .flow-step {
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
                z-index: 2;
            }
            
            .step-indicator {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background-color: #cbd5e1;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                margin-bottom: 8px;
            }
            
            .flow-step.completed .step-indicator {
                background-color: #16a34a;
            }
            
            .flow-step.active .step-indicator {
                background-color: #2563eb;
            }
            
            .step-label {
                font-size: 12px;
                font-weight: 500;
                color: #64748b;
            }
            
            .flow-step.completed .step-label,
            .flow-step.active .step-label {
                color: #1e293b;
            }
            
            .status-flow::before {
                content: '';
                position: absolute;
                top: 45px;
                left: 20px;
                right: 20px;
                height: 2px;
                background-color: #cbd5e1;
                z-index: 1;
            }
        </style>
        
        <!-- Modern Reports View -->
        <div class="filter-section">
            <div class="filter-controls">
                <div class="filter-control">
                    <label class="filter-label">Status</label>
                    <select id="report-status-filter" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg appearance-none pr-8 text-sm w-full">
                        <option value="all">All</option>
                        <option value="new">New</option>
                        <option value="assigned">Assigned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="verified">Verified</option>
                        <option value="paid">Paid</option>
                    </select>
                </div>
                
                <div class="filter-control">
                    <label class="filter-label">Date Range</label>
                    <select id="report-date-filter" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg appearance-none pr-8 text-sm w-full">
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="this_week">This Week</option>
                        <option value="last_week">Last Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>
                
                <div class="filter-control" id="custom-date-range" style="display: none;">
                    <label class="filter-label">Custom Range</label>
                    <div class="flex space-x-2">
                        <input type="date" id="date-from" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">
                        <input type="date" id="date-to" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">
                    </div>
                </div>
                
                <div class="filter-control">
                    <label class="filter-label">Location/Zone</label>
                    <select id="report-location-filter" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg appearance-none pr-8 text-sm w-full">
                        <option value="all">All Locations</option>
                        <option value="downtown">Downtown</option>
                        <option value="north">North District</option>
                        <option value="east">East District</option>
                        <option value="south">South District</option>
                        <option value="west">West District</option>
                    </select>
                </div>
            </div>
            
            <div class="flex flex-wrap justify-between items-center mt-4">
                <div class="filter-control w-full md:w-auto mb-2 md:mb-0">
                    <div class="relative">
                        <input type="text" id="report-search" placeholder="Search reports..." class="bg-white border border-gray-300 text-gray-700 px-4 py-2 pl-10 rounded-lg text-sm w-full md:w-64">
                        <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <i class="fas fa-search text-gray-500"></i>
                        </div>
                    </div>
                </div>
                
                <div class="flex space-x-2">
                    <button id="export-csv-btn" class="export-btn bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                        <i class="fas fa-file-csv text-gray-500"></i>
                        <span>Export CSV</span>
                    </button>
                    <button id="export-pdf-btn" class="export-btn bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                        <i class="fas fa-file-pdf text-gray-500"></i>
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Reports Table -->
        <div class="reports-table-container">
            <table id="illegal-dumping-reports-table" class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="id">
                            ID <i class="fas fa-sort ml-1"></i>
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="date">
                            Date <i class="fas fa-sort ml-1"></i>
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="location">
                            Location <i class="fas fa-sort ml-1"></i>
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="severity">
                            Severity <i class="fas fa-sort ml-1"></i>
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="status">
                            Status <i class="fas fa-sort ml-1"></i>
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="assignee">
                            Assignee <i class="fas fa-sort ml-1"></i>
                        </th>
                        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody id="illegal-dumping-reports-tbody" class="bg-white divide-y divide-gray-200">
                                <option value="downtown">Downtown</option>
                                <option value="north">North District</option>
                                <option value="east">East District</option>
                                <option value="south">South District</option>
                                <option value="west">West District</option>
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <i class="fas fa-chevron-down"></i>
                            </div>
                        </div>
                        </div>
                        
                        <div class="flex items-center space-x-2 w-full md:w-auto mt-2 md:mt-0">
                            <!-- Search Bar -->
                            <div class="relative mb-2 md:mb-0">
                                <input type="text" id="report-search" placeholder="Search by ID or keywords" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm w-full md:w-64">
                                <div class="absolute inset-y-0 right-0 flex items-center px-3">
                                    <i class="fas fa-search text-gray-500"></i>
                                </div>
                            </div>
                            
                            <!-- Export Data Button -->
                            <button id="export-reports-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors mb-2 md:mb-0">
                                <i class="fas fa-file-export mr-2"></i>Export Data
                            </button>
                        </div>
                    </div>
                    
                    <!-- Reports Table -->
                    <div class="overflow-x-auto">
                        <table class="w-full" id="illegal-dumping-reports-table">
                            <thead>
                                <tr class="text-xs text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                                    <th class="px-4 py-3 text-left cursor-pointer" data-sort="id">
                                        <div class="flex items-center">
                                            Report ID<i class="fas fa-sort ml-1"></i>
                                        </div>
                                    </th>
                                    <th class="px-4 py-3 text-left cursor-pointer" data-sort="date">
                                        <div class="flex items-center">
                                            Date/Time<i class="fas fa-sort ml-1"></i>
                                        </div>
                                    </th>
                                    <th class="px-4 py-3 text-left cursor-pointer" data-sort="location">
                                        <div class="flex items-center">
                                            Location/Zone<i class="fas fa-sort ml-1"></i>
                                        </div>
                                    </th>
                                    <th class="px-4 py-3 text-left cursor-pointer" data-sort="status">
                                        <div class="flex items-center">
                                            Status<i class="fas fa-sort ml-1"></i>
                                        </div>
                                    </th>
                                    <th class="px-4 py-3 text-left cursor-pointer" data-sort="severity">
                                        <div class="flex items-center">
                                            Severity<i class="fas fa-sort ml-1"></i>
                                        </div>
                                    </th>
                                    <th class="px-4 py-3 text-left cursor-pointer" data-sort="assigned">
                                        <div class="flex items-center">
                                            Assigned To<i class="fas fa-sort ml-1"></i>
                                        </div>
                                    </th>
                                    <th class="px-4 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="illegal-dumping-reports-tbody">
                                <!-- Report rows will be dynamically inserted here -->
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Pagination Controls -->
                    <div class="p-4 border-t flex justify-between items-center">
                        <div class="text-sm text-gray-500" id="reports-pagination-info">Showing 1-15 of 0 reports</div>
                        <div class="flex space-x-1" id="reports-pagination-controls">
                            <button class="px-3 py-1 rounded-md bg-gray-100 text-gray-600 disabled:opacity-50" id="reports-prev-page" disabled>
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <div id="reports-page-numbers" class="flex space-x-1">
                                <button class="px-3 py-1 rounded-md bg-blue-600 text-white">1</button>
                            </div>
                            <button class="px-3 py-1 rounded-md bg-gray-100 text-gray-600 disabled:opacity-50" id="reports-next-page" disabled>
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Report Detail Panel (Hidden by default) -->
                <div id="report-detail-panel" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                    <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-screen overflow-hidden flex flex-col">
                        <!-- Panel Header -->
                        <div class="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 class="font-semibold" id="report-detail-title">Report Details</h3>
                            <button id="close-report-detail" class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <!-- Status Flow Visualization -->
                        <div class="px-6 pt-4 border-b">
                            <div class="flex items-center justify-between mb-2">
                                <div class="text-sm font-medium">Status Flow:</div>
                                <div class="text-xs text-gray-500" id="report-last-updated">Last updated: N/A</div>
                            </div>
                            <div class="relative">
                                <div class="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2"></div>
                                <div class="flex justify-between relative z-10">
                                    <div class="status-step" data-status="new">
                                        <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                                            <i class="fas fa-file-alt text-gray-500"></i>
                                        </div>
                                        <div class="text-xs mt-1 text-center">New</div>
                                    </div>
                                    <div class="status-step" data-status="assigned">
                                        <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                                            <i class="fas fa-user-check text-gray-500"></i>
                                        </div>
                                        <div class="text-xs mt-1 text-center">Assigned</div>
                                    </div>
                                    <div class="status-step" data-status="in_progress">
                                        <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                                            <i class="fas fa-broom text-gray-500"></i>
                                        </div>
                                        <div class="text-xs mt-1 text-center">In Progress</div>
                                    </div>
                                    <div class="status-step" data-status="completed">
                                        <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                                            <i class="fas fa-check text-gray-500"></i>
                                        </div>
                                        <div class="text-xs mt-1 text-center">Completed</div>
                                    </div>
                                    <div class="status-step" data-status="verified">
                                        <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                                            <i class="fas fa-clipboard-check text-gray-500"></i>
                                        </div>
                                        <div class="text-xs mt-1 text-center">Verified</div>
                                    </div>
                                    <div class="status-step" data-status="paid">
                                        <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                                            <i class="fas fa-money-bill-wave text-gray-500"></i>
                                        </div>
                                        <div class="text-xs mt-1 text-center">Paid</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Tab Navigation -->
                        <div class="border-b">
                            <div class="flex">
                                <button class="px-6 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600 report-detail-tab active" data-tab="report-details">
                                    Report Details
                                </button>
                                <button class="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 report-detail-tab" data-tab="assignment">
                                    Assignment
                                </button>
                                <button class="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 report-detail-tab" data-tab="verification">
                                    Verification
                                </button>
                                <button class="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 report-detail-tab" data-tab="payment">
                                    Payment
                                </button>
                            </div>
                        </div>
                        
                        <!-- Tab Content -->
                        <div class="flex-1 overflow-y-auto">
                            <!-- Report Details Tab -->
                            <div class="p-6 tab-content active" id="report-details-tab">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <!-- Left Column: Report Information -->
                                    <div>
                                        <h4 class="text-lg font-medium mb-4">Report Information</h4>
                                        
                                        <div class="space-y-4">
                                            <div class="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div class="text-sm text-gray-500">Report ID</div>
                                                    <div class="font-medium" id="detail-report-id">-</div>
                                                </div>
                                                <div>
                                                    <div class="text-sm text-gray-500">Reported On</div>
                                                    <div class="font-medium" id="detail-report-date">-</div>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div class="text-sm text-gray-500">Reporting Method</div>
                                                <div class="font-medium" id="detail-reporting-method">-</div>
                                            </div>
                                            
                                            <div>
                                                <div class="text-sm text-gray-500">Reporter Details</div>
                                                <div class="font-medium" id="detail-reporter">-</div>
                                            </div>
                                            
                                            <div>
                                                <div class="text-sm text-gray-500">Description</div>
                                                <div class="text-sm" id="detail-description">-</div>
                                            </div>
                                            
                                            <div class="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div class="text-sm text-gray-500">Severity</div>
                                                    <div id="detail-severity">-</div>
                                                </div>
                                                <div>
                                                    <div class="text-sm text-gray-500">Waste Type</div>
                                                    <div class="font-medium" id="detail-waste-type">-</div>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div class="text-sm text-gray-500">Estimated Volume</div>
                                                <div class="font-medium" id="detail-volume">-</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Right Column: Location and Images -->
                                    <div>
                                        <h4 class="text-lg font-medium mb-4">Location</h4>
                                        
                                        <div class="mb-4">
                                            <div class="text-sm text-gray-500">Address</div>
                                            <div class="font-medium" id="detail-address">-</div>
                                        </div>
                                        
                                        <div class="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <div class="text-sm text-gray-500">GPS Coordinates</div>
                                                <div class="font-medium" id="detail-coordinates">-</div>
                                            </div>
                                            <div>
                                                <div class="text-sm text-gray-500">Zone/District</div>
                                                <div class="font-medium" id="detail-zone">-</div>
                                            </div>
                                        </div>
                                        
                                        <!-- Mini Map -->
                                        <div class="h-48 bg-gray-100 rounded-lg mb-6" id="detail-mini-map">
                                            <div class="w-full h-full flex items-center justify-center text-gray-500">
                                                <span>Map loading...</span>
                                            </div>
                                        </div>
                                        
                                        <h4 class="text-lg font-medium mb-4">Images</h4>
                                        
                                        <!-- Image Gallery -->
                                        <div class="grid grid-cols-3 gap-2" id="detail-image-gallery">
                                            <div class="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                                                <span class="text-gray-500 text-sm">No images</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Timeline -->
                                <div class="mt-8">
                                    <h4 class="text-lg font-medium mb-4">Timeline</h4>
                                    <div class="border-l-2 border-gray-200 pl-4 space-y-4" id="detail-timeline">
                                        <div class="relative">
                                            <div class="absolute -left-6 mt-1 w-4 h-4 rounded-full bg-blue-500"></div>
                                            <div class="text-sm text-gray-500">No timeline events</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Assignment Tab (Empty for now, will be populated dynamically) -->
                            <div class="p-6 tab-content hidden" id="assignment-tab">
                                <div class="text-center text-gray-500 py-8">
                                    Assignment tab content will be loaded when a report is selected.
                                </div>
                            </div>
                            
                            <!-- Verification Tab (Empty for now, will be populated dynamically) -->
                            <div class="p-6 tab-content hidden" id="verification-tab">
                                <div class="text-center text-gray-500 py-8">
                                    Verification tab content will be loaded when a report is selected.
                                </div>
                            </div>
                            
                            <!-- Payment Tab (Empty for now, will be populated dynamically) -->
                            <div class="p-6 tab-content hidden" id="payment-tab">
                                <div class="text-center text-gray-500 py-8">
                                    Payment tab content will be loaded when a report is selected.
                                </div>
                            </div>
                        </div>
                        
                        <!-- Panel Footer -->
                        <div class="p-4 border-t bg-gray-50 flex justify-end">
                            <button id="close-report-detail-btn" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 mr-2 hover:bg-gray-100">
                                Close
                            </button>
                            <button id="report-action-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" disabled>
                                Next Action
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Append the container to the illegal dumping section
        $('#illegal-dumping-section').append(reportsContainerHTML);
        
        // Set up event listeners for the reports view
        this.setupReportsEventListeners();
    },
    
    // Update the reports table with the provided data
    updateReportsTable: function(reports) {
        console.log('Updating reports table with', reports.length, 'reports');
        
        // Clear the existing table content
        const $tbody = $('#illegal-dumping-reports-tbody');
        $tbody.empty();
        
        // If there are no reports, show a message
        if (reports.length === 0) {
            $tbody.append(`
                <tr class="border-b border-gray-100">
                    <td colspan="7" class="px-4 py-6 text-center text-gray-500">
                        <div class="flex flex-col items-center">
                            <i class="fas fa-clipboard-list text-gray-300 text-4xl mb-3"></i>
                            <p>No reports found</p>
                            <p class="text-sm mt-1">Try adjusting your filters or search criteria</p>
                        </div>
                    </td>
                </tr>
            `);
            
            // Update pagination info
            $('#reports-pagination-info').text('Showing 0 of 0 reports');
            return;
        }
        
        // Add each report to the table
        reports.forEach(report => {
            // Create status pill based on report status
            let statusPill = '';
            switch (report.status) {
                case 'new':
                    statusPill = `<span class="status-pill new">New</span>`;
                    break;
                case 'assigned':
                    statusPill = `<span class="status-pill assigned">Assigned</span>`;
                    break;
                case 'in_progress':
                    statusPill = `<span class="status-pill in-progress">In Progress</span>`;
                    break;
                case 'completed':
                    statusPill = `<span class="status-pill completed">Completed</span>`;
                    break;
                case 'verified':
                    statusPill = `<span class="status-pill verified">Verified</span>`;
                    break;
                case 'paid':
                    statusPill = `<span class="status-pill paid">Paid</span>`;
                    break;
                default:
                    statusPill = `<span class="status-pill">${report.status}</span>`;
            }
            
            // Create severity indicator
            let severityIndicator = '';
            switch (report.severity) {
                case 'high':
                    severityIndicator = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">High</span>`;
                    break;
                case 'medium':
                    severityIndicator = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Medium</span>`;
                    break;
                case 'low':
                    severityIndicator = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Low</span>`;
                    break;
                default:
                    severityIndicator = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">${report.severity}</span>`;
            }
            
            // Format the date
            const reportDate = new Date(report.date);
            const formattedDate = reportDate.toLocaleString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Create the assigned to cell
            let assignedToCell = '';
            if (report.assignedTo) {
                assignedToCell = `
                    <div class="flex items-center">
                        <img src="${report.assignedTo.avatar || '/api/placeholder/32/32'}" alt="${report.assignedTo.name}" class="w-7 h-7 rounded-full mr-2">
                        <div>
                            <p class="text-sm font-medium">${report.assignedTo.name}</p>
                            <p class="text-xs text-gray-500">${report.assignedTo.role || 'Cleaner'}</p>
                        </div>
                    </div>
                `;
            } else {
                assignedToCell = `<span class="text-gray-500">Not assigned</span>`;
            }
            
            // Create action buttons
            const actionButtons = `
                <div class="flex justify-center space-x-1">
                    <button class="view-report-btn p-1 rounded-md hover:bg-gray-100" data-report-id="${report.id}" title="View Details">
                        <i class="fas fa-eye text-blue-600"></i>
                    </button>
                    <button class="edit-report-btn p-1 rounded-md hover:bg-gray-100" data-report-id="${report.id}" title="Edit Report">
                        <i class="fas fa-edit text-gray-600"></i>
                    </button>
                    <button class="quick-action-btn p-1 rounded-md hover:bg-gray-100" data-report-id="${report.id}" title="Quick Actions">
                        <i class="fas fa-ellipsis-v text-gray-600"></i>
                    </button>
                </div>
            `;
            
            // Create the row HTML
            const rowHTML = `
                <tr class="border-b border-gray-100 hover:bg-gray-50" data-report-id="${report.id}">
                    <td class="px-4 py-3 text-sm font-medium">#${report.id}</td>
                    <td class="px-4 py-3 text-sm">${formattedDate}</td>
                    <td class="px-4 py-3 text-sm">${report.location}</td>
                    <td class="px-4 py-3">${statusPill}</td>
                    <td class="px-4 py-3">${severityIndicator}</td>
                    <td class="px-4 py-3">${assignedToCell}</td>
                    <td class="px-4 py-3 text-center">${actionButtons}</td>
                </tr>
            `;
            
            // Append the row to the table
            $tbody.append(rowHTML);
        });
        
        // Update pagination info
        $('#reports-pagination-info').text(`Showing 1-${Math.min(reports.length, 15)} of ${reports.length} reports`);
    },
    
    // Set up event listeners for the reports view
    setupReportsEventListeners: function() {
        console.log('Setting up reports event listeners');
        
        // Initialize active filters and pagination
        this.activeFilters = {
            status: 'all',
            severity: 'all',
            zone: 'all',
            dateRange: null,
            search: ''
        };
        
        this.pagination = {
            currentPage: 1,
            itemsPerPage: 10,
            totalPages: 1
        };
        
        this.sorting = {
            field: 'date',
            direction: 'desc' // newest first by default
        };
        
        // Filter change handlers
        $('#report-status-filter').on('change', (e) => {
            this.activeFilters.status = e.target.value;
            this.resetPagination();
            this.applyFilters();
        });
        
        $('#report-severity-filter').on('change', (e) => {
            this.activeFilters.severity = e.target.value;
            this.resetPagination();
            this.applyFilters();
        });
        
        $('#report-zone-filter').on('change', (e) => {
            this.activeFilters.zone = e.target.value;
            this.resetPagination();
            this.applyFilters();
        });
        
        // Date range picker initialization and handler
        $('#report-date-range').daterangepicker({
            autoUpdateInput: false,
            locale: {
                cancelLabel: 'Clear',
                format: 'MMM DD, YYYY'
            }
        });
        
        $('#report-date-range').on('apply.daterangepicker', (e, picker) => {
            $('#report-date-range').val(picker.startDate.format('MMM DD, YYYY') + ' - ' + picker.endDate.format('MMM DD, YYYY'));
            this.activeFilters.dateRange = {
                start: picker.startDate.toDate(),
                end: picker.endDate.toDate()
            };
            this.resetPagination();
            this.applyFilters();
        });
        
        $('#report-date-range').on('cancel.daterangepicker', (e) => {
            $('#report-date-range').val('');
            this.activeFilters.dateRange = null;
            this.resetPagination();
            this.applyFilters();
        });
        
        // Search input handler with debounce
        let searchTimeout;
        $('#report-search').on('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.activeFilters.search = e.target.value;
                this.resetPagination();
                this.applyFilters();
            }, 300);
        });
        
        // Reset filters button
        $('#reset-filters-btn').on('click', () => {
            this.resetFilters();
        });
        
        // New report button
        $('#new-report-btn, #enhanced-new-report-btn').on('click', () => {
            this.createNewReport();
        });
        
        // Pagination controls
        $('#reports-prev-page').on('click', () => {
            if (this.pagination.currentPage > 1) {
                this.pagination.currentPage--;
                this.applyFilters();
            }
        });
        
        $('#reports-next-page').on('click', () => {
            if (this.pagination.currentPage < this.pagination.totalPages) {
                this.pagination.currentPage++;
                this.applyFilters();
            }
        });
        
        // Items per page selector
        $('#reports-per-page').on('change', (e) => {
            this.pagination.itemsPerPage = parseInt(e.target.value);
            this.resetPagination();
            this.applyFilters();
        });
        
        // Table header sorting
        $('.illegal-dumping-reports-table th[data-sort]').on('click', (e) => {
            const sortField = $(e.currentTarget).data('sort');
            
            // Toggle direction if clicking the same field
            if (this.sorting.field === sortField) {
                this.sorting.direction = this.sorting.direction === 'asc' ? 'desc' : 'asc';
            } else {
                this.sorting.field = sortField;
                this.sorting.direction = 'asc';
            }
            
            // Update sort icons
            $('.illegal-dumping-reports-table th[data-sort] i').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
            const iconClass = this.sorting.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
            $(e.currentTarget).find('i').removeClass('fa-sort').addClass(iconClass);
            
            this.applyFilters();
        });
        
        // View report details
        $('#illegal-dumping-reports-tbody').on('click', '.view-report-btn', (e) => {
            e.stopPropagation();
            const reportId = $(e.currentTarget).data('report-id');
            this.openReportDetails(reportId);
        });
        
        // Row click to view details
        $('#illegal-dumping-reports-tbody').on('click', 'tr', (e) => {
            if (!$(e.target).closest('button').length) {
                const reportId = $(e.currentTarget).data('report-id');
                this.openReportDetails(reportId);
            }
        });
        
        // Close report details
        $('#close-report-detail, #close-report-detail-btn').on('click', () => {
            this.closeReportDetails();
        });
        
        // Export data button
        $('#export-reports-btn').on('click', () => {
            this.exportReportsData();
        });
        
        // Table sorting
        $('#illegal-dumping-reports-table th[data-sort]').on('click', (e) => {
            const sortField = $(e.currentTarget).data('sort');
            
            // Toggle sort direction if clicking the same field
            if (this.sortField === sortField) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = sortField;
                this.sortDirection = 'asc';
            }
            
            // Update UI to show sort direction
            $('#illegal-dumping-reports-table th').find('i').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
            const icon = $(e.currentTarget).find('i');
            icon.removeClass('fa-sort');
            icon.addClass(this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            
            // Apply sorting
            this.applyFilters();
        });
        
        // Pagination controls
        $('#reports-prev-page').on('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.applyFilters();
            }
        });
        
        $('#reports-next-page').on('click', () => {
            const totalPages = Math.ceil(this.filteredReports.length / this.itemsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.applyFilters();
            }
        });
        
        // Row click handler to open detail panel
        $(document).on('click', '#illegal-dumping-reports-tbody tr', (e) => {
            // Don't trigger if clicking on action buttons
            if ($(e.target).closest('button').length === 0) {
                const reportId = $(e.currentTarget).data('report-id');
                this.openReportDetail(reportId);
            }
        });
        
        // View report button
        $(document).on('click', '.view-report-btn', (e) => {
            e.stopPropagation();
            const reportId = $(e.currentTarget).data('report-id');
            this.openReportDetail(reportId);
        });
        
        // Edit report button
        $(document).on('click', '.edit-report-btn', (e) => {
            e.stopPropagation();
            const reportId = $(e.currentTarget).data('report-id');
            this.editReport(reportId);
        });
        
        // Quick action button
        $(document).on('click', '.quick-action-btn', (e) => {
            e.stopPropagation();
            const reportId = $(e.currentTarget).data('report-id');
            this.showQuickActions(reportId, e.currentTarget);
        });
        
        // Close detail panel buttons
        $('#close-report-detail, #close-report-detail-btn').on('click', () => {
            this.closeReportDetail();
        });
        
        // Tab navigation in detail panel
        $('.report-detail-tab').on('click', (e) => {
            const tabId = $(e.currentTarget).data('tab');
            
            // Update active tab
            $('.report-detail-tab').removeClass('active border-blue-600 text-blue-600').addClass('text-gray-500');
            $(e.currentTarget).addClass('active border-blue-600 text-blue-600').removeClass('text-gray-500');
            
            // Show the selected tab content
            $('.tab-content').addClass('hidden').removeClass('active');
            $(`#${tabId}-tab`).addClass('active').removeClass('hidden');
        });
        
        // Report action button
        $('#report-action-btn').on('click', () => {
            if (this.activeReport) {
                this.performNextAction(this.activeReport);
            }
        });
    },
    
    // Open the report detail panel
    openReportDetail: function(reportId) {
        console.log('Opening report detail for ID:', reportId);
        
        // Get the report from DataService
        const report = DataService.getReportById(reportId);
        if (!report) {
            console.error('Report not found:', reportId);
            return;
        }
        
        // Store the active report
        this.activeReport = report;
        
        // Update the detail panel title
        $('#report-detail-title').text(`Report #${report.id}`);
        
        // Update last updated timestamp
        const lastUpdated = new Date(report.lastUpdated || report.date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        $('#report-last-updated').text(`Last updated: ${lastUpdated}`);
        
        // Update status flow visualization
        this.updateStatusFlow(report.status);
        
        // Populate the report details tab
        this.populateReportDetails(report);
        
        // Enable/disable and update the action button based on report status
        this.updateActionButton(report);
        
        // Show the detail panel
        $('#report-detail-panel').removeClass('hidden');
    },
    
    // Close the report detail panel
    closeReportDetail: function() {
        $('#report-detail-panel').addClass('hidden');
        this.activeReport = null;
    },
    
    // Update the status flow visualization
    updateStatusFlow: function(currentStatus) {
        // Define the order of statuses for the flow
        const statusOrder = ['new', 'assigned', 'in_progress', 'completed', 'verified', 'paid'];
        const currentIndex = statusOrder.indexOf(currentStatus);
        
        // Reset all steps
        $('.status-step').each(function() {
            const $step = $(this);
            const stepStatus = $step.data('status');
            const stepIndex = statusOrder.indexOf(stepStatus);
            
            // Reset to default state
            $step.find('div:first-child').removeClass('bg-blue-500 bg-green-500').addClass('bg-gray-200');
            $step.find('i').removeClass('text-white').addClass('text-gray-500');
        });
        
        // Update steps based on current status
        statusOrder.forEach((status, index) => {
            const $step = $(`.status-step[data-status="${status}"]`);
            
            if (index < currentIndex) {
                // Completed steps
                $step.find('div:first-child').removeClass('bg-gray-200').addClass('bg-green-500');
                $step.find('i').removeClass('text-gray-500').addClass('text-white');
                
                // Add a check icon to completed steps
                $step.find('i').removeClass('fa-file-alt fa-user-check fa-broom fa-check-circle fa-clipboard-check fa-money-bill-wave')
                     .addClass('fa-check');
            } else if (index === currentIndex) {
                // Current step
                $step.find('div:first-child').removeClass('bg-gray-200').addClass('bg-blue-500');
                $step.find('i').removeClass('text-gray-500').addClass('text-white');
                
                // Keep the original icon for current step
                // No icon change needed
            }
        });
        
        // Update the connecting lines between steps
        for (let i = 0; i < statusOrder.length - 1; i++) {
            const $line = $(`.status-line-${i}`);
            if (i < currentIndex) {
                // Completed line
                $line.removeClass('bg-gray-200').addClass('bg-green-500');
            } else if (i === currentIndex - 1) {
                // Line to current step
                $line.removeClass('bg-gray-200').addClass('bg-blue-500');
            }
        }
    },
    
    // Populate the report details tab
    populateReportDetails: function(report) {
        // Create a comprehensive HTML template for the details tab
        const detailsHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Left column: Basic information -->
                <div>
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Report ID</h4>
                        <p class="font-medium">#${report.id}</p>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Report Date</h4>
                        <p>${new Date(report.date).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</p>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Status</h4>
                        <div class="flex items-center">
                            ${this.getStatusPill(report.status)}
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Severity</h4>
                        <div class="flex items-center">
                            ${this.getSeverityBadge(report.severity)}
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Waste Type</h4>
                        <p>${report.wasteType || 'Not specified'}</p>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Estimated Volume</h4>
                        <p>${report.volume || 'Not specified'}</p>
                    </div>
                </div>
                
                <!-- Right column: Location and reporter info -->
                <div>
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Location</h4>
                        <p>${report.address || report.location}</p>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Zone</h4>
                        <p>${report.zone.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Coordinates</h4>
                        <p class="flex items-center">
                            ${report.coordinates || 'Not available'}
                            ${report.coordinates ? `<button class="ml-2 text-blue-600 hover:text-blue-800" title="View on Map" onclick="IllegalDumpingManagement.showOnMap('${report.coordinates}')"><i class="fas fa-map-marker-alt"></i></button>` : ''}
                        </p>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Reporting Method</h4>
                        <p>${report.reportingMethod || 'Not specified'}</p>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Reporter</h4>
                        ${report.reporter ? 
                            typeof report.reporter === 'object' ? 
                                `<div class="flex items-center">
                                    <div>
                                        <p class="font-medium">${report.reporter.name}</p>
                                        <p class="text-sm text-gray-500">${report.reporter.contact || 'No contact info'}</p>
                                    </div>
                                </div>` : 
                                `<p>${report.reporter}</p>` : 
                            '<p>Anonymous</p>'}
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-1">Assigned To</h4>
                        ${report.assignedTo ? 
                            typeof report.assignedTo === 'object' ? 
                                `<div class="flex items-center">
                                    <div>
                                        <p class="font-medium">${report.assignedTo.name}</p>
                                        <p class="text-sm text-gray-500">${report.assignedTo.role || 'Cleaner'}</p>
                                    </div>
                                </div>` : 
                                `<p>${report.assignedTo}</p>` : 
                            '<p class="text-gray-500">Not assigned</p>'}
                    </div>
                </div>
            </div>
            
            <!-- Description -->
            <div class="mt-2">
                <h4 class="text-sm font-medium text-gray-500 mb-1">Description</h4>
                <p class="p-3 bg-gray-50 rounded-lg">${report.description || 'No description provided.'}</p>
            </div>
            
            <!-- Images if available -->
            ${report.images && report.images.length > 0 ? `
                <div class="mt-4">
                    <h4 class="text-sm font-medium text-gray-500 mb-2">Images</h4>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        ${report.images.map(img => `
                            <div class="relative group">
                                <img src="${img}" alt="Report Image" class="rounded-lg w-full h-32 object-cover cursor-pointer" onclick="IllegalDumpingManagement.openImageViewer('${img}')"/>
                                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all rounded-lg">
                                    <button class="opacity-0 group-hover:opacity-100 bg-white p-2 rounded-full" onclick="IllegalDumpingManagement.openImageViewer('${img}')">
                                        <i class="fas fa-search-plus text-gray-700"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Timeline -->
            ${report.timeline && report.timeline.length > 0 ? `
                <div class="mt-6">
                    <h4 class="text-sm font-medium text-gray-500 mb-2">Timeline</h4>
                    <div class="relative border-l-2 border-gray-200 ml-3 pl-6 pb-2">
                        ${report.timeline.map((event, index) => `
                            <div class="mb-4 relative">
                                <div class="absolute -left-8 mt-1.5 w-4 h-4 rounded-full ${index === 0 ? 'bg-green-500' : index === report.timeline.length - 1 ? 'bg-blue-500' : 'bg-gray-400'}"></div>
                                <div class="text-xs text-gray-500 mb-1">${new Date(event.date).toLocaleString()}</div>
                                <div class="font-medium">${event.action}</div>
                                <div class="text-sm">${event.user}</div>
                                <div class="text-sm text-gray-600 mt-1">${event.notes || ''}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
        
        // Update the details tab with the new HTML
        $('#details-tab').html(detailsHTML);
    },
    
    // Get status pill HTML
    getStatusPill: function(status) {
        let statusText = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
        let statusClass = '';
        
        switch (status) {
            case 'new':
                statusClass = 'bg-blue-100 text-blue-800';
                break;
            case 'assigned':
                statusClass = 'bg-yellow-100 text-yellow-800';
                break;
            case 'in_progress':
                statusClass = 'bg-orange-100 text-orange-800';
                break;
            case 'completed':
                statusClass = 'bg-green-100 text-green-800';
                break;
            case 'verified':
                statusClass = 'bg-purple-100 text-purple-800';
                break;
            case 'paid':
                statusClass = 'bg-indigo-100 text-indigo-800';
                break;
            default:
                statusClass = 'bg-gray-100 text-gray-800';
        }
        
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">${statusText}</span>`;
    },
    
    // Get severity badge HTML
    getSeverityBadge: function(severity) {
        let severityText = severity.charAt(0).toUpperCase() + severity.slice(1);
        let severityClass = '';
        
        switch (severity) {
            case 'high':
                severityClass = 'bg-red-100 text-red-800';
                break;
            case 'medium':
                severityClass = 'bg-yellow-100 text-yellow-800';
                break;
            case 'low':
                severityClass = 'bg-green-100 text-green-800';
                break;
            default:
                severityClass = 'bg-gray-100 text-gray-800';
        }
        
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityClass}">${severityText}</span>`;
    },
    
    // Show a location on the map
    showOnMap: function(coordinates) {
        console.log('Showing location on map:', coordinates);
        
        // Parse coordinates
        let [lat, lng] = coordinates.split(',').map(coord => parseFloat(coord.trim()));
        
        // Switch to map view
        this.switchView('map');
        
        // Center the map on the coordinates
        if (this.map) {
            // Add a special marker for the selected report
            this.addHighlightedMarker(lat, lng);
            
            // Center the map on the coordinates
            this.map.setView([lat, lng], 16);
            
            // Show a popup with the coordinates
            L.popup()
                .setLatLng([lat, lng])
                .setContent(`<strong>Selected Report Location</strong><br>Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
                .openOn(this.map);
        }
    },
    
    // Add a highlighted marker to the map
    addHighlightedMarker: function(lat, lng) {
        // Remove existing highlighted marker if any
        if (this.highlightedMarker) {
            this.map.removeLayer(this.highlightedMarker);
        }
        
        // Create a custom icon for the highlighted marker
        const highlightedIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="marker-pin marker-pin-highlighted"><i class="fas fa-exclamation-triangle text-white"></i></div>`,
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        });
        
        // Add the new highlighted marker
        this.highlightedMarker = L.marker([lat, lng], { icon: highlightedIcon }).addTo(this.map);
        
        // Add a pulsing effect to draw attention
        this.highlightedMarker._icon.classList.add('marker-pulse');
    },
    
    // Open image viewer for report images
    openImageViewer: function(imageUrl) {
        console.log('Opening image viewer for:', imageUrl);
        
        // Create the image viewer if it doesn't exist
        if (!$('#image-viewer-modal').length) {
            const imageViewerHTML = `
                <div id="image-viewer-modal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 hidden">
                    <div class="relative max-w-4xl w-full max-h-screen p-4">
                        <button id="close-image-viewer" class="absolute top-0 right-0 -mt-12 -mr-12 text-white hover:text-gray-300">
                            <i class="fas fa-times text-2xl"></i>
                        </button>
                        <div class="relative">
                            <button id="prev-image" class="absolute left-0 top-1/2 transform -translate-y-1/2 -ml-12 text-white hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                <i class="fas fa-chevron-left text-2xl"></i>
                            </button>
                            <img id="viewer-image" src="" alt="Report Image" class="max-w-full max-h-[80vh] mx-auto rounded-lg shadow-xl">
                            <button id="next-image" class="absolute right-0 top-1/2 transform -translate-y-1/2 -mr-12 text-white hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                <i class="fas fa-chevron-right text-2xl"></i>
                            </button>
                        </div>
                        <div class="text-center mt-4 text-white">
                            <span id="image-count">Image 1 of 1</span>
                        </div>
                    </div>
                </div>
            `;
            
            $('body').append(imageViewerHTML);
            
            // Add event listeners
            $('#close-image-viewer').on('click', () => {
                $('#image-viewer-modal').addClass('hidden');
            });
            
            // Close on escape key
            $(document).on('keydown', (e) => {
                if (e.key === 'Escape' && !$('#image-viewer-modal').hasClass('hidden')) {
                    $('#image-viewer-modal').addClass('hidden');
                }
            });
            
            // Navigation buttons
            $('#prev-image, #next-image').on('click', (e) => {
                const direction = $(e.currentTarget).attr('id') === 'prev-image' ? -1 : 1;
                this.navigateImages(direction);
            });
            
            // Arrow key navigation
            $(document).on('keydown', (e) => {
                if ($('#image-viewer-modal').hasClass('hidden')) return;
                
                if (e.key === 'ArrowLeft') {
                    this.navigateImages(-1);
                } else if (e.key === 'ArrowRight') {
                    this.navigateImages(1);
                }
            });
        }
        
        // Find all images in the current report
        const reportId = this.activeReport.id;
        const report = this.reports.find(r => r.id === reportId);
        
        if (report && report.images && report.images.length > 0) {
            this.viewerImages = report.images;
            this.currentImageIndex = this.viewerImages.indexOf(imageUrl);
            
            if (this.currentImageIndex === -1) {
                this.currentImageIndex = 0;
            }
            
            // Update the image viewer
            this.updateImageViewer();
            
            // Show the modal
            $('#image-viewer-modal').removeClass('hidden');
        } else {
            // If no images array, just show this single image
            this.viewerImages = [imageUrl];
            this.currentImageIndex = 0;
            
            // Update the image viewer
            this.updateImageViewer();
            
            // Show the modal
            $('#image-viewer-modal').removeClass('hidden');
        }
    },
    
    // Navigate between images in the viewer
    navigateImages: function(direction) {
        const newIndex = this.currentImageIndex + direction;
        
        if (newIndex >= 0 && newIndex < this.viewerImages.length) {
            this.currentImageIndex = newIndex;
            this.updateImageViewer();
        }
    },
    
    // Update the image viewer with the current image
    updateImageViewer: function() {
        const currentImage = this.viewerImages[this.currentImageIndex];
        
        // Update the image source
        $('#viewer-image').attr('src', currentImage);
        
        // Update the image counter
        $('#image-count').text(`Image ${this.currentImageIndex + 1} of ${this.viewerImages.length}`);
        
        // Enable/disable navigation buttons
        $('#prev-image').prop('disabled', this.currentImageIndex === 0);
        $('#next-image').prop('disabled', this.currentImageIndex === this.viewerImages.length - 1);
    },
        switch (report.severity) {
            case 'high':
                severityIndicator = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">High</span>`;
                break;
            case 'medium':
                severityIndicator = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Medium</span>`;
                break;
            case 'low':
                severityIndicator = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Low</span>`;
                break;
            default:
                severityIndicator = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">${report.severity || 'Unknown'}</span>`;
        }
        $('#detail-severity').html(severityIndicator);
        
        $('#detail-waste-type').text(report.wasteType || 'General Waste');
        $('#detail-volume').text(report.volume || 'Unknown');
        
        // Location information
        $('#detail-address').text(report.address || 'No address provided');
        $('#detail-coordinates').text(report.coordinates || 'Unknown');
        $('#detail-zone').text(report.zone || 'Unspecified');
        
        // Mini map (placeholder for now)
        // In a real implementation, this would initialize a map with the report location
        $('#detail-mini-map').html(`
            <div class="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                <div class="text-center">
                    <i class="fas fa-map-marker-alt text-red-500 text-2xl mb-2"></i>
                    <p class="text-sm text-gray-500">Map view for ${report.location || 'location'}</p>
                </div>
            </div>
        `);
        
        // Image gallery
        if (report.images && report.images.length > 0) {
            const galleryHTML = report.images.map(image => `
                <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img src="${image.url}" alt="Report image" class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity">
                </div>
            `).join('');
            
            $('#detail-image-gallery').html(galleryHTML);
        } else {
            $('#detail-image-gallery').html(`
                <div class="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <span class="text-gray-500 text-sm">No images available</span>
                </div>
            `);
        }
        
        // Timeline
        if (report.timeline && report.timeline.length > 0) {
            const timelineHTML = report.timeline.map(event => `
                <div class="relative">
                    <div class="absolute -left-6 mt-1 w-4 h-4 rounded-full ${this.getTimelineEventColor(event.type)}"></div>
                    <div class="mb-1">
                        <span class="text-sm font-medium">${event.title}</span>
                        <span class="text-xs text-gray-500 ml-2">${new Date(event.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</span>
                    </div>
                    <p class="text-sm text-gray-600">${event.description}</p>
                    ${event.user ? `<p class="text-xs text-gray-500 mt-1">By: ${event.user}</p>` : ''}
                </div>
            `).join('');
            
            $('#detail-timeline').html(timelineHTML);
        } else {
            $('#detail-timeline').html(`
                <div class="relative">
                    <div class="absolute -left-6 mt-1 w-4 h-4 rounded-full bg-blue-500"></div>
                    <div class="text-sm text-gray-500">Report created</div>
                    <p class="text-xs text-gray-400">${new Date(report.date).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</p>
                </div>
            `);
        }
    },
    
    // Get the appropriate color for timeline events
    getTimelineEventColor: function(eventType) {
        switch (eventType) {
            case 'created':
                return 'bg-blue-500';
            case 'assigned':
                return 'bg-orange-500';
            case 'updated':
                return 'bg-purple-500';
            case 'completed':
                return 'bg-green-500';
            case 'verified':
                return 'bg-teal-500';
            case 'payment':
                return 'bg-yellow-500';
            default:
                return 'bg-gray-500';
        }
    },
    
    // Update the action button based on report status
    updateActionButton: function(report) {
        const $actionBtn = $('#report-action-btn');
        
        // Enable the button and set appropriate text based on status
        switch (report.status) {
            case 'new':
                $actionBtn.text('Assign Cleaner').removeAttr('disabled').removeClass('opacity-50');
                $actionBtn.off('click').on('click', () => {
                    this.updateReportStatus(report.id, 'assigned');
                });
                break;
            case 'assigned':
                $actionBtn.text('Mark In Progress').removeAttr('disabled').removeClass('opacity-50');
                $actionBtn.off('click').on('click', () => {
                    this.updateReportStatus(report.id, 'in_progress');
                });
                break;
            case 'in_progress':
                $actionBtn.text('Mark Completed').removeAttr('disabled').removeClass('opacity-50');
                $actionBtn.off('click').on('click', () => {
                    this.updateReportStatus(report.id, 'completed');
                });
                break;
            case 'completed':
                $actionBtn.text('Verify Cleanup').removeAttr('disabled').removeClass('opacity-50');
                $actionBtn.off('click').on('click', () => {
                    this.updateReportStatus(report.id, 'verified');
                });
                break;
            case 'verified':
                $actionBtn.text('Process Payment').removeAttr('disabled').removeClass('opacity-50');
                $actionBtn.off('click').on('click', () => {
                    this.updateReportStatus(report.id, 'paid');
                });
                break;
            case 'paid':
                $actionBtn.text('Completed').attr('disabled', 'disabled').addClass('opacity-50');
                break;
            default:
                $actionBtn.text('Next Action').attr('disabled', 'disabled').addClass('opacity-50');
        }
    },
    
    // Perform the next action based on report status
    performNextAction: function(report) {
        console.log('Performing next action for report:', report.id, 'with status:', report.status);
        
        // In a real implementation, this would open the appropriate tab and UI
        // For now, we'll just show a message and update the status
        switch (report.status) {
            case 'new':
                // Show assignment tab
                $('.report-detail-tab[data-tab="assignment"]').trigger('click');
                break;
            case 'assigned':
                // Update status to in_progress
                this.updateReportStatus(report.id, 'in_progress');
                break;
            case 'in_progress':
                // Update status to completed
                this.updateReportStatus(report.id, 'completed');
                break;
            case 'completed':
                // Show verification tab
                $('.report-detail-tab[data-tab="verification"]').trigger('click');
                break;
            case 'verified':
                // Show payment tab
                $('.report-detail-tab[data-tab="payment"]').trigger('click');
                break;
        }
    },
    
    // Create a new illegal dumping report
    createNewReport: function() {
        // Show the new report form modal
        this.showNewReportModal();
    },
    
    // Show the new report form modal
    showNewReportModal: function() {
        // Create the modal HTML if it doesn't exist
        if ($('#new-report-modal').length === 0) {
            const modalHTML = `
                <div id="new-report-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
                        <div class="p-4 border-b flex justify-between items-center">
                            <h3 class="font-semibold text-lg">Create New Illegal Dumping Report</h3>
                            <button id="close-new-report-modal" class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <div class="p-6">
                            <form id="new-report-form" class="space-y-6">
                                <!-- Location Information -->
                                <div>
                                    <h4 class="text-md font-medium mb-4">Location Information</h4>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                            <input type="text" id="new-report-address" class="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Zone/District</label>
                                            <select id="new-report-zone" class="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                                                <option value="">Select Zone</option>
                                                <option value="north">North District</option>
                                                <option value="south">South District</option>
                                                <option value="east">East District</option>
                                                <option value="west">West District</option>
                                                <option value="central">Central District</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Report Details -->
                                <div>
                                    <h4 class="text-md font-medium mb-4">Report Details</h4>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Waste Type</label>
                                            <select id="new-report-waste-type" class="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                                                <option value="">Select Waste Type</option>
                                                <option value="construction">Construction Waste</option>
                                                <option value="household">Household Waste</option>
                                                <option value="electronic">Electronic Waste</option>
                                                <option value="hazardous">Hazardous Waste</option>
                                                <option value="green_waste">Green Waste</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                                            <select id="new-report-severity" class="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                                                <option value="">Select Severity</option>
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <textarea id="new-report-description" rows="4" class="w-full border border-gray-300 rounded-lg px-3 py-2" required></textarea>
                                    </div>
                                </div>
                                
                                <!-- Reporter Information -->
                                <div>
                                    <h4 class="text-md font-medium mb-4">Reporter Information</h4>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                            <input type="text" id="new-report-reporter-name" class="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                            <input type="tel" id="new-report-reporter-phone" class="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                                        </div>
                                        <div class="md:col-span-2">
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                            <input type="email" id="new-report-reporter-email" class="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div class="p-4 border-t flex justify-end space-x-3">
                            <button id="cancel-new-report" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                                Cancel
                            </button>
                            <button id="submit-new-report" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            $('body').append(modalHTML);
            
            // Set up event listeners for the modal
            $('#close-new-report-modal, #cancel-new-report').on('click', () => {
                $('#new-report-modal').remove();
            });
            
            $('#submit-new-report').on('click', () => {
                this.submitNewReport();
            });
        } else {
            // Show the existing modal
            $('#new-report-modal').removeClass('hidden');
        }
    },
    
    // Submit a new report
    submitNewReport: function() {
        // Validate the form
        const form = document.getElementById('new-report-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Get form values
        const address = $('#new-report-address').val();
        const zone = $('#new-report-zone').val();
        const wasteType = $('#new-report-waste-type').val();
        const severity = $('#new-report-severity').val();
        const description = $('#new-report-description').val();
        const reporterName = $('#new-report-reporter-name').val();
        const reporterPhone = $('#new-report-reporter-phone').val();
        const reporterEmail = $('#new-report-reporter-email').val();
        
        // Create the report object
        const newReport = {
            timestamp: new Date().toISOString(),
            status: 'new',
            severity: severity,
            wasteType: wasteType,
            description: description,
            location: {
                address: address,
                zone: zone,
                coordinates: {
                    // For demo purposes, we'll use random coordinates near NYC
                    lat: 40.7128 + (Math.random() * 0.05 - 0.025),
                    lng: -74.0060 + (Math.random() * 0.05 - 0.025)
                }
            },
            reporter: {
                name: reporterName,
                phone: reporterPhone,
                email: reporterEmail
            },
            images: [
                `/api/placeholder/400/300?text=Dumping+Site+Demo`,
                `/api/placeholder/400/300?text=Evidence+Demo`
            ]
        };
        
        // Add the report using DataService
        const savedReport = DataService.addReport(newReport);
        
        // Close the modal
        $('#new-report-modal').remove();
        
        // Show success message
        alert(`Report #${savedReport.find(r => r.id === newReport.id)?.id || 'New'} has been created successfully!`);
        
        // Refresh the reports table
        this.loadReports();
    },
    
    // Update a report's status
    updateReportStatus: function(reportId, newStatus) {
        // Get the current report from DataService
        const report = DataService.getReportById(reportId);
        if (!report) {
            console.error('Report not found:', reportId);
            return;
        }
        
        // Prepare update data
        const updateData = {
            status: newStatus,
            lastUpdated: new Date().toISOString(),
            notes: this.getStatusDescription(newStatus),
            user: 'Admin User'
        };
        
        // Update the report using DataService
        DataService.updateReport(reportId, updateData);
        
        // Get the updated report
        const updatedReport = DataService.getReportById(reportId);
        
        // Update the UI
        this.updateStatusFlow(newStatus);
        this.updateActionButton(updatedReport);
        this.populateReportDetails(updatedReport);
        
        // Refresh the reports table
        this.applyFilters();
    },
    
    // Get a human-readable title for a status
    getStatusTitle: function(status) {
        switch (status) {
            case 'new': return 'Report Created';
            case 'assigned': return 'Assigned to Cleaner';
            case 'in_progress': return 'Cleanup In Progress';
            case 'completed': return 'Cleanup Completed';
            case 'verified': return 'Cleanup Verified';
            case 'paid': return 'Payment Processed';
            default: return 'Status Updated';
        }
    },
    
    // Get a description for a status change
    getStatusDescription: function(status) {
        switch (status) {
            case 'new': return 'New illegal dumping report created.';
            case 'assigned': return 'Report assigned to a cleaner for action.';
            case 'in_progress': return 'Cleaner has started the cleanup process.';
            case 'completed': return 'Cleaner has marked the cleanup as completed.';
            case 'verified': return 'Admin has verified the cleanup was completed satisfactorily.';
            case 'paid': return 'Payment has been processed for the cleanup work.';
            default: return 'The status of this report has been updated.';
        }
    },
    
    // Export reports data (placeholder)
    exportReportsData: function() {
        console.log('Exporting reports data');
        alert('Export functionality will be implemented in a future update.');
    },
    
    // Apply filters, sorting, and pagination to the reports data
    applyFilters: function() {
        console.log('Applying filters:', this.activeFilters);
        
        // Start with all reports
        let filtered = [...this.reports];
        
        // Apply status filter
        if (this.activeFilters.status !== 'all') {
            filtered = filtered.filter(report => report.status === this.activeFilters.status);
        }
        
        // Apply zone filter
        if (this.activeFilters.zone !== 'all') {
            filtered = filtered.filter(report => report.zone === this.activeFilters.zone);
        }
        
        // Apply search filter
        if (this.activeFilters.search) {
            const searchTerm = this.activeFilters.search.toLowerCase();
            filtered = filtered.filter(report => {
                // Search in multiple fields
                return (
                    report.id.toString().includes(searchTerm) ||
                    report.location.toLowerCase().includes(searchTerm) ||
                    (report.description && report.description.toLowerCase().includes(searchTerm)) ||
                    (report.assignedTo && report.assignedTo.name.toLowerCase().includes(searchTerm))
                );
            });
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            let valueA, valueB;
            
            // Extract the values to compare based on the sort field
            switch (this.sortField) {
                case 'id':
                    valueA = parseInt(a.id);
                    valueB = parseInt(b.id);
                    break;
                case 'date':
                    valueA = new Date(a.date).getTime();
                    valueB = new Date(b.date).getTime();
                    break;
                case 'location':
                    valueA = a.location.toLowerCase();
                    valueB = b.location.toLowerCase();
                    break;
                case 'status':
                    valueA = a.status;
                    valueB = b.status;
                    break;
                case 'severity':
                    // Convert severity to a numeric value for sorting
                    const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                    valueA = severityOrder[a.severity] || 0;
                    valueB = severityOrder[b.severity] || 0;
                    break;
                case 'assigned':
                    valueA = a.assignedTo ? a.assignedTo.name.toLowerCase() : 'zzz';
                    valueB = b.assignedTo ? b.assignedTo.name.toLowerCase() : 'zzz';
                    break;
                default:
                    valueA = a[this.sortField];
                    valueB = b[this.sortField];
            }
            
            // Compare the values based on the sort direction
            if (this.sortDirection === 'asc') {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            } else {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            }
        });
        
        // Store the filtered reports
        this.filteredReports = filtered;
        
        // Calculate pagination
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        // Adjust current page if needed
        if (this.currentPage > totalPages) {
            this.currentPage = Math.max(1, totalPages);
        }
        
        // Get the current page of items
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        const currentPageItems = filtered.slice(startIndex, endIndex);
        
        // Update the reports table
        this.updateReportsTable(currentPageItems);
        
        // Update pagination info and controls
        this.updatePaginationControls(startIndex, endIndex, totalItems, totalPages);
    },
    
    // Update pagination controls
    updatePaginationControls: function(startIndex, endIndex, totalItems, totalPages) {
        // Update pagination info text
        let paginationInfoText = 'No reports found';
        if (totalItems > 0) {
            paginationInfoText = `Showing ${startIndex + 1}-${endIndex} of ${totalItems} reports`;
        }
        $('#reports-pagination-info').text(paginationInfoText);
        
        // Enable/disable previous page button
        $('#reports-prev-page').prop('disabled', this.currentPage <= 1);
        
        // Enable/disable next page button
        $('#reports-next-page').prop('disabled', this.currentPage >= totalPages);
        
        // Generate page number buttons
        const $pageNumbers = $('#reports-page-numbers');
        $pageNumbers.empty();
        
        // Determine which page numbers to show
        let pagesToShow = [];
        if (totalPages <= 5) {
            // Show all pages if there are 5 or fewer
            pagesToShow = Array.from({ length: totalPages }, (_, i) => i + 1);
        } else {
            // Always include the first page
            pagesToShow.push(1);
            
            // Add ellipsis if not showing page 2
            if (this.currentPage > 3) {
                pagesToShow.push('...');
            }
            
            // Add pages around the current page
            for (let i = Math.max(2, this.currentPage - 1); i <= Math.min(totalPages - 1, this.currentPage + 1); i++) {
                pagesToShow.push(i);
            }
            
            // Add ellipsis if not showing the second-to-last page
            if (this.currentPage < totalPages - 2) {
                pagesToShow.push('...');
            }
            
            // Always include the last page if there are more than 1 page
            if (totalPages > 1) {
                pagesToShow.push(totalPages);
            }
        }
        
        // Create the page number buttons
        pagesToShow.forEach(page => {
            if (page === '...') {
                // Add ellipsis
                $pageNumbers.append(`<span class="px-3 py-1 text-gray-500">...</span>`);
            } else {
                // Add page number button
                const isActive = page === this.currentPage;
                const buttonClass = isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
                
                $pageNumbers.append(`
                    <button class="px-3 py-1 rounded-md ${buttonClass}" data-page="${page}">
                        ${page}
                    </button>
                `);
            }
        });
        
        // Add click event to page number buttons
        $pageNumbers.find('button').on('click', (e) => {
            const page = parseInt($(e.currentTarget).data('page'));
            this.currentPage = page;
            this.applyFilters();
        });
    },
    
    // Load reports data
    loadReports: function() {
        // Load reports from DataService
        this.reports = DataService.getReports();
        this.applyFilters();
    },
    
    // Handle reports updated event from DataService
    handleReportsUpdated: function(event) {
        console.log('Reports updated event received');
        this.reports = event.detail.reports;
        this.applyFilters();
        this.updateMapMarkers(this.filteredReports);
        this.updateStatsOverview();
    },
    
    // Generate mock data for demonstration
    generateMockReports: function() {
        const mockReports = [];
        const statuses = ['new', 'assigned', 'in_progress', 'completed', 'verified', 'paid'];
        const severities = ['high', 'medium', 'low'];
        const wasteTypes = ['construction', 'household', 'electronic', 'hazardous', 'green_waste'];
        const zones = ['downtown', 'north_district', 'south_district', 'east_district', 'west_district'];
        const streets = ['Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm', 'Washington', 'Jefferson', 'Adams', 'Lincoln'];
        
        // Generate 50 random reports
        for (let i = 1; i <= 50; i++) {
            const reportDate = new Date();
            reportDate.setDate(reportDate.getDate() - Math.floor(Math.random() * 30));
            
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const severity = severities[Math.floor(Math.random() * severities.length)];
            const wasteType = wasteTypes[Math.floor(Math.random() * wasteTypes.length)];
            const zone = zones[Math.floor(Math.random() * zones.length)];
            
            // Generate random coordinates within a reasonable area
            const lat = 37.7749 + (Math.random() - 0.5) * 0.1;
            const lng = -122.4194 + (Math.random() - 0.5) * 0.1;
            const streetName = streets[Math.floor(Math.random() * streets.length)];
            const address = `${Math.floor(Math.random() * 1000) + 100} ${streetName} St, ${zone.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
            
            // Create a timeline based on the status
            const timeline = this.generateTimeline(status, reportDate);
            
            // Calculate last updated date based on the most recent timeline event
            const lastUpdated = timeline.length > 0 ? 
                timeline[timeline.length - 1].timestamp : 
                reportDate.toISOString();
            
            // Create the report object with a structure compatible with our UI
            const report = {
                id: i,
                date: reportDate.toISOString(),
                lastUpdated: lastUpdated,
                status: status,
                severity: severity,
                wasteType: wasteType.replace('_', ' '),
                volume: `${Math.floor(Math.random() * 10) + 1} cubic meters`,
                location: `${zone.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                address: address,
                coordinates: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                zone: zone,
                description: `Illegal dumping of ${wasteType.replace('_', ' ')} waste found near ${streetName} Street. ${Math.random() > 0.5 ? 'Area needs immediate attention.' : 'Cleanup requested by local residents.'}`,
                reportingMethod: ['Citizen App', 'Phone Call', 'Website', 'Field Agent'][Math.floor(Math.random() * 4)],
                reporter: Math.random() > 0.3 ? {
                    name: `John Doe ${i}`,
                    contact: `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`
                } : null,
                images: [
                    { url: `https://source.unsplash.com/300x300?trash,${i}` },
                    { url: `https://source.unsplash.com/300x300?garbage,${i+50}` }
                ],
                assignedTo: status !== 'new' ? {
                    id: `CLN-${Math.floor(Math.random() * 50) + 1}`,
                    name: `Cleaner ${Math.floor(Math.random() * 20) + 1}`,
                    contact: `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
                    rating: (Math.floor(Math.random() * 10) + 40) / 10, // Rating between 4.0 and 5.0
                    assignedDate: new Date(reportDate.getTime() + 1000 * 60 * 60 * Math.floor(Math.random() * 24)).toISOString(),
                    priority: ['Normal', 'High', 'Urgent'][Math.floor(Math.random() * 3)],
                    deadline: new Date(reportDate.getTime() + 1000 * 60 * 60 * 24 * (Math.floor(Math.random() * 3) + 1)).toISOString()
                } : null,
                verification: status === 'verified' || status === 'paid' ? {
                    verifiedBy: `Admin ${Math.floor(Math.random() * 5) + 1}`,
                    verifiedDate: new Date(reportDate.getTime() + 1000 * 60 * 60 * 48).toISOString(),
                    rating: Math.floor(Math.random() * 5) + 1,
                    notes: 'Area properly cleaned and sanitized.'
                } : null,
                payment: status === 'paid' ? {
                    amount: Math.floor(Math.random() * 500) + 100,
                    processedBy: `Finance ${Math.floor(Math.random() * 3) + 1}`,
                    processedDate: new Date(reportDate.getTime() + 1000 * 60 * 60 * 72).toISOString(),
                    reference: `PAY-${Math.floor(Math.random() * 10000) + 10000}`
                } : null,
                timeline: timeline
            };
            
            mockReports.push(report);
        }
        
        return mockReports;
    },
    
    // Generate a timeline based on the report status
    generateTimeline: function(status, reportDate) {
        const timeline = [
            {
                type: 'created',
                title: 'Report Created',
                description: 'New illegal dumping report created.',
                timestamp: reportDate.toISOString(),
                user: 'System'
            }
        ];
        
        if (status !== 'new') {
            const assignDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * Math.floor(Math.random() * 24));
            timeline.push({
                type: 'assigned',
                title: 'Assigned to Cleaner',
                description: 'Report assigned to a cleaner for action.',
                timestamp: assignDate.toISOString(),
                user: `Admin ${Math.floor(Math.random() * 5) + 1}`
            });
        }
        
        if (status === 'in_progress' || status === 'completed' || status === 'verified' || status === 'paid') {
            const startDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * (24 + Math.floor(Math.random() * 24)));
            timeline.push({
                type: 'in_progress',
                title: 'Cleanup In Progress',
                description: 'Cleaner has started the cleanup process.',
                timestamp: startDate.toISOString(),
                user: `Cleaner ${Math.floor(Math.random() * 20) + 1}`
            });
        }
        
        if (status === 'completed' || status === 'verified' || status === 'paid') {
            const completeDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * (48 + Math.floor(Math.random() * 24)));
            timeline.push({
                type: 'completed',
                title: 'Cleanup Completed',
                description: 'Cleaner has marked the cleanup as completed.',
                timestamp: completeDate.toISOString(),
                user: `Cleaner ${Math.floor(Math.random() * 20) + 1}`
            });
        }
        
        if (status === 'verified' || status === 'paid') {
            const verifyDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * (72 + Math.floor(Math.random() * 24)));
            timeline.push({
                type: 'verified',
                title: 'Cleanup Verified',
                description: 'Admin has verified the cleanup was completed satisfactorily.',
                timestamp: verifyDate.toISOString(),
                user: `Admin ${Math.floor(Math.random() * 5) + 1}`
            });
        }
        
        if (status === 'paid') {
            const payDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * (96 + Math.floor(Math.random() * 24)));
            timeline.push({
                type: 'payment',
                title: 'Payment Processed',
                description: 'Payment has been processed for the cleanup work.',
                timestamp: payDate.toISOString(),
                user: `Admin ${Math.floor(Math.random() * 5) + 1}`
            });
        }
        
        return timeline;
    },
    
    // Apply filters, sorting, and pagination to the reports data
    applyFilters: function() {
        console.log('Applying filters:', this.activeFilters);
        
        // Start with all reports
        let filtered = [...this.reports];
        
        // Apply status filter
        if (this.activeFilters.status !== 'all') {
            filtered = filtered.filter(report => report.status === this.activeFilters.status);
        }
        
        // Apply severity filter
        if (this.activeFilters.severity !== 'all') {
            filtered = filtered.filter(report => report.severity === this.activeFilters.severity);
        }
        
        // Apply zone filter
        if (this.activeFilters.zone !== 'all') {
            filtered = filtered.filter(report => report.zone === this.activeFilters.zone);
        }
        
        // Apply date range filter if available
        if (this.activeFilters.dateRange) {
            filtered = filtered.filter(report => {
                const reportDate = new Date(report.date);
                return reportDate >= this.activeFilters.dateRange.start && 
                       reportDate <= this.activeFilters.dateRange.end;
            });
        }
        
        // Apply search filter
        if (this.activeFilters.search) {
            const searchTerm = this.activeFilters.search.toLowerCase();
            filtered = filtered.filter(report => {
                // Search in multiple fields
                return (
                    report.id.toString().includes(searchTerm) ||
                    report.location.toLowerCase().includes(searchTerm) ||
                    report.address.toLowerCase().includes(searchTerm) ||
                    (report.description && report.description.toLowerCase().includes(searchTerm)) ||
                    (report.wasteType && report.wasteType.toLowerCase().includes(searchTerm)) ||
                    (report.reportingMethod && report.reportingMethod.toLowerCase().includes(searchTerm)) ||
                    (report.assignedTo && typeof report.assignedTo === 'object' ? 
                        report.assignedTo.name.toLowerCase().includes(searchTerm) : 
                        (report.assignedTo && report.assignedTo.toString().toLowerCase().includes(searchTerm)))
                );
            });
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            let valueA, valueB;
            
            // Extract the values to compare based on the sort field
            switch (this.sortField) {
                case 'id':
                    valueA = parseInt(a.id);
                    valueB = parseInt(b.id);
                    break;
                case 'date':
                    valueA = new Date(a.date).getTime();
                    valueB = new Date(b.date).getTime();
                    break;
                case 'location':
                    valueA = a.location.toLowerCase();
                    valueB = b.location.toLowerCase();
                    break;
                case 'status':
                    valueA = a.status;
                    valueB = b.status;
                    break;
                case 'severity':
                    // Convert severity to a numeric value for sorting
                    const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                    valueA = severityOrder[a.severity] || 0;
                    valueB = severityOrder[b.severity] || 0;
                    break;
                case 'assigned':
                    valueA = a.assignedTo ? a.assignedTo.name.toLowerCase() : 'zzz';
                    valueB = b.assignedTo ? b.assignedTo.name.toLowerCase() : 'zzz';
                    break;
                default:
                    valueA = a[this.sortField];
                    valueB = b[this.sortField];
            }
            
            // Compare the values based on the sort direction
            if (this.sortDirection === 'asc') {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            } else {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            }
        });
        
        // Store the filtered reports
        this.filteredReports = filtered;
        
        // Calculate pagination
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        // Adjust current page if needed
        if (this.currentPage > totalPages) {
            this.currentPage = Math.max(1, totalPages);
        }
        
        // Get the current page of items
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        const currentPageItems = filtered.slice(startIndex, endIndex);
        
        // Update the reports table
        this.updateReportsTable(currentPageItems);
        
        // Update pagination info and controls
        this.updatePaginationControls(startIndex, endIndex, totalItems, totalPages);
    },
    
    // Update pagination controls
    updatePaginationControls: function(startIndex, endIndex, totalItems, totalPages) {
        // Update pagination info text
        let paginationInfoText = 'No reports found';
        if (totalItems > 0) {
            paginationInfoText = `Showing ${startIndex + 1}-${endIndex} of ${totalItems} reports`;
        }
        $('#reports-pagination-info').text(paginationInfoText);
        
        // Enable/disable previous page button
        $('#reports-prev-page').prop('disabled', this.currentPage <= 1);
        
        // Enable/disable next page button
        $('#reports-next-page').prop('disabled', this.currentPage >= totalPages);
        
        // Generate page number buttons
        const $pageNumbers = $('#reports-page-numbers');
        $pageNumbers.empty();
        
        // Determine which page numbers to show
        let pagesToShow = [];
        if (totalPages <= 5) {
            // Show all pages if there are 5 or fewer
            pagesToShow = Array.from({ length: totalPages }, (_, i) => i + 1);
        } else {
            // Always include the first page
            pagesToShow.push(1);
            
            // Add ellipsis if not showing page 2
            if (this.currentPage > 3) {
                pagesToShow.push('...');
            }
            
            // Add pages around the current page
            for (let i = Math.max(2, this.currentPage - 1); i <= Math.min(totalPages - 1, this.currentPage + 1); i++) {
                pagesToShow.push(i);
            }
            
            // Add ellipsis if not showing the second-to-last page
            if (this.currentPage < totalPages - 2) {
                pagesToShow.push('...');
            }
            
            // Always include the last page if there are more than 1 page
            if (totalPages > 1) {
                pagesToShow.push(totalPages);
            }
        }
        
        // Create the page number buttons
        pagesToShow.forEach(page => {
            if (page === '...') {
                // Add ellipsis
                $pageNumbers.append(`<span class="px-3 py-1 text-gray-500">...</span>`);
            } else {
                // Add page number button
                const isActive = page === this.currentPage;
                const buttonClass = isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
                
                $pageNumbers.append(`
                    <button class="px-3 py-1 rounded-md ${buttonClass}" data-page="${page}">
                        ${page}
                    </button>
                `);
            }
        });
        
        // Add click event to page number buttons
        $pageNumbers.find('button').on('click', (e) => {
            const page = parseInt($(e.currentTarget).data('page'));
            this.currentPage = page;
            this.applyFilters();
        });
    },
    
    // Initialize map functionality
    initializeMap: function() {
        console.log('Initializing map');
        
        // If we already have a map initialized, just update the markers
        if (this.mapInitialized) {
            this.updateMapMarkers(this.reports);
            return;
        }
        
        // Create a more interactive map visualization
        const mapContainer = $('#illegal-dumping-map');
        if (mapContainer.length === 0) {
            console.error('Map container not found');
            return;
        }
        
        // Clear any existing content
        mapContainer.empty();
        
        // Check if Leaflet is loaded, if not, load it
        if (typeof L === 'undefined') {
            console.log('Loading Leaflet...');
            // Add Leaflet CSS
            $('head').append('<link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin=""/>');
            
            // Add Leaflet JS and initialize map when loaded
            $.getScript('https://unpkg.com/leaflet@1.7.1/dist/leaflet.js', () => {
                console.log('Leaflet loaded, initializing map...');
                this.initializeLeafletMap(mapContainer);
            });
        } else {
            // Leaflet is already loaded, initialize the map
            this.initializeLeafletMap(mapContainer);
        }
        
        // Create the map container with a city map background
        const mapHTML = `
            <div class="w-full h-full relative" style="background-image: url('https://i.imgur.com/Qn9UvLQ.jpg'); background-size: cover; background-position: center;">
                <div class="absolute inset-0 bg-white bg-opacity-20">
                    <!-- Interactive map overlay -->
                    <div id="interactive-map" class="w-full h-full"></div>
                </div>
                
                <!-- Map Controls -->
                <div class="absolute top-4 right-4 bg-white rounded-lg shadow-md p-2 z-10">
                    <button id="zoom-in-btn" class="p-1 text-gray-700 hover:text-blue-600 focus:outline-none">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button id="zoom-out-btn" class="p-1 text-gray-700 hover:text-blue-600 focus:outline-none">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button id="center-map-btn" class="p-1 text-gray-700 hover:text-blue-600 focus:outline-none">
                        <i class="fas fa-crosshairs"></i>
                    </button>
                </div>
                
                <!-- Info Overlay -->
                <div class="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 w-72 hidden" id="map-info-window">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-medium text-blue-600" id="info-window-title">Report #1234</h4>
                        <button id="close-info-window" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="text-sm" id="info-window-content">
                        <div class="flex items-center mb-1">
                            <i class="fas fa-map-marker-alt text-red-500 mr-2"></i>
                            <span id="info-window-location">123 Main St, Downtown</span>
                        </div>
                        <div class="flex items-center mb-1">
                            <i class="fas fa-calendar-alt text-blue-500 mr-2"></i>
                            <span id="info-window-date">Apr 5, 2025</span>
                        </div>
                        <div class="flex items-center mb-1">
                            <i class="fas fa-tag text-green-500 mr-2"></i>
                            <span id="info-window-status">New</span>
                        </div>
                    </div>
                    <div class="mt-2 pt-2 border-t">
                        <button id="view-report-details" class="w-full text-center text-sm text-blue-600 hover:text-blue-800">
                            View Full Details
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        mapContainer.html(mapHTML);
        
        // Set up event listeners for map controls
        $('#zoom-in-btn').on('click', () => this.zoomMap(1));
        $('#zoom-out-btn').on('click', () => this.zoomMap(-1));
        $('#center-map-btn').on('click', () => this.centerMap());
        $('#close-info-window').on('click', () => this.closeInfoWindow());
        $('#view-report-details').on('click', () => this.viewReportDetails());
        
        // Mark as initialized
        this.mapInitialized = true;
        this.mapZoomLevel = 1;
        
        // Generate and add markers to the map
        this.updateMapMarkers(this.reports);
    },
    
    // Initialize the map with Leaflet
    initializeLeafletMap: function(mapContainer) {
        // Create a div for the map if it doesn't exist
        if ($('#leaflet-map').length === 0) {
            mapContainer.append('<div id="leaflet-map" style="height: 100%; width: 100%;"></div>');
        }
        
        // Create the map
        this.map = L.map('leaflet-map').setView([37.7749, -122.4194], 12);
        
        // Add the tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Add markers for reports
        this.updateMapMarkers(this.reports);
        
        // Add map controls
        L.control.zoom({
            position: 'topright'
        }).addTo(this.map);
        
        console.log('Leaflet map initialized');
        
        // Setup map event listeners
        this.setupMapEventListeners();
    },
    
    // Set up event listeners for the map view
    setupMapEventListeners: function() {
        console.log('Setting up map event listeners');
        
        // Filter change handler for status filter
        $('#map-status-filter').on('change', (e) => {
            const filter = $(e.target).val();
            console.log('Map status filter changed to:', filter);
            
            // Update active filters
            this.activeFilters.status = filter;
            
            // Apply filters
            this.applyFilters();
        });
        
        // Filter change handler for severity filter
        $('#map-severity-filter').on('change', (e) => {
            const filter = $(e.target).val();
            console.log('Map severity filter changed to:', filter);
            
            // Update active filters
            this.activeFilters.severity = filter;
            
            // Apply filters
            this.applyFilters();
        });
        
        // Filter change handler for zone filter
        $('#map-zone-filter').on('change', (e) => {
            const filter = $(e.target).val();
            console.log('Map zone filter changed to:', filter);
            
            // Update active filters
            this.activeFilters.zone = filter;
            
            // Apply filters
            this.applyFilters();
        });
        
        // Apply filters button click handler
        $('#apply-map-filters-btn').on('click', () => {
            console.log('Applying map filters');
            this.applyFilters();
        });
        
        // Refresh button click handler
        $('#refresh-map-btn').on('click', () => {
            console.log('Refreshing map');
            this.loadReports();
            this.updateMapMarkers(this.reports);
        });
        
        // Handle view report link clicks in popups (for Leaflet map)
        $(document).on('click', '.view-report-link', (e) => {
            e.preventDefault();
            const reportId = $(e.target).data('report-id');
            console.log('View report clicked for ID:', reportId);
            
            // Switch to reports view and show the report details
            this.switchView('reports');
            this.openReportDetail(reportId);
        });
    },
    
    // Zoom the map in or out
    zoomMap: function(direction) {
        // direction: 1 for zoom in, -1 for zoom out
        this.mapZoomLevel = Math.max(0.5, Math.min(2, this.mapZoomLevel + (direction * 0.25)));
        $('#interactive-map').css('transform', `scale(${this.mapZoomLevel})`);
    },
    
    // Center the map
    centerMap: function() {
        $('#interactive-map').css('transform', 'scale(1)');
        this.mapZoomLevel = 1;
    },
    
    // Close the info window
    closeInfoWindow: function() {
        $('#map-info-window').addClass('hidden');
    },
    
    // View full report details
    viewReportDetails: function() {
        const reportId = $('#info-window-title').text().replace('Report #', '');
        const report = this.reports.find(r => r.id.toString() === reportId);
        if (report) {
            this.showReportDetails(report);
        }
    },
    
    // Update map markers based on reports data
    updateMapMarkers: function(reports) {
        console.log('Updating map markers with reports:', reports);
        
        const interactiveMap = $('#interactive-map');
        if (interactiveMap.length === 0) return;
        
        // Clear existing markers
        interactiveMap.empty();
        
        // If no reports, show a message
        if (!reports || reports.length === 0) {
            interactiveMap.append(`
                <div class="flex items-center justify-center h-full">
                    <div class="text-center text-gray-500">
                        <i class="fas fa-map-marker-alt text-3xl mb-2"></i>
                        <p>No reports to display</p>
                    </div>
                </div>
            `);
            return;
        }
        
        // Add markers for each report
        reports.forEach(report => {
            // Generate random position for demo purposes
            // In a real app, these would be actual lat/lng coordinates
            const left = Math.floor(Math.random() * 80) + 10; // 10% to 90%
            const top = Math.floor(Math.random() * 80) + 10;  // 10% to 90%
            
            // Determine marker color based on status
            let markerColor = 'red';
            if (report.status === 'completed') markerColor = 'green';
            else if (report.status === 'in_progress') markerColor = 'yellow';
            else if (report.status === 'assigned') markerColor = 'blue';
            
            // Create marker element
            const marker = $(`
                <div class="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 z-10" 
                     style="left: ${left}%; top: ${top}%;" 
                     data-report-id="${report.id}">
                    <div class="relative">
                        <i class="fas fa-map-marker-alt text-${markerColor}-500 text-2xl drop-shadow-md"></i>
                        <div class="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center text-xs font-bold border border-gray-300">
                            ${report.severity === 'high' ? '!' : ''}
                        </div>
                    </div>
                </div>
            `);
            
            // Add click event to show info window
            marker.on('click', () => this.showMarkerInfo(report));
            
            // Add to map
            interactiveMap.append(marker);
        });
        
        // Update marker counts
        this.updateMarkerCounts(reports);
    },
    
    // Show marker info in the info window
    showMarkerInfo: function(report) {
        // Update info window content
        $('#info-window-title').text(`Report #${report.id}`);
        $('#info-window-location').text(report.location);
        $('#info-window-date').text(new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        $('#info-window-status').text(report.status.replace('_', ' '));
        
        // Show the info window
        $('#map-info-window').removeClass('hidden');
    },
    
    // Update marker counts in the legend
    updateMarkerCounts: function(reports) {
        if (!reports) return;
        
        // Count reports by status
        const counts = {
            new: 0,
            assigned: 0,
            in_progress: 0,
            completed: 0
        };
        
        reports.forEach(report => {
            if (counts[report.status] !== undefined) {
                counts[report.status]++;
            }
        });
        
        // Update count displays
        $('#new-marker-count').text(counts.new);
        $('#assigned-marker-count').text(counts.assigned);
        $('#in-progress-marker-count').text(counts.in_progress);
        $('#completed-marker-count').text(counts.completed);
    },
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <span class="status-pill new">New Report</span>
                                            <h4 class="font-medium mt-1">Report #RPT-1042</h4>
                                        </div>
                                        <button class="text-gray-400 hover:text-gray-600">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <div class="mt-2">
                                        <p class="text-sm text-gray-600">123 Main St, Downtown</p>
                                        <p class="text-sm text-gray-600 mt-1">Reported: April 5, 2025</p>
                                    </div>
                                    <div class="mt-3 flex justify-between">
                                        <button class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                                            <i class="fas fa-info-circle mr-1"></i> Details
                                        </button>
                                        <button class="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                                            <i class="fas fa-user-check mr-1"></i> Assign
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Filters & Actions -->
                        <div class="card">
                            <div class="p-4 border-b">
                                <h3 class="font-semibold">Map Filters</h3>
                            </div>
                            <div class="p-4">
                                <div class="mb-4">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                    <select id="map-status-filter" class="w-full p-2 border rounded-md">
                                        <option value="all">All Statuses</option>
                                        <option value="new">New</option>
                                        <option value="assigned">Assigned</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                        <option value="verified">Verified</option>
                                        <option value="paid">Paid</option>
                                    </select>
                                </div>
                                
                                <div class="mb-4">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                                    <select id="map-severity-filter" class="w-full p-2 border rounded-md">
                                        <option value="all">All Severities</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                                
                                <div class="mb-4">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Zone</label>
                                    <select id="map-zone-filter" class="w-full p-2 border rounded-md">
                                        <option value="all">All Zones</option>
                                        <option value="downtown">Downtown</option>
                                        <option value="north_district">North District</option>
                                        <option value="south_district">South District</option>
                                        <option value="east_district">East District</option>
                                        <option value="west_district">West District</option>
                                    </select>
                                </div>
                                
                                <div class="mb-4">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Waste Type</label>
                                    <select id="map-waste-type-filter" class="w-full p-2 border rounded-md">
                                        <option value="all">All Types</option>
                                        <option value="construction">Construction</option>
                                        <option value="household">Household</option>
                                        <option value="electronic">Electronic</option>
                                        <option value="hazardous">Hazardous</option>
                                        <option value="green_waste">Green Waste</option>
                                    </select>
                                </div>
                                
                                <div class="pt-2 border-t">
                                    <button id="apply-map-filters-btn" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                        <i class="fas fa-filter mr-2"></i>Apply Filters
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Hotspots Analysis -->
                    <div class="card mb-6">
                        <div class="p-4 border-b flex justify-between items-center">
                            <h3 class="font-semibold">Hotspot Analysis</h3>
                            <button class="text-sm text-blue-600">
                                <i class="fas fa-file-export mr-1"></i> Export
                            </button>
                        </div>
                        <div class="p-4">
                            <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <!-- Will be populated dynamically -->
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Append the map container to the illegal dumping section
            $('#illegal-dumping-section').append(mapContainerHTML);
            
            // Set up event listeners for the map view
            $('#apply-map-filters-btn').on('click', () => {
                const statusFilter = $('#map-status-filter').val();
                const severityFilter = $('#map-severity-filter').val();
                const zoneFilter = $('#map-zone-filter').val();
                const wasteTypeFilter = $('#map-waste-type-filter').val();
                
                // Update active filters
                this.activeFilters.status = statusFilter;
                this.activeFilters.severity = severityFilter;
                this.activeFilters.zone = zoneFilter;
                
                // Apply filters
                this.applyFilters();
            });
        }
        
        // For demonstration, we'll just create some mock map markers
        this.updateMapMarkers(this.reports);
    },
    
    // Update map markers based on filtered reports
    updateMapMarkers: function(reports) {
        console.log('Updating map markers with', reports.length, 'reports');
        
        // Clear existing markers
        this.mapMarkers = [];
        
        // In a real implementation, this would add markers to a map library
        // For now, we'll just create a visual representation of the markers
        const mapContainer = $('#dumping-map-placeholder .absolute.inset-0');
        if (mapContainer.length) {
            mapContainer.empty();
            
            // Add markers for each report
            reports.forEach(report => {
                // Create a marker element
                const markerHTML = `
                    <div class="map-marker ${report.status}" 
                         style="left: ${(report.location.coordinates.lng + 122.4194) * 5000}px; top: ${(37.7749 - report.location.coordinates.lat) * 5000}px;"
                         data-report-id="${report.id}">
                        <div class="map-marker-tooltip">${report.id}</div>
                    </div>
                `;
                
                mapContainer.append(markerHTML);
                
                // Store marker reference
                this.mapMarkers.push({
                    id: report.id,
                    element: mapContainer.find(`.map-marker[data-report-id="${report.id}"]`),
                    report: report
                });
            });
            
            // Add click event to markers
            $('.map-marker').on('click', (e) => {
                const reportId = $(e.currentTarget).data('report-id');
                const report = this.reports.find(r => r.id === reportId);
                
                if (report) {
                    this.showReportDetails(report);
                }
            });
        }
    },
    
    // Create the reports container and update the reports table with modern design
    updateReportsTable: function(reports) {
        console.log('Updating reports table with', reports.length, 'reports');
        
        // Make sure we're showing the reports view
        if (this.activeView === 'reports') {
            // Show the reports container and hide other containers
            $('#illegal-dumping-map-container').addClass('hidden');
            $('#illegal-dumping-history-container').addClass('hidden');
            $('#illegal-dumping-reports-container').removeClass('hidden');
        }
        
        // Create the reports container if it doesn't exist
        if ($('#illegal-dumping-reports-container').length === 0) {
            const reportsContainerHTML = `
                <div id="illegal-dumping-reports-container" class="${this.activeView === 'reports' ? '' : 'hidden'}">
                    <style>
                        /* Modern Reports View Styles */
                        .filter-section {
                            background: white;
                            border-radius: 8px;
                            padding: 20px;
                            margin-bottom: 20px;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        }
                        
                        .filter-controls {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 15px;
                            margin-bottom: 15px;
                        }
                        
                        .filter-control {
                            flex: 1;
                            min-width: 200px;
                        }
                        
                        .filter-label {
                            display: block;
                            margin-bottom: 5px;
                            font-weight: 500;
                            font-size: 14px;
                            color: #64748b;
                        }
                        
                        .export-btn {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            gap: 8px;
                        }
                        
                        .reports-table-container {
                            background: white;
                            border-radius: 8px;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                            overflow: hidden;
                            margin-bottom: 20px;
                        }
                        
                        .status-badge {
                            padding: 5px 10px;
                            border-radius: 12px;
                            font-size: 12px;
                            font-weight: 500;
                            display: inline-block;
                        }
                        
                        .status-new {
                            background-color: #dbeafe;
                            color: #1e40af;
                        }
                        
                        .status-assigned {
                            background-color: #fef3c7;
                            color: #92400e;
                        }
                        
                        .status-progress {
                            background-color: #e0f2fe;
                            color: #0369a1;
                        }
                        
                        .status-completed {
                            background-color: #dcfce7;
                            color: #166534;
                        }
                        
                        .status-verified {
                            background-color: #d1fae5;
                            color: #065f46;
                        }
                        
                        .status-paid {
                            background-color: #f0fdf4;
                            color: #14532d;
                        }
                        
                        .severity-high {
                            color: #dc2626;
                            font-weight: 600;
                        }
                        
                        .severity-medium {
                            color: #ca8a04;
                            font-weight: 600;
                        }
                        
                        .severity-low {
                            color: #16a34a;
                            font-weight: 600;
                        }
                    </style>
                    
                    <!-- Modern Filter Section -->
                    <div class="filter-section">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="font-semibold text-lg">Illegal Dumping Reports</h3>
                            <button id="new-report-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2">
                                <i class="fas fa-plus"></i>
                                <span>New Report</span>
                            </button>
                        </div>
                        
                        <div class="filter-controls">
                            <div class="filter-control">
                                <label class="filter-label">Status</label>
                                <select id="report-status-filter" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg appearance-none pr-8 text-sm w-full">
                                    <option value="all">All</option>
                                    <option value="new">New</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="verified">Verified</option>
                                    <option value="paid">Paid</option>
                                </select>
                            </div>
                            
                            <div class="filter-control">
                                <label class="filter-label">Date Range</label>
                                <select id="report-date-filter" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg appearance-none pr-8 text-sm w-full">
                                    <option value="all">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="this_week">This Week</option>
                                    <option value="last_week">Last Week</option>
                                    <option value="this_month">This Month</option>
                                    <option value="last_month">Last Month</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                            </div>
                            
                            <div class="filter-control" id="custom-date-range" style="display: none;">
                                <label class="filter-label">Custom Range</label>
                                <div class="flex space-x-2">
                                    <input type="date" id="date-from" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">
                                    <input type="date" id="date-to" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">
                                </div>
                            </div>
                            
                            <div class="filter-control">
                                <label class="filter-label">Location/Zone</label>
                                <select id="report-zone-filter" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg appearance-none pr-8 text-sm w-full">
                                    <option value="all">All Locations</option>
                                    <option value="downtown">Downtown</option>
                                    <option value="north">North District</option>
                                    <option value="east">East District</option>
                                    <option value="south">South District</option>
                                    <option value="west">West District</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="flex flex-wrap justify-between items-center mt-4">
                            <div class="filter-control w-full md:w-auto mb-2 md:mb-0">
                                <div class="relative">
                                    <input type="text" id="report-search" placeholder="Search reports..." class="bg-white border border-gray-300 text-gray-700 px-4 py-2 pl-10 rounded-lg text-sm w-full md:w-64">
                                    <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <i class="fas fa-search text-gray-500"></i>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex space-x-2">
                                <button id="export-csv-btn" class="export-btn bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                                    <i class="fas fa-file-csv text-gray-500"></i>
                                    <span>Export CSV</span>
                                </button>
                                <button id="export-pdf-btn" class="export-btn bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                                    <i class="fas fa-file-pdf text-gray-500"></i>
                                    <span>Export PDF</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Reports Table -->
                    <div class="reports-table-container">
                        <table id="illegal-dumping-reports-table" class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="id">
                                        ID <i class="fas fa-sort ml-1"></i>
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="date">
                                        Date <i class="fas fa-sort ml-1"></i>
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="location">
                                        Location <i class="fas fa-sort ml-1"></i>
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="severity">
                                        Severity <i class="fas fa-sort ml-1"></i>
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="status">
                                        Status <i class="fas fa-sort ml-1"></i>
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" data-sort="assignee">
                                        Assignee <i class="fas fa-sort ml-1"></i>
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="illegal-dumping-reports-tbody" class="bg-white divide-y divide-gray-200">
                                <!-- Report rows will be dynamically inserted here -->
                            </tbody>
                        </table>
                        
                        <!-- Pagination Controls -->
                        <div class="px-6 py-4 bg-white border-t flex justify-between items-center">
                            <div class="text-sm text-gray-700" id="reports-pagination-info">
                                Showing <span id="pagination-start">1</span> to <span id="pagination-end">10</span> of <span id="pagination-total">0</span> reports
                            </div>
                            <div class="flex space-x-1" id="reports-pagination-controls">
                                <button class="px-3 py-1 rounded-md bg-gray-100 text-gray-600 disabled:opacity-50" id="reports-prev-page" disabled>
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                <div id="reports-page-numbers" class="flex space-x-1">
                                    <button class="px-3 py-1 rounded-md bg-blue-600 text-white">1</button>
                                </div>
                                <button class="px-3 py-1 rounded-md bg-gray-100 text-gray-600 disabled:opacity-50" id="reports-next-page" disabled>
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Report Detail Panel (Hidden by default) -->
                    <div id="report-detail-panel" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                        <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-screen overflow-hidden">
                            <!-- Header with Status Flow Visualization -->
                            <div class="p-4 border-b flex justify-between items-center bg-gray-50">
                                <div class="flex items-center">
                                    <h3 class="font-semibold text-lg">Report <span id="detail-report-id" class="text-blue-600">RPT-1025</span></h3>
                                    <span id="detail-report-status" class="ml-3 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">New</span>
                                </div>
                                <div class="flex items-center space-x-4">
                                    <div class="hidden sm:block">
                                        <!-- Status Flow Visualization -->
                                        <div class="flex items-center space-x-1">
                                            <div class="flex flex-col items-center">
                                                <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                                                    <i class="fas fa-clipboard-check"></i>
                                                </div>
                                                <span class="text-xs mt-1 text-blue-600 font-medium">New</span>
                                            </div>
                                            <div class="w-8 h-0.5 bg-gray-300"></div>
                                            <div class="flex flex-col items-center">
                                                <div class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">
                                                    <i class="fas fa-user-plus"></i>
                                                </div>
                                                <span class="text-xs mt-1 text-gray-500">Assigned</span>
                                            </div>
                                            <div class="w-8 h-0.5 bg-gray-300"></div>
                                            <div class="flex flex-col items-center">
                                                <div class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">
                                                    <i class="fas fa-broom"></i>
                                                </div>
                                                <span class="text-xs mt-1 text-gray-500">In Progress</span>
                                            </div>
                                            <div class="w-8 h-0.5 bg-gray-300"></div>
                                            <div class="flex flex-col items-center">
                                                <div class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">
                                                    <i class="fas fa-check"></i>
                                                </div>
                                                <span class="text-xs mt-1 text-gray-500">Completed</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button id="close-report-detail" class="text-gray-400 hover:text-gray-600">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Detail Tabs -->
                            <div class="detail-tabs">
                                <div class="detail-tab active" data-tab="details">Details</div>
                                <div class="detail-tab" data-tab="assignment">Assignment</div>
                                <div class="detail-tab" data-tab="photos">Photos</div>
                                <div class="detail-tab" data-tab="history">History</div>
                                <div class="detail-tab" data-tab="comments">Comments</div>
                            </div>
                            
                            <!-- Tab Content -->
                            <div class="p-6 overflow-y-auto" style="max-height: calc(100vh - 200px);">
                                <!-- Details Tab (Active by Default) -->
                                <div id="details-tab-content" class="tab-content active">
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <!-- Left Column -->
                                        <div>
                                            <div class="mb-6">
                                                <h4 class="text-sm font-medium text-gray-500 mb-2">Report Information</h4>
                                                <div class="bg-gray-50 p-4 rounded-lg">
                                                    <div class="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p class="text-xs text-gray-500">Reported On</p>
                                                            <p class="text-sm font-medium" id="detail-date">Apr 5, 2025</p>
                                                        </div>
                                                        <div>
                                                            <p class="text-xs text-gray-500">Severity</p>
                                                            <p class="text-sm font-medium severity-high" id="detail-severity">High</p>
                                                        </div>
                                                        <div>
                                                            <p class="text-xs text-gray-500">Waste Type</p>
                                                            <p class="text-sm font-medium" id="detail-waste-type">Construction</p>
                                                        </div>
                                                        <div>
                                                            <p class="text-xs text-gray-500">Estimated Volume</p>
                                                            <p class="text-sm font-medium" id="detail-volume">Large (>1 cubic meter)</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div class="mb-6">
                                                <h4 class="text-sm font-medium text-gray-500 mb-2">Location</h4>
                                                <div class="bg-gray-50 p-4 rounded-lg">
                                                    <p class="text-sm font-medium mb-2" id="detail-address">123 Main St, Downtown</p>
                                                    <div class="h-48 bg-gray-200 rounded-lg" id="detail-map"></div>
                                                    <div class="mt-2 text-xs text-gray-500">
                                                        <span id="detail-coordinates">Lat: 37.7749, Long: -122.4194</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <!-- Right Column -->
                                        <div>
                                            <div class="mb-6">
                                                <h4 class="text-sm font-medium text-gray-500 mb-2">Description</h4>
                                                <div class="bg-gray-50 p-4 rounded-lg">
                                                    <p class="text-sm" id="detail-description">Large pile of construction debris including broken concrete, wood scraps, and metal waste. Appears to have been dumped overnight. Blocking part of the sidewalk.</p>
                                                </div>
                                            </div>
                                            
                                            <div class="mb-6">
                                                <h4 class="text-sm font-medium text-gray-500 mb-2">Photos</h4>
                                                <div class="grid grid-cols-3 gap-2" id="detail-photos">
                                                    <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                                        <img src="https://via.placeholder.com/150" alt="Report photo" class="w-full h-full object-cover">
                                                    </div>
                                                    <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                                        <img src="https://via.placeholder.com/150" alt="Report photo" class="w-full h-full object-cover">
                                                    </div>
                                                    <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                                        <img src="https://via.placeholder.com/150" alt="Report photo" class="w-full h-full object-cover">
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <h4 class="text-sm font-medium text-gray-500 mb-2">Reporter Information</h4>
                                                <div class="bg-gray-50 p-4 rounded-lg">
                                                    <div class="flex items-center mb-3">
                                                        <div class="w-10 h-10 rounded-full bg-gray-300 mr-3 flex items-center justify-center text-gray-600">
                                                            <i class="fas fa-user"></i>
                                                        </div>
                                                        <div>
                                                            <p class="text-sm font-medium" id="detail-reporter-name">John Smith</p>
                                                            <p class="text-xs text-gray-500" id="detail-reporter-type">Resident</p>
                                                        </div>
                                                    </div>
                                                    <div class="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <p class="text-xs text-gray-500">Phone</p>
                                                            <p class="font-medium" id="detail-reporter-phone">(555) 123-4567</p>
                                                        </div>
                                                        <div>
                                                            <p class="text-xs text-gray-500">Email</p>
                                                            <p class="font-medium" id="detail-reporter-email">john.smith@example.com</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Other tab contents will be dynamically loaded -->
                                <div id="assignment-tab-content" class="tab-content hidden"></div>
                                <div id="photos-tab-content" class="tab-content hidden"></div>
                                <div id="history-tab-content" class="tab-content hidden"></div>
                                <div id="comments-tab-content" class="tab-content hidden"></div>
                            </div>
                            
                            <!-- Action Footer -->
                            <div class="p-4 border-t flex justify-between items-center bg-gray-50">
                                <div>
                                    <span class="text-sm text-gray-500">Last Updated: <span id="detail-last-updated">Apr 6, 2025, 10:23 AM</span></span>
                                </div>
                                <div class="flex space-x-2">
                                    <button id="report-action-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Assign Cleanup</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Append the reports container to the illegal dumping section
            $('#illegal-dumping-section').append(reportsContainerHTML);
        }
        
        // When in reports view, hide the KPI cards and map
        if (this.activeView === 'reports') {
            // Hide the KPI cards and map
            $('.grid.grid-cols-1.lg\\:grid-cols-3.gap-6.mb-6').addClass('hidden');
        }
        
        // Populate the reports table
        const reportsTableBody = $('#reports-table-body');
        reportsTableBody.empty();
        
        if (reports.length === 0) {
            reportsTableBody.append(`
                <tr class="border-b border-gray-100">
                    <td colspan="7" class="px-4 py-6 text-center text-gray-500">
                        <div class="flex flex-col items-center">
                            <i class="fas fa-search text-3xl mb-3 text-gray-300"></i>
                            <p>No reports found matching your filters</p>
                            <button class="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700" id="reset-filters-btn">
                                Reset Filters
                            </button>
                        </div>
                    </td>
                </tr>
            `);
            
            $('#reset-filters-btn').on('click', () => {
                // Reset filters
                this.activeFilters = {
                    status: 'all',
                    severity: 'all',
                    timeframe: 'week',
                    zone: 'all'
                };
                
                // Update filter UI
                $('#status-filter').val('all');
                $('#severity-filter').val('all');
                $('#timeframe-filter').val('week');
                $('#zone-filter').val('all');
                
                // Apply filters
                this.applyFilters();
            });
            
            return;
        }
        
        // Add reports to the table
        reports.forEach(report => {
            const formattedDate = new Date(report.timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const row = `
                <tr class="border-b border-gray-100 hover:bg-gray-50 report-row" data-report-id="${report.id}">
                    <td class="px-4 py-3 text-sm font-medium">${report.id}</td>
                    <td class="px-4 py-3 text-sm">${formattedDate}</td>
                    <td class="px-4 py-3 text-sm">${report.location.address}, ${this.capitalizeFirstLetter(report.location.zone)}</td>
                    <td class="px-4 py-3">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getStatusClass(report.status)}">
                            ${this.capitalizeFirstLetter(report.status)}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getSeverityClass(report.severity)}">
                            ${this.capitalizeFirstLetter(report.severity)}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-sm">${this.capitalizeFirstLetter(report.wasteDetails.type)}</td>
                    <td class="px-4 py-3">
                        <button class="text-blue-600 hover:text-blue-800 view-report-btn" data-report-id="${report.id}">
                            <i class="fas fa-eye mr-1"></i> View
                        </button>
                    </td>
                </tr>
            `;
            
            reportsTableBody.append(row);
        });
        
        // Add click event to view buttons
        $('.view-report-btn').off('click').on('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const reportId = $(e.currentTarget).data('report-id');
            const report = this.reports.find(r => r.id === reportId);
            
            if (report) {
                this.showReportDetails(report);
            }
        });
        
        // Add click event to report rows
        $('.report-row').off('click').on('click', (e) => {
            const reportId = $(e.currentTarget).data('report-id');
            const report = this.reports.find(r => r.id === reportId);
            
            if (report) {
                this.showReportDetails(report);
            }
        });
    },
    
    // Show report details in the detail panel
    showReportDetails: function(report) {
        console.log('Showing details for report:', report.id);
        
        // Set the selected report
        this.selectedReport = report;
        
        // Update the detail panel with report information
        const detailPanel = $('#report-detail-panel');
        const detailTitle = detailPanel.find('.font-semibold').first();
        
        // Set the title
        detailTitle.text(`Illegal Dumping Report: ${report.id}`);
        
        // Update the overview tab
        const overviewTab = $('#overview-tab-content');
        if (overviewTab.length) {
            const formattedDate = new Date(report.timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const overviewHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-500 mb-1">Report ID</h4>
                            <p class="font-medium">${report.id}</p>
                        </div>
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-500 mb-1">Reported On</h4>
                            <p>${formattedDate}</p>
                        </div>
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-500 mb-1">Status</h4>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getStatusClass(report.status)}">
                                ${this.capitalizeFirstLetter(report.status)}
                            </span>
                        </div>
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-500 mb-1">Severity</h4>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getSeverityClass(report.severity)}">
                                ${this.capitalizeFirstLetter(report.severity)}
                            </span>
                        </div>
                    </div>
                    <div>
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-500 mb-1">Location</h4>
                            <p>${report.location.address}, ${this.capitalizeFirstLetter(report.location.zone)}</p>
                        </div>
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-500 mb-1">Reporter</h4>
                            <p>${report.reporter.name} (via ${this.capitalizeFirstLetter(report.reporter.method)})</p>
                            ${report.reporter.contact ? `<p class="text-sm text-gray-500">${report.reporter.contact}</p>` : ''}
                        </div>
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-500 mb-1">Waste Details</h4>
                            <p>${this.capitalizeFirstLetter(report.wasteDetails.type)} - ${report.wasteDetails.volume}</p>
                            <p class="text-sm text-gray-500">${report.wasteDetails.description}</p>
                        </div>
                    </div>
                </div>
                <div class="mt-4">
                    <h4 class="text-sm font-medium text-gray-500 mb-2">Images</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${report.images.map(img => `
                            <div class="border rounded-lg overflow-hidden">
                                <img src="${img}" alt="Dumping Image" class="w-full h-auto">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            overviewTab.html(overviewHTML);
        }
        
        // Update the assignment tab
        const assignmentTab = $('#assignment-tab-content');
        if (assignmentTab.length) {
            let assignmentHTML = '';
            
            if (report.assignment) {
                const assignedDate = new Date(report.assignment.assignedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const deadlineDate = new Date(report.assignment.deadline).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                assignmentHTML = `
                    <div class="mb-6">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                <i class="fas fa-user-check text-blue-600"></i>
                            </div>
                            <div>
                                <h4 class="font-medium">${report.assignment.cleaner}</h4>
                                <p class="text-sm text-gray-500">Cleaner ID: ${report.assignment.cleanerId}</p>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <div class="mb-4">
                                    <h4 class="text-sm font-medium text-gray-500 mb-1">Assigned On</h4>
                                    <p>${assignedDate}</p>
                                </div>
                                <div class="mb-4">
                                    <h4 class="text-sm font-medium text-gray-500 mb-1">Priority</h4>
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${report.assignment.priority === 'urgent' ? 'red' : report.assignment.priority === 'high' ? 'orange' : 'blue'}-100 text-${report.assignment.priority === 'urgent' ? 'red' : report.assignment.priority === 'high' ? 'orange' : 'blue'}-800">
                                        ${this.capitalizeFirstLetter(report.assignment.priority)}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div class="mb-4">
                                    <h4 class="text-sm font-medium text-gray-500 mb-1">Deadline</h4>
                                    <p>${deadlineDate}</p>
                                </div>
                                <div class="mb-4">
                                    <h4 class="text-sm font-medium text-gray-500 mb-1">Status</h4>
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getStatusClass(report.status)}">
                                        ${this.capitalizeFirstLetter(report.status)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="border-t pt-4">
                        <button class="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 mr-2">
                            <i class="fas fa-edit mr-2"></i>Edit Assignment
                        </button>
                        <button class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                            <i class="fas fa-trash-alt mr-2"></i>Remove Assignment
                        </button>
                    </div>
                `;
            } else {
                assignmentHTML = `
                    <div class="text-center py-8">
                        <div class="mb-4 text-blue-600">
                            <i class="fas fa-user-plus text-5xl"></i>
                        </div>
                        <h4 class="font-medium mb-2">No Cleaner Assigned</h4>
                        <p class="text-gray-500 mb-6">This report has not been assigned to a cleaner yet.</p>
                        <button class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            <i class="fas fa-user-check mr-2"></i>Assign Cleaner
                        </button>
                    </div>
                `;
            }
            
            assignmentTab.html(assignmentHTML);
        }
        
        // Update the verification tab
        const verificationTab = $('#verification-tab-content');
        if (verificationTab.length) {
            let verificationHTML = '';
            
            if (report.verification) {
                const verifiedDate = new Date(report.verification.verifiedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                verificationHTML = `
                    <div class="mb-6">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                                <i class="fas fa-check-circle text-green-600"></i>
                            </div>
                            <div>
                                <h4 class="font-medium">Verified by ${report.verification.verifiedBy}</h4>
                                <p class="text-sm text-gray-500">${verifiedDate}</p>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-500 mb-1">Quality Rating</h4>
                            <div class="flex items-center">
                                ${Array(5).fill(0).map((_, i) => `
                                    <i class="fas fa-star ${i < report.verification.rating ? 'text-yellow-400' : 'text-gray-300'} mr-1"></i>
                                `).join('')}
                                <span class="ml-2">${report.verification.rating}/5</span>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-500 mb-1">Verification Notes</h4>
                            <p>${report.verification.notes}</p>
                        </div>
                    </div>
                    <div class="border-t pt-4">
                        <button class="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">
                            <i class="fas fa-edit mr-2"></i>Edit Verification
                        </button>
                    </div>
                `;
            } else if (report.status === 'completed') {
                verificationHTML = `
                    <div class="text-center py-8">
                        <div class="mb-4 text-green-600">
                            <i class="fas fa-clipboard-check text-5xl"></i>
                        </div>
                        <h4 class="font-medium mb-2">Ready for Verification</h4>
                        <p class="text-gray-500 mb-6">This report has been marked as completed and is ready for verification.</p>
                        <button class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                            <i class="fas fa-check-circle mr-2"></i>Verify Cleanup
                        </button>
                    </div>
                `;
            } else {
                verificationHTML = `
                    <div class="text-center py-8">
                        <div class="mb-4 text-gray-400">
                            <i class="fas fa-hourglass-half text-5xl"></i>
                        </div>
                        <h4 class="font-medium mb-2">Not Ready for Verification</h4>
                        <p class="text-gray-500">This report must be completed before it can be verified.</p>
                    </div>
                `;
            }
            
            verificationTab.html(verificationHTML);
        }
        
        // Update the payment tab
        const paymentTab = $('#payment-tab-content');
        if (paymentTab.length) {
            let paymentHTML = '';
            
            if (report.payment) {
                const paymentDate = new Date(report.payment.processedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                paymentHTML = `
                    <div class="mb-6">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                                <i class="fas fa-money-check-alt text-purple-600"></i>
                            </div>
                            <div>
                                <h4 class="font-medium">Payment Processed</h4>
                                <p class="text-sm text-gray-500">${paymentDate}</p>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <div class="mb-4">
                                    <h4 class="text-sm font-medium text-gray-500 mb-1">Amount</h4>
                                    <p class="text-xl font-bold">$${report.payment.amount.toFixed(2)}</p>
                                </div>
                            </div>
                            <div>
                                <div class="mb-4">
                                    <h4 class="text-sm font-medium text-gray-500 mb-1">Receipt</h4>
                                    <p>${report.payment.receipt}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="border-t pt-4">
                        <button class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2">
                            <i class="fas fa-file-invoice mr-2"></i>View Invoice
                        </button>
                        <button class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                            <i class="fas fa-print mr-2"></i>Print Receipt
                        </button>
                    </div>
                `;
            } else if (report.status === 'verified') {
                paymentHTML = `
                    <div class="text-center py-8">
                        <div class="mb-4 text-purple-600">
                            <i class="fas fa-money-bill-wave text-5xl"></i>
                        </div>
                        <h4 class="font-medium mb-2">Ready for Payment</h4>
                        <p class="text-gray-500 mb-6">This report has been verified and is ready for payment processing.</p>
                        <button class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                            <i class="fas fa-money-check-alt mr-2"></i>Process Payment
                        </button>
                    </div>
                `;
            } else {
                paymentHTML = `
                    <div class="text-center py-8">
                        <div class="mb-4 text-gray-400">
                            <i class="fas fa-lock text-5xl"></i>
                        </div>
                        <h4 class="font-medium mb-2">Not Ready for Payment</h4>
                        <p class="text-gray-500">This report must be verified before payment can be processed.</p>
                    </div>
                `;
            }
            
            paymentTab.html(paymentHTML);
        }
        
        // Update the timeline tab
        const timelineTab = $('#timeline-tab-content');
        if (timelineTab.length) {
            const timelineHTML = `
                <div class="relative pl-8">
                    ${report.timeline.map((event, index) => {
                        const eventDate = new Date(event.timestamp).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        const isLast = index === report.timeline.length - 1;
                        
                        let iconClass = '';
                        switch (event.action) {
                            case 'reported':
                                iconClass = 'fas fa-flag text-red-600';
                                break;
                            case 'assigned':
                                iconClass = 'fas fa-user-check text-blue-600';
                                break;
                            case 'started':
                                iconClass = 'fas fa-play text-yellow-600';
                                break;
                            case 'completed':
                                iconClass = 'fas fa-check text-green-600';
                                break;
                            case 'verified':
                                iconClass = 'fas fa-clipboard-check text-purple-600';
                                break;
                            case 'paid':
                                iconClass = 'fas fa-money-check-alt text-gray-600';
                                break;
                            default:
                                iconClass = 'fas fa-circle text-gray-600';
                        }
                        
                        return `
                            <div class="mb-6 relative">
                                <div class="absolute left-0 top-0 mt-1 -ml-8 w-6 h-6 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center">
                                    <i class="${iconClass} text-xs"></i>
                                </div>
                                ${!isLast ? '<div class="absolute left-0 top-0 mt-7 -ml-5 w-0 border-l-2 border-blue-200 h-full"></div>' : ''}
                                <div>
                                    <h4 class="font-medium">${this.capitalizeFirstLetter(event.action)}</h4>
                                    <p class="text-sm text-gray-500">${eventDate}</p>
                                    <p class="text-sm mt-1">By: ${event.actor}</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            timelineTab.html(timelineHTML);
        }
        
        // Show the detail panel
        detailPanel.removeClass('hidden');
        
        // Set the active tab to Overview
        $('.detail-tab').removeClass('active border-blue-500 text-blue-600').addClass('border-transparent text-gray-500');
        $('.detail-tab[data-tab="overview-tab-content"]').addClass('active border-blue-500 text-blue-600').removeClass('border-transparent text-gray-500');
        
        // Show the overview tab content
        $('.tab-content').addClass('hidden');
        $('#overview-tab-content').removeClass('hidden');
    },
    
    // Helper functions for UI
    getStatusClass: function(status) {
        const statusClasses = {
            'new': 'bg-red-100 text-red-800',
            'assigned': 'bg-blue-100 text-blue-800',
            'in_progress': 'bg-yellow-100 text-yellow-800',
            'completed': 'bg-green-100 text-green-800',
            'verified': 'bg-purple-100 text-purple-800',
            'paid': 'bg-gray-100 text-gray-800'
        };
        return statusClasses[status] || '';
    },
    
    getSeverityClass: function(severity) {
        const severityClasses = {
            'high': 'bg-red-100 text-red-800',
            'medium': 'bg-yellow-100 text-yellow-800',
            'low': 'bg-blue-100 text-blue-800'
        };
        return severityClasses[severity] || '';
    },
    
    capitalizeFirstLetter: function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).replace('_', ' ');
    },
    
    // Load historical data for the history view
    loadHistoricalData: function() {
        // In a real implementation, this would fetch historical data from the server
        // For now, we'll generate mock historical data
        this.historicalData = this.generateMockHistoricalData();
    },
    
    // Generate mock historical data
    generateMockHistoricalData: function() {
        const historicalData = [];
        const months = ['January', 'February', 'March', 'April', 'May', 'June'];
        const zones = ['downtown', 'north_district', 'south_district', 'east_district', 'west_district'];
        
        // Generate monthly data for the past 6 months
        for (let i = 0; i < 6; i++) {
            const totalReports = Math.floor(Math.random() * 50) + 30;
            const resolved = Math.floor(Math.random() * totalReports);
            const resolutionRate = ((resolved / totalReports) * 100).toFixed(1);
            
            const monthData = {
                month: months[i],
                year: 2025,
                totalReports: totalReports,
                resolved: resolved,
                resolutionRate: resolutionRate,
                avgResolutionTime: `${Math.floor(Math.random() * 10) + 1}d ${Math.floor(Math.random() * 12)}h`,
                zoneBreakdown: {}
            };
            
            // Generate zone breakdown
            zones.forEach(zone => {
                const zoneReports = Math.floor(Math.random() * 15) + 5;
                const zoneResolved = Math.floor(Math.random() * zoneReports);
                
                monthData.zoneBreakdown[zone] = {
                    reports: zoneReports,
                    resolved: zoneResolved,
                    resolutionRate: ((zoneResolved / zoneReports) * 100).toFixed(1),
                    averageTime: `${Math.floor(Math.random() * 10) + 1}d ${Math.floor(Math.random() * 24)}h`
                };
            });
            
            historicalData.push(monthData);
        }
        
        return historicalData;
    },
    
    // Update the history view with historical data
    // Create the history container with all necessary elements
    createHistoryContainer: function() {
        console.log('Creating history container');
        
        // Create the main container for the history view
        const historyContainerHTML = `
            <div class="grid grid-cols-1 gap-6 mb-6">
                <!-- Historical Trends Chart -->
                <div class="card">
                    <div class="p-4 border-b flex justify-between items-center">
                        <h3 class="font-semibold">Historical Trends</h3>
                        <div class="flex space-x-2">
                            <button class="px-2 py-1 text-xs bg-blue-600 text-white rounded history-period-btn active" data-period="monthly">Monthly</button>
                            <button class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded history-period-btn" data-period="quarterly">Quarterly</button>
                            <button class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded history-period-btn" data-period="yearly">Yearly</button>
                        </div>
                    </div>
                    <div class="p-4">
                        <div id="historical-chart" style="height: 300px; position: relative;">
                            <!-- Placeholder for chart -->
                            <div class="flex items-center justify-center h-full">
                                <div class="text-center">
                                    <div class="mb-4 text-blue-600">
                                        <i class="fas fa-chart-line text-5xl"></i>
                                    </div>
                                    <p class="text-gray-500">Historical data visualization</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Historical Data Table -->
                <div class="card">
                    <div class="p-4 border-b flex justify-between items-center">
                        <h3 class="font-semibold">Historical Data</h3>
                        <button id="export-history-btn" class="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            <i class="fas fa-file-export mr-1"></i> Export
                        </button>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="text-xs text-gray-500 uppercase border-b border-gray-200">
                                    <th class="px-4 py-3 text-left">Period</th>
                                    <th class="px-4 py-3 text-left">Total Reports</th>
                                    <th class="px-4 py-3 text-left">Resolved</th>
                                    <th class="px-4 py-3 text-left">Resolution Rate</th>
                                    <th class="px-4 py-3 text-left">Avg. Resolution Time</th>
                                    <th class="px-4 py-3 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="history-table-body">
                                <!-- Will be populated with data -->
                            </tbody>
                        </table>
                    </div>
                    <div class="p-4 border-t flex justify-between items-center">
                        <div class="text-sm text-gray-500">Showing historical data</div>
                        <div class="flex space-x-1">
                            <button class="px-3 py-1 rounded-md bg-gray-100 text-gray-600 disabled:opacity-50" disabled>
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button class="px-3 py-1 rounded-md bg-blue-600 text-white">1</button>
                            <button class="px-3 py-1 rounded-md hover:bg-gray-100">2</button>
                            <button class="px-3 py-1 rounded-md hover:bg-gray-100">3</button>
                            <button class="px-3 py-1 rounded-md bg-gray-100 text-gray-600">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Append the HTML to the history container
        $('#illegal-dumping-history-container').html(historyContainerHTML);
        
        // Set up event listeners for the history view
        this.setupHistoryEventListeners();
    },
    
    // Set up event listeners for the history view
    setupHistoryEventListeners: function() {
        // Period buttons
        $('.history-period-btn').on('click', (e) => {
            $('.history-period-btn').removeClass('active bg-blue-600 text-white').addClass('bg-gray-200 text-gray-700');
            $(e.currentTarget).removeClass('bg-gray-200 text-gray-700').addClass('active bg-blue-600 text-white');
            
            const period = $(e.currentTarget).data('period');
            this.updateHistoricalChart(period);
        });
        
        // Export button
        $('#export-history-btn').on('click', () => {
            this.exportHistoricalData();
        });
    },
    
    // Export historical data
    exportHistoricalData: function() {
        console.log('Exporting historical data');
        
        // Get the active period
        const activePeriod = $('.history-period-btn.active').data('period') || 'monthly';
        
        // In a real implementation, this would generate a CSV or Excel file with all historical data
        // For demonstration, we'll show a notification
        
        // Create a toast notification
        const toastHTML = `
            <div class="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center" id="export-toast">
                <i class="fas fa-check-circle mr-2"></i>
                <div>
                    <p class="font-medium">Export Successful</p>
                    <p class="text-sm">All historical data for ${activePeriod} view has been exported.</p>
                </div>
                <button class="ml-4 text-white hover:text-gray-200" id="close-toast">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add the toast to the body
        $('body').append(toastHTML);
        
        // Set up event listener for the close button
        $('#close-toast').on('click', () => {
            $('#export-toast').remove();
        });
        
        // Automatically remove the toast after 5 seconds
        setTimeout(() => {
            $('#export-toast').fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);
    },
    
    // Update the historical chart based on the selected period
    updateHistoricalChart: function(period) {
        console.log('Updating historical chart with period:', period);
        
        // Load historical data if not already loaded
        if (!this.historicalData) {
            this.loadHistoricalData();
        }
        
        // Get the chart container
        const chartContainer = $('#historical-chart');
        if (chartContainer.length === 0) return;
        
        // Clear existing chart
        chartContainer.empty();
        
        // Check if Chart.js is loaded, if not, load it
        if (typeof Chart === 'undefined') {
            console.log('Loading Chart.js...');
            
            // Add Chart.js script
            $.getScript('https://cdn.jsdelivr.net/npm/chart.js', () => {
                console.log('Chart.js loaded, initializing chart...');
                this.renderHistoricalChart(chartContainer, period);
            });
        } else {
            // Chart.js is already loaded, render the chart
            this.renderHistoricalChart(chartContainer, period);
        }
    },
    
    // Render the historical chart
    renderHistoricalChart: function(chartContainer, period) {
        // Filter data based on period
        let chartData;
        let labels;
        
        switch (period) {
            case 'monthly':
                chartData = this.historicalData.slice(0, 6); // Last 6 months
                labels = chartData.map(data => data.month + ' ' + data.year);
                break;
            case 'quarterly':
                // Group data by quarter
                chartData = [
                    { period: 'Q1 2025', totalReports: 0, resolved: 0 },
                    { period: 'Q2 2025', totalReports: 0, resolved: 0 },
                    { period: 'Q3 2024', totalReports: 0, resolved: 0 },
                    { period: 'Q4 2024', totalReports: 0, resolved: 0 }
                ];
                
                // Aggregate monthly data into quarters
                this.historicalData.forEach(data => {
                    const month = data.month;
                    let quarter;
                    
                    if (['January', 'February', 'March'].includes(month)) {
                        quarter = 'Q1 2025';
                    } else if (['April', 'May', 'June'].includes(month)) {
                        quarter = 'Q2 2025';
                    } else if (['July', 'August', 'September'].includes(month)) {
                        quarter = 'Q3 2024';
                    } else {
                        quarter = 'Q4 2024';
                    }
                    
                    const quarterData = chartData.find(q => q.period === quarter);
                    if (quarterData) {
                        quarterData.totalReports += data.totalReports;
                        quarterData.resolved += data.resolved;
                    }
                });
                
                labels = chartData.map(data => data.period);
                break;
            case 'yearly':
                // Group data by year
                chartData = [
                    { period: '2025', totalReports: 0, resolved: 0 },
                    { period: '2024', totalReports: 0, resolved: 0 },
                    { period: '2023', totalReports: 0, resolved: 0 }
                ];
                
                // Aggregate monthly data into years
                this.historicalData.forEach(data => {
                    const yearData = chartData.find(y => y.period === data.year.toString());
                    if (yearData) {
                        yearData.totalReports += data.totalReports;
                        yearData.resolved += data.resolved;
                    }
                });
                
                labels = chartData.map(data => data.period);
                break;
            default:
                chartData = this.historicalData.slice(0, 6);
                labels = chartData.map(data => data.month + ' ' + data.year);
        }
        
        // Create canvas for the chart
        chartContainer.html('<canvas id="history-chart-canvas"></canvas>');
        
        // Get the canvas context
        const ctx = document.getElementById('history-chart-canvas').getContext('2d');
        
        // Create the chart
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Reports',
                        data: chartData.map(data => data.totalReports),
                        backgroundColor: 'rgba(59, 130, 246, 0.5)', // Blue
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1
                    },
                    {
                        label: 'Resolved',
                        data: chartData.map(data => data.resolved),
                        backgroundColor: 'rgba(16, 185, 129, 0.5)', // Green
                        borderColor: 'rgb(16, 185, 129)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Reports'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Period'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Illegal Dumping Reports Over Time',
                        font: {
                            size: 16
                        }
                    },
                    tooltip: {
                        callbacks: {
                            footer: (tooltipItems) => {
                                const dataIndex = tooltipItems[0].dataIndex;
                                const totalReports = chartData[dataIndex].totalReports;
                                const resolved = chartData[dataIndex].resolved;
                                const resolutionRate = totalReports > 0 ? ((resolved / totalReports) * 100).toFixed(1) : 0;
                                
                                return `Resolution Rate: ${resolutionRate}%`;
                            }
                        }
                    }
                }
            }
        });
        
        // Update the history table with the data
        this.updateHistoryTable(chartData, period);
    },
    
    updateHistoryView: function() {
        console.log('Updating history view with data');
        
        // Make sure we have historical data to display
        if (!this.historicalData) {
            this.loadHistoricalData();
        }
        
        // Update the historical chart with monthly data by default
        this.updateHistoricalChart('monthly');
        
        // Populate the history table with the data from the active period
        const activePeriod = $('.history-period-btn.active').data('period') || 'monthly';
        
        // Get the data for the active period
        let chartData;
        switch (activePeriod) {
            case 'monthly':
                chartData = this.historicalData.slice(0, 6); // Last 6 months
                break;
            case 'quarterly':
                // Group data by quarter (simplified for demonstration)
                chartData = [
                    { period: 'Q1 2025', totalReports: 120, resolved: 95 },
                    { period: 'Q2 2025', totalReports: 140, resolved: 110 },
                    { period: 'Q3 2024', totalReports: 95, resolved: 75 },
                    { period: 'Q4 2024', totalReports: 110, resolved: 90 }
                ];
                break;
            case 'yearly':
                // Group data by year (simplified for demonstration)
                chartData = [
                    { period: '2025', totalReports: 450, resolved: 380 },
                    { period: '2024', totalReports: 380, resolved: 320 },
                    { period: '2023', totalReports: 310, resolved: 270 }
                ];
                break;
            default:
                chartData = this.historicalData.slice(0, 6);
        }
        
        // Update the history table with the data
        this.updateHistoryTable(chartData, activePeriod);
    },
    
    // Generate mock historical data for demonstration
    generateHistoricalData: function() {
        console.log('Generating historical data');
        
        this.historicalData = {
            monthly: [],
            quarterly: [],
            yearly: []
        };
        
        // Generate monthly data for the past 12 months
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = month.toLocaleString('default', { month: 'long' });
            const year = month.getFullYear();
            
            this.historicalData.monthly.push({
                period: `${monthName} ${year}`,
                totalReports: Math.floor(Math.random() * 50) + 20,
                resolved: Math.floor(Math.random() * 40) + 15,
                resolutionRate: Math.floor(Math.random() * 30) + 70,
                avgResolutionTime: `${Math.floor(Math.random() * 24) + 1}h ${Math.floor(Math.random() * 60)}m`
            });
        }
        
        // Generate quarterly data for the past 8 quarters
        for (let i = 0; i < 8; i++) {
            const quarter = Math.floor((now.getMonth() - (i * 3)) / 3) + 1;
            const year = now.getFullYear() - Math.floor(i / 4);
            
            this.historicalData.quarterly.push({
                period: `Q${quarter} ${year}`,
                totalReports: Math.floor(Math.random() * 150) + 50,
                resolved: Math.floor(Math.random() * 120) + 40,
                resolutionRate: Math.floor(Math.random() * 20) + 75,
                avgResolutionTime: `${Math.floor(Math.random() * 36) + 12}h ${Math.floor(Math.random() * 60)}m`
            });
        }
        
        // Generate yearly data for the past 5 years
        for (let i = 0; i < 5; i++) {
            const year = now.getFullYear() - i;
            
            this.historicalData.yearly.push({
                period: `${year}`,
                totalReports: Math.floor(Math.random() * 600) + 200,
                resolved: Math.floor(Math.random() * 500) + 150,
                resolutionRate: Math.floor(Math.random() * 15) + 80,
                avgResolutionTime: `${Math.floor(Math.random() * 48) + 24}h ${Math.floor(Math.random() * 60)}m`
            });
        }
    },
    
    // Update the history table with data
    updateHistoryTable: function(chartData, period) {
        console.log('Updating history table with data for period:', period);
        
        // Clear the table body
        $('#history-table-body').empty();
        
        if (!chartData || chartData.length === 0) {
            console.log('No data to display in history table');
            return;
        }
        
        // Add rows for each period
        chartData.forEach(item => {
            // Calculate resolution rate
            const totalReports = item.totalReports || 0;
            const resolved = item.resolved || 0;
            const resolutionRate = totalReports > 0 ? ((resolved / totalReports) * 100).toFixed(1) : 0;
            
            // Calculate average resolution time (mock data for demonstration)
            const avgDays = Math.floor(Math.random() * 10) + 1; // 1-10 days
            const avgHours = Math.floor(Math.random() * 12); // 0-11 hours
            const avgResolutionTime = `${avgDays}d ${avgHours}h`;
            
            // Determine period label based on the period type
            let periodLabel;
            if (period === 'monthly') {
                periodLabel = item.month ? `${item.month} ${item.year}` : item.period;
            } else {
                periodLabel = item.period;
            }
            
            const row = `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-4 py-3">${periodLabel}</td>
                    <td class="px-4 py-3">${totalReports}</td>
                    <td class="px-4 py-3">${resolved}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center">
                            <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div class="bg-green-500 h-2 rounded-full" style="width: ${resolutionRate}%"></div>
                            </div>
                            <span>${resolutionRate}%</span>
                        </div>
                    </td>
                    <td class="px-4 py-3">${avgResolutionTime}</td>
                    <td class="px-4 py-3">
                        <button class="text-blue-600 hover:text-blue-800 view-period-details" data-period="${periodLabel}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="text-green-600 hover:text-green-800 export-period-data ml-2" data-period="${periodLabel}">
                            <i class="fas fa-file-export"></i>
                        </button>
                    </td>
                </tr>
            `;
            
            $('#history-table-body').append(row);
        });
        
        // Set up event listeners for the view details buttons
        $('.view-period-details').on('click', (e) => {
            const period = $(e.currentTarget).data('period');
            this.viewPeriodDetails(period);
        });
        
        // Set up event listeners for the export data buttons
        $('.export-period-data').on('click', (e) => {
            const period = $(e.currentTarget).data('period');
            this.exportPeriodData(period);
        });
    },
    
    // View details for a specific period
    viewPeriodDetails: function(period) {
        console.log('Viewing details for period:', period);
        
        // Create a modal to show period details
        const modalHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="period-details-modal">
                <div class="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-screen overflow-y-auto">
                    <div class="p-4 border-b flex justify-between items-center">
                        <h3 class="font-semibold text-lg">Details for ${period}</h3>
                        <button id="close-period-details" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="p-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <!-- Summary Stats -->
                            <div class="card">
                                <div class="p-4 border-b">
                                    <h4 class="font-medium">Summary Statistics</h4>
                                </div>
                                <div class="p-4">
                                    <div class="grid grid-cols-2 gap-4">
                                        <div class="text-center p-3 bg-blue-50 rounded-lg">
                                            <div class="text-2xl font-bold text-blue-600">${Math.floor(Math.random() * 100) + 50}</div>
                                            <div class="text-sm text-gray-600">Total Reports</div>
                                        </div>
                                        <div class="text-center p-3 bg-green-50 rounded-lg">
                                            <div class="text-2xl font-bold text-green-600">${Math.floor(Math.random() * 40) + 30}</div>
                                            <div class="text-sm text-gray-600">Resolved</div>
                                        </div>
                                        <div class="text-center p-3 bg-yellow-50 rounded-lg">
                                            <div class="text-2xl font-bold text-yellow-600">${Math.floor(Math.random() * 20) + 10}</div>
                                            <div class="text-sm text-gray-600">In Progress</div>
                                        </div>
                                        <div class="text-center p-3 bg-red-50 rounded-lg">
                                            <div class="text-2xl font-bold text-red-600">${Math.floor(Math.random() * 10) + 5}</div>
                                            <div class="text-sm text-gray-600">High Severity</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Zone Distribution -->
                            <div class="card">
                                <div class="p-4 border-b">
                                    <h4 class="font-medium">Zone Distribution</h4>
                                </div>
                                <div class="p-4">
                                    <div class="space-y-3">
                                        <div>
                                            <div class="flex justify-between text-sm mb-1">
                                                <span>Downtown</span>
                                                <span>${Math.floor(Math.random() * 30) + 10}%</span>
                                            </div>
                                            <div class="w-full bg-gray-200 rounded-full h-2">
                                                <div class="bg-blue-600 h-2 rounded-full" style="width: ${Math.floor(Math.random() * 30) + 10}%"></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="flex justify-between text-sm mb-1">
                                                <span>North District</span>
                                                <span>${Math.floor(Math.random() * 30) + 10}%</span>
                                            </div>
                                            <div class="w-full bg-gray-200 rounded-full h-2">
                                                <div class="bg-green-600 h-2 rounded-full" style="width: ${Math.floor(Math.random() * 30) + 10}%"></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="flex justify-between text-sm mb-1">
                                                <span>South District</span>
                                                <span>${Math.floor(Math.random() * 30) + 10}%</span>
                                            </div>
                                            <div class="w-full bg-gray-200 rounded-full h-2">
                                                <div class="bg-yellow-600 h-2 rounded-full" style="width: ${Math.floor(Math.random() * 30) + 10}%"></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="flex justify-between text-sm mb-1">
                                                <span>East District</span>
                                                <span>${Math.floor(Math.random() * 30) + 10}%</span>
                                            </div>
                                            <div class="w-full bg-gray-200 rounded-full h-2">
                                                <div class="bg-purple-600 h-2 rounded-full" style="width: ${Math.floor(Math.random() * 30) + 10}%"></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="flex justify-between text-sm mb-1">
                                                <span>West District</span>
                                                <span>${Math.floor(Math.random() * 30) + 10}%</span>
                                            </div>
                                            <div class="w-full bg-gray-200 rounded-full h-2">
                                                <div class="bg-red-600 h-2 rounded-full" style="width: ${Math.floor(Math.random() * 30) + 10}%"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Detailed Reports Table -->
                        <div class="card mt-6">
                            <div class="p-4 border-b">
                                <h4 class="font-medium">Detailed Reports</h4>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="w-full">
                                    <thead>
                                        <tr class="text-xs text-gray-500 uppercase border-b border-gray-200">
                                            <th class="px-4 py-3 text-left">Report ID</th>
                                            <th class="px-4 py-3 text-left">Date</th>
                                            <th class="px-4 py-3 text-left">Location</th>
                                            <th class="px-4 py-3 text-left">Status</th>
                                            <th class="px-4 py-3 text-left">Severity</th>
                                            <th class="px-4 py-3 text-left">Resolution Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.generateMockDetailRows(5)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="p-4 border-t flex justify-end">
                        <button id="export-period-details" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            <i class="fas fa-file-export mr-2"></i>Export Details
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add the modal to the body
        $('body').append(modalHTML);
        
        // Set up event listeners for the modal
        $('#close-period-details').on('click', () => {
            $('#period-details-modal').remove();
        });
        
        $('#export-period-details').on('click', () => {
            this.exportPeriodData(period, true);
            $('#period-details-modal').remove();
        });
    },
    
    // Generate mock detail rows for the period details modal
    generateMockDetailRows: function(count) {
        let rows = '';
        const statuses = ['new', 'assigned', 'in_progress', 'completed', 'verified'];
        const severities = ['low', 'medium', 'high'];
        const locations = [
            '123 Main St, Downtown',
            '456 Oak Ave, North District',
            '789 Pine Rd, South District',
            '321 Elm Blvd, East District',
            '654 Maple Dr, West District'
        ];
        
        for (let i = 0; i < count; i++) {
            const reportId = 'RPT-' + (Math.floor(Math.random() * 9000) + 1000);
            const date = new Date(2025, Math.floor(Math.random() * 4), Math.floor(Math.random() * 28) + 1);
            const location = locations[Math.floor(Math.random() * locations.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const severity = severities[Math.floor(Math.random() * severities.length)];
            const days = Math.floor(Math.random() * 10) + 1;
            const hours = Math.floor(Math.random() * 24);
            
            const statusClass = this.getStatusClass(status);
            const severityClass = this.getSeverityClass(severity);
            
            rows += `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-4 py-3">${reportId}</td>
                    <td class="px-4 py-3">${date.toLocaleDateString()}</td>
                    <td class="px-4 py-3">${location}</td>
                    <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs ${statusClass}">${this.capitalizeFirstLetter(status)}</span></td>
                    <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs ${severityClass}">${this.capitalizeFirstLetter(severity)}</span></td>
                    <td class="px-4 py-3">${days}d ${hours}h</td>
                </tr>
            `;
        }
        
        return rows;
    },
    
    // Export data for a specific period
    exportPeriodData: function(period, isDetailed = false) {
        console.log(`Exporting ${isDetailed ? 'detailed ' : ''}data for period:`, period);
        
        // In a real implementation, this would generate a CSV or Excel file
        // For demonstration, we'll show a notification
        
        // Create a toast notification
        const toastHTML = `
            <div class="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center" id="export-toast">
                <i class="fas fa-check-circle mr-2"></i>
                <div>
                    <p class="font-medium">Export Successful</p>
                    <p class="text-sm">${isDetailed ? 'Detailed report' : 'Summary data'} for ${period} has been exported.</p>
                </div>
                <button class="ml-4 text-white hover:text-gray-200" id="close-toast">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add the toast to the body
        $('body').append(toastHTML);
        
        // Set up event listener for the close button
        $('#close-toast').on('click', () => {
            $('#export-toast').remove();
        });
        
        // Automatically remove the toast after 5 seconds
        setTimeout(() => {
            $('#export-toast').fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);
    },
    
    // Populate zone analysis in the history view
    populateZoneAnalysis: function() {
        console.log('Populating zone analysis');
        
        // Get the zone analysis container
        const zoneAnalysisContainer = $('#illegal-dumping-history-container .grid.grid-cols-1.md\:grid-cols-5');
        if (zoneAnalysisContainer.length === 0) return;
        
        zoneAnalysisContainer.empty();
        
        // Define zones and their display names
        const zones = ['downtown', 'north_district', 'south_district', 'east_district', 'west_district'];
        const zoneNames = {
            'downtown': 'Downtown',
            'north_district': 'North District',
            'south_district': 'South District',
            'east_district': 'East District',
            'west_district': 'West District'
        };
        
        // For each zone, create a card with stats
        zones.forEach(zone => {
            // In a real implementation, we would calculate these from actual data
            const totalReports = Math.floor(Math.random() * 50) + 10;
            const totalResolved = Math.floor(Math.random() * totalReports);
            const resolutionRate = totalReports > 0 ? ((totalResolved / totalReports) * 100).toFixed(1) : '0.0';
            
            // Create the zone card
            const zoneCard = $('<div>').addClass('p-4 border rounded-lg');
            
            // Add zone name
            $('<h4>').addClass('text-sm font-medium text-gray-500 mb-2').text(zoneNames[zone]).appendTo(zoneCard);
            
            // Add reports count
            $('<div>').addClass('text-xl font-bold mb-1').text(`${totalReports} Reports`).appendTo(zoneCard);
            
            // Add resolution rate with appropriate icon
            const rateContainer = $('<div>').addClass('flex items-center text-sm');
            
            // Determine color and icon based on resolution rate
            let color = 'red';
            let icon = 'times-circle';
            
            if (resolutionRate >= 70) {
                color = 'green';
                icon = 'check-circle';
            } else if (resolutionRate >= 50) {
                color = 'yellow';
                icon = 'exclamation-circle';
            }
            
            $('<span>').addClass(`text-${color}-600`).html(`<i class="fas fa-${icon} mr-1"></i>`).appendTo(rateContainer);
            $('<span>').text(`${resolutionRate}% Resolved`).appendTo(rateContainer);
            
            rateContainer.appendTo(zoneCard);
            zoneAnalysisContainer.append(zoneCard);
        });
    },
    
    setupEventListeners: function() {
        // We no longer need to handle submenu navigation here as it's handled by menu-navigation.js
        // But we'll keep the event listeners for the detail panel and filters
        
        // Filter change handlers
        $('#status-filter').on('change', (e) => {
            this.activeFilters.status = e.target.value;
            this.applyFilters();
        });
        
        $('#severity-filter').on('change', (e) => {
            this.activeFilters.severity = e.target.value;
            this.applyFilters();
        });
        
        $('#timeframe-filter').on('change', (e) => {
            this.activeFilters.timeframe = e.target.value;
            this.applyFilters();
        });
        
        $('#zone-filter').on('change', (e) => {
            this.activeFilters.zone = e.target.value;
            this.applyFilters();
        });
        
        // Assignment tab events
        this.setupAssignmentTabEvents();
        
        // Filter change handlers
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.activeFilters.status = e.target.value;
                this.applyFilters();
            });
        }
        
        const severityFilter = document.getElementById('severity-filter');
        if (severityFilter) {
            severityFilter.addEventListener('change', (e) => {
                this.activeFilters.severity = e.target.value;
                this.applyFilters();
            });
        }
        
        const timeframeFilter = document.getElementById('timeframe-filter');
        if (timeframeFilter) {
            timeframeFilter.addEventListener('change', (e) => {
                this.activeFilters.timeframe = e.target.value;
                this.applyFilters();
            });
        }
        
        const zoneFilter = document.getElementById('zone-filter');
        if (zoneFilter) {
            zoneFilter.addEventListener('change', (e) => {
                this.activeFilters.zone = e.target.value;
                this.applyFilters();
            });
        }
        
        // New report button
        $(document).on('click', '#new-report-btn', () => {
            alert('New report functionality coming soon!');
        });
        
        // Export data button
        $(document).on('click', '#export-data-btn', () => {
            alert('Export functionality coming soon!');
        });
        

        
        // Close detail panel button
        const closeDetailBtn = document.getElementById('close-detail-panel');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', () => {
                document.getElementById('report-detail-panel').classList.add('hidden');
                this.selectedReport = null;
            });
        }
        
        // Tab switching in detail panel
        const detailTabs = document.querySelectorAll('.detail-tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        detailTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                detailTabs.forEach(t => t.classList.remove('active', 'border-blue-500', 'text-blue-600'));
                detailTabs.forEach(t => t.classList.add('border-transparent', 'text-gray-500'));
                
                // Add active class to clicked tab
                tab.classList.add('active', 'border-blue-500', 'text-blue-600');
                tab.classList.remove('border-transparent', 'text-gray-500');
                
                // Hide all tab contents
                tabContents.forEach(content => content.classList.add('hidden'));
                
                // Show the selected tab content
                const tabId = tab.getAttribute('data-tab');
                document.getElementById(tabId).classList.remove('hidden');
                
                // Load tab-specific data if needed
                if (tabId === 'assignment-tab' && this.selectedReport) {
                    this.loadAssignmentTabData(this.selectedReport);
                }
            });
        });
        
        // New report button
        const newReportBtn = document.getElementById('new-report-btn');
        if (newReportBtn) {
            newReportBtn.addEventListener('click', () => {
                this.createNewReport();
            });
        }
        
        // Export data button
        const exportDataBtn = document.getElementById('export-data-btn');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => {
                this.exportReportsData();
            });
        }
    },
    
    // Setup event listeners for the assignment tab
    setupAssignmentTabEvents: function() {
        // Cleaner selection
        $(document).on('click', '#assignment-tab tbody button', (e) => {
            this.handleCleanerSelection(e);
        });
        
        // Priority buttons
        $(document).on('click', '.priority-btn', (e) => {
            this.handlePrioritySelection(e);
        });
        
        // Assignment action buttons
        $(document).on('click', '#btn-assign-task', (e) => {
            this.showCleanerSelectionFocus(e);
        });
        
        $(document).on('click', '#btn-mark-duplicate', (e) => {
            this.handleMarkAsDuplicate(e);
        });
        
        $(document).on('click', '#btn-reject-report', (e) => {
            this.handleRejectReport(e);
        });
        
        // Confirm assignment
        $(document).on('click', '#confirm-assignment-btn', (e) => {
            this.handleConfirmAssignment(e);
        });
        
        // Filter cleaners
        $(document).on('change', '#cleaner-filter-proximity, #cleaner-filter-specialization, #cleaner-filter-rating', () => {
            this.filterCleaners();
        });
    },
    
    // Load data for the assignment tab
    loadAssignmentTabData: function(report) {
        // Update status display based on report status
        const statusMapping = {
            'new': { text: 'New', class: 'bg-blue-100 text-blue-800', description: 'This report is new and waiting to be assigned to a cleaner. Once assigned, the cleaner will be notified and can accept or decline the task.' },
            'assigned': { text: 'Assigned', class: 'bg-purple-100 text-purple-800', description: 'This report has been assigned to a cleaner who will handle the cleanup. You can track their progress or reassign if needed.' },
            'in_progress': { text: 'In Progress', class: 'bg-yellow-100 text-yellow-800', description: 'The cleaner is currently working on this task. You can communicate with them or check for updates.' },
            'completed': { text: 'Completed', class: 'bg-green-100 text-green-800', description: 'The cleaner has marked this task as complete. Please verify the cleanup before processing payment.' },
            'rejected': { text: 'Rejected', class: 'bg-red-100 text-red-800', description: 'This report has been rejected. No further action is required.' },
            'duplicate': { text: 'Duplicate', class: 'bg-gray-100 text-gray-800', description: 'This report has been marked as a duplicate of another report.' }
        };
        
        const status = report.status || 'new';
        const statusInfo = statusMapping[status] || statusMapping['new'];
        
        // Update status display
        $('#assignment-current-status').text(statusInfo.text)
            .removeClass()
            .addClass(`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.class}`);
        $('#assignment-status-description').text(statusInfo.description);
        
        // Update button states based on status
        if (status === 'new') {
            $('#btn-assign-task').prop('disabled', false).removeClass('opacity-50');
            $('#btn-mark-duplicate').prop('disabled', false).removeClass('opacity-50');
            $('#btn-reject-report').prop('disabled', false).removeClass('opacity-50');
        } else if (status === 'assigned' || status === 'in_progress') {
            $('#btn-assign-task').text('Reassign Task').prop('disabled', false).removeClass('opacity-50');
            $('#btn-mark-duplicate').prop('disabled', true).addClass('opacity-50');
            $('#btn-reject-report').prop('disabled', true).addClass('opacity-50');
        } else {
            $('#btn-assign-task').prop('disabled', true).addClass('opacity-50');
            $('#btn-mark-duplicate').prop('disabled', true).addClass('opacity-50');
            $('#btn-reject-report').prop('disabled', true).addClass('opacity-50');
        }
        
        // Load available cleaners
        this.loadAvailableCleaners(report);
        
        // Set default deadline (48 hours from now)
        const defaultDeadline = new Date();
        defaultDeadline.setHours(defaultDeadline.getHours() + 48);
        const formattedDeadline = defaultDeadline.toISOString().slice(0, 16);
        $('#task-deadline').val(formattedDeadline);
        
        // Reset priority selection
        $('.priority-btn').removeClass('bg-blue-500 text-white').addClass('bg-gray-100 text-gray-700');
        $('.priority-btn[data-priority="normal"]').removeClass('bg-gray-100 text-gray-700').addClass('bg-blue-500 text-white');
        
        // Reset selected cleaner
        $('#selected-cleaner-empty').removeClass('hidden');
        $('#selected-cleaner-info').addClass('hidden').empty();
        $('#confirm-assignment-btn').prop('disabled', true);
        
        // If report is already assigned, show the assigned cleaner
        if (report.assignment) {
            this.showAssignedCleaner(report.assignment);
        }
    },
    
    // Load available cleaners for assignment
    loadAvailableCleaners: function(report) {
        // In a real application, this would fetch cleaners from the server
        // For now, we'll use mock data
        const cleaners = this.generateMockCleaners(report.location);
        
        // Apply any active filters
        this.filterCleaners();
    },
    
    // Generate mock cleaners for demonstration
    generateMockCleaners: function(location) {
        // This would be replaced with an API call in a real application
        return [
            {
                id: 'CLN-1042',
                name: 'Michael Johnson',
                distance: '2.3 km',
                specialization: 'Construction',
                specializationClass: 'bg-green-100 text-green-800',
                rating: 4.8,
                workload: '1 active task'
            },
            {
                id: 'CLN-1078',
                name: 'Sarah Williams',
                distance: '3.7 km',
                specialization: 'Hazardous',
                specializationClass: 'bg-purple-100 text-purple-800',
                rating: 4.9,
                workload: '0 active tasks'
            },
            {
                id: 'CLN-1015',
                name: 'David Chen',
                distance: '5.1 km',
                specialization: 'General',
                specializationClass: 'bg-blue-100 text-blue-800',
                rating: 4.6,
                workload: '2 active tasks'
            }
        ];
    },
    
    // Show assigned cleaner in the selected cleaner card
    showAssignedCleaner: function(assignment) {
        $('#selected-cleaner-empty').addClass('hidden');
        $('#selected-cleaner-info').removeClass('hidden').html(`
            <div class="flex items-center mb-4">
                <div class="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                    <i class="fas fa-user text-lg"></i>
                </div>
                <div class="ml-4">
                    <h4 class="text-base font-medium text-gray-900">${assignment.cleaner}</h4>
                    <p class="text-sm text-gray-500">${assignment.cleanerId}</p>
                </div>
            </div>
            <div class="border-t pt-3">
                <p class="text-xs text-gray-500 mb-1">Assignment Details</p>
                <p class="text-sm flex items-center mb-1">
                    <i class="fas fa-calendar-alt text-gray-400 mr-2"></i>
                    Assigned on ${new Date(assignment.assignedAt).toLocaleDateString()}
                </p>
                <p class="text-sm flex items-center mb-1">
                    <i class="fas fa-clock text-gray-400 mr-2"></i>
                    Deadline: ${new Date(assignment.deadline).toLocaleDateString()}
                </p>
                <p class="text-sm flex items-center">
                    <i class="fas fa-flag text-gray-400 mr-2"></i>
                    Priority: ${this.capitalizeFirstLetter(assignment.priority)}
                </p>
            </div>
        `);
        
        // Disable confirm button as it's already assigned
        $('#confirm-assignment-btn').prop('disabled', true);
        
        // Store selected cleaner ID
        this.selectedCleanerId = assignment.cleanerId;
    },
    
    // Handle cleaner selection from the table
    handleCleanerSelection: function(e) {
        e.preventDefault();
        
        // Get cleaner data from the row
        const $row = $(e.target).closest('tr');
        const cleanerName = $row.find('.text-sm.font-medium').text();
        const cleanerId = $row.find('.text-xs.text-gray-500').text().replace('ID: ', '');
        const distance = $row.find('td:nth-child(2) .text-sm').text();
        const specialization = $row.find('td:nth-child(3) span').text();
        const specializationClass = $row.find('td:nth-child(3) span').attr('class');
        const rating = $row.find('td:nth-child(4) span:last-child').text();
        const workload = $row.find('td:nth-child(5) .text-sm').text();
        
        // Update selected cleaner info
        $('#selected-cleaner-empty').addClass('hidden');
        $('#selected-cleaner-info').removeClass('hidden').html(`
            <div class="flex items-center mb-4">
                <div class="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                    <i class="fas fa-user text-lg"></i>
                </div>
                <div class="ml-4">
                    <h4 class="text-base font-medium text-gray-900">${cleanerName}</h4>
                    <p class="text-sm text-gray-500">${cleanerId}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mb-4">
                <div>
                    <p class="text-xs text-gray-500">Distance</p>
                    <p class="text-sm">${distance}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Rating</p>
                    <p class="text-sm flex items-center">
                        <span class="text-yellow-500 mr-1"><i class="fas fa-star"></i></span>
                        <span>${rating}</span>
                    </p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Specialization</p>
                    <p class="text-sm"><span class="${specializationClass}">${specialization}</span></p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Current Workload</p>
                    <p class="text-sm">${workload}</p>
                </div>
            </div>
            <div class="border-t pt-3">
                <p class="text-xs text-gray-500 mb-1">Contact Information</p>
                <p class="text-sm flex items-center mb-1">
                    <i class="fas fa-phone-alt text-gray-400 mr-2"></i>
                    +233 ${Math.floor(Math.random() * 900000000) + 100000000}
                </p>
                <p class="text-sm flex items-center">
                    <i class="fas fa-envelope text-gray-400 mr-2"></i>
                    ${cleanerName.toLowerCase().replace(' ', '.')}@trashdrop.com
                </p>
            </div>
        `);
        
        // Enable confirm button
        $('#confirm-assignment-btn').prop('disabled', false);
        
        // Store selected cleaner ID
        this.selectedCleanerId = cleanerId;
    },
    
    // Handle priority selection
    handlePrioritySelection: function(e) {
        e.preventDefault();
        const priority = $(e.currentTarget).data('priority');
        
        // Update button styles
        $('.priority-btn').removeClass('bg-blue-500 text-white').addClass('bg-gray-100 text-gray-700');
        $(e.currentTarget).removeClass('bg-gray-100 text-gray-700').addClass('bg-blue-500 text-white');
        
        // Store selected priority
        this.selectedPriority = priority;
    },
    
    // Show cleaner selection section with focus
    showCleanerSelectionFocus: function(e) {
        e.preventDefault();
        
        // Scroll to cleaner selection and add a highlight effect
        const $cleanerSection = $('#assignment-tab .bg-white:nth-child(2)');
        $cleanerSection.addClass('ring-2 ring-blue-500 ring-opacity-50');
        
        // Scroll to the cleaner section
        $cleanerSection[0].scrollIntoView({ behavior: 'smooth' });
        
        // Remove highlight after a delay
        setTimeout(() => {
            $cleanerSection.removeClass('ring-2 ring-blue-500 ring-opacity-50');
        }, 2000);
    },
    
    // Handle marking a report as duplicate
    handleMarkAsDuplicate: function(e) {
        e.preventDefault();
        
        if (!this.selectedReport) return;
        
        // Show confirmation dialog
        if (confirm('Are you sure you want to mark this report as a duplicate? This action cannot be undone.')) {
            // Update report status
            this.selectedReport.status = 'duplicate';
            
            // Update UI
            this.loadAssignmentTabData(this.selectedReport);
            
            // Show success message
            alert('Report has been marked as a duplicate.');
            
            // In a real application, this would send an update to the server
        }
    },
    
    // Handle rejecting a report
    handleRejectReport: function(e) {
        e.preventDefault();
        
        if (!this.selectedReport) return;
        
        // Show confirmation dialog with reason input
        const reason = prompt('Please provide a reason for rejecting this report:');
        
        if (reason) {
            // Update report status
            this.selectedReport.status = 'rejected';
            this.selectedReport.rejectionReason = reason;
            
            // Update UI
            this.loadAssignmentTabData(this.selectedReport);
            
            // Show success message
            alert('Report has been rejected.');
            
            // In a real application, this would send an update to the server
        }
    },
    
    // Handle confirming assignment
    handleConfirmAssignment: function(e) {
        e.preventDefault();
        
        if (!this.selectedReport || !this.selectedCleanerId) return;
        
        // Get assignment details
        const priority = this.selectedPriority || 'normal';
        const deadline = $('#task-deadline').val();
        const instructions = $('#task-instructions').val();
        
        // Validate inputs
        if (!deadline) {
            alert('Please set a deadline for this task.');
            return;
        }
        
        // Update report status
        this.selectedReport.status = 'assigned';
        this.selectedReport.assignment = {
            cleanerId: this.selectedCleanerId,
            cleaner: $('#selected-cleaner-info h4').text(),
            assignedAt: new Date(),
            priority: priority,
            deadline: new Date(deadline),
            instructions: instructions
        };
        
        // Update UI
        this.loadAssignmentTabData(this.selectedReport);
        
        // Show success message
        alert(`Task has been assigned to ${this.selectedCleanerId}. The cleaner will be notified immediately.`);
        
        // In a real application, this would send an update to the server
    },
    
    // Filter cleaners based on selected filters
    filterCleaners: function() {
        // Get filter values
        const proximityFilter = $('#cleaner-filter-proximity').val();
        const specializationFilter = $('#cleaner-filter-specialization').val();
        const ratingFilter = $('#cleaner-filter-rating').val();
        
        // In a real application, this would filter the cleaners based on the selected filters
        // For now, we'll just log the filter values
        console.log('Filtering cleaners with:', { proximityFilter, specializationFilter, ratingFilter });
        
        // This would normally update the table with filtered results
    }
};

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the Illegal Dumping Management page
    const illegalDumpingSection = document.getElementById('illegal-dumping-section');
    if (illegalDumpingSection) {
        IllegalDumpingManagement.init();
    }
});

// Export for use in other scripts
window.IllegalDumpingManagement = IllegalDumpingManagement;
