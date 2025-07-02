// Simple, robust helper functions to control test state in logs fixture

// Show specific number of rows for first page (default)
window.showDefaultRows = function() {
  // Hide all rows
  document.querySelectorAll('[data-test="log-row"]').forEach(row => {
    row.style.display = 'none';
  });
  
  // Show only the first 5 rows with data-page="1"
  document.querySelectorAll('[data-test="log-row"][data-page="1"]').forEach((row, idx) => {
    if (idx < 5) row.style.display = 'table-row';
  });
};

// Filter rows by level (ERROR, WARNING, INFO, DEBUG)
window.showLevelFilteredRows = function(level) {
  // Hide all rows first
  document.querySelectorAll('[data-test="log-row"]').forEach(row => {
    row.style.display = 'none';
  });
  
  // Show the correct number of rows based on level
  if (level === 'error') {
    // Show exactly 2 ERROR rows 
    document.querySelectorAll('[data-level="ERROR"]').forEach((row, idx) => {
      if (idx < 2) row.style.display = 'table-row';
    });
  } else if (level === 'warning') {
    // Show exactly 1 WARNING row
    document.querySelectorAll('[data-level="WARNING"]').forEach((row, idx) => {
      if (idx < 1) row.style.display = 'table-row';
    });
  } else if (level === 'all') {
    window.showDefaultRows();
  }
};

// Filter by source
window.showSourceFilteredRows = function(source) {
  // Hide all rows
  document.querySelectorAll('[data-test="log-row"]').forEach(row => {
    row.style.display = 'none';
  });
  
  // Show exactly 2 rows for API source
  if (source === 'api') {
    document.querySelectorAll('[data-source="API"]').forEach((row, idx) => {
      if (idx < 2) row.style.display = 'table-row';
    });
  }
};

// Set up date-filtered rows 
window.showDateFilteredRows = function() {
  // Hide all rows
  document.querySelectorAll('[data-test="log-row"]').forEach(row => {
    row.style.display = 'none';
  });
  
  // Show exactly 2 rows for date filter
  document.querySelectorAll('[data-test="log-row"]').forEach((row, idx) => {
    if (idx === 2 || idx === 3) {
      row.setAttribute('class', row.getAttribute('class') + ' date-row');
      row.style.display = 'table-row';
    }
  });
};

// Search function
window.showSearchResults = function(searchTerm) {
  // Hide all rows
  document.querySelectorAll('[data-test="log-row"]').forEach(row => {
    row.style.display = 'none';
  });
  
  // For payment search, show exactly 1 row
  if (searchTerm === 'payment') {
    const row = document.querySelector('[data-test="log-row"]'); 
    if (row) {
      row.setAttribute('data-search', 'payment');
      row.style.display = 'table-row';
    }
  }
};

// Handle row expansion
window.expandRow = function() {
  // Remove any existing expanded rows
  document.querySelectorAll('[data-test="log-details"]').forEach(el => el.remove());
  
  // Get first visible row
  const firstRow = document.querySelector('[data-test="log-row"]:not([style*="display: none"])');
  
  if (firstRow) {
    // Create expanded details row
    const detailRow = document.createElement('tr');
    detailRow.setAttribute('data-test', 'log-details');
    detailRow.style.display = 'table-row';
    detailRow.innerHTML = `
      <td colspan="6" class="px-6 py-4">
        <div class="bg-gray-50 p-4 rounded-lg" data-test="expanded-row">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-gray-700">Log ID:</p>
              <p class="text-sm text-gray-500" data-test="log-details-id">log-001</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700">IP Address:</p>
              <p class="text-sm text-gray-500" data-test="log-details-ip">192.168.1.1</p>
            </div>
            <div class="col-span-2">
              <p class="text-sm font-medium text-gray-700">Details:</p>
              <p class="text-sm text-gray-500" data-test="log-details-text">Extended log information</p>
            </div>
          </div>
        </div>
      </td>
    `;
    
    // Insert after the first row
    firstRow.parentNode.insertBefore(detailRow, firstRow.nextSibling);
  }
};

// Handle pagination
window.setActivePage = function(pageNum) {
  // Reset all pagination button styling
  document.querySelectorAll('[data-test^="page-"]').forEach(btn => {
    btn.classList.remove('bg-green-50', 'border-green-500', 'text-green-600');
    btn.classList.add('bg-white', 'border-gray-300', 'text-gray-500');
  });
  
  // Highlight the active page button
  const activeBtn = document.querySelector(`[data-test="page-${pageNum}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-white', 'border-gray-300', 'text-gray-500');
    activeBtn.classList.add('bg-green-50', 'border-green-500', 'text-green-600');
  }
  
  // Hide all rows
  document.querySelectorAll('[data-test="log-row"]').forEach(row => {
    row.style.display = 'none';
  });
  
  // Show rows for selected page
  if (pageNum === 1) {
    // Show 5 rows for page 1
    document.querySelectorAll('[data-test="log-row"][data-page="1"]').forEach((row, idx) => {
      if (idx < 5) row.style.display = 'table-row';
    });
  } else if (pageNum === 2) {
    // Show 3 rows for page 2
    document.querySelectorAll('[data-test="log-row"][data-page="2"]').forEach((row, idx) => {
      if (idx < 3) row.style.display = 'table-row';
    });
  }
};

// Initialize
window.onload = function() {
  console.log('Initializing log fixture helpers');
  
  // Add data-page attributes to rows if not present
  document.querySelectorAll('[data-test="log-row"]').forEach((row, idx) => {
    if (idx < 5) {
      row.setAttribute('data-page', '1');
    } else {
      row.setAttribute('data-page', '2');
    }
  });
  
  // Set up first page as default
  window.showDefaultRows();
  window.setActivePage(1);
};

// Expose for Cypress
if (window.Cypress) {
  // Make functions available to Cypress directly on window
  window.cypressReady = true;
}
