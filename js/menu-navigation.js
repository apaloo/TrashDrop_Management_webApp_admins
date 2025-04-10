/**
 * TrashDrop Admin Dashboard - Menu Navigation
 * Handles menu navigation and section switching
 */

const MenuNavigation = {
    // Initialize the menu navigation
    init: function() {
        console.log('Initializing Menu Navigation module');
        this.setupEventListeners();
        this.setupSubmenuMapping();
        this.initializeSubmenuStates();
    },
    
    // Initialize the submenu states based on the active links
    initializeSubmenuStates: function() {
        // Hide all submenus by default
        $('.submenu').hide();
        
        // If a sidebar link has the 'open' class, show its submenu
        $('.sidebar-link.open').each(function() {
            const $link = $(this);
            const sectionId = $link.data('section');
            
            if (sectionId && MenuNavigation.submenuMapping[sectionId]) {
                const submenuId = MenuNavigation.submenuMapping[sectionId];
                $('#' + submenuId).show();
                
                // Update the toggle icon
                const $icon = $link.find('.toggle-icon');
                $icon.removeClass('fa-chevron-right').addClass('fa-chevron-down');
            }
        });
    },
    
    // Map sidebar links to their corresponding submenu IDs
    submenuMapping: {},
    
    // Set up the mapping between sidebar links and submenu IDs
    setupSubmenuMapping: function() {
        // Create mapping for sidebar links and their submenus
        this.submenuMapping = {
            'request-dashboard-section': 'request-dashboard-submenu',
            'bin-management-section': 'bin-management-submenu',
            'illegal-dumping-section': 'illegal-dumping-submenu'
        };
        
        // Submenu mapping initialized
    },
    
    // Set up event listeners for menu navigation
    setupEventListeners: function() {
        // Remove any existing event handlers to avoid duplicates
        $(document).off('click', '.sidebar-link');
        $(document).off('click', '.submenu-link');
        
        // Main sidebar links - using event delegation
        $(document).on('click', '.sidebar-link', function(e) {
            e.preventDefault();
            
            const $link = $(this);
            const hasSubmenu = $link.next('.submenu').length > 0 || 
                             ($link.data('section') && MenuNavigation.submenuMapping[$link.data('section')]);
            

            
            // If the link has a submenu, toggle it
            if (hasSubmenu) {
                // Toggle the open class on the link
                $link.toggleClass('open');
                
                // Get the section ID from the link
                const sectionId = $link.data('section');
                
                // Find the submenu ID from our mapping
                const submenuId = MenuNavigation.submenuMapping[sectionId];
                
                if (submenuId) {
                    // Toggle the submenu visibility directly using the ID
                    const $submenu = $('#' + submenuId);
                    if ($link.hasClass('open')) {
                        $submenu.slideDown(200);
                    } else {
                        $submenu.slideUp(200);
                    }

                } else {
                    // Fallback to the next element if mapping not found
                    const $submenu = $link.next('.submenu');
                    if ($link.hasClass('open')) {
                        $submenu.slideDown(200);
                    } else {
                        $submenu.slideUp(200);
                    }
                }
                
                // Update the toggle icon
                const $icon = $link.find('.toggle-icon');
                if ($link.hasClass('open')) {
                    $icon.removeClass('fa-chevron-right').addClass('fa-chevron-down');
                } else {
                    $icon.removeClass('fa-chevron-down').addClass('fa-chevron-right');
                }
                
                // If this is the Illegal Dumping Management or Bin Management link, handle it specially
                if (sectionId && $link.hasClass('open')) {
                    // Switch to the section if the submenu is being opened
                    MenuNavigation.switchToSection(sectionId, $link.find('span').text());
                    
                    // If it's the illegal dumping section, default to map view
                    if (sectionId === 'illegal-dumping-section' && typeof IllegalDumpingManagement !== 'undefined') {
                        IllegalDumpingManagement.switchView('map');
                    }
                }
            } else {
                // If the link doesn't have a submenu, switch to the section
                const sectionId = $link.data('section');
                if (sectionId) {
                    // Update active state
                    $('.sidebar-link').removeClass('active');
                    $link.addClass('active');
                    
                    // Switch to the section
                    MenuNavigation.switchToSection(sectionId, $link.find('span').text());
                }
            }
        });
        
        // Submenu links - using event delegation
        $(document).on('click', '.submenu-link', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const $link = $(this);
            const sectionId = $link.data('content');
            const linkText = $link.find('span').text();
            

            
            // Update active states
            $('.submenu-link').removeClass('active');
            $link.addClass('active');

            // If this is an illegal dumping submenu link, handle it specially
            if (sectionId && sectionId.includes('illegal-dumping')) {
                // Extract the view name (map, reports, or history)
                const viewName = sectionId.replace('illegal-dumping-', '');
                
                // Switch to the illegal dumping section
                MenuNavigation.switchToSection('illegal-dumping-section', 'Illegal Dumping Management - ' + linkText);
                
                // Call the IllegalDumpingManagement module to switch views
                if (typeof IllegalDumpingManagement !== 'undefined') {
                    // Make sure the module is initialized
                    if (!IllegalDumpingManagement.initialized) {
                        IllegalDumpingManagement.init();
                        IllegalDumpingManagement.initialized = true;
                    }
                    
                    // Switch to the appropriate view
                    IllegalDumpingManagement.switchView(viewName);
                }
            } else if (sectionId) {
                // For other sections, just switch to the section
                MenuNavigation.switchToSection(sectionId, linkText);
            }
        });
    },
    
    // Switch to a section
    switchToSection: function(sectionId, title) {

        
        // Hide all content sections
        $('.content-section').addClass('hidden');
        
        // Show the selected section
        $('#' + sectionId).removeClass('hidden');
        
        // Update the page title
        document.title = 'TrashDrop Admin - ' + title;
        
        // Update the breadcrumb
        $('#page-title').text(title);
    }
};

// Initialize when the DOM is loaded
$(document).ready(function() {
    MenuNavigation.init();
});
