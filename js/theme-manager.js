/**
 * TrashDrop Admin Dashboard - Theme Manager
 * Handles theme preferences (dark/light mode) based on user settings
 */

const ThemeManager = {
    // Initialize the theme manager
    init: function() {
        console.log('Initializing Theme Manager');
        
        // Apply theme based on user preferences
        this.applyTheme();
        
        // Set up event listeners for theme toggle
        this.setupEventListeners();
        
        // Listen for user settings changes
        document.addEventListener('user-settings-updated', this.handleUserSettingsUpdated.bind(this));
    },
    
    // Apply theme based on user preferences
    applyTheme: function() {
        // Get user settings from DataService
        const userSettings = DataService.getUserSettings();
        const darkModeEnabled = userSettings.preferences?.darkMode || false;
        
        if (darkModeEnabled) {
            this.enableDarkMode();
        } else {
            this.disableDarkMode();
        }
    },
    
    // Set up event listeners for theme toggle
    setupEventListeners: function() {
        // Dark mode toggle in settings
        $('#dark-mode-toggle').on('change', (e) => {
            const darkModeEnabled = $(e.target).prop('checked');
            
            // Update user settings
            const userSettings = DataService.getUserSettings();
            userSettings.preferences.darkMode = darkModeEnabled;
            DataService.saveUserSettings(userSettings);
            
            // Apply theme
            if (darkModeEnabled) {
                this.enableDarkMode();
            } else {
                this.disableDarkMode();
            }
        });
    },
    
    // Handle user settings updated event
    handleUserSettingsUpdated: function(event) {
        // Apply theme based on updated settings
        this.applyTheme();
    },
    
    // Enable dark mode
    enableDarkMode: function() {
        $('body').addClass('dark-mode');
        
        // Update UI elements for dark mode
        $('.card').addClass('dark-card');
        $('.bg-white').addClass('dark-bg').removeClass('bg-white');
        $('.bg-gray-50').addClass('dark-bg-alt').removeClass('bg-gray-50');
        $('.text-gray-700').addClass('dark-text').removeClass('text-gray-700');
        $('.text-gray-500').addClass('dark-text-muted').removeClass('text-gray-500');
        $('.border-gray-200').addClass('dark-border').removeClass('border-gray-200');
        $('.border-gray-300').addClass('dark-border').removeClass('border-gray-300');
        
        // Update form elements
        $('input, select, textarea').addClass('dark-input');
        
        // Set dark mode toggle state
        $('#dark-mode-toggle').prop('checked', true);
    },
    
    // Disable dark mode
    disableDarkMode: function() {
        $('body').removeClass('dark-mode');
        
        // Update UI elements for light mode
        $('.dark-card').removeClass('dark-card');
        $('.dark-bg').addClass('bg-white').removeClass('dark-bg');
        $('.dark-bg-alt').addClass('bg-gray-50').removeClass('dark-bg-alt');
        $('.dark-text').addClass('text-gray-700').removeClass('dark-text');
        $('.dark-text-muted').addClass('text-gray-500').removeClass('dark-text-muted');
        $('.dark-border').addClass('border-gray-200').removeClass('dark-border');
        
        // Update form elements
        $('input, select, textarea').removeClass('dark-input');
        
        // Set dark mode toggle state
        $('#dark-mode-toggle').prop('checked', false);
    }
};

// Initialize when the DOM is loaded
$(document).ready(function() {
    ThemeManager.init();
});
