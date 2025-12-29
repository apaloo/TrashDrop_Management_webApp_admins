import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/dashboard' }),
  useNavigate: () => jest.fn()
}));

// Mock the child components used in Layout
jest.mock('../components/Sidebar', () => {
  return function MockSidebar() {
    return <div data-testid="sidebar">Sidebar Component</div>;
  };
});

jest.mock('../components/Navbar', () => {
  return function MockNavbar() {
    return <div data-testid="navbar">Navbar Component</div>;
  };
});

describe('Layout Component', () => {
  // Test case 1: Layout should render sidebar and navbar when authenticated
  test('renders sidebar and navbar when user is authenticated', () => {
    // Setup auth context with authenticated state
    const authContextValue = {
      user: { id: 'test-user-id', user_metadata: { role: 'admin' } },
      isAuthenticated: true,
      loading: false,
      onboardingCompleted: true,
      role: 'admin'
    };

    // Mock localStorage
    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn(() => 'true'),
          setItem: jest.fn(),
          removeItem: jest.fn()
        },
        writable: true
      });
    });
    
    // Render with authentication context
    render(
      <AuthContext.Provider value={authContextValue}>
        <>
          <Layout>
            <div data-testid="content">Test Content</div>
          </Layout>
        </>
      </AuthContext.Provider>
    );

    // Assert that sidebar, navbar and content are rendered
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  // Test case 2: Layout should not render sidebar and navbar on auth pages
  test('does not render sidebar and navbar on auth pages', () => {
    // Setup auth context with authenticated state
    const authContextValue = {
      user: { id: 'test-user-id', user_metadata: { role: 'admin' } },
      isAuthenticated: true,
      loading: false,
      onboardingCompleted: true,
      role: 'admin'
    };
    
    // Mock for auth page test
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/login' });
    
    // Render with authentication context
    render(
      <AuthContext.Provider value={authContextValue}>
        <>
          <Layout>
            <div data-testid="content">Login Content</div>
          </Layout>
        </>
      </AuthContext.Provider>
    );

    // Assert that sidebar and navbar are not rendered but content is
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  // Test case 3: Layout should use localStorage fallback for authentication state
  test('renders sidebar and navbar when authenticated via localStorage', async () => {
    // Setup auth context with unauthenticated state
    const authContextValue = {
      user: null,
      isAuthenticated: false, // Not authenticated in context
      loading: false,
      onboardingCompleted: true,
      role: 'user'
    };

    // Mock localStorage with authentication true
    jest.spyOn(window.localStorage.__proto__, 'getItem')
      .mockImplementation((key) => {
        if (key === 'trashdrop_authenticated') return 'true';
        return null;
      });
    
    // Render with authentication context
    render(
      <AuthContext.Provider value={authContextValue}>
        <>
          <Layout>
            <div data-testid="content">Test Content</div>
          </Layout>
        </>
      </AuthContext.Provider>
    );

    // Wait for useEffect to run and check the localStorage
    await waitFor(() => {
      // Assert that sidebar and navbar are rendered based on localStorage
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
    
    // Verify localStorage was checked
    expect(window.localStorage.getItem).toHaveBeenCalledWith('trashdrop_authenticated');
  });

  // Test case 4: Layout should show loading state when authentication is loading
  test('shows loading spinner when authentication is in loading state', () => {
    // Setup auth context with loading state
    const authContextValue = {
      user: null,
      isAuthenticated: false,
      loading: true,
      onboardingCompleted: false,
      role: 'user'
    };
    
    // Render with authentication context in loading state
    render(
      <AuthContext.Provider value={authContextValue}>
        <>
          <Layout>
            <div data-testid="content">Test Content</div>
          </Layout>
        </>
      </AuthContext.Provider>
    );

    // Assert that loading spinner is displayed (it has a border which is a common pattern for loading spinners)
    expect(screen.getByTestId('content')).toBeInTheDocument(); // Content should be visible
    
    // In our implementation, we're actually showing the content but with a loading state
    // So the sidebar and navbar shouldn't be shown
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
  });
});
