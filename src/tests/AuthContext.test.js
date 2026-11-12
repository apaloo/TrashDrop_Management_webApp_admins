import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { fetchMyAccess } from '../services/accountRoleService';

// Plain functions where the code needs a return value: react-scripts resets
// jest.fn() implementations before each test, so each test sets its own.
let mockAuthCallback = null;
let mockSession = null;
jest.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
      onAuthStateChange: (callback) => {
        mockAuthCallback = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));
jest.mock('../services/accountRoleService', () => ({ fetchMyAccess: jest.fn() }));
jest.mock('../utils/auth', () => ({ hasCompletedOnboarding: jest.fn() }));

const Probe = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="status">{auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="loading">{auth.loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="user">{auth.user ? auth.user.id : 'No User'}</div>
      <div data-testid="role">{auth.role}</div>
      <div data-testid="access-loading">{auth.accessLoading ? 'yes' : 'no'}</div>
    </div>
  );
};

const renderAuth = () => render(<AuthProvider><Probe /></AuthProvider>);

// Signed in, and the access level from the database has arrived
const waitForAccess = async (userId = 'u-1') => {
  await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent(userId));
  await waitFor(() => expect(screen.getByTestId('access-loading')).toHaveTextContent('no'));
  expect(fetchMyAccess).toHaveBeenCalled();
};

const signedIn = (over = {}) => ({
  user: { id: 'u-1', email: 'person@example.com', user_metadata: { role: 'manager', onboardingCompleted: true }, ...over },
});

describe('AuthContext', () => {
  beforeEach(() => {
    mockSession = null;
    mockAuthCallback = null;
    localStorage.clear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('starts loading, then signed out when there is no session', async () => {
    renderAuth();
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading');

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading'));
    expect(screen.getByTestId('status')).toHaveTextContent('Not Authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
    expect(fetchMyAccess).not.toHaveBeenCalled();
  });

  test('takes the role from the database, not from the editable account metadata', async () => {
    mockSession = signedIn({ user_metadata: { role: 'admin' } });
    fetchMyAccess.mockResolvedValue({ role: 'manager', status: 'approved' });

    renderAuth();

    await waitForAccess();
    expect(screen.getByTestId('status')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('u-1');
    expect(screen.getByTestId('role')).toHaveTextContent('manager');
  });

  // Admins are the database's staff_admins table (TD10, 2026-11-12): any
  // account the database calls Admin is one, whatever its email
  test('an admin role from the database makes the account an Admin', async () => {
    mockSession = signedIn();
    fetchMyAccess.mockResolvedValue({ role: 'admin', status: 'approved' });

    renderAuth();

    await waitForAccess();
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
  });

  test('an admin role in the account\'s own details never makes it an Admin', async () => {
    mockSession = signedIn({ user_metadata: { role: 'admin', onboardingCompleted: true } });
    // Before the account roles migration the site falls back to those details
    fetchMyAccess.mockRejectedValue(Object.assign(new Error('missing'), { missingSchema: true }));

    renderAuth();

    await waitForAccess();
    expect(screen.getByTestId('role')).toHaveTextContent('user');
  });

  test('an unknown role from the database is a User', async () => {
    mockSession = signedIn();
    fetchMyAccess.mockResolvedValue({ role: 'superuser', status: 'approved' });

    renderAuth();

    await waitForAccess();
    expect(screen.getByTestId('role')).toHaveTextContent('user');
  });

  test('treats the account as a User when its access cannot be loaded', async () => {
    mockSession = signedIn();
    fetchMyAccess.mockRejectedValue(new Error('network down'));

    renderAuth();

    await waitForAccess();
    expect(screen.getByTestId('status')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('role')).toHaveTextContent('user');
  });

  test('follows sign-in and sign-out events', async () => {
    fetchMyAccess.mockResolvedValue({ role: 'volunteer', status: 'approved' });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading'));

    act(() => mockAuthCallback('SIGNED_IN', signedIn({ id: 'u-2' })));
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('volunteer'));
    expect(screen.getByTestId('status')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('u-2');

    act(() => mockAuthCallback('SIGNED_OUT', null));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Not Authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
  });
});
