/**
 * TrashDrop Admin Dashboard - Collector Management
 * Handles management of waste collectors, including adding, editing, and tracking
 */

const CollectorManagement = {
    // Store collectors data
    collectors: [],
    
    // Store current filters
    filters: {},
    
    // Pagination settings
    pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1
    },
    
    // Initialize the collector management
    init: function() {
        console.log('Initializing Collector Management');
        
        // Load collectors
        this.loadCollectors();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Listen for data changes
        document.addEventListener('collectors-updated', this.handleCollectorsUpdated.bind(this));
        
        return this;
    },
    
    // Load collectors from DataService
    loadCollectors: function() {
        // Get collectors from DataService
        this.collectors = DataService.getCollectors();
        
        // Apply filters and render
        this.applyFilters();
    },
    
    // Set up event listeners
    setupEventListeners: function() {
        // Add collector button
        $('#add-collector-btn').on('click', () => {
            this.showCollectorModal();
        });
        
        // Save collector button
        $('#save-collector-btn').on('click', () => {
            this.saveCollector();
        });
        
        // Close modal buttons
        $('.close-collector-modal').on('click', () => {
            this.hideCollectorModal();
        });
        
        // Edit collector button (delegated)
        $('#collectors-list').on('click', '.edit-collector-btn', (e) => {
            const collectorId = $(e.currentTarget).data('id');
            this.editCollector(collectorId);
        });
        
        // Delete collector button (delegated)
        $('#collectors-list').on('click', '.delete-collector-btn', (e) => {
            const collectorId = $(e.currentTarget).data('id');
            this.deleteCollector(collectorId);
        });
        
        // View collector details button (delegated)
        $('#collectors-list').on('click', '.view-collector-btn', (e) => {
            const collectorId = $(e.currentTarget).data('id');
            this.viewCollectorDetails(collectorId);
        });
        
        // Pagination controls
        $('#collectors-prev-page').on('click', () => {
            if (this.pagination.currentPage > 1) {
                this.pagination.currentPage--;
                this.renderCollectors();
            }
        });
        
        $('#collectors-next-page').on('click', () => {
            if (this.pagination.currentPage < this.pagination.totalPages) {
                this.pagination.currentPage++;
                this.renderCollectors();
            }
        });
        
        // Reset filters button
        $('#reset-collectors-filters-btn').on('click', () => {
            this.resetFilters();
        });
    },
    
    // Show collector modal for adding or editing
    showCollectorModal: function(collectorData = null) {
        // Reset form
        $('#collector-form')[0].reset();
        
        // Set modal title
        $('#collector-modal-title').text(collectorData ? 'Edit Collector' : 'Add New Collector');
        
        // Set form data if editing
        if (collectorData) {
            $('#collector-id').val(collectorData.id);
            $('#collector-name').val(collectorData.name);
            $('#collector-type').val(collectorData.type);
            $('#collector-status').val(collectorData.status);
            $('#collector-region').val(collectorData.region);
            $('#collector-address').val(collectorData.address);
            $('#collector-contact-name').val(collectorData.contact.name);
            $('#collector-contact-phone').val(collectorData.contact.phone);
            $('#collector-contact-email').val(collectorData.contact.email);
            $('#collector-notes').val(collectorData.notes);
        } else {
            $('#collector-id').val('');
        }
        
        // Show modal
        $('#collector-modal').removeClass('hidden');
    },
    
    // Hide collector modal
    hideCollectorModal: function() {
        $('#collector-modal').addClass('hidden');
    },
    
    // Save collector (add or update)
    saveCollector: function() {
        // Validate form
        if (!this.validateCollectorForm()) {
            return;
        }
        
        // Get form data
        const formData = this.getCollectorFormData();
        
        // Check if adding or updating
        const isNew = !formData.id;
        
        if (isNew) {
            // Generate ID for new collector
            formData.id = 'col-' + Date.now();
            
            // Add creation date
            formData.createdAt = new Date().toISOString();
            
            // Add to collectors array
            this.collectors.push(formData);
        } else {
            // Update existing collector
            const index = this.collectors.findIndex(c => c.id === formData.id);
            if (index !== -1) {
                // Preserve creation date
                formData.createdAt = this.collectors[index].createdAt;
                
                // Add updated date
                formData.updatedAt = new Date().toISOString();
                
                // Update collector
                this.collectors[index] = formData;
            }
        }
        
        // Save to DataService
        DataService.saveCollectors(this.collectors);
        
        // Hide modal
        this.hideCollectorModal();
        
        // Show success message
        this.showSuccessMessage(isNew ? 'Collector added successfully!' : 'Collector updated successfully!');
        
        // Refresh collectors list
        this.loadCollectors();
    },
    
    // Validate collector form
    validateCollectorForm: function() {
        let isValid = true;
        
        // Clear previous errors
        $('.error-message').remove();
        $('.border-red-500').removeClass('border-red-500');
        
        // Check required fields
        const requiredFields = ['collector-name', 'collector-type', 'collector-status', 'collector-region', 'collector-address'];
        
        requiredFields.forEach(field => {
            const $field = $(`#${field}`);
            if (!$field.val()) {
                this.showFieldError($field, 'This field is required');
                isValid = false;
            }
        });
        
        // Check contact information
        if (!$('#collector-contact-name').val()) {
            this.showFieldError($('#collector-contact-name'), 'Please enter a contact name');
            isValid = false;
        }
        
        if (!$('#collector-contact-phone').val() && !$('#collector-contact-email').val()) {
            this.showFieldError($('#collector-contact-phone'), 'Please provide at least one contact method');
            this.showFieldError($('#collector-contact-email'), 'Please provide at least one contact method');
            isValid = false;
        }
        
        return isValid;
    },
    
    // Show field error
    showFieldError: function($field, message) {
        $field.addClass('border-red-500');
        $field.after(`<p class="text-red-500 text-xs mt-1 error-message">${message}</p>`);
    },
    
    // Get form data
    getCollectorFormData: function() {
        return {
            id: $('#collector-id').val(),
            name: $('#collector-name').val(),
            type: $('#collector-type').val(),
            status: $('#collector-status').val(),
            region: $('#collector-region').val(),
            address: $('#collector-address').val(),
            contact: {
                name: $('#collector-contact-name').val(),
                phone: $('#collector-contact-phone').val(),
                email: $('#collector-contact-email').val()
            },
            notes: $('#collector-notes').val(),
            stats: {
                completedPickups: 0,
                pendingPickups: 0,
                totalWeight: 0
            }
        };
    },
    
    // Edit collector
    editCollector: function(collectorId) {
        // Find collector
        const collector = this.collectors.find(c => c.id === collectorId);
        
        if (collector) {
            // Show modal with collector data
            this.showCollectorModal(collector);
        }
    },
    
    // Delete collector
    deleteCollector: function(collectorId) {
        // Confirm deletion
        if (!confirm('Are you sure you want to delete this collector?')) {
            return;
        }
        
        // Remove collector
        this.collectors = this.collectors.filter(c => c.id !== collectorId);
        
        // Save to DataService
        DataService.saveCollectors(this.collectors);
        
        // Show success message
        this.showSuccessMessage('Collector deleted successfully!');
        
        // Refresh collectors list
        this.loadCollectors();
    },
    
    // View collector details
    viewCollectorDetails: function(collectorId) {
        // Find collector
        const collector = this.collectors.find(c => c.id === collectorId);
        
        if (collector) {
            // Show details modal
            this.showCollectorDetailsModal(collector);
        }
    },
    
    // Show collector details modal
    showCollectorDetailsModal: function(collector) {
        // Set collector details
        $('#collector-detail-name').text(collector.name);
        $('#collector-detail-type').text(collector.type);
        $('#collector-detail-status').text(collector.status);
        $('#collector-detail-region').text(collector.region);
        $('#collector-detail-address').text(collector.address);
        $('#collector-detail-contact-name').text(collector.contact.name);
        $('#collector-detail-contact-phone').text(collector.contact.phone || 'N/A');
        $('#collector-detail-contact-email').text(collector.contact.email || 'N/A');
        $('#collector-detail-notes').text(collector.notes || 'No notes available');
        
        // Set stats
        $('#collector-detail-completed-pickups').text(collector.stats.completedPickups || 0);
        $('#collector-detail-pending-pickups').text(collector.stats.pendingPickups || 0);
        $('#collector-detail-total-weight').text((collector.stats.totalWeight || 0) + ' kg');
        
        // Set status badge class
        const $statusBadge = $('#collector-detail-status-badge');
        $statusBadge.removeClass('bg-green-100 bg-yellow-100 bg-red-100 bg-gray-100');
        $statusBadge.removeClass('text-green-800 text-yellow-800 text-red-800 text-gray-800');
        
        switch (collector.status.toLowerCase()) {
            case 'active':
                $statusBadge.addClass('bg-green-100 text-green-800');
                break;
            case 'inactive':
                $statusBadge.addClass('bg-gray-100 text-gray-800');
                break;
            case 'suspended':
                $statusBadge.addClass('bg-red-100 text-red-800');
                break;
            case 'pending':
                $statusBadge.addClass('bg-yellow-100 text-yellow-800');
                break;
            default:
                $statusBadge.addClass('bg-gray-100 text-gray-800');
        }
        
        $statusBadge.text(collector.status);
        
        // Show modal
        $('#collector-details-modal').removeClass('hidden');
    },
    
    // Hide collector details modal
    hideCollectorDetailsModal: function() {
        $('#collector-details-modal').addClass('hidden');
    },
    
    // Apply filters to collectors
    applyFilters: function() {
        // Filter collectors
        const filteredCollectors = this.getFilteredCollectors();
        
        // Update pagination
        this.updatePagination(filteredCollectors);
        
        // Render collectors
        this.renderCollectors(filteredCollectors);
    },
    
    // Get filtered collectors
    getFilteredCollectors: function() {
        // If no filters, return all collectors
        if (!this.filters || Object.keys(this.filters).length === 0) {
            return this.collectors;
        }
        
        // Filter collectors
        return this.collectors.filter(collector => {
            let match = true;
            
            // Check each filter
            Object.keys(this.filters).forEach(key => {
                const filterValue = this.filters[key];
                
                // Skip empty filters
                if (!filterValue) {
                    return;
                }
                
                // Handle different filter types
                switch (key) {
                    case 'status':
                        match = match && collector.status === filterValue;
                        break;
                    case 'type':
                        match = match && collector.type === filterValue;
                        break;
                    case 'region':
                        match = match && collector.region === filterValue;
                        break;
                    case 'search':
                        const searchValue = filterValue.toLowerCase();
                        const nameMatch = collector.name.toLowerCase().includes(searchValue);
                        const addressMatch = collector.address.toLowerCase().includes(searchValue);
                        const contactMatch = collector.contact.name.toLowerCase().includes(searchValue);
                        match = match && (nameMatch || addressMatch || contactMatch);
                        break;
                }
            });
            
            return match;
        });
    },
    
    // Update pagination
    updatePagination: function(filteredCollectors) {
        const totalItems = filteredCollectors.length;
        this.pagination.totalPages = Math.ceil(totalItems / this.pagination.itemsPerPage);
        
        // Adjust current page if needed
        if (this.pagination.currentPage > this.pagination.totalPages) {
            this.pagination.currentPage = Math.max(1, this.pagination.totalPages);
        }
        
        // Update pagination UI
        $('#collectors-current-page').text(this.pagination.currentPage);
        $('#collectors-total-pages').text(this.pagination.totalPages);
        
        // Update prev/next buttons
        $('#collectors-prev-page').prop('disabled', this.pagination.currentPage === 1);
        $('#collectors-next-page').prop('disabled', this.pagination.currentPage === this.pagination.totalPages);
    },
    
    // Render collectors
    renderCollectors: function(filteredCollectors) {
        // Use filtered collectors or all collectors
        const collectors = filteredCollectors || this.getFilteredCollectors();
        
        // Get current page items
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
        const endIndex = startIndex + this.pagination.itemsPerPage;
        const pageCollectors = collectors.slice(startIndex, endIndex);
        
        // Clear collectors list
        $('#collectors-list').empty();
        
        // Show message if no collectors
        if (collectors.length === 0) {
            $('#collectors-list').append(`
                <tr>
                    <td colspan="6" class="py-4 text-center text-gray-500">
                        No collectors found. Add a collector to get started.
                    </td>
                </tr>
            `);
            return;
        }
        
        // Show message if no collectors after filtering
        if (pageCollectors.length === 0) {
            $('#collectors-list').append(`
                <tr>
                    <td colspan="6" class="py-4 text-center text-gray-500">
                        No collectors match the current filters.
                    </td>
                </tr>
            `);
            return;
        }
        
        // Add each collector to the list
        pageCollectors.forEach(collector => {
            // Create status badge
            let statusBadgeClass = '';
            switch (collector.status.toLowerCase()) {
                case 'active':
                    statusBadgeClass = 'bg-green-100 text-green-800';
                    break;
                case 'inactive':
                    statusBadgeClass = 'bg-gray-100 text-gray-800';
                    break;
                case 'suspended':
                    statusBadgeClass = 'bg-red-100 text-red-800';
                    break;
                case 'pending':
                    statusBadgeClass = 'bg-yellow-100 text-yellow-800';
                    break;
                default:
                    statusBadgeClass = 'bg-gray-100 text-gray-800';
            }
            
            const collectorRow = `
                <tr class="border-b">
                    <td class="py-3 px-4">
                        <div class="font-medium">${collector.name}</div>
                        <div class="text-sm text-gray-500">${collector.type}</div>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-1 rounded-full text-xs ${statusBadgeClass}">
                            ${collector.status}
                        </span>
                    </td>
                    <td class="py-3 px-4">${collector.region}</td>
                    <td class="py-3 px-4">
                        <div>${collector.contact.name}</div>
                        <div class="text-sm text-gray-500">${collector.contact.phone || 'N/A'}</div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="flex space-x-2">
                            <button class="view-collector-btn text-blue-600 hover:text-blue-800" data-id="${collector.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="edit-collector-btn text-gray-600 hover:text-gray-800" data-id="${collector.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-collector-btn text-red-600 hover:text-red-800" data-id="${collector.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            $('#collectors-list').append(collectorRow);
        });
        
        // Update total count
        $('#collectors-count').text(collectors.length);
    },
    
    // Set filters
    setFilters: function(filters) {
        this.filters = filters;
    },
    
    // Get filters
    getFilters: function() {
        return this.filters;
    },
    
    // Reset filters
    resetFilters: function() {
        this.filters = {};
        
        // Reset filter form if it exists
        if ($('#collectors-filter-form').length) {
            $('#collectors-filter-form')[0].reset();
        }
        
        // Apply filters (which will now show all)
        this.applyFilters();
        
        // Hide filter indicator
        $('#collectors-filter-indicator').addClass('hidden');
    },
    
    // Handle collectors updated event
    handleCollectorsUpdated: function(event) {
        // Reload collectors
        this.loadCollectors();
    },
    
    // Show success message
    showSuccessMessage: function(message) {
        // Create toast notification
        const toast = `
            <div id="success-toast" class="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center">
                <i class="fas fa-check-circle mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Remove existing toast if any
        $('#success-toast').remove();
        
        // Add to body
        $('body').append(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            $('#success-toast').fadeOut(300, function() {
                $(this).remove();
            });
        }, 3000);
    }
};

// Initialize when the DOM is loaded
$(document).ready(function() {
    CollectorManagement.init();
});
