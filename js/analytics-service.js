/**
 * TrashDrop Admin Dashboard - Analytics Service
 * Handles data visualization, reporting, and analytics functionality
 */

const AnalyticsService = {
    charts: {},
    
    init: function() {
        // Initialize charts when analytics tab is active
        document.addEventListener('DOMContentLoaded', () => {
            // Set up event listeners for analytics tab
            const analyticsLink = document.querySelector('.submenu-link[data-section="analytics"]');
            if (analyticsLink) {
                analyticsLink.addEventListener('click', () => {
                    // Wait for the content to be visible before initializing charts
                    setTimeout(() => {
                        this.initializeCharts();
                    }, 100);
                });
            }
        });
    },
    
    initializeCharts: function() {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded. Using fallback visualization.');
            this.initializeFallbackCharts();
            return;
        }
        
        // Initialize performance metrics chart
        this.initializePerformanceChart();
        
        // Initialize request volume chart
        this.initializeVolumeChart();
        
        // Initialize collector efficiency chart
        this.initializeCollectorChart();
        
        // Initialize geographic distribution chart
        this.initializeGeographicChart();
    },
    
    initializeFallbackCharts: function() {
        // Create fallback visualizations when Chart.js is not available
        console.log('Using fallback charts');
        
        // Performance metrics fallback
        this.createFallbackPerformanceChart();
        
        // Request volume fallback
        this.createFallbackVolumeChart();
        
        // Collector efficiency fallback
        this.createFallbackCollectorChart();
        
        // Geographic distribution fallback
        this.createFallbackGeographicChart();
    },
    
    initializePerformanceChart: function() {
        const ctx = document.getElementById('performance-chart');
        if (!ctx) return;
        
        // Get performance data
        const data = this.getPerformanceData();
        
        // Create chart
        this.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Response Time (min)',
                        data: data.responseTime,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Completion Rate (%)',
                        data: data.completionRate,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Response Time (min)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Completion Rate (%)'
                        },
                        min: 0,
                        max: 100,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    },
    
    initializeVolumeChart: function() {
        const ctx = document.getElementById('volume-chart');
        if (!ctx) return;
        
        // Get volume data
        const data = this.getVolumeData();
        
        // Create chart
        this.charts.volume = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'New Requests',
                        data: data.new,
                        backgroundColor: '#3b82f6'
                    },
                    {
                        label: 'Completed Requests',
                        data: data.completed,
                        backgroundColor: '#10b981'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Request Volume by Day'
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                    },
                    y: {
                        stacked: true
                    }
                }
            }
        });
    },
    
    initializeCollectorChart: function() {
        const ctx = document.getElementById('collector-chart');
        if (!ctx) return;
        
        // Get collector data
        const data = this.getCollectorData();
        
        // Create chart
        this.charts.collector = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Pickups Completed',
                        data: data.pickups,
                        backgroundColor: '#3b82f6'
                    },
                    {
                        label: 'Avg. Response Time (min)',
                        data: data.responseTime,
                        backgroundColor: '#f59e0b',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Collector Efficiency'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Pickups Completed'
                        }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Avg. Response Time (min)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    },
    
    initializeGeographicChart: function() {
        const ctx = document.getElementById('geographic-chart');
        if (!ctx) return;
        
        // Get geographic data
        const data = this.getGeographicData();
        
        // Create chart
        this.charts.geographic = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        data: data.values,
                        backgroundColor: [
                            '#3b82f6',
                            '#10b981',
                            '#f59e0b',
                            '#ef4444',
                            '#8b5cf6',
                            '#ec4899'
                        ]
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: true,
                        text: 'Request Distribution by Area'
                    }
                }
            }
        });
    },
    
    createFallbackPerformanceChart: function() {
        const container = document.getElementById('performance-chart-container');
        if (!container) return;
        
        // Get performance data
        const data = this.getPerformanceData();
        
        // Create a simple table as fallback
        const table = document.createElement('table');
        table.className = 'w-full text-sm';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th class="px-2 py-1 text-left">Date</th>
            <th class="px-2 py-1 text-left">Response Time (min)</th>
            <th class="px-2 py-1 text-left">Completion Rate (%)</th>
        `;
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        for (let i = 0; i < data.labels.length; i++) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-2 py-1 border-t">${data.labels[i]}</td>
                <td class="px-2 py-1 border-t">${data.responseTime[i]}</td>
                <td class="px-2 py-1 border-t">${data.completionRate[i]}</td>
            `;
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        
        // Replace canvas with table
        container.innerHTML = '';
        container.appendChild(table);
    },
    
    createFallbackVolumeChart: function() {
        const container = document.getElementById('volume-chart-container');
        if (!container) return;
        
        // Get volume data
        const data = this.getVolumeData();
        
        // Create a simple table as fallback
        const table = document.createElement('table');
        table.className = 'w-full text-sm';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th class="px-2 py-1 text-left">Day</th>
            <th class="px-2 py-1 text-left">New Requests</th>
            <th class="px-2 py-1 text-left">Completed Requests</th>
        `;
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        for (let i = 0; i < data.labels.length; i++) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-2 py-1 border-t">${data.labels[i]}</td>
                <td class="px-2 py-1 border-t">${data.new[i]}</td>
                <td class="px-2 py-1 border-t">${data.completed[i]}</td>
            `;
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        
        // Replace canvas with table
        container.innerHTML = '';
        container.appendChild(table);
    },
    
    createFallbackCollectorChart: function() {
        const container = document.getElementById('collector-chart-container');
        if (!container) return;
        
        // Get collector data
        const data = this.getCollectorData();
        
        // Create a simple table as fallback
        const table = document.createElement('table');
        table.className = 'w-full text-sm';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th class="px-2 py-1 text-left">Collector</th>
            <th class="px-2 py-1 text-left">Pickups Completed</th>
            <th class="px-2 py-1 text-left">Avg. Response Time (min)</th>
        `;
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        for (let i = 0; i < data.labels.length; i++) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-2 py-1 border-t">${data.labels[i]}</td>
                <td class="px-2 py-1 border-t">${data.pickups[i]}</td>
                <td class="px-2 py-1 border-t">${data.responseTime[i]}</td>
            `;
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        
        // Replace canvas with table
        container.innerHTML = '';
        container.appendChild(table);
    },
    
    createFallbackGeographicChart: function() {
        const container = document.getElementById('geographic-chart-container');
        if (!container) return;
        
        // Get geographic data
        const data = this.getGeographicData();
        
        // Create a simple table as fallback
        const table = document.createElement('table');
        table.className = 'w-full text-sm';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th class="px-2 py-1 text-left">Area</th>
            <th class="px-2 py-1 text-left">Request Count</th>
            <th class="px-2 py-1 text-left">Percentage</th>
        `;
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        const total = data.values.reduce((sum, value) => sum + value, 0);
        for (let i = 0; i < data.labels.length; i++) {
            const percentage = ((data.values[i] / total) * 100).toFixed(1);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-2 py-1 border-t">${data.labels[i]}</td>
                <td class="px-2 py-1 border-t">${data.values[i]}</td>
                <td class="px-2 py-1 border-t">${percentage}%</td>
            `;
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        
        // Replace canvas with table
        container.innerHTML = '';
        container.appendChild(table);
    },
    
    getPerformanceData: function() {
        // In a real implementation, this would fetch data from the server
        // For now, we'll return mock data
        return {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            responseTime: [22.5, 20.8, 19.2, 18.7, 18.3, 17.9, 17.5],
            completionRate: [90.2, 91.5, 92.8, 93.4, 94.2, 94.7, 95.1]
        };
    },
    
    getVolumeData: function() {
        // In a real implementation, this would fetch data from the server
        // For now, we'll return mock data
        return {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            new: [42, 38, 45, 53, 58, 62, 48],
            completed: [38, 35, 42, 48, 54, 58, 45]
        };
    },
    
    getCollectorData: function() {
        // In a real implementation, this would fetch data from the server
        // For now, we'll return mock data
        return {
            labels: ['Miguel R.', 'Sarah L.', 'David K.', 'Alex M.', 'Jennifer P.'],
            pickups: [48, 42, 38, 35, 32],
            responseTime: [16.2, 17.5, 18.3, 19.1, 20.4]
        };
    },
    
    getGeographicData: function() {
        // In a real implementation, this would fetch data from the server
        // For now, we'll return mock data
        return {
            labels: ['Downtown', 'Uptown', 'Midtown', 'Westside', 'Eastside', 'Suburbs'],
            values: [125, 98, 87, 65, 54, 42]
        };
    },
    
    generateReport: function(reportType, dateRange, format) {
        console.log(`Generating ${reportType} report for ${dateRange} in ${format} format`);
        
        // In a real implementation, this would generate and download a report
        // For now, we'll just simulate it
        
        // Show a loading indicator
        this.showReportGenerating();
        
        // Simulate report generation delay
        setTimeout(() => {
            // Hide loading indicator
            this.hideReportGenerating();
            
            // Show success message
            this.showReportSuccess(reportType, format);
        }, 2000);
    },
    
    showReportGenerating: function() {
        const container = document.getElementById('report-status');
        if (container) {
            container.innerHTML = `
                <div class="flex items-center text-blue-600">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating report...</span>
                </div>
            `;
        }
    },
    
    hideReportGenerating: function() {
        const container = document.getElementById('report-status');
        if (container) {
            container.innerHTML = '';
        }
    },
    
    showReportSuccess: function(reportType, format) {
        const container = document.getElementById('report-status');
        if (container) {
            container.innerHTML = `
                <div class="flex items-center text-green-600">
                    <i class="fas fa-check-circle mr-2"></i>
                    <span>${reportType} report generated successfully in ${format.toUpperCase()} format</span>
                </div>
            `;
            
            // Clear after a few seconds
            setTimeout(() => {
                this.hideReportGenerating();
            }, 5000);
        }
    }
};

// Export for use in other scripts
window.AnalyticsService = AnalyticsService;
