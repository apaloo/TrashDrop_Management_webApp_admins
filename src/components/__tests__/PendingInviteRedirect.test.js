import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PendingInviteRedirect from '../PendingInviteRedirect';
import { useAuth } from '../../context/AuthContext';
import { rememberInvite } from '../../utils/teamInvite';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));

const token = 'ef'.repeat(32);
const renderAt = (path, auth) => {
  useAuth.mockReturnValue({ authInitialized: true, loading: false, isAuthenticated: true, onboardingCompleted: true, ...auth });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PendingInviteRedirect />
      <Routes>
        <Route path="/join/:token" element={<p>Join page</p>} />
        <Route path="*" element={<p>Other page</p>} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => localStorage.clear());

it('takes someone back to the invite they opened before signing up', async () => {
  rememberInvite(token);
  renderAt('/settings');
  expect(await screen.findByText('Join page')).toBeInTheDocument();
});

it('waits until they are signed in and onboarded', () => {
  rememberInvite(token);
  const { unmount } = renderAt('/settings', { isAuthenticated: false });
  expect(screen.getByText('Other page')).toBeInTheDocument();
  unmount();
  renderAt('/settings', { onboardingCompleted: false });
  expect(screen.getByText('Other page')).toBeInTheDocument();
});

it('does nothing on sign-up and onboarding pages, or without a remembered invite', () => {
  rememberInvite(token);
  const { unmount } = renderAt('/onboarding');
  expect(screen.getByText('Other page')).toBeInTheDocument();
  unmount();
  localStorage.clear();
  renderAt('/settings');
  expect(screen.getByText('Other page')).toBeInTheDocument();
});

it('follows the invite kept in the account by a sign-up through the link (another device)', async () => {
  renderAt('/dashboard', { user: { user_metadata: { inviteToken: token } } });
  expect(await screen.findByText('Join page')).toBeInTheDocument();
});
