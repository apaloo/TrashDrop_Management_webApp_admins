import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JoinTeam from '../JoinTeam';
import { getInviteInfo, acceptInvite } from '../../services/teamService';
import { useAuth } from '../../context/AuthContext';
import { pendingInvite } from '../../utils/teamInvite';
import { updateUserMetadata } from '../../utils/auth';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../services/teamService', () => ({ getInviteInfo: jest.fn(), acceptInvite: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../utils/auth', () => ({ updateUserMetadata: jest.fn() }));

const token = '0123456789abcdef'.repeat(4);
const info = { valid: true, group_name: 'Clean Accra', region: 'Greater Accra', team_role: 'member' };
const refreshAccess = jest.fn(() => Promise.resolve());

const renderAt = (auth, t = token) => {
  useAuth.mockReturnValue({ authInitialized: true, loading: false, refreshAccess, access: null, ...auth });
  return render(
    <MemoryRouter initialEntries={[`/join/${t}`]}>
      <Routes>
        <Route path="/join/:token" element={<JoinTeam />} />
        <Route path="/team" element={<p>Team page</p>} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  getInviteInfo.mockResolvedValue(info);
  acceptInvite.mockResolvedValue({ group_name: 'Clean Accra' });
  updateUserMetadata.mockResolvedValue({ data: {}, error: null });
});

it('signed out: says who invites, offers sign up / sign in, and remembers the link', async () => {
  renderAt({ isAuthenticated: false });
  expect(await screen.findByRole('heading', { name: 'Join Clean Accra' })).toBeInTheDocument();
  expect(screen.getByTestId('invite-line')).toHaveTextContent('invited as a member of a volunteer group in Greater Accra');
  expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', `/signup?invite=${token}`);
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(pendingInvite()).toBe(token);
  expect(acceptInvite).not.toHaveBeenCalled();
});

it('signed in: joins with one click, refreshes access and opens the team', async () => {
  renderAt({ isAuthenticated: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Join Clean Accra' }));
  expect(await screen.findByText('Team page')).toBeInTheDocument();
  expect(acceptInvite).toHaveBeenCalledWith(token);
  expect(refreshAccess).toHaveBeenCalled();
  expect(pendingInvite()).toBeNull();
});

it('shows why joining failed', async () => {
  acceptInvite.mockRejectedValue(new Error('You are already in another group. Leave it first.'));
  renderAt({ isAuthenticated: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Join Clean Accra' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('already in another group');
});

it('explains a link that no longer works, and forgets it', async () => {
  getInviteInfo.mockResolvedValue({ valid: false, reason: 'expired' });
  renderAt({ isAuthenticated: false });
  expect(await screen.findByRole('alert')).toHaveTextContent('This invite link has expired. Ask the group for a new one.');
  await waitFor(() => expect(pendingInvite()).toBeNull());
});

it('refuses a malformed link without asking the database', async () => {
  renderAt({ isAuthenticated: false }, 'not-a-token');
  expect(await screen.findByRole('alert')).toHaveTextContent('doesn’t exist');
  expect(getInviteInfo).not.toHaveBeenCalled();
});

it('tells a member of this group they are already in', async () => {
  renderAt({ isAuthenticated: true, access: { team: { groupName: 'Clean Accra', teamRole: 'member' } } });
  expect(await screen.findByText('You’re already in Clean Accra.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Join/ })).not.toBeInTheDocument();
});

it('someone who signed up through this link joins on first sign-in, and the link is cleared from their account', async () => {
  renderAt({ isAuthenticated: true, user: { user_metadata: { inviteToken: token } } });
  expect(await screen.findByText('Team page')).toBeInTheDocument();
  expect(acceptInvite).toHaveBeenCalledTimes(1);
  expect(updateUserMetadata).toHaveBeenCalledWith({ inviteToken: null });
});

it('does not join on its own for someone who did not sign up with this link', async () => {
  renderAt({ isAuthenticated: true, user: { user_metadata: { inviteToken: 'cd'.repeat(32) } } });
  expect(await screen.findByRole('button', { name: 'Join Clean Accra' })).toBeInTheDocument();
  expect(acceptInvite).not.toHaveBeenCalled();
});

it('if joining on sign-in fails, says why, stops retrying and keeps the button', async () => {
  acceptInvite.mockRejectedValue(new Error('This invite link has been used up.'));
  renderAt({ isAuthenticated: true, user: { user_metadata: { inviteToken: token } } });
  expect(await screen.findByRole('alert')).toHaveTextContent('used up');
  expect(acceptInvite).toHaveBeenCalledTimes(1);
  expect(updateUserMetadata).toHaveBeenCalledWith({ inviteToken: null });
  expect(screen.getByRole('button', { name: 'Join Clean Accra' })).toBeEnabled();
});
