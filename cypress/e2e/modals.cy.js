describe('Modal System', () => {
  beforeEach(() => {
    // Login before each test
    cy.intercept('POST', '**/auth/v1/token*', {
      fixture: 'user.json',
      statusCode: 200
    }).as('loginRequest');
    
    cy.window().then((window) => {
      window.localStorage.setItem('trashdrop_authenticated', 'true');
    });
    
    // Mock API responses for collectors and other data
    cy.intercept('GET', '**/rest/v1/collectors*', {
      fixture: 'collectors.json'
    }).as('getCollectors');
    
    cy.intercept('GET', '**/rest/v1/bags*', {
      fixture: 'bags.json'
    }).as('getBags');
    
    // Visit the dashboard
    cy.visit('/dashboard');
  });

  it('should open and close QR Code modal', () => {
    // Mock the modal demo component
    cy.visit('/dashboard'); // Assuming we have the modal demo accessible from dashboard
    
    // Test data for QR code modal
    const mockQrData = {
      id: 'TD-BAG-1234',
      prefix: 'TD-',
      description: 'Trash collection bag for Downtown area',
      qrImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TD-BAG-1234'
    };
    
    // Expose a method to open the modal directly
    cy.window().then((window) => {
      window.openModal = (type, data) => {
        window.dispatchEvent(
          new CustomEvent('openModal', { detail: { type, data } })
        );
      };
    });
    
    // Open the QR code modal programmatically
    cy.window().invoke('openModal', 'qrCode', mockQrData);
    
    // Verify the modal is visible and has the correct content
    cy.get('[data-test=qrcode-modal]').should('be.visible');
    cy.get('[data-test=qrcode-id]').should('contain', 'TD-BAG-1234');
    
    // Test close functionality
    cy.get('[data-test=qrcode-close-button]').click();
    cy.get('[data-test=qrcode-modal]').should('not.exist');
  });

  it('should open and use Confirmation modal', () => {
    // Setup a spy to test the confirm action
    cy.window().then((win) => {
      win.confirmActionCalled = false;
      win.testConfirmAction = () => {
        win.confirmActionCalled = true;
      };
    });
    
    // Open the confirmation modal programmatically
    cy.window().invoke('openModal', 'confirmation', {
      title: 'Delete Batch',
      message: 'Are you sure you want to delete this batch? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: 'testConfirmAction'
    });
    
    // Verify the modal is visible and has the correct content
    cy.get('[data-test=confirmation-modal]').should('be.visible');
    cy.get('[data-test=confirmation-title]').should('contain', 'Delete Batch');
    
    // Test confirm action
    cy.get('[data-test=confirm-button]').click();
    
    // Verify the action was called
    cy.window().its('confirmActionCalled').should('be.true');
  });

  it('should open and display CollectorProfile modal', () => {
    const collector = {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '555-123-4567',
      region: 'North',
      status: 'Active',
      vehicleType: 'Van',
      vehicleId: 'TD-VAN-001'
    };
    
    // Open the collector profile modal programmatically
    cy.window().invoke('openModal', 'collectorProfile', { collector });
    
    // Verify the modal is visible and has the correct content
    cy.get('[data-test=collector-profile-modal]').should('be.visible');
    cy.get('[data-test=collector-name]').should('contain', 'John Doe');
    cy.get('[data-test=collector-email]').should('contain', 'john.doe@example.com');
    
    // Test switching to edit mode
    cy.get('[data-test=edit-collector-button]').click();
    cy.get('[data-test=collector-form]').should('be.visible');
    
    // Edit some fields
    cy.get('[data-test=input-phone]').clear().type('555-999-8888');
    
    // Save the changes
    cy.get('[data-test=save-button]').click();
    
    // Verify we're back in view mode
    cy.get('[data-test=collector-phone]').should('contain', '555-999-8888');
  });

  it('should open and use Messages modal', () => {
    // Open the messages modal programmatically
    cy.window().invoke('openModal', 'messages');
    
    // Verify the modal is visible
    cy.get('[data-test=messages-modal]').should('be.visible');
    
    // Select a contact
    cy.get('[data-test=contact-item]').first().click();
    
    // Send a message
    const testMessage = 'This is a test message';
    cy.get('[data-test=message-input]').type(testMessage);
    cy.get('[data-test=send-button]').click();
    
    // Verify the message was sent
    cy.get('[data-test=message-bubble]').last().should('contain', testMessage);
    
    // Close the modal
    cy.get('[data-test=close-button]').click();
    cy.get('[data-test=messages-modal]').should('not.exist');
  });
});
