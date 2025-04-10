/**
 * TrashDrop Admin Dashboard - Notification Preferences
 * Handles user notification preferences and settings
 */

const NotificationPreferences = {
    // Initialize the notification preferences
    init: function() {
        console.log('Initializing Notification Preferences');
        
        // Apply notification settings based on user preferences
        this.applyNotificationSettings();
        
        // Set up event listeners for notification toggles
        this.setupEventListeners();
        
        // Listen for user settings changes
        document.addEventListener('user-settings-updated', this.handleUserSettingsUpdated.bind(this));
    },
    
    // Apply notification settings based on user preferences
    applyNotificationSettings: function() {
        // Get user settings from DataService
        const userSettings = DataService.getUserSettings();
        
        // Set email notifications toggle
        const emailNotifications = userSettings.notifications?.email || false;
        $('#email-notifications').prop('checked', emailNotifications);
        this.updateToggleUI('#email-notifications');
        
        // Set in-app notifications toggle
        const inAppNotifications = userSettings.notifications?.inApp || false;
        $('#inapp-notifications').prop('checked', inAppNotifications);
        this.updateToggleUI('#inapp-notifications');
        
        // Set push notifications toggle
        const pushNotifications = userSettings.notifications?.push || false;
        $('#push-notifications').prop('checked', pushNotifications);
        this.updateToggleUI('#push-notifications');
    },
    
    // Set up event listeners for notification toggles
    setupEventListeners: function() {
        // Email notifications toggle
        $('#email-notifications').on('change', (e) => {
            const isEnabled = $(e.target).prop('checked');
            this.updateToggleUI('#email-notifications');
            this.saveNotificationPreference('email', isEnabled);
        });
        
        // In-app notifications toggle
        $('#inapp-notifications').on('change', (e) => {
            const isEnabled = $(e.target).prop('checked');
            this.updateToggleUI('#inapp-notifications');
            this.saveNotificationPreference('inApp', isEnabled);
        });
        
        // Push notifications toggle
        $('#push-notifications').on('change', (e) => {
            const isEnabled = $(e.target).prop('checked');
            this.updateToggleUI('#push-notifications');
            this.saveNotificationPreference('push', isEnabled);
            
            // If enabling push notifications, request permission
            if (isEnabled) {
                this.requestPushNotificationPermission();
            }
        });
    },
    
    // Update toggle UI based on checked state
    updateToggleUI: function(toggleSelector) {
        const isChecked = $(toggleSelector).prop('checked');
        const $dot = $(toggleSelector).siblings('.dot');
        
        if (isChecked) {
            $dot.addClass('transform translate-x-6 bg-blue-600');
            $(toggleSelector).siblings('.block').addClass('bg-blue-400').removeClass('bg-gray-200');
        } else {
            $dot.removeClass('transform translate-x-6 bg-blue-600');
            $(toggleSelector).siblings('.block').removeClass('bg-blue-400').addClass('bg-gray-200');
        }
    },
    
    // Save notification preference to user settings
    saveNotificationPreference: function(type, isEnabled) {
        // Get current user settings
        const userSettings = DataService.getUserSettings();
        
        // Initialize notifications object if it doesn't exist
        if (!userSettings.notifications) {
            userSettings.notifications = {};
        }
        
        // Update the specific notification type
        userSettings.notifications[type] = isEnabled;
        
        // Save updated settings
        DataService.saveUserSettings(userSettings);
        
        console.log(`${type} notifications ${isEnabled ? 'enabled' : 'disabled'}`);
    },
    
    // Request permission for push notifications
    requestPushNotificationPermission: function() {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Push notification permission granted');
                    this.sendTestNotification();
                } else {
                    console.log('Push notification permission denied');
                    // Revert the toggle since permission was denied
                    $('#push-notifications').prop('checked', false);
                    this.updateToggleUI('#push-notifications');
                    this.saveNotificationPreference('push', false);
                    
                    // Show alert to user
                    alert('Push notification permission denied. Please enable notifications in your browser settings to receive push notifications.');
                }
            });
        } else {
            console.log('Push notifications not supported in this browser');
            // Revert the toggle since notifications are not supported
            $('#push-notifications').prop('checked', false);
            this.updateToggleUI('#push-notifications');
            this.saveNotificationPreference('push', false);
            
            // Show alert to user
            alert('Push notifications are not supported in your browser.');
        }
    },
    
    // Send a test notification
    sendTestNotification: function() {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('TrashDrop Notifications Enabled', {
                body: 'You will now receive notifications for important updates and alerts.',
                icon: '/images/logo.png'
            });
            
            notification.onclick = function() {
                window.focus();
                notification.close();
            };
        }
    },
    
    // Handle user settings updated event
    handleUserSettingsUpdated: function(event) {
        // Apply notification settings based on updated settings
        this.applyNotificationSettings();
    }
};

// Initialize when the DOM is loaded
$(document).ready(function() {
    NotificationPreferences.init();
});
