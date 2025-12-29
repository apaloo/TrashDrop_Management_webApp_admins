/// <reference types="cypress" />

describe('Mobile App Reports Verification', () => {
  beforeEach(() => {
    // Intercept the request to load mobile app reports
    cy.intercept('GET', '**/rest/v1/dumping_reports**', {
      fixture: 'mobile-reports-verification.json'
    }).as('getMobileReports');
    
    // Intercept the request to load collectors for assignment
    cy.intercept('GET', '**/rest/v1/collectors**', {
      fixture: 'collectors.json'
    }).as('getCollectors');

    // Intercept the verification API call
    cy.intercept('POST', '**/rest/v1/rpc/verifyDumpingReport', {
      statusCode: 200,
      body: { id: '12345', status: 'Verified' }
    }).as('verifyReport');
    
    // Intercept the assignment API call
    cy.intercept('POST', '**/rest/v1/rpc/assignDumpingCleaner', {
      statusCode: 200,
      body: { success: true }
    }).as('assignCleaner');

    // Visit the page that contains our component
    cy.visit('/illegal-dumping-history');
    cy.wait('@getMobileReports');
  });

  it('should display mobile reports pending verification', () => {
    // Check the component title is visible
    cy.contains('Mobile App Reports Pending Verification').should('be.visible');
    
    // Check the table headers are displayed
    cy.contains('th', 'Reporter').should('be.visible');
    cy.contains('th', 'Location').should('be.visible');
    cy.contains('th', 'Waste Type').should('be.visible');
    cy.contains('th', 'Size').should('be.visible');
    cy.contains('th', 'Reported On').should('be.visible');
    cy.contains('th', 'Images').should('be.visible');
    cy.contains('th', 'Actions').should('be.visible');
    
    // Check at least one report is displayed
    cy.get('table tbody tr').should('have.length.at.least', 1);
  });

  it('should verify a report when clicking verify button', () => {
    // Find the first verify button and click it
    cy.contains('button', 'Verify').first().click();
    
    // Wait for the API call to complete
    cy.wait('@verifyReport');
    
    // Check the success message appears
    cy.contains('Report verified and task created successfully').should('be.visible');
  });

  it('should show image gallery when clicking on view images', () => {
    // Find a view images link and click it
    cy.contains('button', 'View').first().click();
    
    // Check the image modal appears
    cy.get('.fixed.inset-0.z-50').should('be.visible');
    cy.get('.fixed.inset-0.z-50 img').should('be.visible');
    
    // Close the gallery
    cy.get('.fixed.inset-0.z-50 button[aria-label="Close"]').click();
    cy.get('.fixed.inset-0.z-50').should('not.exist');
  });

  it('should open assignment modal after verifying a report', () => {
    // First verify a report
    cy.contains('button', 'Verify').first().click();
    cy.wait('@verifyReport');
    
    // Now check for the assign cleaner button and click it
    cy.contains('button', 'Assign Cleaner').first().click();
    
    // Verify the assignment modal appears
    cy.contains('h3', 'Assign Cleaner').should('be.visible');
    
    // Check collector dropdown loads
    cy.wait('@getCollectors');
    cy.get('select#collector').should('be.visible');
    
    // Check date picker is present
    cy.get('input#date').should('be.visible');
    
    // Fill in the form
    cy.get('select#collector').select(1);
    cy.get('input#date').type('2025-12-31');
    cy.get('textarea#notes').type('Test assignment notes');
    
    // Submit the assignment
    cy.contains('button', 'Assign Cleaner').click();
    cy.wait('@assignCleaner');
    
    // Check success message
    cy.contains('Cleaner assigned successfully').should('be.visible');
  });

  it('should refresh the list when clicking refresh button', () => {
    // Click refresh button
    cy.contains('button', 'Refresh').click();
    
    // Wait for the API call
    cy.wait('@getMobileReports');
    
    // Verify that the table is still visible
    cy.get('table tbody tr').should('have.length.at.least', 1);
  });
});
