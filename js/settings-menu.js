/**
 * Settings Menu - TrashDrop Admin WebPortal
 * Handles the settings menu functionality in the sidebar
 */

const SettingsMenu = {
    // Initialize the settings menu functionality
    init: function() {
        this.initSettingsToggle();
        this.initSettingsOptions();
        this.initSettingsTabs();
    },

    // Initialize the toggle for the settings submenu
    initSettingsToggle: function() {
        $('#settings-link').on('click', function(e) {
            e.preventDefault();
            $('#settings-submenu').toggleClass('hidden');
            
            // Add a subtle animation
            if (!$('#settings-submenu').hasClass('hidden')) {
                $('#settings-submenu').hide().slideDown(200);
            }
        });

        // Close the submenu when clicking outside
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#settings-link, #settings-submenu').length) {
                $('#settings-submenu').addClass('hidden');
            }
        });
    },

    // Initialize the settings options
    initSettingsOptions: function() {
        $('.settings-option').on('click', function(e) {
            e.preventDefault();
            
            // Get the selected option
            const option = $(this).data('option');
            
            // Navigate to the settings section
            SettingsMenu.navigateToSettings(option);
            
            // Hide the submenu
            $('#settings-submenu').addClass('hidden');
        });
    },
    
    // Initialize the settings tabs
    initSettingsTabs: function() {
        $('.settings-tab').on('click', function() {
            // Remove active class from all tabs
            $('.settings-tab').removeClass('active bg-blue-50 text-blue-600 border-blue-600')
                .addClass('border-transparent text-gray-600');
            
            // Add active class to clicked tab
            $(this).addClass('active bg-blue-50 text-blue-600 border-blue-600')
                .removeClass('border-transparent text-gray-600');
            
            // Hide all tab content
            $('.settings-tab-content').addClass('hidden');
            
            // Show selected tab content
            const tabId = $(this).data('tab');
            $('#' + tabId + '-settings').removeClass('hidden');
        });
    },

    // Navigate to the settings section with the specified tab active
    navigateToSettings: function(activeTab) {
        // Switch to the settings section using the MenuNavigation module
        if (typeof MenuNavigation !== 'undefined' && MenuNavigation.switchToSection) {
            MenuNavigation.switchToSection('settings-section', 'Settings');
        } else {
            // Fallback to the global function if MenuNavigation is not available
            if (typeof switchToSection === 'function') {
                switchToSection('settings-section', 'Settings');
            } else {
                // Direct DOM manipulation if neither is available
                $('.content-section').addClass('hidden');
                $('#settings-section').removeClass('hidden');
            }
        }
        
        // Activate the appropriate tab
        setTimeout(function() {
            // First, deactivate all tabs
            $('.settings-tab').removeClass('active bg-blue-50 text-blue-600 border-blue-600')
                .addClass('border-transparent text-gray-600');
            
            // Then activate the selected tab
            $(`.settings-tab[data-tab="${activeTab}"]`).addClass('active bg-blue-50 text-blue-600 border-blue-600')
                .removeClass('border-transparent text-gray-600');
            
            // Show the corresponding tab content
            $('.settings-tab-content').addClass('hidden');
            $(`#${activeTab}-settings`).removeClass('hidden');
        }, 100);
    }
};

// Initialize settings menu when document is ready
$(document).ready(function() {
    SettingsMenu.init();
    
    // Remove the inline script for settings tabs since we're handling it here
    console.log('Settings menu initialized');
});
