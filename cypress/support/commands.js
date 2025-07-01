// ***********************************************
// TrashDrop Admin Portal Custom Cypress Commands
// ***********************************************

// Import Testing Library commands
import '@testing-library/cypress/add-commands';

/**
 * Login to the TrashDrop Admin Portal
 * 
 * Usage: cy.login('admin@example.com', 'password123')
 */
Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login');
  cy.get('[data-test=email-input]').type(email);
  cy.get('[data-test=password-input]').type(password);
  cy.get('[data-test=login-button]').click();

  // Verify successful login by checking if redirected to dashboard
  cy.url().should('include', '/dashboard');
});

/**
 * Navigate to a specific section in the sidebar
 * 
 * Usage: cy.navigateToSection('Bin Management')
 */
Cypress.Commands.add('navigateToSection', (section) => {
  cy.get(`[data-test=sidebar-link-${section.toLowerCase().replace(/\s+/g, '-')}]`).click();
});

/**
 * Open a modal by clicking a specific trigger button
 * 
 * Usage: cy.openModal('qrCode', '[data-test=show-qr-button]')
 */
Cypress.Commands.add('openModal', (modalType, triggerSelector) => {
  cy.get(triggerSelector).click();
  // Check that the modal is visible
  cy.get(`[data-test=${modalType}-modal]`).should('be.visible');
});

/**
 * Set up mock data test helpers
 * 
 * Usage: cy.mockApiResponse('getCollectors', 'GET', '/api/collectors', 'fixtures/collectors.json')
 */
Cypress.Commands.add('mockApiResponse', (alias, method, url, fixture) => {
  cy.intercept(method, url, { fixture }).as(alias);
});

/**
 * Complete the onboarding flow
 * 
 * Usage: cy.completeOnboarding('Test Company', 'Urban')
 */
Cypress.Commands.add('completeOnboarding', (companyName, operatingArea) => {
  // Step 1: Company Info
  cy.get('[data-test=company-name-input]').type(companyName);
  cy.get('[data-test=company-type-select]').select('Waste Management');
  cy.get('[data-test=operating-area-input]').type(operatingArea);
  cy.get('[data-test=next-button]').click();
  
  // Step 2: User Preferences
  cy.get('[data-test=notify-pickups-checkbox]').check();
  cy.get('[data-test=notify-reports-checkbox]').check();
  cy.get('[data-test=next-button]').click();
  
  // Step 3: Completion
  cy.get('[data-test=finish-button]').click();
  
  // Verify redirection to dashboard
  cy.url().should('include', '/dashboard');
});