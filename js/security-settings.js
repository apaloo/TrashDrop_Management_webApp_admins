/**
 * Security Settings - TrashDrop Admin WebPortal
 * Handles security preferences, password management, and two-factor authentication
 */

const SecuritySettings = {
    // Default security settings
    settings: {
        twoFactorEnabled: false,
        recoveryOptions: {
            email: true,
            phone: true,
            backupCodes: false
        },
        sessionTimeout: 30 // minutes
    },
    
    // Initialize security settings
    init: function() {
        this.initPasswordManagement();
        this.initTwoFactorToggle();
        this.initRecoveryOptions();
        this.initSessionManagement();
        this.initEmergencyLogout();
        this.loadSavedSettings();
    },
    
    // Initialize password management
    initPasswordManagement: function() {
        // Password visibility toggle
        $('.password-toggle').on('click', function() {
            const passwordField = $(this).siblings('input');
            const type = passwordField.attr('type') === 'password' ? 'text' : 'password';
            passwordField.attr('type', type);
            
            // Toggle icon
            $(this).find('i').toggleClass('fa-eye fa-eye-slash');
        });
        
        // Password strength checker
        $('#new-password').on('input', function() {
            const password = $(this).val();
            const strength = SecuritySettings.checkPasswordStrength(password);
            
            // Update strength indicator
            $('#password-strength-bar').css('width', `${strength.score * 25}%`);
            $('#password-strength-bar').removeClass('bg-red-500 bg-yellow-500 bg-green-500');
            
            if (strength.score <= 1) {
                $('#password-strength-bar').addClass('bg-red-500');
                $('#password-strength-text').text('Weak');
            } else if (strength.score <= 3) {
                $('#password-strength-bar').addClass('bg-yellow-500');
                $('#password-strength-text').text('Moderate');
            } else {
                $('#password-strength-bar').addClass('bg-green-500');
                $('#password-strength-text').text('Strong');
            }
        });
        
        // Password change form submission
        $('.change-password-btn').on('click', function() {
            const currentPassword = $('#current-password').val();
            const newPassword = $('#new-password').val();
            const confirmPassword = $('#confirm-password').val();
            
            // Validate inputs
            if (!currentPassword) {
                SecuritySettings.showError('Please enter your current password');
                return;
            }
            
            if (!newPassword) {
                SecuritySettings.showError('Please enter a new password');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                SecuritySettings.showError('New passwords do not match');
                return;
            }
            
            // Check password strength
            const strength = SecuritySettings.checkPasswordStrength(newPassword);
            if (strength.score < 2) {
                SecuritySettings.showError('Password is too weak. Please choose a stronger password.');
                return;
            }
            
            // Simulate password change (would connect to backend API in production)
            SecuritySettings.changePassword(currentPassword, newPassword);
        });
    },
    
    // Initialize two-factor authentication toggle
    initTwoFactorToggle: function() {
        $('#two-factor-toggle').on('change', function() {
            const isEnabled = $(this).is(':checked');
            
            if (isEnabled) {
                // Show setup instructions
                $('#two-factor-setup').removeClass('hidden');
                
                // Generate QR code (simulated)
                SecuritySettings.generateTwoFactorQR();
            } else {
                // Hide setup instructions
                $('#two-factor-setup').addClass('hidden');
                
                // Disable 2FA (would connect to backend API in production)
                SecuritySettings.disableTwoFactor();
            }
        });
        
        // Verify and activate 2FA
        $('.verify-2fa-btn').on('click', function() {
            const code = $('#verification-code').val();
            
            if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
                SecuritySettings.showError('Please enter a valid 6-digit code');
                return;
            }
            
            // Verify code (simulated)
            SecuritySettings.verifyTwoFactorCode(code);
        });
    },
    
    // Initialize recovery options
    initRecoveryOptions: function() {
        $('#recovery-email, #recovery-phone, #recovery-codes').on('change', function() {
            const option = $(this).attr('id').replace('recovery-', '');
            const isChecked = $(this).is(':checked');
            
            SecuritySettings.settings.recoveryOptions[option] = isChecked;
            SecuritySettings.saveSettings();
        });
    },
    
    // Initialize session management
    initSessionManagement: function() {
        // Logout individual sessions
        $('.logout-session-btn').on('click', function() {
            const sessionId = $(this).data('session-id');
            SecuritySettings.logoutSession(sessionId);
        });
        
        // Logout all other sessions
        $('.logout-all-sessions-btn').on('click', function() {
            SecuritySettings.logoutAllSessions();
        });
    },
    
    // Initialize emergency logout
    initEmergencyLogout: function() {
        $('.emergency-logout-btn').on('click', function() {
            SecuritySettings.emergencyLogout();
        });
        
        // Add keyboard shortcut (Ctrl+Alt+L)
        $(document).on('keydown', function(e) {
            if (e.ctrlKey && e.altKey && e.which === 76) {
                SecuritySettings.emergencyLogout();
            }
        });
    },
    
    // Load saved settings from localStorage
    loadSavedSettings: function() {
        const savedSettings = localStorage.getItem('trashdrop_security_settings');
        if (savedSettings) {
            try {
                const parsedSettings = JSON.parse(savedSettings);
                // Merge saved settings with defaults
                this.settings = { ...this.settings, ...parsedSettings };
                this.applySettings();
            } catch (e) {
                console.error('Error loading security settings:', e);
            }
        }
    },
    
    // Apply current settings to UI
    applySettings: function() {
        // Apply 2FA setting
        $('#two-factor-toggle').prop('checked', this.settings.twoFactorEnabled);
        if (this.settings.twoFactorEnabled) {
            $('#two-factor-setup').removeClass('hidden');
        } else {
            $('#two-factor-setup').addClass('hidden');
        }
        
        // Apply recovery options
        $('#recovery-email').prop('checked', this.settings.recoveryOptions.email);
        $('#recovery-phone').prop('checked', this.settings.recoveryOptions.phone);
        $('#recovery-codes').prop('checked', this.settings.recoveryOptions.backupCodes);
    },
    
    // Check password strength
    checkPasswordStrength: function(password) {
        // Simple password strength checker
        // In production, use a more robust library like zxcvbn
        
        let score = 0;
        const patterns = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            numbers: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        };
        
        // Calculate score
        score += patterns.length ? 1 : 0;
        score += patterns.uppercase ? 1 : 0;
        score += patterns.lowercase ? 1 : 0;
        score += patterns.numbers ? 1 : 0;
        score += patterns.special ? 1 : 0;
        
        return {
            score: score,
            patterns: patterns
        };
    },
    
    // Change password (simulated)
    changePassword: function(currentPassword, newPassword) {
        // In production, this would call a backend API
        console.log('Changing password...');
        
        // Simulate API call
        setTimeout(() => {
            console.log('Password changed successfully');
            
            // Clear password fields
            $('#current-password, #new-password, #confirm-password').val('');
            
            // Show success message
            this.showSuccess('Password changed successfully');
        }, 1000);
    },
    
    // Generate 2FA QR code (simulated)
    generateTwoFactorQR: function() {
        // In production, this would call a backend API to generate a QR code
        console.log('Generating 2FA QR code...');
        
        // Simulate API call
        setTimeout(() => {
            console.log('2FA QR code generated');
            
            // For demo purposes, we'll just show a placeholder
            // In production, this would be replaced with an actual QR code
            $('#qr-code-placeholder').html('<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=otpauth://totp/TrashDrop:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=TrashDrop" alt="2FA QR Code">');
        }, 1000);
    },
    
    // Verify 2FA code (simulated)
    verifyTwoFactorCode: function(code) {
        // In production, this would call a backend API to verify the code
        console.log('Verifying 2FA code:', code);
        
        // Simulate API call
        setTimeout(() => {
            // For demo purposes, any 6-digit code is accepted
            console.log('2FA code verified');
            
            // Enable 2FA
            this.settings.twoFactorEnabled = true;
            this.saveSettings();
            
            // Show success message
            this.showSuccess('Two-factor authentication enabled successfully');
            
            // Clear verification code
            $('#verification-code').val('');
        }, 1000);
    },
    
    // Disable 2FA (simulated)
    disableTwoFactor: function() {
        // In production, this would call a backend API
        console.log('Disabling 2FA...');
        
        // Simulate API call
        setTimeout(() => {
            console.log('2FA disabled');
            
            // Update settings
            this.settings.twoFactorEnabled = false;
            this.saveSettings();
            
            // Show success message
            this.showSuccess('Two-factor authentication disabled');
        }, 1000);
    },
    
    // Logout specific session (simulated)
    logoutSession: function(sessionId) {
        // In production, this would call a backend API
        console.log('Logging out session:', sessionId);
        
        // Simulate API call
        setTimeout(() => {
            console.log('Session logged out');
            
            // Show success message
            this.showSuccess('Session logged out successfully');
            
            // Remove session from UI
            $(`[data-session-id="${sessionId}"]`).closest('.session-item').fadeOut();
        }, 1000);
    },
    
    // Logout all other sessions (simulated)
    logoutAllSessions: function() {
        // In production, this would call a backend API
        console.log('Logging out all other sessions...');
        
        // Simulate API call
        setTimeout(() => {
            console.log('All other sessions logged out');
            
            // Show success message
            this.showSuccess('All other sessions logged out successfully');
            
            // Remove all sessions from UI except current
            $('.session-item:not(.current-session)').fadeOut();
        }, 1000);
    },
    
    // Emergency logout
    emergencyLogout: function() {
        console.log('Emergency logout initiated');
        
        // Show confirmation dialog
        if (confirm('Are you sure you want to perform an emergency logout? This will log you out from all devices.')) {
            // Clear all local storage
            localStorage.clear();
            
            // Clear all session storage
            sessionStorage.clear();
            
            // Clear all cookies
            document.cookie.split(';').forEach(function(c) {
                document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;';
            });
            
            // Redirect to login page
            window.location.href = 'login.html?emergency=true';
        }
    },
    
    // Save settings to localStorage
    saveSettings: function() {
        localStorage.setItem('trashdrop_security_settings', JSON.stringify(this.settings));
        console.log('Security settings saved:', this.settings);
        return true;
    },
    
    // Show success message
    showSuccess: function(message) {
        if (typeof NotificationService !== 'undefined') {
            NotificationService.showSuccess(message);
        } else if (typeof toastr !== 'undefined') {
            toastr.success(message);
        } else {
            alert(message);
        }
    },
    
    // Show error message
    showError: function(message) {
        if (typeof NotificationService !== 'undefined') {
            NotificationService.showError(message);
        } else if (typeof toastr !== 'undefined') {
            toastr.error(message);
        } else {
            alert('Error: ' + message);
        }
    }
};

// Initialize security settings when document is ready
$(document).ready(function() {
    SecuritySettings.init();
});
