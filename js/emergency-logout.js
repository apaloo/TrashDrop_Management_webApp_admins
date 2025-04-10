/**
 * TrashDrop Admin Dashboard - Emergency Logout
 * Provides a reliable emergency logout functionality that works independently
 * of the main application code, ensuring it remains functional even if other
 * parts of the application fail.
 * 
 * Features:
 * - Fixed position emergency logout button
 * - Comprehensive session clearing (localStorage, sessionStorage, cookies)
 * - Keyboard shortcut (Ctrl+Alt+L) for quick logout
 * - Multiple redundant navigation approaches for reliability
 * - Visual feedback during logout process
 */

const EmergencyLogout = {
    // Initialize the emergency logout functionality
    init: function() {
        console.log('Initializing Emergency Logout System');
        
        // Create the emergency logout button
        this.createEmergencyLogoutButton();
        
        // Set up keyboard shortcut
        this.setupKeyboardShortcut();
    },
    
    // Create the emergency logout button
    createEmergencyLogoutButton: function() {
        // Create the button element if it doesn't exist
        if ($('#emergency-logout-button').length === 0) {
            const buttonHTML = `
                <div id="emergency-logout-button" class="fixed bottom-4 right-4 z-50">
                    <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full shadow-lg flex items-center">
                        <i class="fas fa-power-off mr-2"></i>
                        Emergency Logout
                    </button>
                </div>
            `;
            
            $('body').append(buttonHTML);
            
            // Add event listener to the button
            $('#emergency-logout-button').on('click', () => {
                this.performEmergencyLogout();
            });
        }
    },
    
    // Set up keyboard shortcut (Ctrl+Alt+L)
    setupKeyboardShortcut: function() {
        $(document).on('keydown', (e) => {
            // Check for Ctrl+Alt+L combination
            if (e.ctrlKey && e.altKey && e.key === 'l') {
                console.log('Emergency logout keyboard shortcut detected');
                this.performEmergencyLogout();
            }
        });
    },
    
    // Perform the emergency logout
    performEmergencyLogout: function() {
        console.log('Performing emergency logout');
        
        // Show logout feedback
        this.showLogoutFeedback();
        
        // Clear all session data
        this.clearSessionData();
        
        // Redirect to login page
        setTimeout(() => {
            this.redirectToLogin();
        }, 1000);
    },
    
    // Show visual feedback during logout
    showLogoutFeedback: function() {
        // Create the feedback overlay if it doesn't exist
        if ($('#emergency-logout-overlay').length === 0) {
            const overlayHTML = `
                <div id="emergency-logout-overlay" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div class="bg-white p-6 rounded-lg shadow-xl text-center max-w-md">
                        <div class="text-red-600 text-5xl mb-4">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h2 class="text-2xl font-bold mb-2">Emergency Logout</h2>
                        <p class="mb-4">Securely logging you out and clearing all session data...</p>
                        <div class="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                            <div id="logout-progress" class="bg-red-600 h-2.5 rounded-full" style="width: 0%"></div>
                        </div>
                        <p class="text-sm text-gray-500">Please wait, you will be redirected to the login page.</p>
                    </div>
                </div>
            `;
            
            $('body').append(overlayHTML);
            
            // Animate the progress bar
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 10;
                $('#logout-progress').css('width', progress + '%');
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                }
            }, 100);
        }
    },
    
    // Clear all session data
    clearSessionData: function() {
        try {
            // Clear localStorage
            localStorage.clear();
            console.log('localStorage cleared');
            
            // Clear sessionStorage
            sessionStorage.clear();
            console.log('sessionStorage cleared');
            
            // Clear cookies
            this.clearAllCookies();
            console.log('Cookies cleared');
        } catch (error) {
            console.error('Error clearing session data:', error);
        }
    },
    
    // Clear all cookies
    clearAllCookies: function() {
        const cookies = document.cookie.split(';');
        
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        }
    },
    
    // Redirect to login page with multiple fallback approaches
    redirectToLogin: function() {
        try {
            // Primary approach: window.location.href
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Primary redirect failed, trying fallback:', error);
            
            try {
                // Fallback 1: window.location.replace
                window.location.replace('/login.html');
            } catch (error) {
                console.error('Fallback 1 failed, trying fallback 2:', error);
                
                try {
                    // Fallback 2: document.location
                    document.location = '/login.html';
                } catch (error) {
                    console.error('Fallback 2 failed, trying fallback 3:', error);
                    
                    try {
                        // Fallback 3: Create and click a link
                        const link = document.createElement('a');
                        link.href = '/login.html';
                        link.innerText = 'Click here to log out';
                        link.style.display = 'block';
                        link.style.margin = '20px auto';
                        link.style.textAlign = 'center';
                        link.style.padding = '10px';
                        link.style.backgroundColor = '#f44336';
                        link.style.color = 'white';
                        link.style.textDecoration = 'none';
                        link.style.borderRadius = '4px';
                        
                        // Add to the overlay if it exists, otherwise to body
                        const container = document.getElementById('emergency-logout-overlay') || document.body;
                        container.appendChild(link);
                        
                        // Try to click the link
                        link.click();
                    } catch (error) {
                        console.error('All redirect approaches failed:', error);
                        
                        // Last resort: Show manual instructions
                        alert('Emergency logout initiated. Please close this browser window and log in again.');
                    }
                }
            }
        }
    }
};

// Initialize when the DOM is loaded
$(document).ready(function() {
    EmergencyLogout.init();
});
