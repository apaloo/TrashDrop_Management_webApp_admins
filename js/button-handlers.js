/**
 * Button Handlers - TrashDrop Admin WebPortal
 * Handles interactions for various buttons throughout the dashboard
 */

const ButtonHandlers = {
    // Initialize all button handlers
    init: function() {
        this.initQRCodeButtons();
        this.initAssignCleanerButton();
        this.initSaveChangesButton();
        this.initEmergencyLogoutButton();
    },

    // QR Code Performance period buttons
    initQRCodeButtons: function() {
        $('.qr-period-btn').on('click', function() {
            // Remove active class from all period buttons
            $('.qr-period-btn').removeClass('bg-blue-600 text-white').addClass('bg-gray-200 text-gray-700');
            
            // Add active class to clicked button
            $(this).removeClass('bg-gray-200 text-gray-700').addClass('bg-blue-600 text-white');
            
            // Get the selected period
            const period = $(this).data('period');
            
            // Update QR code performance data based on period
            ButtonHandlers.updateQRCodeData(period);
        });
    },

    // Update QR code performance data based on selected period
    updateQRCodeData: function(period) {
        // Sample data for different periods
        const data = {
            daily: {
                scanSuccess: '98.3%',
                avgScanTime: '1.2 sec',
                uniqueUsers: '243'
            },
            weekly: {
                scanSuccess: '97.8%',
                avgScanTime: '1.4 sec',
                uniqueUsers: '1,245'
            },
            monthly: {
                scanSuccess: '96.5%',
                avgScanTime: '1.6 sec',
                uniqueUsers: '5,872'
            }
        };

        // Update the displayed metrics
        const metrics = data[period];
        $('.qr-metrics .scan-success').text(metrics.scanSuccess);
        $('.qr-metrics .avg-scan-time').text(metrics.avgScanTime);
        $('.qr-metrics .unique-users').text(metrics.uniqueUsers);

        // Show success notification
        NotificationService.showSuccess(`QR code data updated to ${period} view`);
    },

    // Assign Cleaner button
    initAssignCleanerButton: function() {
        $('#assign-cleaner-btn').on('click', function() {
            // Get the current report ID from the detail panel
            const reportId = $('#report-detail-panel').data('report-id');
            
            // Show collector selection modal
            CollectorManagement.showCollectorSelectionModal(reportId);
        });
    },

    // Save Changes button in report detail
    initSaveChangesButton: function() {
        $('#save-report-changes-btn').on('click', function() {
            // Get the current report ID from the detail panel
            const reportId = $('#report-detail-panel').data('report-id');
            
            // Collect form data from the detail panel
            const formData = {
                status: $('#report-status-select').val(),
                priority: $('#report-priority-select').val(),
                notes: $('#report-notes').val(),
                assignedTo: $('#report-assigned-to').val()
            };
            
            // Save changes to the report
            IllegalDumpingManagement.saveReportChanges(reportId, formData);
            
            // Show success notification
            NotificationService.showSuccess('Report changes saved successfully');
        });
    },

    // Emergency Logout button
    initEmergencyLogoutButton: function() {
        $('.emergency-logout-btn').on('click', function() {
            // Call the emergency logout function
            EmergencyLogout.performLogout();
        });
    }
};

// Initialize button handlers when document is ready
$(document).ready(function() {
    ButtonHandlers.init();
});
