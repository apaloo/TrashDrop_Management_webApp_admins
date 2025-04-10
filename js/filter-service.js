/**
 * TrashDrop Admin Dashboard - Filter Service
 * Provides advanced filtering capabilities for various dashboard components
 */

const FilterService = {
    // Initialize the filter service
    init: function() {
        console.log('Initializing Filter Service');
        
        // Set up event listeners
        this.setupEventListeners();
        
        return this;
    },
    
    // Set up event listeners
    setupEventListeners: function() {
        // Filter button click
        $('.filter-btn').on('click', (e) => {
            const targetSection = $(e.currentTarget).data('target');
            this.showFilterModal(targetSection);
        });
        
        // Apply filter button
        $('.apply-filter-btn').on('click', (e) => {
            const targetSection = $(e.currentTarget).data('target');
            this.applyFilters(targetSection);
        });
        
        // Reset filter button
        $('.reset-filter-btn').on('click', (e) => {
            const targetSection = $(e.currentTarget).data('target');
            this.resetFilters(targetSection);
        });
        
        // Close filter modal
        $('.close-filter-modal').on('click', () => {
            this.hideFilterModal();
        });
        
        // Date range picker initialization
        if ($.fn.daterangepicker) {
            $('.date-range-picker').daterangepicker({
                opens: 'left',
                autoUpdateInput: false,
                locale: {
                    cancelLabel: 'Clear',
                    applyLabel: 'Apply',
                    format: 'MM/DD/YYYY'
                }
            });
            
            $('.date-range-picker').on('apply.daterangepicker', function(ev, picker) {
                $(this).val(picker.startDate.format('MM/DD/YYYY') + ' - ' + picker.endDate.format('MM/DD/YYYY'));
            });
            
            $('.date-range-picker').on('cancel.daterangepicker', function(ev, picker) {
                $(this).val('');
            });
        }
    },
    
    // Show filter modal for specific section
    showFilterModal: function(targetSection) {
        // Hide all filter modals first
        $('.filter-modal').addClass('hidden');
        
        // Show the specific filter modal
        $(`#${targetSection}-filter-modal`).removeClass('hidden');
        
        // Load current filters
        this.loadCurrentFilters(targetSection);
    },
    
    // Hide filter modal
    hideFilterModal: function() {
        $('.filter-modal').addClass('hidden');
    },
    
    // Load current filters
    loadCurrentFilters: function(targetSection) {
        if (targetSection === 'reports') {
            // Load report filters
            const filters = IllegalDumpingManagement.getFilters();
            
            // Set filter values
            $('#filter-report-status').val(filters.status || '');
            $('#filter-report-priority').val(filters.priority || '');
            $('#filter-report-date-range').val(filters.dateRange || '');
            $('#filter-report-assigned-to').val(filters.assignedTo || '');
            $('#filter-report-location').val(filters.location || '');
        } else if (targetSection === 'collectors') {
            // Load collector filters
            const filters = CollectorManagement ? CollectorManagement.getFilters() : {};
            
            // Set filter values
            $('#filter-collector-status').val(filters.status || '');
            $('#filter-collector-region').val(filters.region || '');
            $('#filter-collector-type').val(filters.type || '');
        } else if (targetSection === 'bins') {
            // Load bin filters
            const filters = BinManagement ? BinManagement.getFilters() : {};
            
            // Set filter values
            $('#filter-bin-status').val(filters.status || '');
            $('#filter-bin-type').val(filters.type || '');
            $('#filter-bin-location').val(filters.location || '');
        }
    },
    
    // Apply filters for specific section
    applyFilters: function(targetSection) {
        if (targetSection === 'reports') {
            // Get filter values
            const filters = {
                status: $('#filter-report-status').val(),
                priority: $('#filter-report-priority').val(),
                dateRange: $('#filter-report-date-range').val(),
                assignedTo: $('#filter-report-assigned-to').val(),
                location: $('#filter-report-location').val()
            };
            
            // Apply filters
            IllegalDumpingManagement.setFilters(filters);
            IllegalDumpingManagement.applyFilters();
        } else if (targetSection === 'collectors') {
            // Get filter values
            const filters = {
                status: $('#filter-collector-status').val(),
                region: $('#filter-collector-region').val(),
                type: $('#filter-collector-type').val()
            };
            
            // Apply filters if CollectorManagement exists
            if (CollectorManagement && CollectorManagement.setFilters) {
                CollectorManagement.setFilters(filters);
                CollectorManagement.applyFilters();
            }
        } else if (targetSection === 'bins') {
            // Get filter values
            const filters = {
                status: $('#filter-bin-status').val(),
                type: $('#filter-bin-type').val(),
                location: $('#filter-bin-location').val()
            };
            
            // Apply filters if BinManagement exists
            if (BinManagement && BinManagement.setFilters) {
                BinManagement.setFilters(filters);
                BinManagement.applyFilters();
            }
        }
        
        // Hide filter modal
        this.hideFilterModal();
        
        // Show filter applied indicator
        this.showFilterAppliedIndicator(targetSection);
    },
    
    // Reset filters for specific section
    resetFilters: function(targetSection) {
        if (targetSection === 'reports') {
            // Reset form
            $('#reports-filter-form')[0].reset();
            
            // Reset filters in management
            IllegalDumpingManagement.resetFilters();
        } else if (targetSection === 'collectors') {
            // Reset form
            $('#collectors-filter-form')[0].reset();
            
            // Reset filters if CollectorManagement exists
            if (CollectorManagement && CollectorManagement.resetFilters) {
                CollectorManagement.resetFilters();
            }
        } else if (targetSection === 'bins') {
            // Reset form
            $('#bins-filter-form')[0].reset();
            
            // Reset filters if BinManagement exists
            if (BinManagement && BinManagement.resetFilters) {
                BinManagement.resetFilters();
            }
        }
        
        // Hide filter applied indicator
        this.hideFilterAppliedIndicator(targetSection);
    },
    
    // Show filter applied indicator
    showFilterAppliedIndicator: function(targetSection) {
        $(`#${targetSection}-filter-indicator`).removeClass('hidden');
    },
    
    // Hide filter applied indicator
    hideFilterAppliedIndicator: function(targetSection) {
        $(`#${targetSection}-filter-indicator`).addClass('hidden');
    },
    
    // Filter data based on criteria
    filterData: function(data, filters) {
        if (!data || !data.length || !filters) {
            return data;
        }
        
        return data.filter(item => {
            let match = true;
            
            // Check each filter
            Object.keys(filters).forEach(key => {
                const filterValue = filters[key];
                
                // Skip empty filters
                if (!filterValue) {
                    return;
                }
                
                // Handle different filter types
                switch (key) {
                    case 'status':
                        match = match && item.status === filterValue;
                        break;
                    case 'priority':
                        match = match && item.priority === filterValue;
                        break;
                    case 'type':
                        match = match && item.type === filterValue;
                        break;
                    case 'region':
                        match = match && item.region === filterValue;
                        break;
                    case 'assignedTo':
                        match = match && item.assignedTo === filterValue;
                        break;
                    case 'location':
                        // Check if location contains the filter value
                        const locationString = typeof item.location === 'object' 
                            ? item.location.address 
                            : item.location;
                        match = match && locationString.toLowerCase().includes(filterValue.toLowerCase());
                        break;
                    case 'dateRange':
                        // Parse date range
                        if (filterValue.includes(' - ')) {
                            const [startDateStr, endDateStr] = filterValue.split(' - ');
                            const startDate = new Date(startDateStr);
                            const endDate = new Date(endDateStr);
                            endDate.setHours(23, 59, 59, 999); // End of day
                            
                            // Get item date
                            const itemDate = new Date(item.dateReported || item.date || item.createdAt);
                            
                            match = match && itemDate >= startDate && itemDate <= endDate;
                        }
                        break;
                }
            });
            
            return match;
        });
    }
};

// Initialize when the DOM is loaded
$(document).ready(function() {
    FilterService.init();
});
