describe('Logs Management', () => {
  beforeEach(() => {
    // Mock authentication
    cy.window().then((window) => {
      window.localStorage.setItem('trashdrop_authenticated', 'true');
    });
    
    // Mock API responses
    cy.intercept('GET', '**/rest/v1/logs*', {
      fixture: 'logs.json'
    }).as('getLogs');
    
    // Visit the logs management page
    cy.visit('/request-pickup/logs');
    
    // Wait for the data to load
    cy.wait('@getLogs');
  });
  
  it('should display log entries correctly', () => {
    // Verify the page title
    cy.get('[data-test=page-title]').should('contain', 'Logs');
    
    // Verify summary cards
    cy.get('[data-test=summary-card-error]').should('contain', '2');
    cy.get('[data-test=summary-card-warning]').should('contain', '1');
    cy.get('[data-test=summary-card-total]').should('contain', '5');
    
    // Verify that log entries are displayed
    cy.get('[data-test=log-row]').should('have.length', 5);
    
    // Verify the first log has correct information and formatting
    cy.get('[data-test=log-row]').first().within(() => {
      // Check that ERROR level is properly color-coded
      cy.get('[data-test=log-level]')
        .should('contain', 'ERROR')
        .and('have.class', 'text-red-600');
      
      cy.get('[data-test=log-message]').should('contain', 'Failed to connect to database');
      cy.get('[data-test=log-source]').should('contain', 'API');
    });
  });
  
  it('should filter logs by level', () => {
    // Open level filter dropdown
    cy.get('[data-test=level-filter]').click();
    
    // Select ERROR level
    cy.get('[data-test=level-option-error]').click();
    
    // Verify only ERROR logs are shown
    cy.get('[data-test=log-row]').should('have.length', 2);
    cy.get('[data-test=log-row]').each(($row) => {
      cy.wrap($row).find('[data-test=log-level]').should('contain', 'ERROR');
    });
    
    // Change filter to WARNING level
    cy.get('[data-test=level-filter]').click();
    cy.get('[data-test=level-option-warning]').click();
    
    // Verify only WARNING logs are shown
    cy.get('[data-test=log-row]').should('have.length', 1);
    cy.get('[data-test=log-row]').find('[data-test=log-level]').should('contain', 'WARNING');
  });
  
  it('should filter logs by source', () => {
    // Open source filter dropdown
    cy.get('[data-test=source-filter]').click();
    
    // Select API source
    cy.get('[data-test=source-option-api]').click();
    
    // Verify only API logs are shown
    cy.get('[data-test=log-row]').should('have.length', 2);
    cy.get('[data-test=log-row]').each(($row) => {
      cy.wrap($row).find('[data-test=log-source]').should('contain', 'API');
    });
  });
  
  it('should filter logs by date range', () => {
    // Set start date to 2025-06-22T10:00:00Z
    cy.get('[data-test=date-start-input]').type('2025-06-22T10:00:00');
    
    // Set end date to 2025-06-22T12:00:00Z
    cy.get('[data-test=date-end-input]').type('2025-06-22T12:00:00');
    
    // Apply date filter
    cy.get('[data-test=apply-date-filter]').click();
    
    // Verify only logs within date range are shown
    cy.get('[data-test=log-row]').should('have.length', 2);
    cy.contains('[data-test=log-message]', 'Daily backup completed successfully').should('exist');
    cy.contains('[data-test=log-message]', 'Location data received from collector app').should('exist');
  });
  
  it('should search logs by text', () => {
    // Enter search term
    cy.get('[data-test=search-input]').type('payment');
    
    // Verify search results
    cy.get('[data-test=log-row]').should('have.length', 1);
    cy.get('[data-test=log-message]').should('contain', 'Payment processing failed');
  });
  
  it('should expand row to show detailed log information', () => {
    // Click to expand the first log row
    cy.get('[data-test=expand-row-button]').first().click();
    
    // Verify detailed information is displayed
    cy.get('[data-test=log-details]').should('be.visible');
    cy.get('[data-test=log-details-id]').should('contain', 'log-001');
    cy.get('[data-test=log-details-ip]').should('contain', '192.168.1.1');
    cy.get('[data-test=log-details-performance]').should('contain', '31542');
    cy.get('[data-test=log-details-related]').should('contain', 'Database');
    
    // Collapse the row again
    cy.get('[data-test=expand-row-button]').first().click();
    cy.get('[data-test=log-details]').should('not.be.visible');
  });
  
  it('should paginate logs correctly', () => {
    // Mock API response with more logs for pagination testing
    const generateLogs = (count) => {
      const logs = [];
      for (let i = 0; i < count; i++) {
        logs.push({
          id: `log-${1000 + i}`,
          timestamp: `2025-06-22T${String(i % 24).padStart(2, '0')}:00:00Z`,
          level: ['INFO', 'WARNING', 'ERROR', 'DEBUG'][i % 4],
          source: ['API', 'Frontend', 'System', 'Mobile App'][i % 4],
          user: `user${i}@example.com`,
          message: `Test log message ${i}`,
          details: `Test details ${i}`,
          ip: `192.168.1.${i}`,
          related_entity: 'Test',
          performance_ms: i * 100
        });
      }
      return logs;
    };
    
    cy.intercept('GET', '**/rest/v1/logs*', {
      body: generateLogs(25)
    }).as('getMoreLogs');
    
    // Reload the page to get the new mock data
    cy.visit('/request-pickup/logs');
    cy.wait('@getMoreLogs');
    
    // Verify we have the first page with 10 entries by default
    cy.get('[data-test=log-row]').should('have.length', 10);
    
    // Change entries per page to 25
    cy.get('[data-test=entries-per-page]').select('25');
    
    // Verify we now have 25 entries
    cy.get('[data-test=log-row]').should('have.length', 25);
    
    // Change back to 10 entries
    cy.get('[data-test=entries-per-page]').select('10');
    
    // Go to next page
    cy.get('[data-test=next-page-button]').click();
    
    // Verify we're on page 2
    cy.get('[data-test=current-page]').should('contain', '2');
    cy.get('[data-test=log-row]').first().find('[data-test=log-message]').should('contain', 'Test log message 10');
  });
});
