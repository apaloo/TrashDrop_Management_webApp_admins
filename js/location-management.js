/**
 * TrashDrop Admin Dashboard - Location Management
 * Handles user saved locations, including adding, editing, and deleting locations
 */

const LocationManagement = {
    // Initialize the location management
    init: function() {
        console.log('Initializing Location Management');
        
        // Load saved locations
        this.loadSavedLocations();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Listen for user settings changes
        document.addEventListener('user-settings-updated', this.handleUserSettingsUpdated.bind(this));
    },
    
    // Load saved locations from user settings
    loadSavedLocations: function() {
        // Get user settings from DataService
        const userSettings = DataService.getUserSettings();
        const savedLocations = userSettings.locations || [];
        
        // Clear existing locations
        $('#saved-locations-list').empty();
        
        // Add each location to the list
        if (savedLocations.length === 0) {
            $('#saved-locations-list').append(`
                <div class="text-center py-4 text-gray-500">
                    <p>No saved locations. Add a location to get started.</p>
                </div>
            `);
        } else {
            savedLocations.forEach((location, index) => {
                this.addLocationToList(location, index);
            });
        }
    },
    
    // Add a location to the list
    addLocationToList: function(location, index) {
        const isDefault = location.isDefault ? 'bg-blue-50 border-blue-200' : '';
        const defaultBadge = location.isDefault ? '<span class="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Default</span>' : '';
        const typeIcon = this.getLocationTypeIcon(location.type);
        
        const locationItem = `
            <div class="location-item mb-3 p-3 border ${isDefault} rounded-lg" data-index="${index}">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-medium flex items-center">
                            ${typeIcon}
                            ${location.name} ${defaultBadge}
                        </div>
                        <div class="text-sm text-gray-600 mt-1">${location.address}</div>
                        <div class="text-xs text-gray-500 mt-1">Type: ${this.formatLocationType(location.type)}</div>
                    </div>
                    <div class="flex space-x-2">
                        ${!location.isDefault ? `<button class="set-default-btn text-xs px-2 py-1 text-blue-600 hover:text-blue-800" data-index="${index}">Set Default</button>` : ''}
                        <button class="edit-location-btn text-xs px-2 py-1 text-gray-600 hover:text-gray-800" data-index="${index}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-location-btn text-xs px-2 py-1 text-red-600 hover:text-red-800" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        $('#saved-locations-list').append(locationItem);
    },
    
    // Get icon for location type
    getLocationTypeIcon: function(type) {
        switch (type) {
            case 'home':
                return '<i class="fas fa-home mr-2 text-blue-500"></i>';
            case 'work':
                return '<i class="fas fa-briefcase mr-2 text-orange-500"></i>';
            case 'other':
            default:
                return '<i class="fas fa-map-marker-alt mr-2 text-green-500"></i>';
        }
    },
    
    // Format location type for display
    formatLocationType: function(type) {
        return type.charAt(0).toUpperCase() + type.slice(1);
    },
    
    // Set up event listeners
    setupEventListeners: function() {
        // Add new location button
        $('#add-location-btn').on('click', () => {
            this.showLocationModal();
        });
        
        // Save location button
        $('#save-location-btn').on('click', () => {
            this.saveLocation();
        });
        
        // Delete location button (delegated event)
        $('#saved-locations-list').on('click', '.delete-location-btn', (e) => {
            const index = $(e.currentTarget).data('index');
            this.deleteLocation(index);
        });
        
        // Edit location button (delegated event)
        $('#saved-locations-list').on('click', '.edit-location-btn', (e) => {
            const index = $(e.currentTarget).data('index');
            this.editLocation(index);
        });
        
        // Set default location button (delegated event)
        $('#saved-locations-list').on('click', '.set-default-btn', (e) => {
            const index = $(e.currentTarget).data('index');
            this.setDefaultLocation(index);
        });
    },
    
    // Show location modal for adding or editing
    showLocationModal: function(locationData = null) {
        // Reset form
        $('#location-form')[0].reset();
        
        // Set modal title
        $('#location-modal-title').text(locationData ? 'Edit Location' : 'Add New Location');
        
        // Set form data if editing
        if (locationData) {
            $('#location-id').val(locationData.id || '');
            $('#location-name').val(locationData.name || '');
            $('#location-address').val(locationData.address || '');
            $('#location-type').val(locationData.type || 'home');
            $('#location-is-default').prop('checked', locationData.isDefault || false);
        } else {
            $('#location-id').val('');
        }
        
        // Show modal
        $('#location-modal').removeClass('hidden');
    },
    
    // Hide location modal
    hideLocationModal: function() {
        $('#location-modal').addClass('hidden');
    },
    
    // Save location (add or update)
    saveLocation: function() {
        // Get form data
        const locationId = $('#location-id').val();
        const locationData = {
            name: $('#location-name').val(),
            address: $('#location-address').val(),
            type: $('#location-type').val(),
            isDefault: $('#location-is-default').prop('checked')
        };
        
        // Validate form
        if (!locationData.name || !locationData.address) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Get user settings
        const userSettings = DataService.getUserSettings();
        
        // Initialize locations array if it doesn't exist
        if (!userSettings.locations) {
            userSettings.locations = [];
        }
        
        // If setting as default, unset any existing default
        if (locationData.isDefault) {
            userSettings.locations.forEach(location => {
                location.isDefault = false;
            });
        }
        
        // Add or update location
        if (locationId) {
            // Update existing location
            const index = parseInt(locationId);
            userSettings.locations[index] = locationData;
        } else {
            // Add new location
            userSettings.locations.push(locationData);
        }
        
        // Save user settings
        DataService.saveUserSettings(userSettings);
        
        // Reload locations
        this.loadSavedLocations();
        
        // Hide modal
        this.hideLocationModal();
    },
    
    // Edit location
    editLocation: function(index) {
        // Get user settings
        const userSettings = DataService.getUserSettings();
        const location = userSettings.locations[index];
        
        // Show modal with location data
        this.showLocationModal({
            id: index,
            ...location
        });
    },
    
    // Delete location
    deleteLocation: function(index) {
        // Confirm deletion
        if (!confirm('Are you sure you want to delete this location?')) {
            return;
        }
        
        // Get user settings
        const userSettings = DataService.getUserSettings();
        
        // Remove location
        userSettings.locations.splice(index, 1);
        
        // Save user settings
        DataService.saveUserSettings(userSettings);
        
        // Reload locations
        this.loadSavedLocations();
    },
    
    // Set default location
    setDefaultLocation: function(index) {
        // Get user settings
        const userSettings = DataService.getUserSettings();
        
        // Unset any existing default
        userSettings.locations.forEach(location => {
            location.isDefault = false;
        });
        
        // Set new default
        userSettings.locations[index].isDefault = true;
        
        // Save user settings
        DataService.saveUserSettings(userSettings);
        
        // Reload locations
        this.loadSavedLocations();
    },
    
    // Handle user settings updated event
    handleUserSettingsUpdated: function(event) {
        // Reload saved locations
        this.loadSavedLocations();
    }
};

// Initialize when the DOM is loaded
$(document).ready(function() {
    LocationManagement.init();
});
