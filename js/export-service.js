/**
 * TrashDrop Admin Dashboard - Export Service
 * Handles exporting data to various formats (CSV, PDF, Excel)
 */

const ExportService = {
    // Initialize the export service
    init: function() {
        console.log('Initializing Export Service');
        return this;
    },
    
    // Export data to CSV
    exportToCSV: function(data, filename = 'export.csv') {
        if (!data || !data.length) {
            console.error('No data to export');
            return false;
        }
        
        // Get headers from first object keys
        const headers = Object.keys(data[0]);
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        // Add data rows
        data.forEach(item => {
            const row = headers.map(header => {
                // Handle special cases (objects, arrays, etc.)
                let cell = item[header];
                if (cell === null || cell === undefined) {
                    return '';
                } else if (typeof cell === 'object') {
                    cell = JSON.stringify(cell);
                }
                
                // Escape quotes and wrap in quotes if contains comma
                cell = String(cell).replace(/"/g, '""');
                if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
                    cell = `"${cell}"`;
                }
                
                return cell;
            }).join(',');
            
            csvContent += row + '\n';
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return true;
    },
    
    // Export data to PDF
    exportToPDF: function(elementId, filename = 'export.pdf', options = {}) {
        if (!window.html2pdf) {
            console.error('html2pdf.js library is required for PDF export');
            this.showLibraryError('html2pdf.js');
            return false;
        }
        
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element with ID "${elementId}" not found`);
            return false;
        }
        
        // Default options
        const defaultOptions = {
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Merge options
        const mergedOptions = { ...defaultOptions, ...options };
        
        // Generate PDF
        html2pdf().from(element).set(mergedOptions).save();
        
        return true;
    },
    
    // Export reports to CSV
    exportReports: function(reports, format = 'csv') {
        if (!reports || !reports.length) {
            console.error('No reports to export');
            return false;
        }
        
        // Prepare data for export (flatten nested objects)
        const exportData = reports.map(report => {
            return {
                'Report ID': report.id,
                'Date Reported': report.dateReported,
                'Location': report.location.address,
                'Status': report.status,
                'Priority': report.priority,
                'Type': report.type,
                'Description': report.description,
                'Reporter Name': report.reporter.name,
                'Reporter Contact': report.reporter.contact,
                'Last Updated': report.lastUpdated,
                'Assigned To': report.assignedTo || 'Unassigned',
                'Latitude': report.location.coordinates.lat,
                'Longitude': report.location.coordinates.lng
            };
        });
        
        // Export based on format
        if (format === 'csv') {
            return this.exportToCSV(exportData, 'trashdrop_reports.csv');
        } else if (format === 'pdf') {
            // For PDF, we need to create a temporary table
            this.createTemporaryReportTable(exportData);
            const result = this.exportToPDF('temp-export-container', 'trashdrop_reports.pdf');
            this.removeTemporaryReportTable();
            return result;
        }
        
        return false;
    },
    
    // Create temporary table for PDF export
    createTemporaryReportTable: function(data) {
        // Remove existing container if any
        this.removeTemporaryReportTable();
        
        // Create container
        const container = document.createElement('div');
        container.id = 'temp-export-container';
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        
        // Add title
        const title = document.createElement('h2');
        title.textContent = 'TrashDrop Illegal Dumping Reports';
        title.style.textAlign = 'center';
        title.style.marginBottom = '20px';
        container.appendChild(title);
        
        // Add date
        const date = document.createElement('p');
        date.textContent = `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
        date.style.textAlign = 'center';
        date.style.marginBottom = '30px';
        container.appendChild(date);
        
        // Create table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        
        // Add headers
        const headers = Object.keys(data[0]);
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            th.style.border = '1px solid #ddd';
            th.style.padding = '8px';
            th.style.backgroundColor = '#f2f2f2';
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Add data rows
        const tbody = document.createElement('tbody');
        
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
            
            headers.forEach(header => {
                const td = document.createElement('td');
                td.textContent = item[header] || '';
                td.style.border = '1px solid #ddd';
                td.style.padding = '8px';
                row.appendChild(td);
            });
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        container.appendChild(table);
        
        // Add to document
        document.body.appendChild(container);
    },
    
    // Remove temporary table
    removeTemporaryReportTable: function() {
        const container = document.getElementById('temp-export-container');
        if (container) {
            document.body.removeChild(container);
        }
    },
    
    // Show library error message
    showLibraryError: function(libraryName) {
        const message = `The ${libraryName} library is required for this feature but is not loaded. Please include it in your project.`;
        
        // Create modal if it doesn't exist
        if (!document.getElementById('library-error-modal')) {
            const modal = document.createElement('div');
            modal.id = 'library-error-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            
            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-semibold text-lg">Missing Library</h3>
                        <button id="close-library-error-modal" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="mb-6">
                        <p id="library-error-message">${message}</p>
                    </div>
                    <div class="flex justify-end">
                        <button id="confirm-library-error" class="px-4 py-2 bg-blue-600 text-white rounded-md">OK</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('close-library-error-modal').addEventListener('click', () => {
                document.getElementById('library-error-modal').remove();
            });
            
            document.getElementById('confirm-library-error').addEventListener('click', () => {
                document.getElementById('library-error-modal').remove();
            });
        } else {
            // Update message if modal already exists
            document.getElementById('library-error-message').textContent = message;
        }
    },
    
    // Load required libraries
    loadLibraries: function() {
        // Check if html2pdf is already loaded
        if (!window.html2pdf) {
            // Create script element for html2pdf
            const html2pdfScript = document.createElement('script');
            html2pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            html2pdfScript.async = true;
            
            // Append to document
            document.head.appendChild(html2pdfScript);
            
            console.log('html2pdf.js library loaded');
        }
    }
};

// Initialize when the DOM is loaded
$(document).ready(function() {
    ExportService.init();
    ExportService.loadLibraries();
});
