/**
 * TrashDrop Admin Dashboard - Pickup Request Service
 * Handles creation and management of pickup requests
 */

const PickupRequestService = {
    // Initialize the pickup request service
    init: function() {
        console.log('Initializing Pickup Request Service');
        
        // Set up event listeners
        this.setupEventListeners();
        
        return this;
    },
    
    // Set up event listeners
    setupEventListeners: function() {
        // New pickup request button
        $('#new-pickup-btn').on('click', () => {
            this.showPickupRequestModal();
        });
        
        // Save pickup request button
        $('#save-pickup-request-btn').on('click', () => {
            this.savePickupRequest();
        });
        
        // Close modal buttons
        $('.close-pickup-modal').on('click', () => {
            this.hidePickupRequestModal();
        });
        
        // Date picker initialization
        if ($.fn.datepicker) {
            $('#pickup-date').datepicker({
                format: 'mm/dd/yyyy',
                autoclose: true,
                todayHighlight: true,
                startDate: new Date()
            });
        }
        
        // Time picker initialization
        if ($.fn.timepicker) {
            $('#pickup-time').timepicker({
                minuteStep: 15,
                showMeridian: true,
                defaultTime: '09:00 AM'
            });
        }
    },
    
    // Show pickup request modal
    showPickupRequestModal: function() {
        // Reset form
        $('#pickup-request-form')[0].reset();
        
        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if ($.fn.datepicker) {
            $('#pickup-date').datepicker('update', tomorrow);
        } else {
            // Fallback if datepicker not available
            const formattedDate = tomorrow.toISOString().split('T')[0];
            $('#pickup-date').val(formattedDate);
        }
        
        // Load locations from user settings
        this.loadLocations();
        
        // Show modal
        $('#pickup-request-modal').removeClass('hidden');
    },
    
    // Hide pickup request modal
    hidePickupRequestModal: function() {
        $('#pickup-request-modal').addClass('hidden');
    },
    
    // Load locations from user settings
    loadLocations: function() {
        const userSettings = DataService.getUserSettings();
        const locations = userSettings.locations || [];
        
        // Clear existing options
        $('#pickup-location').empty();
        
        // Add default option
        $('#pickup-location').append('<option value="">Select a location</option>');
        
        // Add saved locations
        locations.forEach((location, index) => {
            const defaultTag = location.isDefault ? ' (Default)' : '';
            $('#pickup-location').append(`<option value="${index}" ${location.isDefault ? 'selected' : ''}>${location.name}${defaultTag}</option>`);
        });
        
        // Add custom location option
        $('#pickup-location').append('<option value="custom">Enter custom location</option>');
        
        // Handle custom location selection
        $('#pickup-location').on('change', function() {
            if ($(this).val() === 'custom') {
                $('#custom-location-container').removeClass('hidden');
            } else {
                $('#custom-location-container').addClass('hidden');
            }
        });
    },
    
    // Save pickup request
    savePickupRequest: function() {
        // Validate form
        if (!this.validatePickupForm()) {
            return;
        }
        
        // Get form data
        const formData = this.getPickupFormData();
        
        // Save to DataService
        DataService.savePickupRequest(formData);
        
        // Show success message
        this.showSuccessMessage('Pickup request created successfully!');
        
        // Hide modal
        this.hidePickupRequestModal();
        
        // Refresh pickup requests list if on that page
        if (typeof PickupManagement !== 'undefined' && PickupManagement.loadPickupRequests) {
            PickupManagement.loadPickupRequests();
        }
    },
    
    // Validate pickup form
    validatePickupForm: function() {
        let isValid = true;
        
        // Clear previous errors
        $('.error-message').remove();
        $('.border-red-500').removeClass('border-red-500');
        
        // Check required fields
        const requiredFields = ['pickup-date', 'pickup-time', 'waste-type', 'waste-quantity'];
        
        requiredFields.forEach(field => {
            const $field = $(`#${field}`);
            if (!$field.val()) {
                this.showFieldError($field, 'This field is required');
                isValid = false;
            }
        });
        
        // Check location
        const locationValue = $('#pickup-location').val();
        if (!locationValue) {
            this.showFieldError($('#pickup-location'), 'Please select a location');
            isValid = false;
        } else if (locationValue === 'custom') {
            if (!$('#custom-location-address').val()) {
                this.showFieldError($('#custom-location-address'), 'Please enter a custom address');
                isValid = false;
            }
        }
        
        // Check contact information
        if (!$('#contact-name').val()) {
            this.showFieldError($('#contact-name'), 'Please enter a contact name');
            isValid = false;
        }
        
        if (!$('#contact-phone').val() && !$('#contact-email').val()) {
            this.showFieldError($('#contact-phone'), 'Please provide at least one contact method');
            this.showFieldError($('#contact-email'), 'Please provide at least one contact method');
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
    getPickupFormData: function() {
        // Get location data
        let location;
        const locationValue = $('#pickup-location').val();
        
        if (locationValue === 'custom') {
            location = {
                address: $('#custom-location-address').val(),
                coordinates: {
                    lat: 0, // Would normally use geocoding API
                    lng: 0
                }
            };
        } else {
            const userSettings = DataService.getUserSettings();
            location = userSettings.locations[locationValue];
        }
        
        // Create request object
        const request = {
            id: 'req-' + Date.now(),
            dateCreated: new Date().toISOString(),
            pickupDate: $('#pickup-date').val(),
            pickupTime: $('#pickup-time').val(),
            location: location,
            wasteType: $('#waste-type').val(),
            wasteQuantity: $('#waste-quantity').val(),
            notes: $('#pickup-notes').val(),
            contact: {
                name: $('#contact-name').val(),
                phone: $('#contact-phone').val(),
                email: $('#contact-email').val()
            },
            status: 'pending',
            assignedTo: null,
            timeline: [
                {
                    status: 'created',
                    timestamp: new Date().toISOString(),
                    note: 'Pickup request created'
                }
            ]
        };
        
        return request;
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
    PickupRequestService.init();
});
