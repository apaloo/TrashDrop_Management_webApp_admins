/**
 * TrashDrop Admin Dashboard - Pickup Management
 * Handles management of pickup requests, including creating, updating, and tracking
 */

const PickupManagement = {
    // Store pickup requests data
    requests: [],
    
    // Store current filters
    filters: {},
    
    // Pagination settings
    pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1
    },
    
    // Initialize the pickup management
    init: function() {
        console.log('Initializing Pickup Management');
        
        // Load pickup requests
        this.loadPickupRequests();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Listen for data changes
        document.addEventListener('pickup-requests-updated', this.handlePickupRequestsUpdated.bind(this));
        
        return this;
    },
    
    // Load pickup requests from DataService
    loadPickupRequests: function() {
        // Get pickup requests from DataService
        this.requests = DataService.getPickupRequests();
        
        // Apply filters and render
        this.applyFilters();
    },
    
    // Set up event listeners
    setupEventListeners: function() {
        // New pickup request button
        $('#new-pickup-btn').on('click', () => {
            PickupRequestService.showPickupRequestModal();
        });
        
        // View pickup details button (delegated)
        $('#pickup-requests-list').on('click', '.view-pickup-btn', (e) => {
            const requestId = $(e.currentTarget).data('id');
            this.viewPickupDetails(requestId);
        });
        
        // Cancel pickup button (delegated)
        $('#pickup-requests-list').on('click', '.cancel-pickup-btn', (e) => {
            const requestId = $(e.currentTarget).data('id');
            this.cancelPickupRequest(requestId);
        });
        
        // Complete pickup button (delegated)
        $('#pickup-requests-list').on('click', '.complete-pickup-btn', (e) => {
            const requestId = $(e.currentTarget).data('id');
            this.completePickupRequest(requestId);
        });
        
        // Assign pickup button (delegated)
        $('#pickup-requests-list').on('click', '.assign-pickup-btn', (e) => {
            const requestId = $(e.currentTarget).data('id');
            this.showAssignPickupModal(requestId);
        });
        
        // Save assignment button
        $('#save-assignment-btn').on('click', () => {
            this.savePickupAssignment();
        });
        
        // Pagination controls
        $('#pickup-prev-page').on('click', () => {
            if (this.pagination.currentPage > 1) {
                this.pagination.currentPage--;
                this.renderPickupRequests();
            }
        });
        
        $('#pickup-next-page').on('click', () => {
            if (this.pagination.currentPage < this.pagination.totalPages) {
                this.pagination.currentPage++;
                this.renderPickupRequests();
            }
        });
        
        // Reset filters button
        $('#reset-pickup-filters-btn').on('click', () => {
            this.resetFilters();
        });
    },
    
    // View pickup details
    viewPickupDetails: function(requestId) {
        // Find request
        const request = this.requests.find(r => r.id === requestId);
        
        if (request) {
            // Show details modal
            this.showPickupDetailsModal(request);
        }
    },
    
    // Show pickup details modal
    showPickupDetailsModal: function(request) {
        // Set request details
        $('#pickup-detail-id').text(request.id);
        $('#pickup-detail-date').text(request.pickupDate);
        $('#pickup-detail-time').text(request.pickupTime);
        $('#pickup-detail-address').text(request.location.address);
        $('#pickup-detail-waste-type').text(request.wasteType);
        $('#pickup-detail-waste-quantity').text(request.wasteQuantity);
        $('#pickup-detail-notes').text(request.notes || 'No notes provided');
        $('#pickup-detail-contact-name').text(request.contact.name);
        $('#pickup-detail-contact-phone').text(request.contact.phone || 'N/A');
        $('#pickup-detail-contact-email').text(request.contact.email || 'N/A');
        
        // Set status badge class
        const $statusBadge = $('#pickup-detail-status-badge');
        $statusBadge.removeClass('bg-green-100 bg-yellow-100 bg-red-100 bg-blue-100 bg-gray-100');
        $statusBadge.removeClass('text-green-800 text-yellow-800 text-red-800 text-blue-800 text-gray-800');
        
        switch (request.status) {
            case 'completed':
                $statusBadge.addClass('bg-green-100 text-green-800');
                break;
            case 'pending':
                $statusBadge.addClass('bg-yellow-100 text-yellow-800');
                break;
            case 'cancelled':
                $statusBadge.addClass('bg-red-100 text-red-800');
                break;
            case 'scheduled':
                $statusBadge.addClass('bg-blue-100 text-blue-800');
                break;
            case 'in-progress':
                $statusBadge.addClass('bg-blue-100 text-blue-800');
                break;
            default:
                $statusBadge.addClass('bg-gray-100 text-gray-800');
        }
        
        $statusBadge.text(request.status);
        
        // Set assigned collector
        if (request.assignedTo) {
            const collector = DataService.getCollectorById(request.assignedTo);
            $('#pickup-detail-assigned-to').text(collector ? collector.name : 'Unknown');
        } else {
            $('#pickup-detail-assigned-to').text('Not assigned');
        }
        
        // Clear timeline
        $('#pickup-detail-timeline').empty();
        
        // Add timeline entries
        if (request.timeline && request.timeline.length > 0) {
            request.timeline.forEach(entry => {
                const date = new Date(entry.timestamp);
                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                
                let statusClass = '';
                switch (entry.status) {
                    case 'created':
                        statusClass = 'bg-blue-100 text-blue-800';
                        break;
                    case 'scheduled':
                        statusClass = 'bg-yellow-100 text-yellow-800';
                        break;
                    case 'in-progress':
                        statusClass = 'bg-purple-100 text-purple-800';
                        break;
                    case 'completed':
                        statusClass = 'bg-green-100 text-green-800';
                        break;
                    case 'cancelled':
                        statusClass = 'bg-red-100 text-red-800';
                        break;
                    default:
                        statusClass = 'bg-gray-100 text-gray-800';
                }
                
                const timelineEntry = `
                    <div class="flex mb-4">
                        <div class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="ml-4 flex-grow">
                            <div class="flex justify-between">
                                <h4 class="text-sm font-medium">${formattedDate}</h4>
                                <span class="px-2 py-1 rounded-full text-xs ${statusClass}">
                                    ${entry.status}
                                </span>
                            </div>
                            <p class="text-sm text-gray-600 mt-1">${entry.note}</p>
                        </div>
                    </div>
                `;
                
                $('#pickup-detail-timeline').append(timelineEntry);
            });
        } else {
            $('#pickup-detail-timeline').append('<p class="text-gray-500">No timeline entries available</p>');
        }
        
        // Show modal
        $('#pickup-details-modal').removeClass('hidden');
    },
    
    // Hide pickup details modal
    hidePickupDetailsModal: function() {
        $('#pickup-details-modal').addClass('hidden');
    },
    
    // Cancel pickup request
    cancelPickupRequest: function(requestId) {
        // Confirm cancellation
        if (!confirm('Are you sure you want to cancel this pickup request?')) {
            return;
        }
        
        // Update request status
        DataService.updatePickupRequestStatus(requestId, 'cancelled', 'Pickup cancelled by administrator');
        
        // Reload pickup requests
        this.loadPickupRequests();
        
        // Show success message
        this.showSuccessMessage('Pickup request cancelled successfully');
    },
    
    // Complete pickup request
    completePickupRequest: function(requestId) {
        // Confirm completion
        if (!confirm('Are you sure you want to mark this pickup request as completed?')) {
            return;
        }
        
        // Update request status
        DataService.updatePickupRequestStatus(requestId, 'completed', 'Pickup completed by administrator');
        
        // Reload pickup requests
        this.loadPickupRequests();
        
        // Show success message
        this.showSuccessMessage('Pickup request completed successfully');
    },
    
    // Show assign pickup modal
    showAssignPickupModal: function(requestId) {
        // Find request
        const request = this.requests.find(r => r.id === requestId);
        
        if (request) {
            // Set request ID
            $('#assign-pickup-id').val(requestId);
            
            // Clear collector select
            $('#assign-collector').empty();
            
            // Add default option
            $('#assign-collector').append('<option value="">Select a collector</option>');
            
            // Get collectors
            const collectors = DataService.getCollectors();
            
            // Add active collectors
            const activeCollectors = collectors.filter(c => c.status === 'Active');
            
            if (activeCollectors.length > 0) {
                activeCollectors.forEach(collector => {
                    const selected = collector.id === request.assignedTo ? 'selected' : '';
                    $('#assign-collector').append(`<option value="${collector.id}" ${selected}>${collector.name}</option>`);
                });
            } else {
                $('#assign-collector').append('<option value="" disabled>No active collectors available</option>');
            }
            
            // Show modal
            $('#assign-pickup-modal').removeClass('hidden');
        }
    },
    
    // Hide assign pickup modal
    hideAssignPickupModal: function() {
        $('#assign-pickup-modal').addClass('hidden');
    },
    
    // Save pickup assignment
    savePickupAssignment: function() {
        // Get request ID and collector ID
        const requestId = $('#assign-pickup-id').val();
        const collectorId = $('#assign-collector').val();
        
        if (!requestId) {
            alert('Invalid request ID');
            return;
        }
        
        // Find request
        const request = this.requests.find(r => r.id === requestId);
        
        if (request) {
            // Update request
            request.assignedTo = collectorId || null;
            
            // Update status if not already scheduled or in progress
            if (request.status === 'pending') {
                request.status = 'scheduled';
                
                // Add timeline entry
                if (!request.timeline) {
                    request.timeline = [];
                }
                
                request.timeline.push({
                    status: 'scheduled',
                    timestamp: new Date().toISOString(),
                    note: collectorId ? `Pickup scheduled and assigned to collector` : 'Pickup scheduled'
                });
            } else {
                // Add timeline entry for assignment change
                if (!request.timeline) {
                    request.timeline = [];
                }
                
                request.timeline.push({
                    status: request.status,
                    timestamp: new Date().toISOString(),
                    note: collectorId ? `Assigned to collector` : 'Collector assignment removed'
                });
            }
            
            // Save request
            DataService.savePickupRequest(request);
            
            // Hide modal
            this.hideAssignPickupModal();
            
            // Reload pickup requests
            this.loadPickupRequests();
            
            // Show success message
            this.showSuccessMessage('Pickup request assignment updated successfully');
        }
    },
    
    // Apply filters to pickup requests
    applyFilters: function() {
        // Filter pickup requests
        const filteredRequests = this.getFilteredRequests();
        
        // Update pagination
        this.updatePagination(filteredRequests);
        
        // Render pickup requests
        this.renderPickupRequests(filteredRequests);
    },
    
    // Get filtered pickup requests
    getFilteredRequests: function() {
        // If no filters, return all requests
        if (!this.filters || Object.keys(this.filters).length === 0) {
            return this.requests;
        }
        
        // Filter requests
        return this.requests.filter(request => {
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
                        match = match && request.status === filterValue;
                        break;
                    case 'wasteType':
                        match = match && request.wasteType === filterValue;
                        break;
                    case 'assignedTo':
                        match = match && request.assignedTo === filterValue;
                        break;
                    case 'dateRange':
                        // Parse date range
                        if (filterValue.includes(' - ')) {
                            const [startDateStr, endDateStr] = filterValue.split(' - ');
                            const startDate = new Date(startDateStr);
                            const endDate = new Date(endDateStr);
                            endDate.setHours(23, 59, 59, 999); // End of day
                            
                            // Parse pickup date
                            const [month, day, year] = request.pickupDate.split('/');
                            const pickupDate = new Date(`${year}-${month}-${day}`);
                            
                            match = match && pickupDate >= startDate && pickupDate <= endDate;
                        }
                        break;
                    case 'search':
                        const searchValue = filterValue.toLowerCase();
                        const addressMatch = request.location.address.toLowerCase().includes(searchValue);
                        const contactMatch = request.contact.name.toLowerCase().includes(searchValue);
                        const wasteMatch = request.wasteType.toLowerCase().includes(searchValue);
                        match = match && (addressMatch || contactMatch || wasteMatch);
                        break;
                }
            });
            
            return match;
        });
    },
    
    // Update pagination
    updatePagination: function(filteredRequests) {
        const totalItems = filteredRequests.length;
        this.pagination.totalPages = Math.ceil(totalItems / this.pagination.itemsPerPage);
        
        // Adjust current page if needed
        if (this.pagination.currentPage > this.pagination.totalPages) {
            this.pagination.currentPage = Math.max(1, this.pagination.totalPages);
        }
        
        // Update pagination UI
        $('#pickup-current-page').text(this.pagination.currentPage);
        $('#pickup-total-pages').text(this.pagination.totalPages);
        
        // Update prev/next buttons
        $('#pickup-prev-page').prop('disabled', this.pagination.currentPage === 1);
        $('#pickup-next-page').prop('disabled', this.pagination.currentPage === this.pagination.totalPages);
    },
    
    // Render pickup requests
    renderPickupRequests: function(filteredRequests) {
        // Use filtered requests or all requests
        const requests = filteredRequests || this.getFilteredRequests();
        
        // Get current page items
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
        const endIndex = startIndex + this.pagination.itemsPerPage;
        const pageRequests = requests.slice(startIndex, endIndex);
        
        // Clear pickup requests list
        $('#pickup-requests-list').empty();
        
        // Show message if no requests
        if (requests.length === 0) {
            $('#pickup-requests-list').append(`
                <tr>
                    <td colspan="6" class="py-4 text-center text-gray-500">
                        No pickup requests found. Create a new request to get started.
                    </td>
                </tr>
            `);
            return;
        }
        
        // Show message if no requests after filtering
        if (pageRequests.length === 0) {
            $('#pickup-requests-list').append(`
                <tr>
                    <td colspan="6" class="py-4 text-center text-gray-500">
                        No pickup requests match the current filters.
                    </td>
                </tr>
            `);
            return;
        }
        
        // Add each request to the list
        pageRequests.forEach(request => {
            // Create status badge
            let statusBadgeClass = '';
            switch (request.status) {
                case 'completed':
                    statusBadgeClass = 'bg-green-100 text-green-800';
                    break;
                case 'pending':
                    statusBadgeClass = 'bg-yellow-100 text-yellow-800';
                    break;
                case 'cancelled':
                    statusBadgeClass = 'bg-red-100 text-red-800';
                    break;
                case 'scheduled':
                    statusBadgeClass = 'bg-blue-100 text-blue-800';
                    break;
                case 'in-progress':
                    statusBadgeClass = 'bg-purple-100 text-purple-800';
                    break;
                default:
                    statusBadgeClass = 'bg-gray-100 text-gray-800';
            }
            
            // Get assigned collector name
            let assignedToName = 'Not assigned';
            if (request.assignedTo) {
                const collector = DataService.getCollectorById(request.assignedTo);
                assignedToName = collector ? collector.name : 'Unknown';
            }
            
            const requestRow = `
                <tr class="border-b">
                    <td class="py-3 px-4">
                        <div class="font-medium">${request.pickupDate}</div>
                        <div class="text-sm text-gray-500">${request.pickupTime}</div>
                    </td>
                    <td class="py-3 px-4">
                        <div>${request.location.address}</div>
                    </td>
                    <td class="py-3 px-4">
                        <div>${request.wasteType}</div>
                        <div class="text-sm text-gray-500">${request.wasteQuantity}</div>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-1 rounded-full text-xs ${statusBadgeClass}">
                            ${request.status}
                        </span>
                    </td>
                    <td class="py-3 px-4">${assignedToName}</td>
                    <td class="py-3 px-4">
                        <div class="flex space-x-2">
                            <button class="view-pickup-btn text-blue-600 hover:text-blue-800" data-id="${request.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${request.status !== 'completed' && request.status !== 'cancelled' ? `
                                <button class="assign-pickup-btn text-purple-600 hover:text-purple-800" data-id="${request.id}">
                                    <i class="fas fa-user-plus"></i>
                                </button>
                                <button class="complete-pickup-btn text-green-600 hover:text-green-800" data-id="${request.id}">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="cancel-pickup-btn text-red-600 hover:text-red-800" data-id="${request.id}">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
            
            $('#pickup-requests-list').append(requestRow);
        });
        
        // Update total count
        $('#pickup-count').text(requests.length);
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
        if ($('#pickup-filter-form').length) {
            $('#pickup-filter-form')[0].reset();
        }
        
        // Apply filters (which will now show all)
        this.applyFilters();
        
        // Hide filter indicator
        $('#pickup-filter-indicator').addClass('hidden');
    },
    
    // Handle pickup requests updated event
    handlePickupRequestsUpdated: function(event) {
        // Reload pickup requests
        this.loadPickupRequests();
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
    PickupManagement.init();
});
