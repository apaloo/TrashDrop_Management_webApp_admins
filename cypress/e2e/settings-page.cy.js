describe('Settings Page Tests', () => {
  beforeEach(() => {
    // Simply visit the fixture file directly
    cy.visit('cypress/fixtures/settings-test.html');
    
    // Mock authentication after page load
    cy.window().then((win) => {
      win.localStorage.setItem('trashdrop_authenticated', 'true');
      win.localStorage.setItem('trashdrop_onboarding_completed', 'true');
      win.localStorage.setItem('trashdrop_user_preferences', JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '555-123-4567'
      }));
    });
  });

  it('should render settings page with correct tabs', () => {
    // Verify settings page heading
    cy.get('[data-test="page-title"]').should('exist').and('contain', 'Settings');
    
    // Verify tab presence
    cy.get('[data-tab="profile"]').should('exist');
    cy.get('[data-tab="notifications"]').should('exist');
    cy.get('[data-tab="dashboard"]').should('exist');
    cy.get('[data-tab="regional"]').should('exist');
  });

  it('should display user profile information', () => {
    // Verify user profile info is loaded
    cy.get('#profile-tab').should('be.visible');
    cy.get('#firstName').should('have.value', 'Test');
    cy.get('#lastName').should('have.value', 'User');
    cy.get('#email').should('have.value', 'test@example.com');
    cy.get('#phone').should('have.value', '555-123-4567');
  });

  it('should navigate between tabs', () => {
    // Click on Notifications tab
    cy.get('[data-tab="notifications"]').click();
    
    // Verify notifications section is visible
    cy.get('#notifications-tab').should('be.visible');
    
    // Click on Dashboard tab
    cy.get('[data-tab="dashboard"]').click();
    
    // Verify dashboard section is visible
    cy.get('#dashboard-tab').should('be.visible');
    
    // Click on Regional tab
    cy.get('[data-tab="regional"]').click();
    
    // Verify regional section is visible
    cy.get('#regional-tab').should('be.visible');
    
    // Return to Profile tab
    cy.get('[data-tab="profile"]').click();
    
    // Verify profile section is visible again
    cy.get('#profile-tab').should('be.visible');
  });

  it('should display correct notification preferences', () => {
    // Navigate to notifications tab
    cy.get('[data-tab="notifications"]').click();
    
    // Check notification preferences
    cy.get('#email-notifications').should('be.checked');
    cy.get('#push-notifications').should('not.be.checked');
    cy.get('#sms-notifications').should('not.be.checked');
  });

  it('should display correct dashboard preferences', () => {
    // Navigate to dashboard tab
    cy.get('[data-tab="dashboard"]').click();
    
    // Check dashboard preferences
    cy.get('#show-kpis').should('be.checked');
    cy.get('#show-recent-activity').should('be.checked');
    cy.get('#default-view').should('have.value', 'map');
  });

  it('should display correct regional settings', () => {
    // Navigate to regional tab
    cy.get('[data-tab="regional"]').click();
    
    // Check regional settings
    cy.get('#timezone').should('have.value', 'America/New_York');
    cy.get('#dateFormat').should('have.value', 'MM/DD/YYYY');
    cy.get('#measurementUnit').should('have.value', 'imperial');
  });

  it('should update profile information', () => {
    // Go to profile tab
    cy.get('[data-tab="profile"]').click();
    
    // Update form fields
    cy.get('#firstName').clear().type('Updated');
    cy.get('#lastName').clear().type('Name');
    cy.get('#phone').clear().type('+9876543210');
    
    // Submit form
    cy.get('[data-test="save-settings-button"]').click();
    
    // Check success message is shown
    cy.get('[data-test="success-message"]').should('be.visible');
    
    // Verify values stayed updated
    cy.get('#firstName').should('have.value', 'Updated');
    cy.get('#lastName').should('have.value', 'Name');
    cy.get('#phone').should('have.value', '+9876543210');
  });

  it('should update notification preferences', () => {
    // Go to notifications tab
    cy.get('[data-tab="notifications"]').click();
    
    // Change notification settings
    cy.get('#email-notifications').click(); // toggle
    cy.get('#push-notifications').click(); // toggle
    cy.get('#sms-notifications').click(); // toggle
    
    // Save settings
    cy.get('[data-test="save-settings-button"]').click();
    
    // Check success message is shown
    cy.get('[data-test="success-message"]').should('be.visible');
    
    // Verify values have been toggled
    cy.get('#email-notifications').should('not.be.checked');
    cy.get('#push-notifications').should('be.checked');
    cy.get('#sms-notifications').should('be.checked');
  });
  
  it('should update dashboard preferences', () => {
    // Go to dashboard tab
    cy.get('[data-tab="dashboard"]').click();
    
    // Change dashboard settings
    cy.get('#show-kpis').click(); // toggle
    cy.get('#default-view').select('list');
    
    // Save settings
    cy.get('[data-test="save-settings-button"]').click();
    
    // Check success message is shown
    cy.get('[data-test="success-message"]').should('be.visible');
    
    // Verify values have been updated
    cy.get('#show-kpis').should('not.be.checked');
    cy.get('#default-view').should('have.value', 'list');
  });
  
  it('should update regional settings', () => {
    // Go to regional tab
    cy.get('[data-tab="regional"]').click();
    
    // Change regional settings
    cy.get('#timezone').select('America/Los_Angeles');
    cy.get('#dateFormat').select('DD/MM/YYYY');
    cy.get('#measurementUnit').select('metric');
    
    // Save settings
    cy.get('[data-test="save-settings-button"]').click();
    
    // Check success message is shown
    cy.get('[data-test="success-message"]').should('be.visible');
    
    // Verify values have been updated
    cy.get('#timezone').should('have.value', 'America/Los_Angeles');
    cy.get('#dateFormat').should('have.value', 'DD/MM/YYYY');
    cy.get('#measurementUnit').should('have.value', 'metric');
  });
});
