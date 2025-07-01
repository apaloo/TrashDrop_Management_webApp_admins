describe('Authentication', () => {
  beforeEach(() => {
    // Reset any previous state
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('should allow user to login with valid credentials', () => {
    // Mock the API response for successful login
    cy.intercept('POST', '**/auth/v1/token*', {
      fixture: 'user.json',
      statusCode: 200
    }).as('loginRequest');
    
    cy.visit('/login');
    
    // Fill out the login form
    cy.get('[data-test=email-input]').type('test@trashdrop.example');
    cy.get('[data-test=password-input]').type('password123');
    cy.get('[data-test=login-button]').click();
    
    // Wait for the API call and check if we're redirected to dashboard
    cy.wait('@loginRequest');
    cy.url().should('include', '/dashboard');
    
    // Check if user data is in local storage
    cy.window().then((window) => {
      expect(window.localStorage.getItem('trashdrop_authenticated')).to.eq('true');
    });
  });

  it('should show error message with invalid credentials', () => {
    // Mock the API response for failed login
    cy.intercept('POST', '**/auth/v1/token*', {
      statusCode: 400,
      body: {
        error: 'Invalid login credentials',
        error_description: 'Email or password is incorrect'
      }
    }).as('loginRequest');
    
    cy.visit('/login');
    
    // Fill out the login form with invalid credentials
    cy.get('[data-test=email-input]').type('wrong@email.com');
    cy.get('[data-test=password-input]').type('wrongpassword');
    cy.get('[data-test=login-button]').click();
    
    // Wait for the API call
    cy.wait('@loginRequest');
    
    // Check for error message
    cy.get('[data-test=login-error]').should('be.visible');
    cy.get('[data-test=login-error]').should('contain', 'Email or password is incorrect');
    
    // URL should still be login page
    cy.url().should('include', '/login');
  });

  it('should redirect to onboarding if not completed', () => {
    // Mock the API response for user without completed onboarding
    cy.intercept('POST', '**/auth/v1/token*', {
      statusCode: 200,
      body: {
        ...require('../fixtures/user.json'),
        user_metadata: {
          ...require('../fixtures/user.json').user_metadata,
          onboardingCompleted: false
        }
      }
    }).as('loginRequest');
    
    cy.visit('/login');
    
    // Fill out the login form
    cy.get('[data-test=email-input]').type('new@trashdrop.example');
    cy.get('[data-test=password-input]').type('password123');
    cy.get('[data-test=login-button]').click();
    
    // Wait for the API call
    cy.wait('@loginRequest');
    
    // Check if redirected to onboarding
    cy.url().should('include', '/onboarding');
  });

  it('should allow user to complete onboarding flow', () => {
    // Mock the necessary API calls for onboarding
    cy.intercept('POST', '**/auth/v1/user', {
      statusCode: 200,
      body: {
        ...require('../fixtures/user.json'),
        user_metadata: {
          ...require('../fixtures/user.json').user_metadata,
          onboardingCompleted: true
        }
      }
    }).as('updateUserMetadata');
    
    // Set up the app to think we're logged in but haven't completed onboarding
    cy.window().then((window) => {
      window.localStorage.setItem('trashdrop_authenticated', 'true');
      // Any other auth state you need to set
    });
    
    cy.visit('/onboarding');
    
    // Complete onboarding using our custom command
    cy.completeOnboarding('TrashDrop Test Company', 'Urban Test Area');
    
    // Check if it was successful
    cy.url().should('include', '/dashboard');
  });
});
