/**
 * TrashDrop Admin Dashboard - Request Service
 * Handles pickup request management functionality
 */

const RequestService = {
    requests: [],
    filteredRequests: [],
    currentFilters: {
        status: [],
        dateRange: 'today',
        searchTerm: '',
        sortBy: 'created',
        sortOrder: 'desc'
    },
    
    init: function() {
        // Load initial request data
        this.loadRequests();
        
        // Set up event listeners
        this.setupEventListeners();
    },
    
    loadRequests: function() {
        // In a real implementation, this would fetch data from the server
        // For now, we'll use the mock data from DataService
        this.requests = this.generateMockRequests();
        this.applyFilters();
    },
    
    generateMockRequests: function() {
        // Generate a larger set of mock requests for demonstration
        const baseRequests = DataService.getRecentRequests();
        const mockRequests = [...baseRequests];
        
        // Add more mock requests with variations
        const statuses = ['new', 'en-route', 'completed', 'issue'];
        const streets = ['Oak Avenue', 'Maple Drive', 'Pine Street', 'Cedar Lane', 'Elm Boulevard'];
        const customerNames = ['John Smith', 'Emily Johnson', 'Michael Brown', 'Jessica Williams', 'Robert Taylor', 'Sarah Davis', 'David Miller'];
        const collectorNames = ['Miguel R.', 'Sarah L.', 'David K.', 'Alex M.', 'Jennifer P.', 'Carlos S.'];
        
        // Generate additional requests
        for (let i = 0; i < 20; i++) {
            const requestId = 3850 - i;
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const streetNumber = Math.floor(Math.random() * 1000) + 100;
            const street = streets[Math.floor(Math.random() * streets.length)];
            const customerIndex = Math.floor(Math.random() * customerNames.length);
            const collectorIndex = Math.floor(Math.random() * collectorNames.length);
            
            // Calculate time (earlier than the base requests)
            const hoursAgo = Math.floor(Math.random() * 8) + 1;
            const minutesAgo = Math.floor(Math.random() * 60);
            const date = new Date();
            date.setHours(date.getHours() - hoursAgo);
            date.setMinutes(date.getMinutes() - minutesAgo);
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Calculate ETA
            let eta;
            if (status === 'completed') {
                eta = 'Completed';
            } else if (status === 'issue') {
                eta = 'Delayed';
            } else {
                const etaDate = new Date(date);
                etaDate.setMinutes(etaDate.getMinutes() + 30 + Math.floor(Math.random() * 30));
                eta = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            
            mockRequests.push({
                id: requestId.toString(),
                customer: {
                    name: customerNames[customerIndex],
                    avatar: '/api/placeholder/28/28'
                },
                address: `${streetNumber} ${street}`,
                collector: {
                    name: collectorNames[collectorIndex],
                    avatar: '/api/placeholder/28/28'
                },
                status: status,
                created: timeString,
                eta: eta,
                // Additional fields for detailed view
                wasteType: ['Household', 'Recycling', 'Yard Waste', 'Bulk Items'][Math.floor(Math.random() * 4)],
                priority: Math.random() < 0.2, // 20% chance of being priority
                notes: Math.random() < 0.3 ? 'Customer requested contactless pickup' : '',
                history: [
                    {
                        timestamp: timeString,
                        action: 'Request created',
                        user: 'System'
                    }
                ]
            });
            
            // Add status history for some requests
            if (status !== 'new') {
                const assignedDate = new Date(date);
                assignedDate.setMinutes(assignedDate.getMinutes() + 5);
                const assignedTime = assignedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                mockRequests[mockRequests.length - 1].history.push({
                    timestamp: assignedTime,
                    action: 'Assigned to collector',
                    user: 'Sarah Johnson'
                });
                
                if (status === 'en-route' || status === 'completed' || status === 'issue') {
                    const enRouteDate = new Date(assignedDate);
                    enRouteDate.setMinutes(enRouteDate.getMinutes() + 10);
                    const enRouteTime = enRouteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    mockRequests[mockRequests.length - 1].history.push({
                        timestamp: enRouteTime,
                        action: 'Collector en route',
                        user: collectorNames[collectorIndex]
                    });
                    
                    if (status === 'completed') {
                        const completedDate = new Date(enRouteDate);
                        completedDate.setMinutes(completedDate.getMinutes() + 20);
                        const completedTime = completedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        mockRequests[mockRequests.length - 1].history.push({
                            timestamp: completedTime,
                            action: 'Pickup completed',
                            user: collectorNames[collectorIndex]
                        });
                    } else if (status === 'issue') {
                        const issueDate = new Date(enRouteDate);
                        issueDate.setMinutes(issueDate.getMinutes() + 15);
                        const issueTime = issueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        mockRequests[mockRequests.length - 1].history.push({
                            timestamp: issueTime,
                            action: 'Issue reported: Access problem',
                            user: collectorNames[collectorIndex]
                        });
                    }
                }
            }
        }
        
        return mockRequests;
    },
    
    applyFilters: function() {
        let filtered = [...this.requests];
        
        // Apply status filter
        if (this.currentFilters.status.length > 0) {
            filtered = filtered.filter(request => 
                this.currentFilters.status.includes(request.status)
            );
        }
        
        // Apply search term
        if (this.currentFilters.searchTerm) {
            const searchTerm = this.currentFilters.searchTerm.toLowerCase();
            filtered = filtered.filter(request => 
                request.id.includes(searchTerm) ||
                request.customer.name.toLowerCase().includes(searchTerm) ||
                request.address.toLowerCase().includes(searchTerm) ||
                request.collector.name.toLowerCase().includes(searchTerm)
            );
        }
        
        // Apply date range filter
        // In a real implementation, this would filter based on actual dates
        // For now, we'll just simulate it
        
        // Apply sorting
        filtered.sort((a, b) => {
            let comparison = 0;
            
            switch (this.currentFilters.sortBy) {
                case 'id':
                    comparison = parseInt(a.id) - parseInt(b.id);
                    break;
                case 'customer':
                    comparison = a.customer.name.localeCompare(b.customer.name);
                    break;
                case 'address':
                    comparison = a.address.localeCompare(b.address);
                    break;
                case 'status':
                    comparison = a.status.localeCompare(b.status);
                    break;
                case 'created':
                    // Simple string comparison for our mock data
                    // In a real implementation, this would compare actual dates
                    comparison = a.created.localeCompare(b.created);
                    break;
                default:
                    comparison = parseInt(a.id) - parseInt(b.id);
            }
            
            // Apply sort order
            return this.currentFilters.sortOrder === 'asc' ? comparison : -comparison;
        });
        
        this.filteredRequests = filtered;
        
        // Update UI
        this.updateRequestsTable();
        
        // Update map if integrated
        if (window.MapService) {
            // Convert requests to map markers
            const markers = this.filteredRequests.map(request => ({
                position: this.getRandomPosition(), // In a real implementation, this would use actual coordinates
                type: request.status === 'en-route' ? 'en-route' : request.status,
                requestId: request.id,
                address: request.address,
                customer: request.customer.name,
                created: request.created
            }));
            
            window.MapService.loadMarkers(markers);
        }
        
        return filtered;
    },
    
    getRandomPosition: function() {
        // Generate a random position near New York for demonstration
        // In a real implementation, this would use actual coordinates from the data
        return {
            lat: 40.7128 + (Math.random() - 0.5) * 0.05,
            lng: -74.0060 + (Math.random() - 0.5) * 0.05
        };
    },
    
    updateRequestsTable: function() {
        const tableBody = document.getElementById('recent-requests-table-body');
        if (!tableBody) {
            console.error('Requests table body not found');
            return;
        }
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Add new rows
        this.filteredRequests.forEach(request => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-100 hover:bg-gray-50';
            row.setAttribute('data-request-id', request.id);
            
            // Status class mapping
            const statusClasses = {
                'new': 'status-pill new',
                'en-route': 'status-pill route',
                'completed': 'status-pill completed',
                'issue': 'status-pill issue'
            };
            
            // Format status text
            const statusText = {
                'new': 'New',
                'en-route': 'En Route',
                'completed': 'Completed',
                'issue': 'Issue'
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
                <td class="px-4 py-3"><span class="${statusClasses[request.status] || ''}">${statusText[request.status] || request.status}</span></td>
                <td class="px-4 py-3 text-sm">${request.created}</td>
                <td class="px-4 py-3 text-sm">${request.eta}</td>
                <td class="px-4 py-3 text-center">
                    <button class="text-gray-500 hover:text-blue-600 mx-1 view-request-btn" data-request-id="${request.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="text-gray-500 hover:text-green-600 mx-1 edit-request-btn" data-request-id="${request.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners to the new buttons
        this.addTableRowEventListeners();
    },
    
    addTableRowEventListeners: function() {
        // Add event listeners to view buttons
        const viewButtons = document.querySelectorAll('.view-request-btn');
        viewButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const requestId = button.getAttribute('data-request-id');
                this.viewRequestDetails(requestId);
            });
        });
        
        // Add event listeners to edit buttons
        const editButtons = document.querySelectorAll('.edit-request-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const requestId = button.getAttribute('data-request-id');
                this.editRequest(requestId);
            });
        });
        
        // Add event listeners to table rows
        const tableRows = document.querySelectorAll('#recent-requests-table-body tr');
        tableRows.forEach(row => {
            row.addEventListener('click', (e) => {
                // Only trigger if the click wasn't on a button
                if (!e.target.closest('button')) {
                    const requestId = row.getAttribute('data-request-id');
                    this.viewRequestDetails(requestId);
                }
            });
        });
    },
    
    viewRequestDetails: function(requestId) {
        console.log(`Viewing details for request #${requestId}`);
        
        // Find the request
        const request = this.requests.find(r => r.id === requestId);
        if (!request) {
            console.error(`Request #${requestId} not found`);
            return;
        }
        
        // In a full implementation, this would open a modal with request details
        // For now, we'll log the details to the console
        console.log('Request details:', request);
        
        // Show a simple alert for demonstration
        alert(`Request #${requestId} details:\nCustomer: ${request.customer.name}\nAddress: ${request.address}\nStatus: ${request.status}\nCreated: ${request.created}\nETA: ${request.eta}`);
    },
    
    editRequest: function(requestId) {
        console.log(`Editing request #${requestId}`);
        
        // Find the request
        const request = this.requests.find(r => r.id === requestId);
        if (!request) {
            console.error(`Request #${requestId} not found`);
            return;
        }
        
        // In a full implementation, this would open a modal for editing
        // For now, we'll log the request to the console
        console.log('Request to edit:', request);
        
        // Show a simple alert for demonstration
        alert(`Editing request #${requestId} (${request.customer.name})`);
    },
    
    createNewRequest: function() {
        console.log('Creating new request');
        
        // In a full implementation, this would open a modal for creating a new request
        // For now, we'll just log to the console
        console.log('New request form would open here');
        
        // Show a simple alert for demonstration
        alert('Creating new pickup request');
    },
    
    setupEventListeners: function() {
        // Set up event listeners for filters and actions
        
        // Date range selector
        const dateRangeSelector = document.getElementById('date-range-selector');
        if (dateRangeSelector) {
            dateRangeSelector.addEventListener('change', (e) => {
                this.currentFilters.dateRange = e.target.value;
                this.applyFilters();
            });
        }
        
        // New request button
        const newRequestButton = document.querySelector('button:has(i.fa-plus)');
        if (newRequestButton) {
            newRequestButton.addEventListener('click', () => {
                this.createNewRequest();
            });
        }
        
        // Search input (if exists)
        const searchInput = document.querySelector('input[type="text"][placeholder="Search..."]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilters.searchTerm = e.target.value;
                this.applyFilters();
            });
        }
        
        // Table header sorting (if implemented)
        const tableHeaders = document.querySelectorAll('th[data-sort]');
        tableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const sortField = header.getAttribute('data-sort');
                
                // Toggle sort order if clicking the same field
                if (this.currentFilters.sortBy === sortField) {
                    this.currentFilters.sortOrder = this.currentFilters.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.currentFilters.sortBy = sortField;
                    this.currentFilters.sortOrder = 'asc';
                }
                
                this.applyFilters();
                
                // Update sort indicators
                this.updateSortIndicators();
            });
        });
    },
    
    updateSortIndicators: function() {
        // Update sort indicators in table headers
        const tableHeaders = document.querySelectorAll('th[data-sort]');
        tableHeaders.forEach(header => {
            // Remove existing indicators
            header.classList.remove('sorting-asc', 'sorting-desc');
            
            const sortField = header.getAttribute('data-sort');
            if (this.currentFilters.sortBy === sortField) {
                header.classList.add(this.currentFilters.sortOrder === 'asc' ? 'sorting-asc' : 'sorting-desc');
            }
        });
    }
};

// Export for use in other scripts
window.RequestService = RequestService;
