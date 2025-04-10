/**
 * TrashDrop Admin Dashboard - Map Service
 * Handles map functionality and request visualization
 */

const MapService = {
    map: null,
    liveMap: null,
    liveMapInitialized: false,
    markers: {},
    collectors: {},
    activeInfoWindow: null,
    
    init: function(containerId, options = {}) {
        try {
            // Check if container exists
            const mapContainer = document.getElementById(containerId);
            if (!mapContainer) {
                console.warn(`Map container with ID '${containerId}' not found. Skipping map initialization.`);
                return;
            }
            
            // Check if Leaflet is available
            if (typeof L === 'undefined') {
                console.warn('Leaflet library not found. Loading placeholder map instead.');
                this.loadPlaceholderMap(containerId);
                return;
            }
            
            // Initialize map with default options
            const defaultOptions = {
                center: [40.7128, -74.0060], // New York by default
                zoom: 12
            };
            
            const mapOptions = { ...defaultOptions, ...options };
            
            // Initialize OpenStreetMap based on container ID
            if (containerId === 'live-map-container') {
                this.initializeLiveMap(containerId, mapOptions);
                console.log('Initializing Live Map with OpenStreetMap.');
            } else {
                this.initializePlaceholderMap(containerId, mapOptions);
                console.log('Initializing Dashboard Map with OpenStreetMap.');
            }
        } catch (error) {
            console.error('Error initializing map:', error);
            this.loadPlaceholderMap(containerId);
        }
    }
    },
    
    initializeMap: function(containerId, options) {
        try {
            const mapContainer = document.getElementById(containerId);
            if (!mapContainer) {
                console.error(`Map container with ID '${containerId}' not found.`);
                return;
            }
            
            // Use Leaflet instead of Google Maps
            this.map = L.map(containerId, {
                center: options.center,
                zoom: options.zoom,
                zoomControl: false // We'll add custom zoom controls
            });
            
            // Add OpenStreetMap tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);
            
            // Add map controls
            this.addCustomControls();
            
            // Set up event listeners
            this.setupEventListeners();
            
            return this.map;
        } catch (error) {
            console.error('Error initializing map with Leaflet:', error);
            this.loadPlaceholderMap(containerId);
            return null;
        }
    },
    
    initializePlaceholderMap: function(containerId, options) {
        try {
            const mapContainer = document.getElementById(containerId);
        if (!mapContainer) {
            console.error(`Map container with ID '${containerId}' not found.`);
            return;
        }
        
        // Make sure the container is empty
        mapContainer.innerHTML = '';
        
        // Initialize OpenStreetMap
        try {
            this.map = L.map(mapContainer).setView([options.center.lat, options.center.lng], options.zoom);
            
            // Add OpenStreetMap tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19
            }).addTo(this.map);
            
            console.log('Dashboard Map initialized successfully');
            
            // Add sample markers for demonstration
            this.addSampleMarkers();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Force a resize event to ensure the map renders correctly
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
                this.map.invalidateSize();
            }, 100);
        } catch (error) {
            console.error('Error initializing map:', error);
            // Fallback to a simple colored div if map fails to load
            mapContainer.innerHTML = `
                <div style="width:100%;height:100%;background-color:#e5e7eb;display:flex;align-items:center;justify-content:center;">
                    <div style="text-align:center;">
                        <i class="fas fa-map-marker-alt" style="font-size:48px;color:#4b5563;margin-bottom:10px;"></i>
                        <p>Map loading error. Please check console for details.</p>
                    </div>
                </div>
            `;
        }
        } catch (error) {
            console.error('Error initializing placeholder map:', error);
            this.loadPlaceholderMap(containerId);
        }
    },
    
    loadPlaceholderMap: function(containerId) {
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer) return;
        
        // Create a simple placeholder with a background image or message
        mapContainer.innerHTML = `
            <div class="flex items-center justify-center h-full bg-gray-100 rounded-lg">
                <div class="text-center p-6">
                    <div class="text-blue-600 mb-2">
                        <i class="fas fa-map-marked-alt text-4xl"></i>
                    </div>
                    <h4 class="font-medium text-gray-700">Map Unavailable</h4>
                    <p class="text-sm text-gray-500 mt-1">The map could not be loaded at this time.</p>
                    <button class="mt-3 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm" onclick="MapService.retryLoadMap('${containerId}')">
                        <i class="fas fa-sync-alt mr-2"></i>Retry
                    </button>
                </div>
            </div>
        `;
    },
    
    retryLoadMap: function(containerId) {
        console.log('Retrying map initialization for', containerId);
        this.init(containerId);
    },
    
    initializeLiveMap: function(containerId, options) {
        try {
            const mapContainer = document.getElementById(containerId);
            if (!mapContainer) {
                console.error(`Live map container with ID '${containerId}' not found.`);
                return;
            }
            
            // Make sure the container is empty and has height
            if (mapContainer.style.height === '') {
                mapContainer.style.height = '400px';
            }
            
            // Initialize OpenStreetMap for the live map
            try {
                // Check if Leaflet is available
                if (typeof L === 'undefined') {
                    throw new Error('Leaflet library not available');
                }
                
                // Initialize the map with the container ID directly
                this.liveMap = L.map(containerId).setView([40.7128, -74.0060], 12);
                this.liveMapInitialized = true;
                
                // Add OpenStreetMap tile layer
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19
                }).addTo(this.liveMap);
                
                console.log('Live Map initialized successfully');
                
                // Add more detailed sample markers for the live map
                setTimeout(() => {
                    this.addLiveMapMarkers();
                }, 500);
                
                // Set up event listeners specific to the live map
            this.setupLiveMapEventListeners();
                
                // Force a resize event to ensure the map renders correctly
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                    if (this.liveMap) {
                        this.liveMap.invalidateSize();
                    }
                }, 100);
            } catch (error) {
                console.error('Error initializing live map with Leaflet:', error);
                // Fallback to a simple placeholder
                this.loadPlaceholderMap(containerId);
            }
        } catch (error) {
            console.error('Error in initializeLiveMap:', error);
            this.loadPlaceholderMap(containerId);
        }
    },
    
    showSampleInfoWindow: function() {
        const infoWindow = document.getElementById('map-info-window');
        if (infoWindow) {
            infoWindow.classList.remove('hidden');
        }
    },
    
    loadMarkers: function(markers) {
        // Clear existing markers
        this.clearMarkers();
        
        // Add new markers
        markers.forEach(marker => {
            this.addMarker(marker);
        });
        
        // Update marker counts in the legend
        this.updateMarkerCounts(markers);
    },
    
    addMarker: function(markerData) {
        if (this.map && typeof L !== 'undefined') {
            // Create marker icon based on type
            const iconUrl = this.getMarkerIconUrl(markerData.type);
            const icon = L.icon({
                iconUrl: iconUrl,
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34]
            });
            
            // Create Leaflet marker
            const marker = L.marker([markerData.position.lat, markerData.position.lng], {
                icon: icon,
                title: `Request #${markerData.requestId}`
            }).addTo(this.map);
            
            // Add popup with info
            marker.bindPopup(this.createPopupContent(markerData));
            
            // Store marker reference
            this.markers[markerData.requestId] = marker;
        } else {
            // For simulation, just update the counts
            console.log(`Added marker for request #${markerData.requestId} of type ${markerData.type}`);
        }
    },
    
    loadCollectors: function(collectors) {
        // Clear existing collector markers
        this.clearCollectors();
        
        // Add new collector markers
        collectors.forEach(collector => {
            this.addCollector(collector);
        });
    },
    
    addCollector: function(collectorData) {
        if (this.map && typeof L !== 'undefined') {
            // Create marker icon based on collector status
            const iconUrl = this.getCollectorIconUrl(collectorData.status, collectorData.vehicle);
            const icon = L.icon({
                iconUrl: iconUrl,
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34]
            });
            
            // Create Leaflet marker
            const marker = L.marker([collectorData.position.lat, collectorData.position.lng], {
                icon: icon,
                title: `Collector: ${collectorData.name}`
            }).addTo(this.map);
            
            // Add popup with collector info
            marker.bindPopup(this.createCollectorPopupContent(collectorData));
            
            // Store collector marker reference
            this.collectors[collectorData.id] = marker;
        } else {
            // For simulation
            console.log(`Added collector marker for ${collectorData.name}`);
        }
    },
    
    createPopupContent: function(markerData) {
        // Create popup content
        return `
            <div class="p-3">
                <span class="status-pill ${markerData.type}">${this.getStatusText(markerData.type)}</span>
                <h4 class="font-medium mt-2">Request #${markerData.requestId}</h4>
                <p class="text-sm text-gray-500">${markerData.address}</p>
                <div class="mt-3 flex items-center">
                    <i class="fas fa-user-circle text-gray-500 mr-2"></i>
                    <span class="text-sm">${markerData.customer}</span>
                </div>
                <div class="mt-2 flex justify-between text-xs text-gray-500">
                    <span>Created: ${markerData.created}</span>
                </div>
                <div class="mt-3 flex">
                    <button class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md mr-2 view-request-btn" data-request-id="${markerData.requestId}">View Details</button>
                    <button class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-md assign-collector-btn" data-request-id="${markerData.requestId}">Assign Collector</button>
                </div>
            </div>
        `;
    },
    
    createCollectorPopupContent: function(collectorData) {
        // Create collector popup content
        return `
            <div class="p-3">
                <div class="flex items-center">
                    <i class="fas fa-user-circle text-gray-500 mr-2"></i>
                    <span class="font-medium">Collector: ${collectorData.name}</span>
                </div>
                <div class="mt-2 flex items-center">
                    <span class="status-pill ${collectorData.status}">${this.getCollectorStatusText(collectorData.status)}</span>
                </div>
                <p class="text-sm text-gray-500 mt-2">${collectorData.vehicle || 'Standard Vehicle'}</p>
                <div class="mt-2 flex justify-between text-xs text-gray-500">
                    <span>Pickups Today: ${collectorData.pickupsToday || 0}</span>
                </div>
                <div class="mt-3 flex">
                    <button class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md mr-2 view-collector-btn" data-collector-id="${collectorData.id}">View Details</button>
                    <button class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-md contact-collector-btn" data-collector-id="${collectorData.id}">Contact</button>
                </div>
            </div>
        `;
    }
    },
    
    addSampleMarkers: function() {
        // Add some sample markers for demonstration
        const sampleRequests = [
            {
                requestId: 3801,
                type: 'new',
                position: { lat: 40.7128, lng: -74.0060 },
                address: '123 Broadway, New York, NY',
                customer: 'John Smith',
                created: '2 hours ago'
            },
            {
                requestId: 3802,
                type: 'assigned',
                position: { lat: 40.7200, lng: -74.0100 },
                address: '456 5th Ave, New York, NY',
                customer: 'Jane Doe',
                created: '3 hours ago'
            },
            {
                requestId: 3803,
                type: 'in-progress',
                position: { lat: 40.7050, lng: -74.0150 },
                address: '789 Wall St, New York, NY',
                customer: 'Robert Johnson',
                created: '5 hours ago'
            },
            {
                requestId: 3804,
                type: 'completed',
                position: { lat: 40.7300, lng: -73.9950 },
                address: '321 Park Ave, New York, NY',
                customer: 'Emily Wilson',
                created: '1 day ago'
            }
        ];
        
        // Add sample collectors
        const sampleCollectors = [
            {
                id: 1,
                name: 'Miguel Rodriguez',
                status: 'active',
                vehicle: 'Truck #103',
                position: { lat: 40.7150, lng: -74.0080 },
                pickupsToday: 8
            },
            {
                id: 2,
                name: 'Sarah Johnson',
                status: 'idle',
                vehicle: 'Van #205',
                position: { lat: 40.7220, lng: -74.0020 },
                pickupsToday: 5
            },
            {
                id: 3,
                name: 'David Kim',
                status: 'offline',
                vehicle: 'Truck #118',
                position: { lat: 40.7080, lng: -73.9900 },
                pickupsToday: 12
            }
        ];
        
        // Add the markers
        sampleRequests.forEach(request => this.addMarker(request));
        sampleCollectors.forEach(collector => this.addCollector(collector));
    },
    
    addLiveMapMarkers: function() {
        try {
            // Check if live map is initialized
            if (!this.liveMap) {
                console.error('Cannot add markers: Live map not initialized');
                return;
            }
            
            // Add more detailed sample markers for the live map view
            const liveMapRequests = [
            {
                requestId: 3801,
                type: 'new',
                position: { lat: 40.7128, lng: -74.0060 },
                address: '123 Broadway, New York, NY',
                customer: 'John Smith',
                created: '2 hours ago'
            },
            {
                requestId: 3802,
                type: 'route',
                position: { lat: 40.7200, lng: -74.0100 },
                address: '456 5th Ave, New York, NY',
                customer: 'Jane Doe',
                created: '3 hours ago'
            },
            {
                requestId: 3803,
                type: 'route',
                position: { lat: 40.7050, lng: -74.0150 },
                address: '789 Wall St, New York, NY',
                customer: 'Robert Johnson',
                created: '5 hours ago'
            },
            {
                requestId: 3804,
                type: 'completed',
                position: { lat: 40.7300, lng: -73.9950 },
                address: '321 Park Ave, New York, NY',
                customer: 'Emily Wilson',
                created: '1 day ago'
            },
            {
                requestId: 3805,
                type: 'new',
                position: { lat: 40.7180, lng: -74.0000 },
                address: '555 Madison Ave, New York, NY',
                customer: 'Michael Brown',
                created: '1 hour ago'
            },
            {
                requestId: 3806,
                type: 'issue',
                position: { lat: 40.7250, lng: -74.0050 },
                address: '888 Lexington Ave, New York, NY',
                customer: 'Lisa Garcia',
                created: '4 hours ago'
            },
            {
                requestId: 3807,
                type: 'priority',
                position: { lat: 40.7100, lng: -74.0120 },
                address: '777 7th Ave, New York, NY',
                customer: 'David Williams',
                created: '30 minutes ago'
            }
        ];
        
        // Add sample collectors for the live map
        const liveMapCollectors = [
            {
                id: 1,
                name: 'Miguel Rodriguez',
                status: 'active',
                vehicle: 'Truck #103',
                position: { lat: 40.7150, lng: -74.0080 },
                pickupsToday: 8,
                assignedRequest: 3802
            },
            {
                id: 2,
                name: 'Sarah Johnson',
                status: 'idle',
                vehicle: 'Van #205',
                position: { lat: 40.7220, lng: -74.0020 },
                pickupsToday: 5,
                assignedRequest: null
            },
            {
                id: 3,
                name: 'David Kim',
                status: 'offline',
                vehicle: 'Truck #118',
                position: { lat: 40.7080, lng: -73.9900 },
                pickupsToday: 12,
                assignedRequest: null
            },
            {
                id: 4,
                name: 'Jessica Martinez',
                status: 'active',
                vehicle: 'Van #210',
                position: { lat: 40.7060, lng: -74.0140 },
                pickupsToday: 6,
                assignedRequest: 3803
            },
            {
                id: 5,
                name: 'Thomas Wilson',
                status: 'active',
                vehicle: 'Truck #105',
                position: { lat: 40.7260, lng: -74.0040 },
                pickupsToday: 9,
                assignedRequest: null
            }
        ];
        
        // Add the markers to the live map
        if (this.liveMap) {
            liveMapRequests.forEach(request => {
                this.addMarkerToLiveMap(request);
            });
            
            liveMapCollectors.forEach(collector => {
                this.addCollectorToLiveMap(collector);
            });
            
            // Update the marker counts in the live map legend
            this.updateLiveMapMarkerCounts(liveMapRequests);
        }
    },
    
    addMarkerToLiveMap: function(markerData) {
        try {
            if (this.liveMap && typeof L !== 'undefined') {
                // Create marker icon based on type
                const iconUrl = this.getMarkerIconUrl(markerData.type);
                const icon = L.icon({
                iconUrl: iconUrl,
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34]
            });
            
            // Create Leaflet marker
            const marker = L.marker([markerData.position.lat, markerData.position.lng], {
                icon: icon,
                title: `Request #${markerData.requestId}`
            }).addTo(this.liveMap);
            
            // Add popup with info
            marker.bindPopup(this.createPopupContent(markerData));
        }
    },
    
    addCollectorToLiveMap: function(collectorData) {
        if (this.liveMap && typeof L !== 'undefined') {
            // Create marker icon based on collector status
            const iconUrl = this.getCollectorIconUrl(collectorData.status, collectorData.vehicle);
            const icon = L.icon({
                iconUrl: iconUrl,
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34]
            });
            
            // Create Leaflet marker
            const marker = L.marker([collectorData.position.lat, collectorData.position.lng], {
                icon: icon,
                title: `Collector: ${collectorData.name}`
            }).addTo(this.liveMap);
            
            // Add popup with collector info
            marker.bindPopup(this.createCollectorPopupContent(collectorData));
        }
    },
    
    updateLiveMapMarkerCounts: function(markers) {
        // Count markers by type
        const counts = {
            new: 0,
            route: 0,
            completed: 0,
            issue: 0,
            priority: 0
        };
        
        // Count markers by type
        markers.forEach(marker => {
            counts[marker.type] = (counts[marker.type] || 0) + 1;
        });
        
        // Update the UI for the live map
        document.getElementById('live-new-marker-count').textContent = counts.new;
        document.getElementById('live-en-route-marker-count').textContent = counts.route;
        document.getElementById('live-completed-marker-count').textContent = counts.completed;
        document.getElementById('live-issue-marker-count').textContent = counts.issue;
    },
    
    setupLiveMapEventListeners: function() {
        // Set up event listeners specific to the live map
        const refreshButton = document.querySelector('#live-map-section button');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                // Refresh the live map data
                this.refreshLiveMap();
            });
        }
    },
    
    refreshLiveMap: function() {
        // This would typically fetch new data from the server
        // For now, we'll just update the last updated timestamp
        const lastUpdatedElement = document.getElementById('map-last-updated');
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = 'Just now';
        }
        
        // For demonstration, we'll just log a message
        console.log('Live map refreshed at', new Date().toLocaleTimeString());
    },
                    <div class="mt-2 flex items-center">
                        <span class="status-pill ${collectorData.status}">${this.getCollectorStatusText(collectorData.status)}</span>
                        <span class="text-xs text-gray-500 ml-2">ID: ${collectorData.id}</span>
                    </div>
                    <div class="mt-2 text-sm">
                        <p>Speed: ${collectorData.speed} mph</p>
                        <p>Assigned Request: ${collectorData.assignedRequest ? '#' + collectorData.assignedRequest : 'None'}</p>
                    </div>
                    <div class="mt-3 flex">
                        <button class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md mr-2">View Profile</button>
                        <button class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-md">Contact</button>
                    </div>
                </div>
            `;
            
            // Create and open info window
            const infoWindow = new google.maps.InfoWindow({
                content: content,
                maxWidth: 300
            });
            
            infoWindow.open(this.map, marker);
            this.activeInfoWindow = infoWindow;
        } else {
            // For simulation, show the sample info window
            this.showSampleInfoWindow();
        }
    },
    
    clearMarkers: function() {
        // Clear all request markers
        if (this.map) {
            Object.values(this.markers).forEach(marker => {
                this.map.removeLayer(marker);
            });
        }
        this.markers = {};
    },
    
    clearCollectors: function() {
        // Clear all collector markers
        if (this.map) {
            Object.values(this.collectors).forEach(marker => {
                this.map.removeLayer(marker);
            });
        }
        this.collectors = {};
    },
    
    updateMarkerCounts: function(markers) {
        // Update marker counts in the legend
        const counts = {
            new: 0,
            'en-route': 0,
            completed: 0,
            issue: 0,
            priority: 0
        };
        
        // Count markers by type
        markers.forEach(marker => {
            counts[marker.type] = (counts[marker.type] || 0) + 1;
        });
        
        // Update the UI
        document.getElementById('new-marker-count').textContent = counts.new;
        document.getElementById('en-route-marker-count').textContent = counts['en-route'];
        document.getElementById('completed-marker-count').textContent = counts.completed;
        document.getElementById('issue-marker-count').textContent = counts.issue;
        document.getElementById('priority-marker-count').textContent = counts.priority;
    },
    
    addCustomControls: function() {
        // This would add custom controls to the Google Map
        // For our simulation, we'll use the existing HTML controls
    },
    
    setupEventListeners: function() {
        // Set up event listeners for map controls
        const mapFilterButtons = document.querySelectorAll('.map-filter-btn');
        mapFilterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const filterType = button.getAttribute('data-filter');
                this.handleMapControl(filterType);
            });
        });
        
        // Close info window button
        const closeInfoButton = document.querySelector('#map-info-window .close-info');
        if (closeInfoButton) {
            closeInfoButton.addEventListener('click', () => {
                const infoWindow = document.getElementById('map-info-window');
                if (infoWindow) {
                    infoWindow.classList.add('hidden');
                }
            });
        }
    },
    
    handleMapControl: function(controlType) {
        console.log(`Map control clicked: ${controlType}`);
        
        switch (controlType) {
            case 'zoom-in':
                if (this.map) {
                    this.map.zoomIn();
                }
                break;
                
            case 'zoom-out':
                if (this.map) {
                    this.map.zoomOut();
                }
                break;
                
            case 'layers':
                // Toggle map layers (would show a layer selector in a real implementation)
                console.log('Layer selection would show here');
                break;
                
            case 'location':
                // Center map on user's location
                this.centerOnUserLocation();
                break;
                
            case 'filter':
                // Show filter options
                console.log('Filter options would show here');
                break;
        }
    },
    
    centerOnUserLocation: function() {
        if (navigator.geolocation && this.map) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    this.map.setCenter(userLocation);
                    
                    // Add a marker for user's location
                    new google.maps.Marker({
                        position: userLocation,
                        map: this.map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: '#4285F4',
                            fillOpacity: 0.8,
                            strokeColor: 'white',
                            strokeWeight: 2
                        },
                        title: 'Your Location'
                    });
                },
                () => {
                    console.error('Error getting user location');
                }
            );
        } else {
            console.error('Geolocation not supported by this browser');
        }
    },
    
    getMarkerIcon: function(type) {
        // In a real implementation, this would return custom marker icons
        // For simulation, we'll return null to use default markers
        return null;
    },
    
    handleMapControl: function(controlType) {
        console.log('Handling map control:', controlType);
        
        try {
            // Determine which map to use (dashboard or live)
            const isLiveMapActive = document.getElementById('live-map-section') && 
                                   document.getElementById('live-map-section').classList.contains('active');
            
            const targetMap = this.liveMapInitialized && isLiveMapActive ? this.liveMap : this.map;
                
            if (!targetMap) {
                console.error('No active map found');
                return;
            }
            
            // Handle different control types
            switch(controlType) {
                case 'zoom-in':
                    targetMap.setZoom(targetMap.getZoom() + 1);
                    break;
                    
                case 'zoom-out':
                    targetMap.setZoom(targetMap.getZoom() - 1);
                    break;
                
            case 'layers':
                // Toggle map layers panel
                alert('Map layers functionality coming soon!');
                break;
                
            case 'location':
                // Center map on user's location
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function(position) {
                        const userLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        targetMap.setView([userLocation.lat, userLocation.lng], 14);
                    }, function(error) {
                        console.error('Error getting location:', error);
                        alert('Unable to get your location. Please check your browser permissions.');
                    });
                } else {
                    alert('Geolocation is not supported by your browser.');
                }
                break;
                
            default:
                console.warn('Unknown map control type:', controlType);
        }
    },
    
    refreshLiveMap: function() {
        console.log('Refreshing live map...');
        
        try {
            // Clear existing markers
            if (this.liveMap) {
                // Remove existing markers
                Object.values(this.markers).forEach(marker => {
                    if (this.liveMap.hasLayer(marker)) {
                        this.liveMap.removeLayer(marker);
                    }
                });
                
                // Add new markers with updated data
                this.addLiveMapMarkers();
                
                console.log('Live map refreshed with new data');
            } else {
                console.error('Live map not initialized');
                // Try to initialize the map if it's not already
                if (document.getElementById('live-map-container')) {
                    this.initializeLiveMap('live-map-container');
                }
            }
        } catch (error) {
            console.error('Error refreshing live map:', error);
        }
    },
    
    getCollectorIcon: function(status, vehicle) {
        // In a real implementation, this would return custom collector icons
        // For simulation, we'll return null to use default markers
        return null;
    },
    
    getStatusText: function(type) {
        const statusMap = {
            'new': 'New',
            'en-route': 'En Route',
            'completed': 'Completed',
            'issue': 'Issue',
            'priority': 'Priority'
        };
        
        return statusMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
    },
    
    getCollectorStatusText: function(status) {
        const statusMap = {
            'active': 'Active',
            'idle': 'Idle',
            'offline': 'Offline'
        };
        
        return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
    },
    
    getMapStyles: function() {
        // Custom map styles for a cleaner look
        // This would be used with the actual Google Maps implementation
        return [
            {
                "featureType": "administrative",
                "elementType": "labels.text.fill",
                "stylers": [{"color": "#444444"}]
            },
            {
                "featureType": "landscape",
                "elementType": "all",
                "stylers": [{"color": "#f2f2f2"}]
            },
            {
                "featureType": "poi",
                "elementType": "all",
                "stylers": [{"visibility": "off"}]
            },
            {
                "featureType": "road",
                "elementType": "all",
                "stylers": [{"saturation": -100}, {"lightness": 45}]
            },
            {
                "featureType": "road.highway",
                "elementType": "all",
                "stylers": [{"visibility": "simplified"}]
            },
            {
                "featureType": "road.arterial",
                "elementType": "labels.icon",
                "stylers": [{"visibility": "off"}]
            },
            {
                "featureType": "transit",
                "elementType": "all",
                "stylers": [{"visibility": "off"}]
            },
            {
                "featureType": "water",
                "elementType": "all",
                "stylers": [{"color": "#c4e5f9"}, {"visibility": "on"}]
            }
        ];
    }
};

// Export for use in other scripts
window.MapService = MapService;
