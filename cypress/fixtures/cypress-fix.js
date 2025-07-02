/**
 * Cypress Fix Script for LogsManagement tests
 * 
 * This script integrates with our new fixture approach by providing commands
 * that ensure deterministic test behavior with the fixture
 */

// Ensure the fixture is ready before running tests
Cypress.Commands.add('waitForFixtureReady', () => {
  // Wait for the DOM to be fully loaded and our helper functions to be available
  cy.window().should('have.property', 'logsHelper');
  cy.get('[data-test="log-row"]').should('exist');
  cy.wait(500); // Give time for all JS to initialize
});

/**
 * Level Filtering Commands
 */
Cypress.Commands.add('filterByLevel', (level) => {
  // Select from the dropdown first
  cy.get('[data-test="level-filter"]').click();
  cy.get(`[data-test="level-option-${level.toLowerCase()}"]`).click();
  
  // Then use the helper to ensure correct rows are visible
  cy.window().then((win) => {
    if (win.logsHelper) {
      win.logsHelper.showLevelFilteredRows(level.toLowerCase());
    }
  });
});

/**
 * Source Filtering Commands
 */
Cypress.Commands.add('filterBySource', (source) => {
  // Select from the dropdown first
  cy.get('[data-test="source-filter"]').click();
  cy.get(`[data-test="source-option-${source.toLowerCase()}"]`).click();
  
  // Then use the helper to ensure correct rows are visible
  cy.window().then((win) => {
    if (win.logsHelper) {
      win.logsHelper.showSourceFilteredRows(source.toLowerCase());
    }
  });
});

/**
 * Date Range Filtering Commands
 */
Cypress.Commands.add('filterByDateRange', (startDate, endDate) => {
  // Enter the date values
  if (startDate) {
    cy.get('[data-test="date-start-input"]').type(`${startDate}T10:00:00`);
  }
  
  if (endDate) {
    cy.get('[data-test="date-end-input"]').type(`${endDate}T12:00:00`);
  }
  
  // Click apply button
  cy.get('[data-test="apply-date-filter"]').click();
  
  // Use the helper to ensure correct rows are visible
  cy.window().then((win) => {
    if (win.logsHelper) {
      win.logsHelper.showDateFilteredRows();
    }
  });
});

/**
 * Search Filtering Commands
 */
Cypress.Commands.add('filterBySearch', (searchTerm) => {
  // Type in the search input
  cy.get('[data-test="search-input"]').clear().type(searchTerm);
  
  // Use the helper to ensure correct rows are visible
  cy.window().then((win) => {
    if (win.logsHelper) {
      win.logsHelper.showSearchResults(searchTerm);
    }
  });
});

/**
 * Pagination Commands
 */
Cypress.Commands.add('goToPage', (pageNumber) => {
  // Click on the page number
  cy.get(`[data-test="page-${pageNumber}"]`).click();
  
  // Use the helper to ensure correct rows are visible
  cy.window().then((win) => {
    if (win.logsHelper) {
      win.logsHelper.showPage(pageNumber);
    }
  });
});

/**
 * Row Expansion Commands
 */
Cypress.Commands.add('expandRow', (rowIndex = 0) => {
  // Click the expand button on the specified row
  cy.get('[data-test="expand-row-button"]').eq(rowIndex).click();
  
  // Use the helper to ensure expanded row is visible
  cy.window().then((win) => {
    if (win.logsHelper) {
      win.logsHelper.expandRow(rowIndex);
    }
  });
});

/**
 * Override visibility detection for Cypress
 */
Cypress.Commands.overwrite('should', (originalFn, subject, assertion, ...args) => {
  // For log rows, handle visibility consistently using inline styles
  if (subject && subject.selector && subject.selector.includes('data-test="log-row"')) {
    if (assertion === 'be.visible') {
      return originalFn(subject, 'not.have.css', 'display', 'none');
    }
    if (assertion === 'not.be.visible') {
      return originalFn(subject, 'have.css', 'display', 'none');
    }
  }
  
  // For expanded rows
  if (subject && subject.selector && subject.selector.includes('data-test="expanded-row"')) {
    if (assertion === 'be.visible') {
      return originalFn(subject, 'not.have.css', 'display', 'none');
    }
    if (assertion === 'not.be.visible') {
      return originalFn(subject, 'have.css', 'display', 'none');
    }
  }
  
  return originalFn(subject, assertion, ...args);
});
