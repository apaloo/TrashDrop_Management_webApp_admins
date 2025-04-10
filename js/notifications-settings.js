/**
 * Notifications Settings - TrashDrop Admin WebPortal
 * Handles notification preferences and settings
 */

const NotificationsSettings = {
    // Default notification settings
    settings: {
        email: {
            newReports: true,
            collectorStatus: false,
            dailySummary: true,
            systemAlerts: true
        },
        app: {
            newReports: true,
            collectorStatus: true,
            systemAlerts: true,
            soundAlerts: false
        },
        schedule: {
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
            frequency: 'immediate'
        }
    },
    
    // Initialize notifications settings
    init: function() {
        this.initEmailToggles();
        this.initAppToggles();
        this.initScheduleInputs();
        this.initSaveButton();
        this.loadSavedSettings();
    },
    
    // Initialize email notification toggles
    initEmailToggles: function() {
        $('#email-new-reports').on('change', function() {
            NotificationsSettings.settings.email.newReports = $(this).is(':checked');
        });
        
        $('#email-collector-status').on('change', function() {
            NotificationsSettings.settings.email.collectorStatus = $(this).is(':checked');
        });
        
        $('#email-daily-summary').on('change', function() {
            NotificationsSettings.settings.email.dailySummary = $(this).is(':checked');
        });
        
        $('#email-system-alerts').on('change', function() {
            NotificationsSettings.settings.email.systemAlerts = $(this).is(':checked');
        });
    },
    
    // Initialize in-app notification toggles
    initAppToggles: function() {
        $('#app-new-reports').on('change', function() {
            NotificationsSettings.settings.app.newReports = $(this).is(':checked');
        });
        
        $('#app-collector-status').on('change', function() {
            NotificationsSettings.settings.app.collectorStatus = $(this).is(':checked');
        });
        
        $('#app-system-alerts').on('change', function() {
            NotificationsSettings.settings.app.systemAlerts = $(this).is(':checked');
        });
        
        $('#app-sound-alerts').on('change', function() {
            NotificationsSettings.settings.app.soundAlerts = $(this).is(':checked');
        });
    },
    
    // Initialize schedule inputs
    initScheduleInputs: function() {
        $('#quiet-hours-start').on('change', function() {
            NotificationsSettings.settings.schedule.quietHoursStart = $(this).val();
        });
        
        $('#quiet-hours-end').on('change', function() {
            NotificationsSettings.settings.schedule.quietHoursEnd = $(this).val();
        });
        
        $('#notification-frequency').on('change', function() {
            NotificationsSettings.settings.schedule.frequency = $(this).val();
        });
    },
    
    // Initialize save button
    initSaveButton: function() {
        $('.save-notification-settings').on('click', function() {
            NotificationsSettings.saveSettings();
            
            // Show success notification
            if (typeof NotificationService !== 'undefined') {
                NotificationService.showSuccess('Notification settings saved successfully');
            } else {
                toastr.success('Notification settings saved successfully');
            }
        });
    },
    
    // Load saved settings from localStorage
    loadSavedSettings: function() {
        const savedSettings = localStorage.getItem('trashdrop_notification_settings');
        if (savedSettings) {
            try {
                const parsedSettings = JSON.parse(savedSettings);
                // Merge saved settings with defaults
                this.settings = this.mergeSettings(this.settings, parsedSettings);
                this.applySettings();
            } catch (e) {
                console.error('Error loading notification settings:', e);
            }
        }
    },
    
    // Merge settings objects (helper function)
    mergeSettings: function(target, source) {
        const output = Object.assign({}, target);
        
        if (source && typeof source === 'object') {
            Object.keys(source).forEach(key => {
                if (source[key] && typeof source[key] === 'object') {
                    if (target[key] && typeof target[key] === 'object') {
                        output[key] = this.mergeSettings(target[key], source[key]);
                    } else {
                        output[key] = source[key];
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }
        
        return output;
    },
    
    // Apply current settings to UI
    applySettings: function() {
        // Apply email notification settings
        $('#email-new-reports').prop('checked', this.settings.email.newReports);
        $('#email-collector-status').prop('checked', this.settings.email.collectorStatus);
        $('#email-daily-summary').prop('checked', this.settings.email.dailySummary);
        $('#email-system-alerts').prop('checked', this.settings.email.systemAlerts);
        
        // Apply in-app notification settings
        $('#app-new-reports').prop('checked', this.settings.app.newReports);
        $('#app-collector-status').prop('checked', this.settings.app.collectorStatus);
        $('#app-system-alerts').prop('checked', this.settings.app.systemAlerts);
        $('#app-sound-alerts').prop('checked', this.settings.app.soundAlerts);
        
        // Apply schedule settings
        $('#quiet-hours-start').val(this.settings.schedule.quietHoursStart);
        $('#quiet-hours-end').val(this.settings.schedule.quietHoursEnd);
        $('#notification-frequency').val(this.settings.schedule.frequency);
    },
    
    // Save settings to localStorage
    saveSettings: function() {
        localStorage.setItem('trashdrop_notification_settings', JSON.stringify(this.settings));
        console.log('Notification settings saved:', this.settings);
        
        // Apply settings immediately
        this.applyNotificationSettings();
        
        return true;
    },
    
    // Apply notification settings to the system
    applyNotificationSettings: function() {
        // Here we would typically connect to a backend API
        // to update user notification preferences
        
        // For now, we'll just simulate this with a console log
        console.log('Applying notification settings to system');
        
        // Update sound settings for notifications
        if (typeof NotificationService !== 'undefined') {
            NotificationService.setSoundEnabled(this.settings.app.soundAlerts);
        }
    }
};

// Initialize notification settings when document is ready
$(document).ready(function() {
    NotificationsSettings.init();
});
