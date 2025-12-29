import React from 'react';

// CSV export utility
const exportToCSV = (alerts) => {
  // Define column headers
  const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Created At', 'Updated At', 'Related Type', 'Related ID', 'Location', 'Assigned To'];
  
  // Format data for CSV
  const csvData = alerts.map(alert => ([
    alert.id,
    `"${alert.title.replace(/"/g, '""')}"`, // Escape quotes in title
    `"${alert.description.replace(/"/g, '""')}"`, // Escape quotes in description
    alert.status,
    alert.priority,
    new Date(alert.createdAt).toLocaleString(),
    new Date(alert.updatedAt).toLocaleString(),
    alert.relatedTo.type,
    alert.relatedTo.id,
    alert.relatedTo.location || '',
    alert.assignedTo || ''
  ]));
  
  // Combine headers and data
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => row.join(','))
  ].join('\n');
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `alerts-export-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// JSON export utility
const exportToJSON = (alerts) => {
  const jsonContent = JSON.stringify(alerts, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `alerts-export-${new Date().toISOString().split('T')[0]}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Print utility
const printAlerts = (alerts) => {
  // Create a printable version
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Alerts Report - ${new Date().toLocaleDateString()}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
        }
        h1 {
          color: #333;
          border-bottom: 1px solid #ccc;
          padding-bottom: 10px;
        }
        .alert {
          border: 1px solid #ddd;
          padding: 10px;
          margin-bottom: 10px;
          border-radius: 5px;
        }
        .alert-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .alert-title {
          font-weight: bold;
        }
        .critical { background-color: #FFEBEE; }
        .high { background-color: #FFF8E1; }
        .medium { background-color: #E8F5E9; }
        .low { background-color: #E3F2FD; }
        .property { margin: 2px 0; }
        .property span { font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Alerts Report - ${new Date().toLocaleDateString()}</h1>
      <div>Total Alerts: ${alerts.length}</div>
      <div>Generated: ${new Date().toLocaleString()}</div>
      <hr>
      
      ${alerts.map(alert => `
        <div class="alert ${alert.priority}">
          <div class="alert-header">
            <div class="alert-title">${alert.title}</div>
            <div>${new Date(alert.createdAt).toLocaleString()}</div>
          </div>
          <div class="property"><span>Status:</span> ${alert.status}</div>
          <div class="property"><span>Priority:</span> ${alert.priority}</div>
          <div class="property"><span>Description:</span> ${alert.description}</div>
          <div class="property">
            <span>Related to:</span> 
            ${alert.relatedTo.type} (${alert.relatedTo.id})
            ${alert.relatedTo.location ? `- ${alert.relatedTo.location}` : ''}
          </div>
          <div class="property">
            <span>Assigned to:</span> ${alert.assignedTo || 'Not assigned'}
          </div>
        </div>
      `).join('')}
    </body>
    </html>
  `;
  
  // Open print window
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Wait for resources to load then print
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};

const AlertExport = ({ alerts, filteredAlerts }) => {
  return (
    <div className="dropdown inline-block relative">
      <button className="bg-white text-gray-700 font-semibold py-2 px-4 rounded inline-flex items-center border border-gray-300 hover:bg-gray-50">
        <span className="mr-1">Export</span>
        <i className="fas fa-chevron-down"></i>
      </button>
      <ul className="dropdown-menu absolute hidden text-gray-700 pt-1 bg-white shadow-lg rounded-md border border-gray-200 w-48 z-10 right-0">
        <li>
          <button 
            className="w-full text-left rounded-t py-2 px-4 hover:bg-gray-100 flex items-center"
            onClick={() => exportToCSV(filteredAlerts)}
          >
            <i className="fas fa-file-csv mr-2 text-green-600"></i>
            Export to CSV
          </button>
        </li>
        <li>
          <button 
            className="w-full text-left py-2 px-4 hover:bg-gray-100 flex items-center"
            onClick={() => exportToJSON(filteredAlerts)}
          >
            <i className="fas fa-file-code mr-2 text-blue-600"></i>
            Export to JSON
          </button>
        </li>
        <li>
          <button 
            className="w-full text-left rounded-b py-2 px-4 hover:bg-gray-100 flex items-center"
            onClick={() => printAlerts(filteredAlerts)}
          >
            <i className="fas fa-print mr-2 text-gray-600"></i>
            Print Alerts
          </button>
        </li>
      </ul>
    </div>
  );
};

export default AlertExport;
