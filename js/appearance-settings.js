/**
 * Appearance Settings - TrashDrop Admin WebPortal
 * Handles appearance customization functionality
 */

const AppearanceSettings = {
    // Initialize appearance settings
    init: function() {
        this.initThemeOptions();
        this.initDarkModeToggle();
        this.initLayoutOptions();
        this.loadSavedSettings();
    },

    // Initialize theme options
    initThemeOptions: function() {
        $('.theme-option').on('click', function() {
            // Remove active class from all theme options
            $('.theme-option').removeClass('active border-blue-600').addClass('border-gray-300');
            
            // Add active class to selected theme option
            $(this).addClass('active border-blue-600').removeClass('border-gray-300');
            
            // Get the selected theme
            const theme = $(this).find('span').text().toLowerCase();
            
            // Save and apply the selected theme
            AppearanceSettings.setTheme(theme);
        });
    },

    // Initialize dark mode toggle
    initDarkModeToggle: function() {
        $('#dark-mode-toggle').on('change', function() {
            const isDarkMode = $(this).is(':checked');
            AppearanceSettings.setDarkMode(isDarkMode);
        });
    },

    // Initialize layout options
    initLayoutOptions: function() {
        $('input[name="layout-option"]').on('change', function() {
            const option = $(this).data('option');
            const isEnabled = $(this).is(':checked');
            
            // Save layout preference
            AppearanceSettings.saveLayoutPreference(option, isEnabled);
            
            // Apply layout changes
            AppearanceSettings.applyLayoutChanges();
        });
    },

    // Load saved appearance settings
    loadSavedSettings: function() {
        // Load theme
        const savedTheme = localStorage.getItem('trashdrop_theme') || 'default';
        this.applyTheme(savedTheme);
        
        // Activate the correct theme option
        $('.theme-option').removeClass('active border-blue-600').addClass('border-gray-300');
        $(`.theme-option:contains('${savedTheme.charAt(0).toUpperCase() + savedTheme.slice(1)}')`).addClass('active border-blue-600').removeClass('border-gray-300');
        
        // Load dark mode setting
        const isDarkMode = localStorage.getItem('trashdrop_dark_mode') === 'true';
        $('#dark-mode-toggle').prop('checked', isDarkMode);
        this.setDarkMode(isDarkMode, false);
        
        // Load layout preferences
        const layoutPreferences = JSON.parse(localStorage.getItem('trashdrop_layout_preferences') || '{}');
        
        // Apply saved layout preferences to checkboxes
        $.each(layoutPreferences, function(option, isEnabled) {
            $(`input[data-option="${option}"]`).prop('checked', isEnabled);
        });
        
        // Apply layout changes
        this.applyLayoutChanges();
    },

    // Set theme
    setTheme: function(theme) {
        // Save theme preference
        localStorage.setItem('trashdrop_theme', theme);
        
        // Apply theme
        this.applyTheme(theme);
        
        // Show notification
        NotificationService.showSuccess(`Theme changed to ${theme}`);
    },

    // Apply theme
    applyTheme: function(theme) {
        // Remove all theme classes
        $('body').removeClass('theme-default theme-green theme-purple theme-dark');
        
        // Add selected theme class
        $('body').addClass(`theme-${theme}`);
        
        // Update primary color variables
        let primaryColor = '#3b82f6'; // Default blue
        
        switch(theme) {
            case 'green':
                primaryColor = '#10b981';
                break;
            case 'purple':
                primaryColor = '#8b5cf6';
                break;
            case 'dark':
                primaryColor = '#1f2937';
                break;
        }
        
        // Set CSS variables for the theme
        document.documentElement.style.setProperty('--primary-color', primaryColor);
    },

    // Set dark mode
    setDarkMode: function(enabled, showNotification = true) {
        // Save dark mode preference
        localStorage.setItem('trashdrop_dark_mode', enabled);
        
        // Apply dark mode
        if (enabled) {
            $('body').addClass('dark-mode');
            $('.dot').css('transform', 'translateX(100%)');
        } else {
            $('body').removeClass('dark-mode');
            $('.dot').css('transform', 'translateX(0)');
        }
        
        // Show notification if needed
        if (showNotification) {
            const message = enabled ? 'Dark mode enabled' : 'Dark mode disabled';
            NotificationService.showSuccess(message);
        }
    },

    // Save layout preference
    saveLayoutPreference: function(option, isEnabled) {
        // Get existing preferences
        const preferences = JSON.parse(localStorage.getItem('trashdrop_layout_preferences') || '{}');
        
        // Update preference
        preferences[option] = isEnabled;
        
        // Save updated preferences
        localStorage.setItem('trashdrop_layout_preferences', JSON.stringify(preferences));
    },

    // Apply layout changes based on saved preferences
    applyLayoutChanges: function() {
        const preferences = JSON.parse(localStorage.getItem('trashdrop_layout_preferences') || '{}');
        
        // Apply compact sidebar preference
        if (preferences.compactSidebar) {
            $('.sidebar').addClass('compact');
        } else {
            $('.sidebar').removeClass('compact');
        }
        
        // Apply quick actions preference
        if (preferences.showQuickActions) {
            $('.quick-actions').removeClass('hidden');
        } else {
            $('.quick-actions').addClass('hidden');
        }
    }
};

// Initialize appearance settings when document is ready
$(document).ready(function() {
    AppearanceSettings.init();
});
