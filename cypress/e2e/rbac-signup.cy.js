describe('Role-Based Access Control - Signup Flow', () => {
  const visitSignupFixture = () => {
    cy.readFile('cypress/fixtures/auth-login-test.html').then((html) => {
      cy.intercept('GET', '/test-signup', {
        statusCode: 200,
        body: html,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      }).as('signupPage');

      cy.visit('/test-signup', { failOnStatusCode: false });
    });
  };

  beforeEach(() => {
    visitSignupFixture();
    cy.window().then((window) => {
      window.localStorage.clear();
    });
  });

  const companyTypeRoleMapping = [
    { companyType: 'waste_management', expectedRole: 'manager', label: 'Waste Management' },
    { companyType: 'municipality', expectedRole: 'manager', label: 'Municipality' },
    { companyType: 'recycling', expectedRole: 'manager', label: 'Recycling' },
    { companyType: 'nonprofit', expectedRole: 'user', label: 'Non-Profit Organisation' },
    { companyType: 'other', expectedRole: 'user', label: 'Other' }
  ];

  companyTypeRoleMapping.forEach(({ companyType, expectedRole, label }) => {
    it(`assigns '${expectedRole}' role when company type is '${label}'`, () => {
      cy.get('[data-test=signup-form]').should('exist');

      cy.get('[data-test=first-name-input]').type('Test');
      cy.get('[data-test=last-name-input]').type('User');
      cy.get('[data-test=email-input]').type(`test.${companyType}@example.com`);
      cy.get('[data-test=password-input]').type('SecurePassword123!');
      cy.get('[data-test=confirm-password-input]').type('SecurePassword123!');
      cy.get('[data-test=company-name-input]').type('Test Company');
      cy.get('[data-test=company-type-select]').select(companyType);
      cy.get('[data-test=terms-checkbox]').check();

      cy.intercept('POST', '**/auth/v1/signup', (req) => {
        expect(req.body.data.role).to.equal(expectedRole);
        expect(req.body.data.metadata.role).to.equal(expectedRole);
        expect(req.body.data.metadata.companyType).to.equal(companyType);

        req.reply({
          statusCode: 200,
          body: {
            user: {
              id: 'test-user-id',
              email: req.body.email,
              user_metadata: {
                role: expectedRole,
                companyType: companyType,
                onboardingCompleted: false
              }
            }
          }
        });
      }).as('signupRequest');

      cy.get('[data-test=signup-submit]').click();

      cy.wait('@signupRequest').then((interception) => {
        expect(interception.request.body.data.role).to.equal(expectedRole);
      });
    });
  });

  it('stores correct role in localStorage for onboarding', () => {
    cy.get('[data-test=company-type-select]').select('waste_management');
    
    cy.intercept('POST', '**/auth/v1/signup', {
      statusCode: 200,
      body: {
        user: {
          id: 'test-user-id',
          email: 'manager@example.com',
          user_metadata: {
            role: 'manager',
            companyType: 'waste_management',
            onboardingCompleted: false
          }
        }
      }
    }).as('signupRequest');

    cy.get('[data-test=first-name-input]').type('Manager');
    cy.get('[data-test=last-name-input]').type('User');
    cy.get('[data-test=email-input]').type('manager@example.com');
    cy.get('[data-test=password-input]').type('SecurePassword123!');
    cy.get('[data-test=confirm-password-input]').type('SecurePassword123!');
    cy.get('[data-test=company-name-input]').type('Waste Corp');
    cy.get('[data-test=terms-checkbox]').check();
    cy.get('[data-test=signup-submit]').click();

    cy.window().then((window) => {
      const onboardingUser = JSON.parse(window.localStorage.getItem('trashdrop_onboarding_user') || '{}');
      expect(onboardingUser.companyType).to.equal('waste_management');
    });
  });

  it('validates that nonprofit gets user role', () => {
    cy.intercept('POST', '**/auth/v1/signup', (req) => {
      expect(req.body.data.role).to.equal('user');
      expect(req.body.data.metadata.companyType).to.equal('nonprofit');
      
      req.reply({
        statusCode: 200,
        body: {
          user: {
            id: 'nonprofit-user-id',
            email: req.body.email,
            user_metadata: {
              role: 'user',
              companyType: 'nonprofit',
              onboardingCompleted: false
            }
          }
        }
      });
    }).as('nonprofitSignup');

    cy.get('[data-test=first-name-input]').type('Nonprofit');
    cy.get('[data-test=last-name-input]').type('User');
    cy.get('[data-test=email-input]').type('nonprofit@example.org');
    cy.get('[data-test=password-input]').type('SecurePassword123!');
    cy.get('[data-test=confirm-password-input]').type('SecurePassword123!');
    cy.get('[data-test=company-name-input]').type('Green Earth NPO');
    cy.get('[data-test=company-type-select]').select('nonprofit');
    cy.get('[data-test=terms-checkbox]').check();
    cy.get('[data-test=signup-submit]').click();

    cy.wait('@nonprofitSignup');
  });

  it('validates that municipality gets manager role', () => {
    cy.intercept('POST', '**/auth/v1/signup', (req) => {
      expect(req.body.data.role).to.equal('manager');
      expect(req.body.data.metadata.companyType).to.equal('municipality');
      
      req.reply({
        statusCode: 200,
        body: {
          user: {
            id: 'municipality-user-id',
            email: req.body.email,
            user_metadata: {
              role: 'manager',
              companyType: 'municipality',
              onboardingCompleted: false
            }
          }
        }
      });
    }).as('municipalitySignup');

    cy.get('[data-test=first-name-input]').type('City');
    cy.get('[data-test=last-name-input]').type('Manager');
    cy.get('[data-test=email-input]').type('manager@city.gov');
    cy.get('[data-test=password-input]').type('SecurePassword123!');
    cy.get('[data-test=confirm-password-input]').type('SecurePassword123!');
    cy.get('[data-test=company-name-input]').type('Accra Metropolitan Assembly');
    cy.get('[data-test=company-type-select]').select('municipality');
    cy.get('[data-test=terms-checkbox]').check();
    cy.get('[data-test=signup-submit]').click();

    cy.wait('@municipalitySignup');
  });
});
