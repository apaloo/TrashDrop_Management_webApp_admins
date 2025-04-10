/**
 * Stats Settings - TrashDrop Admin WebPortal
 * Handles statistics and analytics settings
 */

const StatsSettings = {
    // Initialize stats settings
    init: function() {
        this.loadStats();
        this.initCharts();
        this.initDateRangeSelector();
        this.initExportOptions();
    },

    // Load statistics data
    loadStats: function() {
        // In a real implementation, this would fetch data from an API
        // For now, we'll use mock data
        this.statsData = {
            userActivity: {
                daily: [12, 19, 15, 22, 18, 24, 20],
                weekly: [85, 102, 92, 110, 98],
                monthly: [320, 350, 410, 380, 360, 390]
            },
            reportStats: {
                submitted: 428,
                inProgress: 156,
                completed: 312,
                total: 896
            },
            collectionStats: {
                scheduled: 89,
                completed: 72,
                missed: 8,
                total: 169
            },
            wasteTypes: {
                household: 45,
                construction: 25,
                electronic: 10,
                hazardous: 5,
                other: 15
            }
        };

        // Update the UI with the loaded stats
        this.updateStatsUI();
    },

    // Update the statistics UI
    updateStatsUI: function() {
        // Update report stats
        $('#total-reports').text(this.statsData.reportStats.total);
        $('#submitted-reports').text(this.statsData.reportStats.submitted);
        $('#in-progress-reports').text(this.statsData.reportStats.inProgress);
        $('#completed-reports').text(this.statsData.reportStats.completed);

        // Update collection stats
        $('#total-collections').text(this.statsData.collectionStats.total);
        $('#scheduled-collections').text(this.statsData.collectionStats.scheduled);
        $('#completed-collections').text(this.statsData.collectionStats.completed);
        $('#missed-collections').text(this.statsData.collectionStats.missed);

        // Update waste type percentages
        $('#household-waste').text(this.statsData.wasteTypes.household + '%');
        $('#construction-waste').text(this.statsData.wasteTypes.construction + '%');
        $('#electronic-waste').text(this.statsData.wasteTypes.electronic + '%');
        $('#hazardous-waste').text(this.statsData.wasteTypes.hazardous + '%');
        $('#other-waste').text(this.statsData.wasteTypes.other + '%');
    },

    // Initialize charts
    initCharts: function() {
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded. Charts will not be displayed.');
            return;
        }

        // User activity chart
        const activityCtx = document.getElementById('user-activity-chart').getContext('2d');
        this.activityChart = new Chart(activityCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'User Activity',
                    data: this.statsData.userActivity.daily,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Waste type chart
        const wasteCtx = document.getElementById('waste-type-chart').getContext('2d');
        this.wasteChart = new Chart(wasteCtx, {
            type: 'doughnut',
            data: {
                labels: ['Household', 'Construction', 'Electronic', 'Hazardous', 'Other'],
                datasets: [{
                    data: [
                        this.statsData.wasteTypes.household,
                        this.statsData.wasteTypes.construction,
                        this.statsData.wasteTypes.electronic,
                        this.statsData.wasteTypes.hazardous,
                        this.statsData.wasteTypes.other
                    ],
                    backgroundColor: [
                        '#3b82f6', // Blue
                        '#10b981', // Green
                        '#f59e0b', // Yellow
                        '#ef4444', // Red
                        '#8b5cf6'  // Purple
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    },

    // Initialize date range selector
    initDateRangeSelector: function() {
        $('.date-range-btn').on('click', function() {
            // Remove active class from all buttons
            $('.date-range-btn').removeClass('bg-blue-600 text-white').addClass('bg-gray-200 text-gray-700');
            
            // Add active class to clicked button
            $(this).removeClass('bg-gray-200 text-gray-700').addClass('bg-blue-600 text-white');
            
            // Get the selected range
            const range = $(this).data('range');
            
            // Update the charts based on the selected range
            StatsSettings.updateChartData(range);
        });
    },

    // Update chart data based on selected range
    updateChartData: function(range) {
        // Update the activity chart with the appropriate data
        let labels, data;
        
        switch(range) {
            case 'daily':
                labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                data = this.statsData.userActivity.daily;
                break;
            case 'weekly':
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
                data = this.statsData.userActivity.weekly;
                break;
            case 'monthly':
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
                data = this.statsData.userActivity.monthly;
                break;
            default:
                labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                data = this.statsData.userActivity.daily;
        }
        
        // Update the chart
        this.activityChart.data.labels = labels;
        this.activityChart.data.datasets[0].data = data;
        this.activityChart.update();
    },

    // Initialize export options
    initExportOptions: function() {
        $('.export-stats-btn').on('click', function() {
            const format = $(this).data('format');
            StatsSettings.exportStats(format);
        });
    },

    // Export statistics
    exportStats: function(format) {
        // In a real implementation, this would generate and download a file
        // For now, we'll just show a notification
        NotificationService.showSuccess(`Statistics exported as ${format.toUpperCase()}`);
        
        // If ExportService is available, use it
        if (typeof ExportService !== 'undefined') {
            const data = [
                {
                    category: 'Reports',
                    total: this.statsData.reportStats.total,
                    submitted: this.statsData.reportStats.submitted,
                    inProgress: this.statsData.reportStats.inProgress,
                    completed: this.statsData.reportStats.completed
                },
                {
                    category: 'Collections',
                    total: this.statsData.collectionStats.total,
                    scheduled: this.statsData.collectionStats.scheduled,
                    completed: this.statsData.collectionStats.completed,
                    missed: this.statsData.collectionStats.missed
                },
                {
                    category: 'Waste Types',
                    household: this.statsData.wasteTypes.household + '%',
                    construction: this.statsData.wasteTypes.construction + '%',
                    electronic: this.statsData.wasteTypes.electronic + '%',
                    hazardous: this.statsData.wasteTypes.hazardous + '%',
                    other: this.statsData.wasteTypes.other + '%'
                }
            ];
            
            if (format === 'csv') {
                ExportService.exportToCSV(data, 'trashdrop_statistics.csv');
            } else if (format === 'pdf') {
                ExportService.exportToPDF(data, 'trashdrop_statistics.pdf');
            }
        }
    }
};

// Initialize stats settings when document is ready
$(document).ready(function() {
    // Only initialize if we're on the settings page and the stats tab is available
    if ($('#stats-settings').length) {
        StatsSettings.init();
    }
});
