import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SignUp from '../SignUp';
import { signUp } from '../../utils/auth';
import { getInviteInfo } from '../../services/teamService';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../utils/auth', () => ({ signUp: jest.fn() }));
jest.mock('../../services/teamService', () => ({ getInviteInfo: jest.fn() }));

const token = 'cd'.repeat(32);

const renderSignUp = () => render(
  <MemoryRouter initialEntries={[`/signup?invite=${token}`]}>
    <Routes>
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<p>Sign-in page</p>} />
    </Routes>
  </MemoryRouter>,
);

const fill = (password) => {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ama' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Mensah' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ama@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: /Create account/ }));
};

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = jest.fn();
  getInviteInfo.mockResolvedValue({ valid: true, group_name: 'Clean Accra', team_role: 'member' });
  signUp.mockResolvedValue({ data: {}, error: null });
});

it('after sign-up: replaces the form with the check-your-email step, scrolls to it, and stays until the person moves on', async () => {
  jest.useFakeTimers();
  try {
    renderSignUp();
    await screen.findByRole('heading', { name: 'Join Clean Accra' });
    fill('Blue-house7');

    const step = await screen.findByTestId('signup-check-email');
    expect(step).toHaveTextContent('Account created. Check your email to finish.');
    expect(step).toHaveTextContent('ama@example.com');
    expect(step).toHaveTextContent('spam');
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));

    // No timed jump to sign-in: the message stays until they choose to go
    act(() => { jest.advanceTimersByTime(30000); });
    expect(screen.getByTestId('signup-check-email')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Go to sign in/ }));
    expect(screen.getByText('Sign-in page')).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

it('refuses an easy-to-guess password before anything is sent', async () => {
  renderSignUp();
  await screen.findByRole('heading', { name: 'Join Clean Accra' });
  fill('password1');
  expect(await screen.findByText(/too easy to guess/)).toBeInTheDocument();
  await waitFor(() => expect(signUp).not.toHaveBeenCalled());
});
