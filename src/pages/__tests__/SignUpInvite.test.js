import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignUp, { signUpProblem } from '../SignUp';
import { signUp } from '../../utils/auth';
import { getInviteInfo } from '../../services/teamService';
import { pendingInvite } from '../../utils/teamInvite';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../utils/auth', () => ({ signUp: jest.fn() }));
jest.mock('../../services/teamService', () => ({ getInviteInfo: jest.fn() }));

const token = 'ab'.repeat(32);

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><SignUp /></MemoryRouter>);

const fillBasics = () => {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ama' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Mensah' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ama@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Strong-pass1' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Strong-pass1' } });
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
  expect(screen.queryByLabelText('Organisation or group name')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Account type')).not.toBeInTheDocument();
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
  expect(screen.getByLabelText('Organisation or group name')).toBeInTheDocument();
  expect(screen.getByLabelText('Account type')).toBeInTheDocument();
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
  expect(screen.getByLabelText('Account type')).toBeInTheDocument();
});

it('ignores a malformed invite value', () => {
  renderAt('/signup?invite=nope');
  expect(screen.getByLabelText('Account type')).toBeInTheDocument();
  expect(getInviteInfo).not.toHaveBeenCalled();
});

it('an existing account through an invite: sign in to join instead', async () => {
  signUp.mockResolvedValue({ data: null, error: { message: 'An account with this email already exists.', status: 400, code: 'user_already_exists' } });
  renderAt(`/signup?invite=${token}`);
  await screen.findByRole('heading', { name: 'Join Clean Accra' });
  fillBasics();
  fireEvent.click(screen.getByRole('button', { name: /Create account/ }));
  expect(await screen.findByRole('link', { name: 'Sign in to join' })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('dialog', { name: /account already exists/i })).toBeInTheDocument();
  expect(screen.getByText(/Sign in with it and you'll join Clean Accra/)).toBeInTheDocument();
  expect(pendingInvite()).toBe(token);
});

it('does not call other sign-up problems "account already exists"', async () => {
  signUp.mockResolvedValue({ data: null, error: { message: 'email rate limit exceeded', status: 429, code: 'over_email_send_rate_limit' } });
  renderAt(`/signup?invite=${token}`);
  await screen.findByRole('heading', { name: 'Join Clean Accra' });
  fillBasics();
  fireEvent.click(screen.getByRole('button', { name: /Create account/ }));
  expect(await screen.findByText(/Too many sign-up emails/)).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: /account already exists/i })).not.toBeInTheDocument();
});

describe('signUpProblem', () => {
  it.each([
    [{ code: 'user_already_exists', status: 400, message: 'x' }, true, /already exists/],
    [{ code: 'email_exists', status: 422, message: 'x' }, true, /already exists/],
    [{ status: 429, message: 'email rate limit exceeded' }, false, /Too many sign-up emails/],
    [{ status: 400, code: 'email_address_invalid', message: 'Email address "a@b" is invalid' }, false, /can’t be used/],
    [{ status: 500, message: 'Error sending confirmation email' }, false, /couldn’t send the confirmation email/],
    [{ status: 400, message: 'Signups not allowed for this instance' }, false, /Failed to sign up: Signups not allowed/],
  ])('%j', (err, duplicate, text) => {
    const p = signUpProblem(err);
    expect(Boolean(p.duplicate)).toBe(duplicate);
    expect(p.text).toMatch(text);
  });
});
