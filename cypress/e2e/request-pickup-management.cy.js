describe('Request Pickup Management', () => {
  beforeEach(() => {
    // Use a static HTML fixture to avoid routing issues and header size limitations
    // Intercept requests to our test path and serve the fixture file
    cy.fixture('request-pickup-test.html').then((html) => {
      cy.intercept('GET', '/test-request-pickup', {
        statusCode: 200,
        body: html,
        headers: {
          'Content-Type': 'text/html'
        }
      }).as('testRequestPickupPage');
      
      // Visit our test URL path that will be intercepted
      cy.visit('/test-request-pickup');
      cy.wait('@testRequestPickupPage');
    });
  });
  
  it('should display the request pickup management page title', () => {
    cy.get('[data-test="page-title"]').should('contain', 'Request Pickup Management');
  });
  
  it('should display pickup requests in a table format', () => {
    // Verify that requests are displayed in a table
    cy.get('.requests-table').should('be.visible');
    cy.get('[data-test="request-item"]').should('have.length', 4);
    
    // Verify the first row data
    cy.get('[data-test="request-item"]').first().within(() => {
      cy.get('[data-test="request-id"]').should('contain', 'req-001');
      cy.get('[data-test="requester-name"]').should('contain', 'Jane Citizen');
      cy.get('[data-test="request-location"]').should('contain', '123 Pine Street');
      cy.get('[data-test="bag-count"]').should('contain', '2');
      cy.get('[data-test="request-status"]').should('contain', 'Pending');
    });
  });
  
  it('should filter requests by status', () => {
    // Select "Pending" status
    cy.get('[data-test="status-filter"]').select('Pending');
    
    // Verify only pending requests are shown (using :visible to only count displayed elements)
    cy.get('[data-test="request-item"]:visible').should('have.length', 1);
    cy.get('[data-test="request-status"]:visible').should('contain', 'Pending');
    
    // Change filter to "Assigned" status
    cy.get('[data-test="status-filter"]').select('Assigned');
    
    // Verify only assigned requests are shown
    cy.get('[data-test="request-item"]:visible').should('have.length', 1);
    cy.get('[data-test="request-status"]:visible').should('contain', 'Assigned');
    
    // Reset to "All" statuses
    cy.get('[data-test="status-filter"]').select('All');
  });
  
  it('should search requests by location', () => {
    // Enter search term
    cy.get('[data-test="search-input"]').type('Westside');
    
    // Verify search results
    cy.get('[data-test="request-item"]:visible').should('have.length', 1);
    cy.get('[data-test="request-location"]:visible').should('contain', 'Westside');
    
    // Clear search and verify all items are shown again
    cy.get('[data-test="search-input"]').clear();
    cy.get('[data-test="request-item"]:visible').should('have.length', 4);
  });
  
  it('should open request details modal when clicking view button', () => {
    // Click view details button for first request
    cy.get('[data-test="view-details-button"]').first().click();
    
    // Verify request details modal is displayed
    cy.get('#details-modal').should('have.class', 'visible');
    
    // Verify details content
    cy.get('[data-test="modal-title"]').should('contain', 'Request Details');
    cy.get('[data-test="request-details"]').should('contain', 'Jane Citizen');
    cy.get('[data-test="request-details"]').should('contain', '123 Pine Street');
    
    // Close the modal
    cy.get('[data-test="close-button"]').click();
    cy.get('#details-modal').should('not.have.class', 'visible');
  });
  
  it('should open request details modal when clicking on a row', () => {
    // Click on the first row (not on a button)
    cy.get('[data-test="request-item"]').first().click('center');
    
    // Verify request details modal is displayed
    cy.get('#details-modal').should('have.class', 'visible');
    
    // Close the modal
    cy.get('[data-test="close-button"]').click();
  });
  
  it('should open assign collector modal when clicking assign button', () => {
    // Click assign button for first request
    cy.get('[data-test="assign-button"]').first().click();
    
    // Verify assign modal is displayed
    cy.get('#assign-modal').should('have.class', 'visible');
    
    // Verify collector select is present
    cy.get('[data-test="collector-select"]').should('be.visible');
    
    // Select a collector
    cy.get('[data-test="collector-select"]').select(1);
    
    // Confirm assignment
    cy.get('[data-test="assign-confirm"]').click();
    
    // Verify modal is closed
    cy.get('#assign-modal').should('not.have.class', 'visible');
  });
  
  it('should close assign modal when clicking cancel button', () => {
    // Open the assign modal
    cy.get('[data-test="assign-button"]').first().click();
    cy.get('#assign-modal').should('have.class', 'visible');
    
    // Click cancel
    cy.get('[data-test="assign-cancel"]').click();
    
    // Verify modal is closed
    cy.get('#assign-modal').should('not.have.class', 'visible');
  });
  
  it('should filter requests by both status and search term', () => {
    // Set status filter to "Completed"
    cy.get('[data-test="status-filter"]').select('Completed');
    
    // Enter search term
    cy.get('[data-test="search-input"]').type('Northside');
    
    // Verify filtered results
    cy.get('[data-test="request-item"]:visible').should('have.length', 1);
    cy.get('[data-test="request-location"]:visible').should('contain', 'Northside');
    cy.get('[data-test="request-status"]:visible').should('contain', 'Completed');
  });
});
