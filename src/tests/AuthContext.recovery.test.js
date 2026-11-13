// Staff sign-in state beyond the role (AuthContext.test.js covers roles):
// the password-reset flow that must end on the new-password form, sign-out
// clearing what this browser kept, and refreshAuthState after a sign-in.
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { fetchMyAccess } from '../services/accountRoleService';
import { hasCompletedOnboarding } from '../utils/auth';

let mockAuthCallback = null;
let mockGetSession = () => Promise.resolve({ data: { session: null }, error: null });
jest.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback) => {
        mockAuthCallback = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
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
      <div data-testid="reset">{auth.forceResetMode ? 'reset' : 'normal'}</div>
      <div data-testid="onboarding">{auth.onboardingCompleted ? 'done' : 'not done'}</div>
      <div data-testid="loading">{auth.loading ? 'loading' : 'ready'}</div>
    </div>
  );
};
const mount = async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
};
const session = (over = {}) => ({ user: { id: 'u-1', email: 'staff@example.org', user_metadata: { onboardingCompleted: false }, ...over } });
const RECOVERY_FLAG = 'trashdrop_password_recovery';

beforeEach(() => {
  mockAuthCallback = null;
  mockGetSession = () => Promise.resolve({ data: { session: null }, error: null });
  localStorage.clear();
  sessionStorage.clear();
  fetchMyAccess.mockResolvedValue({ role: 'manager', status: 'approved' });
  hasCompletedOnboarding.mockResolvedValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('password reset', () => {
  it("Supabase's PASSWORD_RECOVERY event sends the account to the new-password form, and remembers it for the tab", async () => {
    await mount();
    expect(screen.getByTestId('reset')).toHaveTextContent('normal');
    act(() => mockAuthCallback('PASSWORD_RECOVERY', session()));
    expect(screen.getByTestId('reset')).toHaveTextContent('reset');
    expect(screen.getByTestId('status')).toHaveTextContent('in');
    expect(sessionStorage.getItem(RECOVERY_FLAG)).toBe('1');
  });

  it('a recovery link opened in the tab (#type=recovery) does the same', async () => {
    await mount();
    act(() => {
      window.location.hash = '#access_token=x&type=recovery';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('reset')).toHaveTextContent('reset');
    window.location.hash = '';
  });

  it('a reset still in progress survives a refresh of the tab (the reset link signed the account in)', async () => {
    sessionStorage.setItem(RECOVERY_FLAG, '1');
    mockGetSession = () => Promise.resolve({ data: { session: session() }, error: null });
    await mount();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'));
    expect(screen.getByTestId('reset')).toHaveTextContent('reset');
  });

  it('with no session any more, a remembered reset is dropped (signed out)', async () => {
    sessionStorage.setItem(RECOVERY_FLAG, '1');
    await mount();
    expect(screen.getByTestId('reset')).toHaveTextContent('normal');
    expect(sessionStorage.getItem(RECOVERY_FLAG)).toBeNull();
  });

  it('setting the new password ends it (clearForceResetMode)', async () => {
    sessionStorage.setItem(RECOVERY_FLAG, '1');
    await mount();
    act(() => auth.clearForceResetMode());
    expect(screen.getByTestId('reset')).toHaveTextContent('normal');
    expect(sessionStorage.getItem(RECOVERY_FLAG)).toBeNull();
  });

  it('signing out ends a reset in progress', async () => {
    await mount();
    act(() => mockAuthCallback('PASSWORD_RECOVERY', session()));
    act(() => mockAuthCallback('SIGNED_OUT', null));
    expect(screen.getByTestId('reset')).toHaveTextContent('normal');
    expect(sessionStorage.getItem(RECOVERY_FLAG)).toBeNull();
  });
});

describe('signing out', () => {
  it('clears what this browser kept about the account', async () => {
    for (const k of ['trashdrop_authenticated', 'trashdrop_session_active', 'trashdrop_onboarding_completed', 'trashdrop_user_data']) localStorage.setItem(k, 'x');
    localStorage.setItem('trashdrop_theme', 'dark');
    mockGetSession = () => Promise.resolve({ data: { session: session() }, error: null });
    await mount();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'));
    act(() => mockAuthCallback('SIGNED_OUT', null));
    expect(screen.getByTestId('status')).toHaveTextContent('out');
    for (const k of ['trashdrop_authenticated', 'trashdrop_session_active', 'trashdrop_onboarding_completed', 'trashdrop_user_data']) expect(localStorage.getItem(k)).toBeNull();
    expect(localStorage.getItem('trashdrop_theme')).toBe('dark');
  });

  it('a signed-in session is never written to localStorage outside development', async () => {
    mockGetSession = () => Promise.resolve({ data: { session: session() }, error: null });
    await mount();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'));
    expect(localStorage.getItem('trashdrop_user_data')).toBeNull();
    expect(localStorage.getItem('trashdrop_authenticated')).toBeNull();
  });
});

describe('refreshAuthState (after a sign-in)', () => {
  it('takes the new session and asks the database whether onboarding is done', async () => {
    await mount();
    expect(screen.getByTestId('status')).toHaveTextContent('out');
    mockGetSession = () => Promise.resolve({ data: { session: session() }, error: null });
    await act(async () => { await auth.refreshAuthState(); });
    expect(screen.getByTestId('status')).toHaveTextContent('in');
    expect(hasCompletedOnboarding).toHaveBeenCalled();
    expect(screen.getByTestId('onboarding')).toHaveTextContent('done');
  });

  it('no session after all: signed out', async () => {
    await mount();
    await act(async () => { await auth.refreshAuthState(); });
    expect(screen.getByTestId('status')).toHaveTextContent('out');
    expect(screen.getByTestId('loading')).toHaveTextContent('ready');
  });

  it('a failed session read stops loading and does not sign anyone in', async () => {
    await mount();
    mockGetSession = () => Promise.resolve({ data: { session: null }, error: { message: 'network' } });
    await act(async () => { await auth.refreshAuthState(); });
    expect(screen.getByTestId('status')).toHaveTextContent('out');
    expect(screen.getByTestId('loading')).toHaveTextContent('ready');
  });

  it('a session read that throws at start-up still finishes loading, signed out', async () => {
    mockGetSession = () => Promise.reject(new Error('offline'));
    await mount();
    expect(screen.getByTestId('status')).toHaveTextContent('out');
  });
});
