// Helper function for setting up authentication and onboarding completion
// Use this in the beforeEach hook of all test files that require authentication

export const setupTestAuth = () => {
  // Set localStorage items for auth
  cy.window().then((window) => {
    window.localStorage.setItem('trashdrop_authenticated', 'true');
    window.localStorage.setItem('trashdrop_onboarding_completed', 'true');
    
    // Add mock user data
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'admin',
      user_metadata: {
        onboardingCompleted: true,
        companyName: 'Test Company',
        companyType: 'Waste Management',
        operatingAreas: ['North', 'South']
      }
    };
    window.localStorage.setItem('trashdrop_user', JSON.stringify(mockUser));
  });
  
  // Mock common auth endpoints
  cy.intercept('GET', '**/rest/v1/auth/user', {
    statusCode: 200,
    body: {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'admin',
      user_metadata: {
        onboardingCompleted: true,
        companyName: 'Test Company',
        companyType: 'Waste Management',
        operatingAreas: ['North', 'South']
      }
    }
  }).as('getUser');
  
  cy.intercept('GET', '**/rest/v1/auth/session', {
    statusCode: 200,
    body: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_at: Date.now() + 3600000 // 1 hour from now
    }
  }).as('getSession');
};
