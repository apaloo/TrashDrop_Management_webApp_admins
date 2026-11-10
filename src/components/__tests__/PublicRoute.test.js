import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import PublicRoute from '../PublicRoute';

let mockAuth;
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../utils/logger', () => ({ log: () => {} }));

const Where = () => <p data-testid="path">{useLocation().pathname}</p>;
const signIn = (role, extra = {}) => {
  mockAuth = { isAuthenticated: true, loading: false, authInitialized: true, forceResetMode: false, accessLoading: false, role, ...extra };
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<PublicRoute><h1>Sign in</h1></PublicRoute>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
};

// After sign-in every account used to go to /dashboard first, which only Admin
// and Manager can open; the others then had to be redirected again.
it.each([
  ['admin', '/dashboard'],
  ['manager', '/dashboard'],
  ['authority', '/illegal-dumping/reports'],
  ['media', '/illegal-dumping/map'],
  ['volunteer', '/illegal-dumping/map'],
  ['user', '/settings'],
])('sends a signed-in %s straight to %s', (role, path) => {
  signIn(role);
  expect(screen.getByTestId('path')).toHaveTextContent(path);
});

it('waits for the access level before choosing where to go', () => {
  signIn('user', { accessLoading: true });
  expect(screen.queryByTestId('path')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
});

it('shows the page to someone signed out', () => {
  mockAuth = { isAuthenticated: false, loading: false, authInitialized: true, forceResetMode: false, accessLoading: false, role: 'user' };
  render(<MemoryRouter><PublicRoute><h1>Sign in</h1></PublicRoute></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
});
