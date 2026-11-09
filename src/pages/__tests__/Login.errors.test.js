import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';
import { signIn } from '../../utils/auth';

jest.mock('../../utils/auth', () => ({ signIn: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ refreshAuthState: jest.fn(), isAuthenticated: false })
}));

const submit = async (message) => {
  signIn.mockResolvedValue({ error: { message } });
  render(<MemoryRouter><Login /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  return screen.findByRole('alert');
};

describe('Login feedback', () => {
  it('says the email or password is wrong, with no emoji or "Login Failed" prefix', async () => {
    const alert = await submit('Invalid login credentials');
    expect(alert).toHaveTextContent('Email or password is incorrect');
    expect(alert.textContent).not.toMatch(/Login Failed|❌|⚠️/);
  });

  it('uses the warning style when the email is not verified', async () => {
    const alert = await submit('Email not confirmed');
    expect(alert).toHaveTextContent('Verify your email to sign in');
    expect(alert.className).toMatch(/amber/);
  });
});
