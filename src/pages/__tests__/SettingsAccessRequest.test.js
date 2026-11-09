import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../Settings';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../utils/auth', () => ({ updateUserMetadata: jest.fn() }));

const show = (auth) => {
  useAuth.mockReturnValue({
    user: { id: 'u1', email: 'someone@example.test', user_metadata: {} },
    isAuthenticated: true,
    accessLoading: false,
    ...auth,
  });
  return render(<MemoryRouter><Settings /></MemoryRouter>);
};

test('a plain User can ask for partner access', () => {
  show({ role: 'user', access: { role: 'user', companyType: null } });
  expect(screen.getByRole('link', { name: /request partner access/i })).toHaveAttribute('href', '/onboarding');
});

test.each(['volunteer', 'media', 'manager', 'authority', 'admin'])('%s is not offered it', (role) => {
  show({ role, access: { role, companyType: 'other' } });
  expect(screen.queryByTestId('request-access')).toBeNull();
});

test('an account that already gave its organisation is not offered it', () => {
  show({ role: 'user', access: { role: 'user', companyType: 'waste_management' } });
  expect(screen.queryByTestId('request-access')).toBeNull();
});

test('nothing flashes while the access level is loading', () => {
  show({ role: 'user', access: null, accessLoading: true });
  expect(screen.queryByTestId('request-access')).toBeNull();
});
