import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignUp from '../SignUp';
import { signUp } from '../../utils/auth';
import { getInviteInfo } from '../../services/teamService';
import { pendingInvite } from '../../utils/teamInvite';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../utils/auth', () => ({ signUp: jest.fn() }));
jest.mock('../../services/teamService', () => ({ getInviteInfo: jest.fn() }));

const token = 'ab'.repeat(32);

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><SignUp /></MemoryRouter>);

const fillBasics = () => {
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Ama' } });
  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Mensah' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ama@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Strong-pass1' } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Strong-pass1' } });
  fireEvent.click(screen.getByRole('checkbox'));
};

beforeEach(() => {
  localStorage.clear();
  getInviteInfo.mockResolvedValue({ valid: true, group_name: 'Clean Accra', team_role: 'member' });
  signUp.mockResolvedValue({ data: {}, error: null });
});

it('through an invite link: asks only for the person’s own details and ties the account to the group', async () => {
  renderAt(`/signup?invite=${token}`);
  expect(await screen.findByRole('heading', { name: 'Join Clean Accra' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Organisation / Group Name')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Account Type')).not.toBeInTheDocument();
  expect(pendingInvite()).toBe(token);

  fillBasics();
  fireEvent.click(screen.getByRole('button', { name: /Create account/ }));

  await waitFor(() => expect(signUp).toHaveBeenCalled());
  const args = signUp.mock.calls[0][0];
  expect(args).toMatchObject({ email: 'ama@example.com', name: 'Ama Mensah', role: 'user' });
  expect(args.metadata).toEqual({
    firstName: 'Ama', lastName: 'Mensah', companyType: 'other', role: 'user', inviteToken: token, onboardingCompleted: true,
  });
  expect(await screen.findByText(/sign in to join Clean Accra/)).toBeInTheDocument();
});

it('without an invite: still asks for the full account setup', async () => {
  renderAt('/signup');
  expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  expect(screen.getByLabelText('Organisation / Group Name')).toBeInTheDocument();
  expect(screen.getByLabelText('Account Type')).toBeInTheDocument();
  fillBasics();
  fireEvent.click(screen.getByRole('button', { name: /Create account/ }));
  expect(await screen.findByText('Organisation or group name is required')).toBeInTheDocument();
  expect(signUp).not.toHaveBeenCalled();
  expect(getInviteInfo).not.toHaveBeenCalled();
});

it('falls back to the full form when the invite link can’t be used', async () => {
  getInviteInfo.mockResolvedValue({ valid: false, reason: 'expired' });
  renderAt(`/signup?invite=${token}`);
  expect(await screen.findByRole('alert')).toHaveTextContent('This invite link has expired');
  expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  expect(screen.getByLabelText('Account Type')).toBeInTheDocument();
});

it('ignores a malformed invite value', () => {
  renderAt('/signup?invite=nope');
  expect(screen.getByLabelText('Account Type')).toBeInTheDocument();
  expect(getInviteInfo).not.toHaveBeenCalled();
});
