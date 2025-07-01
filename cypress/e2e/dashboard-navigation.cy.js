describe('Dashboard and Navigation', () => {
  beforeEach(() => {
    // Mock authentication
    cy.window().then((window) => {
      window.localStorage.setItem('trashdrop_authenticated', 'true');
      window.localStorage.setItem('trashdrop_onboarding_completed', 'true');
    });
    
    // Mock API responses for dashboard data
    cy.intercept('GET', '**/rest/v1/dashboard/stats', {
      statusCode: 200,
      body: {
        totalCollectors: 42,
        activeBags: 256,
        pendingPickups: 18,
        completedToday: 24,
        activeAlerts: 3,
        illegalDumpingReports: 7
      }
    }).as('getDashboardStats');
    
    cy.intercept('GET', '**/rest/v1/dashboard/recent-activity', {
      statusCode: 200,
      body: [
        {
          type: 'pickup_completed',
          timestamp: '2025-06-22T18:45:00Z',
          details: {
            requestId: 'req-101',
            collectorName: 'John Doe',
            location: 'Downtown Area'
          }
        },
        {
          type: 'collector_registered',
          timestamp: '2025-06-22T17:30:00Z',
          details: {
            collectorId: 'collector-045',
            collectorName: 'Mark Wilson',
            region: 'East'
          }
        },
        {
          type: 'dumping_reported',
          timestamp: '2025-06-22T16:15:00Z',
          details: {
            reportId: 'dump-025',
            location: 'Westside Park',
            severity: 'Medium'
          }
        }
      ]
    }).as('getRecentActivity');
    
    // Visit the dashboard
    cy.visit('/');
    
    // Wait for API calls to complete
    cy.wait(['@getDashboardStats', '@getRecentActivity']);
  });
  
  it('should display dashboard components correctly', () => {
    // Verify page title
    cy.get('[data-test=page-title]').should('contain', 'Dashboard');
    
    // Verify stats cards are displayed
    cy.get('[data-test=stats-cards]').should('be.visible');
    cy.get('[data-test=stat-card]').should('have.length.at.least', 4);
    
    // Check individual stat cards
    cy.get('[data-test=collectors-card]').within(() => {
      cy.get('[data-test=stat-value]').should('contain', '42');
      cy.get('[data-test=stat-label]').should('contain', 'Collectors');
    });
    
    cy.get('[data-test=bags-card]').within(() => {
      cy.get('[data-test=stat-value]').should('contain', '256');
      cy.get('[data-test=stat-label]').should('contain', 'Active Bags');
    });
    
    cy.get('[data-test=pickups-card]').within(() => {
      cy.get('[data-test=stat-value]').should('contain', '18');
      cy.get('[data-test=stat-label]').should('contain', 'Pending Pickups');
    });
    
    // Verify recent activity section
    cy.get('[data-test=recent-activity]').should('be.visible');
    cy.get('[data-test=activity-item]').should('have.length', 3);
    
    // Check first activity item
    cy.get('[data-test=activity-item]').first().within(() => {
      cy.get('[data-test=activity-type]').should('contain', 'Pickup Completed');
      cy.get('[data-test=activity-time]').should('contain', 'Jun 22');
      cy.get('[data-test=activity-details]').should('contain', 'John Doe');
    });
  });
  
  it('should display alerts summary on dashboard', () => {
    // Check alerts section exists
    cy.get('[data-test=alerts-summary]').should('be.visible');
    cy.get('[data-test=alerts-count]').should('contain', '3');
    
    // Verify "View All" button works
    cy.get('[data-test=view-all-alerts]').click();
    cy.url().should('include', '/alerts');
  });
  
  it('should navigate to different sections using sidebar', () => {
    // Test navigation to Bag Management
    cy.get('[data-test=sidebar-nav]').contains('Bag Management').click();
    cy.url().should('include', '/bin-management');
    cy.get('[data-test=page-title]').should('contain', 'Bag Management');
    
    // Test navigation to Collectors
    cy.get('[data-test=sidebar-nav]').contains('Collectors').click();
    cy.url().should('include', '/request-pickup/collectors');
    cy.get('[data-test=page-title]').should('contain', 'Collectors');
    
    // Test navigation to Pickup Requests
    cy.get('[data-test=sidebar-nav]').contains('Pickup Requests').click();
    cy.url().should('include', '/request-pickup/manage');
    cy.get('[data-test=page-title]').should('contain', 'Pickup Requests');
    
    // Test navigation to Illegal Dumping
    cy.get('[data-test=sidebar-nav]').contains('Illegal Dumping').click();
    cy.url().should('include', '/illegal-dumping');
    cy.get('[data-test=page-title]').should('contain', 'Illegal Dumping');
    
    // Test navigation to Logs
    cy.get('[data-test=sidebar-nav]').contains('System Logs').click();
    cy.url().should('include', '/logs');
    cy.get('[data-test=page-title]').should('contain', 'Logs');
    
    // Test navigation back to Dashboard
    cy.get('[data-test=sidebar-nav]').contains('Dashboard').click();
    cy.url().should('include', '/');
    cy.get('[data-test=page-title]').should('contain', 'Dashboard');
  });
  
  it('should toggle sidebar open/closed', () => {
    // Check sidebar is visible
    cy.get('[data-test=sidebar]').should('be.visible');
    
    // Click toggle button to collapse sidebar
    cy.get('[data-test=toggle-sidebar]').click();
    
    // Verify sidebar is collapsed
    cy.get('[data-test=sidebar]').should('have.class', 'collapsed');
    cy.get('[data-test=nav-labels]').should('not.be.visible');
    
    // Click toggle button again to expand sidebar
    cy.get('[data-test=toggle-sidebar]').click();
    
    // Verify sidebar is expanded
    cy.get('[data-test=sidebar]').should('not.have.class', 'collapsed');
    cy.get('[data-test=nav-labels]').should('be.visible');
  });
  
  it('should display user menu and allow logout', () => {
    // Mock the logout API call
    cy.intercept('POST', '**/rest/v1/auth/logout', {
      statusCode: 200,
      body: { success: true }
    }).as('logout');
    
    // Click on user menu
    cy.get('[data-test=user-menu]').click();
    
    // Verify menu options
    cy.get('[data-test=user-menu-dropdown]').should('be.visible');
    cy.get('[data-test=profile-option]').should('exist');
    cy.get('[data-test=settings-option]').should('exist');
    cy.get('[data-test=logout-option]').should('exist');
    
    // Click logout
    cy.get('[data-test=logout-option]').click();
    
    // Wait for logout API call
    cy.wait('@logout');
    
    // Verify redirect to login page
    cy.url().should('include', '/login');
  });
  
  it('should update notification bell when new alerts arrive', () => {
    // Verify notification bell initial state
    cy.get('[data-test=notification-bell]').should('be.visible');
    cy.get('[data-test=notification-count]').should('contain', '3');
    
    // Click notification bell
    cy.get('[data-test=notification-bell]').click();
    
    // Verify notification dropdown appears
    cy.get('[data-test=notification-dropdown]').should('be.visible');
    cy.get('[data-test=notification-item]').should('have.length', 3);
    
    // Mock updated notifications with one more alert
    cy.intercept('GET', '**/rest/v1/notifications/unread', {
      statusCode: 200,
      body: [
        {
          id: 'notif-001',
          type: 'alert',
          title: 'New Critical Alert',
          message: 'Payment system error detected',
          timestamp: '2025-06-22T19:01:00Z',
          read: false
        },
        {
          id: 'notif-002',
          type: 'pickup_request',
          title: 'New Pickup Request',
          message: 'A new pickup request has been submitted',
          timestamp: '2025-06-22T18:55:00Z',
          read: false
        },
        {
          id: 'notif-003',
          type: 'collector_update',
          title: 'Collector Status Change',
          message: 'John Doe is now inactive',
          timestamp: '2025-06-22T18:50:00Z',
          read: false
        },
        {
          id: 'notif-004',
          type: 'system',
          title: 'System Update',
          message: 'System maintenance scheduled for tonight',
          timestamp: '2025-06-22T18:48:00Z',
          read: false
        }
      ]
    }).as('getNotifications');
    
    // Simulate receiving a new notification
    cy.get('[data-test=refresh-notifications]').click();
    
    // Wait for notifications API call
    cy.wait('@getNotifications');
    
    // Verify notification count has increased
    cy.get('[data-test=notification-count]').should('contain', '4');
    cy.get('[data-test=notification-item]').should('have.length', 4);
  });
  
  it('should show appropriate theme based on user preference', () => {
    // Check current theme (assumed to be light by default)
    cy.get('body').should('have.class', 'light-theme');
    
    // Click theme toggle
    cy.get('[data-test=theme-toggle]').click();
    
    // Verify dark theme is applied
    cy.get('body').should('have.class', 'dark-theme');
    
    // Toggle back to light theme
    cy.get('[data-test=theme-toggle]').click();
    
    // Verify light theme is restored
    cy.get('body').should('have.class', 'light-theme');
  });
});
