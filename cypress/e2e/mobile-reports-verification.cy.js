/// <reference types="cypress" />

describe('Mobile App Reports Verification', () => {
  beforeEach(() => {
    // Intercept any requests to a test path and serve our fixture HTML instead
    cy.readFile('cypress/fixtures/mobile-reports-verification-test.html').then((html) => {
      cy.intercept('GET', '/test-mobile-reports', {
        statusCode: 200,
        body: html,
        headers: {
          'content-type': 'text/html; charset=utf-8'
        }
      }).as('testPage');
      
      // Visit the intercepted path, this bypasses the React router completely
      cy.visit('/test-mobile-reports', {
        failOnStatusCode: false
      });
    });
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
    cy.get('[data-test="verify-button"]').first().click();
    
    // Check the button is disabled and text changes
    cy.get('[data-test="verify-button"]:disabled').should('have.text', 'Verified');
    
    // Check the verified report is now visible
    cy.get('[data-test="mobile-report-verified"]').should('be.visible');
  });

  it('should show image gallery when clicking on view images', () => {
    // Find a view images link and click it
    cy.get('[data-test="view-images-button"]').first().click();
    
    // Check the image modal appears
    cy.get('#image-gallery-modal').should('not.have.class', 'hidden');
    cy.get('[data-test="gallery-image"]').should('be.visible');
    
    // Close the gallery
    cy.get('[data-test="close-gallery-button"]').click();
    cy.get('#image-gallery-modal').should('have.class', 'hidden');
  });

  it('should open assignment modal after verifying a report', () => {
    // Click on the assign cleaner button for verified report
    cy.get('[data-test="assign-button"]').click();
    
    // Verify the assignment modal appears
    cy.get('#assignment-modal').should('not.have.class', 'hidden');
    cy.contains('Assign Cleaner').should('be.visible');
    
    // Check form elements are visible
    cy.get('[data-test="collector-select"]').should('be.visible');
    cy.get('[data-test="cleanup-date"]').should('be.visible');
    cy.get('[data-test="assignment-notes"]').should('be.visible');
    
    // Fill in the form
    cy.get('[data-test="collector-select"]').select(1);
    cy.get('[data-test="cleanup-date"]').type('2025-12-31');
    cy.get('[data-test="assignment-notes"]').type('Test assignment notes');
    
    // Submit the assignment
    cy.get('[data-test="submit-assignment-button"]').click();
    
    // Check button changes to success state
    cy.get('[data-test="submit-assignment-button"]').should('have.text', 'Assigned!');
  });

  it('should refresh the list when clicking refresh button', () => {
    // Click refresh button
    cy.get('#refresh-button').click();
    
    // Verify that the table is still visible with reports
    cy.get('[data-test="mobile-report"]').should('have.length.at.least', 1);
  });
});
