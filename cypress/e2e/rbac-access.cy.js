describe('Role-Based Access Control', () => {
  const visitDashboardFixture = () => {
    cy.readFile('cypress/fixtures/dashboard-test.html').then((html) => {
      cy.intercept('GET', '/test-dashboard', {
        statusCode: 200,
        body: html,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      }).as('dashboardPage');

      cy.visit('/test-dashboard', { failOnStatusCode: false });
    });
  };

  const setAuthState = (overrides = {}) => {
    cy.window().then((window) => {
      window.localStorage.setItem('trashdrop_authenticated', 'true');
      window.localStorage.setItem('trashdrop_onboarding_completed', 'true');
      if (overrides.user) {
        window.localStorage.setItem('trashdrop_user_data', JSON.stringify(overrides.user));
      } else {
        window.localStorage.removeItem('trashdrop_user_data');
      }
    });
  };

  const expectNavItems = (visibleLabels) => {
    const labels = [
      'Dashboard',
      'Bag Management',
      'Generate Bag',
      'Request Pickup',
      'Collectors',
      'Illegal Dumping',
      'System Logs',
      'Alerts',
      'Settings'
    ];

    labels.forEach((label) => {
      if (visibleLabels.includes(label)) {
        cy.contains('[data-test=sidebar-nav] a', label).should('exist');
      } else {
        cy.contains('[data-test=sidebar-nav] a', label).should('not.exist');
      }
    });
  };

  beforeEach(() => {
    visitDashboardFixture();
  });

  it('shows only dashboard and settings for basic user', () => {
    setAuthState({
      user: {
        email: 'user@example.com',
        user_metadata: { role: 'user' }
      }
    });

    expectNavItems(['Dashboard', 'Settings']);
  });

  it('shows dashboard, illegal dumping, settings for manager', () => {
    setAuthState({
      user: {
        email: 'manager@city.gov',
        user_metadata: { role: 'manager' }
      }
    });

    expectNavItems(['Dashboard', 'Illegal Dumping', 'Settings']);
  });

  it('grants full access only to whitelisted admin email', () => {
    setAuthState({
      user: {
        email: 'nonadmin@example.com',
        user_metadata: { role: 'admin' }
      }
    });
    expectNavItems(['Dashboard', 'Settings']);

    setAuthState({
      user: {
        email: 'otisadomako50@gmail.com',
        user_metadata: { role: 'admin' }
      }
    });
    expectNavItems([
      'Dashboard',
      'Bag Management',
      'Generate Bag',
      'Request Pickup',
      'Collectors',
      'Illegal Dumping',
      'System Logs',
      'Alerts',
      'Settings'
    ]);
  });

  it('redirects unauthorized routes back to dashboard for user role', () => {
    cy.visit('/request-pickup/requests', { failOnStatusCode: false });
    setAuthState({
      user: {
        email: 'user@example.com',
        user_metadata: { role: 'user' }
      }
    });

    cy.url().should('include', '/dashboard');
  });
});
