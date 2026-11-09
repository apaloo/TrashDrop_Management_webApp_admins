import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from '../ResetPassword';
import { useAuth } from '../../context/AuthContext';
import { updatePassword, signOut } from '../../utils/auth';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../utils/auth', () => ({ updatePassword: jest.fn(), signOut: jest.fn() }));

const clearForceResetMode = jest.fn();
const signedInByLink = { isAuthenticated: true, forceResetMode: true, clearForceResetMode };

const show = () => render(<MemoryRouter><ResetPassword /></MemoryRouter>);
const submitButton = () => screen.getByRole('button', { name: /reset password/i });
const fill = (password, confirm = password) => {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } });
};

beforeEach(() => {
  jest.clearAllMocks();
  updatePassword.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
});

test('a working link shows the form with no error', () => {
  useAuth.mockReturnValue(signedInByLink);
  show();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(submitButton()).toBeEnabled();
});

test('an expired link says so and cannot set a password', () => {
  useAuth.mockReturnValue({ isAuthenticated: false, forceResetMode: false, clearForceResetMode });
  show();
  expect(screen.getByRole('alert')).toHaveTextContent(/invalid or has expired/i);
  expect(submitButton()).toBeDisabled();
});

test('someone already signed in without a link cannot use the form', () => {
  useAuth.mockReturnValue({ isAuthenticated: true, forceResetMode: false, clearForceResetMode });
  show();
  expect(submitButton()).toBeDisabled();
});

test('saves the new password, then signs out so it is used to log in', async () => {
  useAuth.mockReturnValue(signedInByLink);
  show();
  fill('newpassword1');
  fireEvent.click(submitButton());
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  expect(updatePassword).toHaveBeenCalledWith('newpassword1');
  expect(await screen.findByRole('status')).toHaveTextContent(/successful/i);
});

test('a rejected password keeps the person on the form, still in reset mode', async () => {
  useAuth.mockReturnValue(signedInByLink);
  updatePassword.mockResolvedValue({ error: new Error('Password too weak') });
  show();
  fill('newpassword1');
  fireEvent.click(submitButton());
  expect(await screen.findByRole('alert')).toHaveTextContent('Password too weak');
  expect(signOut).not.toHaveBeenCalled();
  expect(clearForceResetMode).not.toHaveBeenCalled();
});

test('passwords that differ are not sent', () => {
  useAuth.mockReturnValue(signedInByLink);
  show();
  fill('newpassword1', 'different1');
  fireEvent.click(submitButton());
  expect(updatePassword).not.toHaveBeenCalled();
});

test('going back to login ends the sign-in the link created', () => {
  useAuth.mockReturnValue(signedInByLink);
  show();
  fireEvent.click(screen.getByRole('link', { name: /back to login/i }));
  expect(signOut).toHaveBeenCalledTimes(1);
});
