// What the staff site's sign-in state trusts besides a Supabase session.
// Development sign-in (a mock Admin kept in localStorage) must never work
// outside a development build, whatever localStorage or the flag says, and
// the fallback for a database without the account roles migration takes the
// role from the account's own metadata, which its owner can edit, so it
// never grants Admin. AuthContext.test.js covers roles from the database,
// AuthContext.recovery.test.js password resets and sign-out.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { fetchMyAccess } from '../services/accountRoleService';
import { MOCK_USER } from '../utils/devAuth';

let mockSession = null;
jest.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
jest.mock('../services/accountRoleService', () => ({ fetchMyAccess: jest.fn() }));
jest.mock('../utils/auth', () => ({ hasCompletedOnboarding: jest.fn() }));

let auth;
const Probe = () => {
  auth = useAuth();
  return (
    <div>
      <div data-testid="status">{auth.isAuthenticated ? 'in' : 'out'}</div>
      <div data-testid="role">{auth.role}</div>
      <div data-testid="loading">{auth.loading || auth.accessLoading ? 'loading' : 'ready'}</div>
    </div>
  );
};
const mount = async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
};
// What a forged or left-over development sign-in leaves in the browser
const forgeDevSignIn = () => {
  localStorage.setItem('trashdrop_dev_user', JSON.stringify(MOCK_USER));
  localStorage.setItem('trashdrop_authenticated', 'true');
  localStorage.setItem('trashdrop_user_data', JSON.stringify(MOCK_USER));
  localStorage.setItem('trashdrop_onboarding_completed', 'true');
};

const env = { ...process.env };
beforeEach(() => {
  mockSession = null;
  localStorage.clear();
  sessionStorage.clear();
  fetchMyAccess.mockResolvedValue({ role: 'manager', status: 'approved' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...env };
  jest.restoreAllMocks();
});

describe('development sign-in never works outside development', () => {
  it.each([
    ['a production build, even with the development flag on', 'production', 'true'],
    ['a test or preview build without the flag', 'test', undefined],
  ])('%s: a mock Admin in localStorage is ignored and cleared', async (_label, nodeEnv, flag) => {
    process.env.NODE_ENV = nodeEnv;
    if (flag) process.env.REACT_APP_USE_DEV_AUTH = flag; else delete process.env.REACT_APP_USE_DEV_AUTH;
    forgeDevSignIn();
    await mount();
    expect(screen.getByTestId('status')).toHaveTextContent('out');
    expect(screen.getByTestId('role')).toHaveTextContent('user');
    expect(auth.user).toBeNull();
    expect(localStorage.getItem('trashdrop_authenticated')).toBeNull();
    expect(localStorage.getItem('trashdrop_user_data')).toBeNull();
  });

  it('with a real session outside development, the role still comes from the database', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REACT_APP_USE_DEV_AUTH = 'true';
    forgeDevSignIn();
    mockSession = { user: { id: 'u-1', user_metadata: { role: 'admin' } } };
    await mount();
    expect(screen.getByTestId('status')).toHaveTextContent('in');
    expect(screen.getByTestId('role')).toHaveTextContent('manager');
    expect(fetchMyAccess).toHaveBeenCalled();
  });

  it('in a development build with the flag, the mock Admin signs in without the database', async () => {
    process.env.NODE_ENV = 'development';
    process.env.REACT_APP_USE_DEV_AUTH = 'true';
    await mount();
    expect(screen.getByTestId('status')).toHaveTextContent('in');
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(auth.user.id).toBe(MOCK_USER.id);
    expect(fetchMyAccess).not.toHaveBeenCalled();
  });
});

describe('a database without the account roles migration (legacy)', () => {
  const missingSchema = () => Object.assign(new Error('function my_access() does not exist'), { missingSchema: true });

  it('uses the role in the account metadata', async () => {
    fetchMyAccess.mockRejectedValue(missingSchema());
    mockSession = { user: { id: 'u-1', user_metadata: { role: 'authority' } } };
    await mount();
    expect(screen.getByTestId('role')).toHaveTextContent('authority');
    expect(auth.access).toEqual({ legacy: true });
  });

  it('never as Admin: the account owner can write that metadata', async () => {
    fetchMyAccess.mockRejectedValue(missingSchema());
    mockSession = { user: { id: 'u-1', user_metadata: { role: 'admin' } } };
    await mount();
    expect(screen.getByTestId('role')).toHaveTextContent('user');
  });
});

it('useAuth outside the provider is a programming error, not a signed-out state', () => {
  const Bare = () => { useAuth(); return null; };
  expect(() => render(<Bare />)).toThrow('useAuth must be used within an AuthProvider');
});
