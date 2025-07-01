// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Import Testing Library commands
import '@testing-library/cypress/add-commands';

// Handle uncaught exceptions
Cypress.on('uncaught:exception', (err) => {
  // Returning false here prevents Cypress from failing the test
  // This is helpful when third-party libraries throw errors
  // that don't actually affect our application's functionality
  console.log('Uncaught exception:', err.message);
  return false;
});

// Configure default viewport for all tests
// These can be overridden in individual test files if needed
beforeEach(() => {
  // Default to desktop viewport
  cy.viewport(1280, 800);
});

// Add support for drag and drop operations
// This allows testing features like reordering items
const dataTransfer = new DataTransfer();

Cypress.Commands.add('dragAndDrop', { prevSubject: 'element' }, (subject, target) => {
  cy.wrap(subject)
    .trigger('dragstart', { dataTransfer })
    .then(() => {
      cy.wrap(target)
        .trigger('drop', { dataTransfer })
        .then(() => {
          cy.wrap(subject).trigger('dragend');
        });
    });
});

// Add a utility to wait for animations to complete
Cypress.Commands.add('waitForAnimations', () => {
  cy.wait(300); // Adjust this time based on your app's animation duration
});

// Add command to test responsive layouts
Cypress.Commands.add('testResponsiveLayout', (viewports) => {
  viewports.forEach(({ width, height, name }) => {
    cy.viewport(width, height);
    cy.log(`Testing on ${name} viewport (${width}x${height})`);
    // Allow time for responsive adjustments
    cy.waitForAnimations();
  });
});

// Easy access to localStorage for testing persistence
Cypress.Commands.add('getLocalStorage', (key) => {
  return cy.window().then((window) => {
    return window.localStorage.getItem(key);
  });
});

Cypress.Commands.add('setLocalStorage', (key, value) => {
  return cy.window().then((window) => {
    window.localStorage.setItem(key, value);
  });
});

// Log test environment info at the start of tests
Cypress.Commands.add('logTestEnvironment', () => {
  cy.log(`Browser: ${Cypress.browser.name} v${Cypress.browser.version}`);
  cy.log(`Viewport: ${Cypress.config('viewportWidth')}x${Cypress.config('viewportHeight')}`);
  cy.log(`Cypress: v${Cypress.version}`);
});

// Add this to the beginning of important test suites
// cy.logTestEnvironment();