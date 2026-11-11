import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';

jest.mock('../components/Sidebar', () => () => <div data-testid="sidebar">Sidebar</div>);
jest.mock('../components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);
jest.mock('../components/AccessStatusBanner', () => () => null);
jest.mock('../components/PageTransitionLoader', () => () => null);
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));

const signedIn = { user: { id: 'u-1', user_metadata: { firstName: 'Ama' } }, role: 'manager', isAuthenticated: true, loading: false };
const signedOut = { user: null, role: 'user', isAuthenticated: false, loading: false };

const renderAt = (path, auth) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth}>
        <Layout>
          <div data-testid="content">Page</div>
        </Layout>
      </AuthContext.Provider>
    </MemoryRouter>
  );

describe('Layout', () => {
  beforeEach(() => localStorage.clear());

  test('signed in on a dashboard page: sidebar, navbar and the page', () => {
    renderAt('/dashboard', signedIn);
    // Desktop sidebar and the mobile menu's copy
    expect(screen.getAllByTestId('sidebar')).toHaveLength(2);
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  test.each(['/login', '/reset-password', '/join/abc123'])('no dashboard frame on %s', (path) => {
    renderAt(path, signedIn);
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  test.each(['/', '/about/', '/blog/some-post'])('public page %s is drawn without the dashboard frame', (path) => {
    renderAt(path, signedIn);
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  test('signed out on a dashboard page: no sidebar or navbar', () => {
    renderAt('/dashboard', signedOut);
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
  });

  test('a leftover sign-in flag in the browser does not show the frame', () => {
    localStorage.setItem('trashdrop_authenticated', 'true');
    renderAt('/dashboard', signedOut);
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
  });

  test('while auth is loading the page waits behind a spinner', () => {
    renderAt('/dashboard', { ...signedOut, loading: true });
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
  });
});
