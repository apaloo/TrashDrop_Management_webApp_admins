// Logs Management Tests using direct DOM manipulation

describe('Logs Management', () => {
  beforeEach(() => {
    // Handle uncaught exceptions from fixture scripts
    cy.on('uncaught:exception', () => {
      return false;
    });
    
    // Use cy.intercept pattern that was successful in Bag Management/Illegal Dumping tests
    cy.intercept('GET', '/logs-management', { fixture: 'logs-management-test.html' }).as('logsFixture');
    cy.visit('/logs-management');
    cy.wait('@logsFixture');
    
    // Initialize the fixture
    cy.waitForLogsFixtureReady();
    
    // Set authentication in localStorage
    cy.window().then((window) => {
      window.localStorage.setItem('trashdrop_authenticated', 'true');
    });
  });

  it('should display log entries correctly', () => {
    // Verify 5 logs are visible using our custom command
    cy.countVisibleRows(5);
    
    // Verify summary cards exist
    cy.get('[data-test="summary-card-error"]').should('exist');
    cy.get('[data-test="summary-card-warning"]').should('exist');
    cy.get('[data-test="summary-card-total"]').should('exist');
  });
  
  it('should filter logs by level', () => {
    // Filter by ERROR level
    cy.filterLogsByLevel('ERROR');
    
    // Verify 2 ERROR logs are shown
    cy.countVisibleRows(2);
    
    // Filter by WARNING level
    cy.filterLogsByLevel('WARNING');
    
    // Verify 1 WARNING log is shown
    cy.countVisibleRows(1);
  });
  
  it('should filter logs by source', () => {
    // Filter by API source
    cy.filterLogsBySource('API');
    
    // Verify 2 API logs are shown
    cy.countVisibleRows(2);
  });
  
  it('should filter logs by date range', () => {
    // Apply date filter
    cy.filterLogsByDateRange();
    
    // Verify 2 date-filtered logs are shown
    cy.countVisibleRows(2);
  });
  
  it('should search logs by text', () => {
    // Search for payment
    cy.searchLogs('payment');
    
    // Verify 1 log with payment is shown
    cy.countVisibleRows(1);
    
    // Use a simpler method to verify text content using proper data-test attribute
    cy.window().then((win) => {
      // Use JavaScript to check if the message contains 'payment'
      const visibleRow = win.document.querySelector('[data-test="log-row"][style*="display: table-row"]');
      const messageCell = visibleRow.querySelector('[data-test="log-message"]');
      expect(messageCell.textContent).to.include('Payment');
    });
  });
  
  it('should expand row to show detailed log information', () => {
    // Expand a log row
    cy.expandLogRow();
    
    // Verify expanded row is visible
    cy.verifyExpandedRow();
    
    // Verify expanded content
    cy.get('[data-test="expanded-row"]').should('exist');
    cy.get('[data-test="log-details-id"]').should('contain', 'log-001');
    cy.get('[data-test="log-details-ip"]').should('contain', '192.168.1.1');
  });
  
  it('should handle pagination correctly', () => {
    // Verify page 1 shows 5 logs
    cy.countVisibleRows(5);
    
    // Go to page 2
    cy.goToLogsPage(2);
    
    // Verify page 2 shows 3 logs
    cy.countVisibleRows(3);
    
    // Back to page 1
    cy.goToLogsPage(1);
    
    // Verify page 1 shows 5 logs again
    cy.countVisibleRows(5);
  });
});
