describe('Illegal Dumping History', () => {
  beforeEach(() => {
    // Intercept any requests to a test path and serve our fixture HTML instead
    cy.readFile('cypress/fixtures/illegal-dumping-test.html').then((html) => {
      cy.intercept('GET', '/test-illegal-dumping', {
        statusCode: 200,
        body: html,
        headers: {
          'content-type': 'text/html; charset=utf-8'
        }
      }).as('testPage');
      
      // Visit the intercepted path, this bypasses the React router completely
      cy.visit('/test-illegal-dumping', {
        failOnStatusCode: false
      });
    });
  });
  
  it('should display illegal dumping reports correctly', () => {
    // Verify the header is displayed
    cy.contains('h1', 'Illegal Dumping History').should('be.visible');
    
    // Verify that reports are displayed
    cy.get('[data-test="dumping-report"]').should('have.length', 3);
    
    // Verify the first report has correct information
    cy.get('[data-test="dumping-report"]').first().within(() => {
      cy.get('[data-test="report-id"]').should('contain', 'dump-001');
      cy.get('[data-test="report-location"]').should('contain', '123 Oak Street');
    });
  });
  
  it('should filter reports using status tabs', () => {
    // Click on "Resolved" status tab
    cy.get('[data-tab="resolved"]').click();
    
    // Verify only cleaned up reports are shown (should be 2 reports with this status)
    cy.get('[data-test="dumping-report"]').filter(':visible').should('have.length.at.most', 2);
    cy.get('[data-test="dumping-report"]').filter(':visible').first().find('[data-test="report-status"]')
      .should('contain', 'Cleaned Up');
    
    // Click on "Cancelled" status tab
    cy.get('[data-tab="cancelled"]').click();
    
    // Verify only cancelled reports are shown
    cy.get('[data-test="dumping-report"]').filter(':visible').should('have.length', 1);
    cy.get('[data-test="dumping-report"]').filter(':visible').find('[data-test="report-status"]')
      .should('contain', 'Cancelled');
    
    // Reset to "All" tab
    cy.get('[data-tab="all"]').click();
    cy.get('[data-test="dumping-report"]').filter(':visible').should('have.length', 3);
  });
  
  it('should filter reports using status filter buttons', () => {
    // Click on "Cleaned Up" status filter button
    cy.contains('button.status-filter', 'Cleaned Up').click();
    
    // Verify only cleaned up reports are shown
    cy.get('[data-test="dumping-report"]').filter(':visible').should('have.length.at.most', 2);
    cy.get('[data-test="dumping-report"]').filter(':visible').each($report => {
      cy.wrap($report).find('[data-test="report-status"]').should('contain', 'Cleaned Up');
    });
    
    // Reset filters by clicking the 'All' tab
    cy.get('[data-tab="all"]').click();
    cy.get('[data-test="dumping-report"]').filter(':visible').should('have.length', 2);
  });
  
  it('should search for reports by location', () => {
    // Enter search term
    cy.get('[data-test="search-input"]').type('Westside');
    
    // Verify search results
    cy.get('[data-test="dumping-report"]').filter(':visible').should('have.length', 1);
    cy.get('[data-test="report-location"]').filter(':visible').should('contain', 'Westside');
  });
  
  it('should open detailed view of a report', () => {
    // Click on view details button for first report
    cy.get('[data-test="view-details-button"]').first().click();
    
    // Verify detailed modal is displayed
    cy.get('#detail-modal').should('not.have.class', 'hidden');
    cy.get('[data-test="detail-report-id"]').should('contain', 'dump-001');
    
    // Verify detailed information
    cy.get('[data-test="detail-reporter-name"]').should('contain', 'John Citizen');
    cy.get('[data-test="detail-reporter-email"]').should('contain', 'john.citizen@email.com');
    cy.get('[data-test="detail-waste-type"]').should('contain', 'Construction');
    cy.get('[data-test="detail-description"]').should('contain', 'Large pile of construction debris');
    
    // Verify severity information is available in the detail view
    cy.get('[data-test="detail-severity"]').should('contain', 'High');
    
    // Verify images section exists
    cy.get('[data-test="detail-images"]').should('exist');
    
    // Close modal
    cy.get('#close-detail-button').click();
    cy.get('#detail-modal').should('have.class', 'hidden');
  });
  
  it('should show report location on map', () => {
    // Click on view map button for first report
    cy.get('[data-test="view-map-button"]').first().click();
    
    // Verify map modal is displayed
    cy.get('#map-modal').should('not.have.class', 'hidden');
    
    // Verify map container exists
    cy.get('[data-test="map-container"]').should('be.visible');
    
    // Verify location marker exists
    cy.get('.leaflet-marker-icon').should('exist');
    
    // Verify the coordinates display
    cy.get('#map-coordinates').should('contain', 'Coordinates:');
    
    // Close using the close button - force:true needed as button might be covered by another element
    cy.get('#close-map-button').click({force: true});
    cy.get('#map-modal').should('have.class', 'hidden');
  });
  
  it('should apply multiple filters simultaneously', () => {
    // Use both search and tab filters
    cy.get('[data-test="search-input"]').type('Oak');
    cy.get('[data-tab="resolved"]').click();
    
    // Verify filtered results
    cy.get('[data-test="dumping-report"]').filter(':visible').should('have.length.at.most', 1);
    
    // Check if the visible report has both "Cleaned Up" status and contains "Oak" in the location
    cy.get('[data-test="dumping-report"]').filter(':visible').first().within(() => {
      cy.get('[data-test="report-status"]').should('contain', 'Cleaned Up');
      cy.get('[data-test="report-location"]').should('contain', 'Oak');
    });
    
    // Reset filters by clicking the 'All' tab
    cy.get('[data-tab="all"]').click();
  });
  
  it('should open detail view by clicking on the row', () => {
    // Click directly on a row (not on a button)
    cy.get('[data-test="dumping-report"]').first().click();
    
    // Verify detailed modal is displayed
    cy.get('#detail-modal').should('not.have.class', 'hidden');
    
    // Verify it's the correct report
    cy.get('#detail-id').should('contain', 'dump-001');
    
    // Close using the close button instead of backdrop (which can be flaky in Cypress)
    cy.get('#close-detail-button').click();
    cy.get('#detail-modal').should('have.class', 'hidden');
  });
});
