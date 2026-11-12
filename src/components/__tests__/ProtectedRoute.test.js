import React, { Suspense, lazy } from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';
import { SECTIONS } from '../../constants/accessControl';

const mockAuth = {
  isAuthenticated: true, loading: false, authInitialized: true, accessLoading: false, forceResetMode: false,
  role: 'authority', user: { email: 'mmda@example.test' }, access: { role: 'authority', companyType: 'municipality' },
};
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../utils/logger', () => ({ log: () => {} }));

let navigateTo;
const Probe = () => {
  navigateTo = useNavigate();
  return <div data-testid="path">{useLocation().pathname}</div>;
};

const SIGNED_IN_AUTHORITY = { ...mockAuth, access: { ...mockAuth.access } };
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  Object.assign(mockAuth, SIGNED_IN_AUTHORITY);
});
afterEach(() => console.warn.mockRestore());

// The login page sends everyone to /dashboard twice (right away, then from a
// timer). For an MMDA account the second trip used to land while the Reports
// page was still downloading, and the page stayed blank on /dashboard.
it('redirects a denied account again when it is sent to the same page a second time', async () => {
  let finishDownload;
  const download = new Promise(resolve => { finishDownload = resolve; });
  const Reports = lazy(() => download.then(() => ({ default: () => <h1>Reports page</h1> })));

  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Probe />
      <Suspense fallback={<p>Loading…</p>}>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute section={SECTIONS.DASHBOARD}><h1>Dashboard</h1></ProtectedRoute>} />
          <Route path="/illegal-dumping/reports" element={<ProtectedRoute section={SECTIONS.ILLEGAL_DUMPING}><Reports /></ProtectedRoute>} />
        </Routes>
      </Suspense>
    </MemoryRouter>
  );

  // Denied on Dashboard, sent to Reports, whose code is still downloading:
  // the account never sees the Dashboard and waits on a spinner. (React
  // Router 7 changes the address once the page's code has arrived.)
  expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();

  // The login page's timer sends the account to /dashboard again
  act(() => navigateTo('/dashboard'));
  expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  await act(async () => { finishDownload(); await download; });

  expect(screen.getByTestId('path')).toHaveTextContent('/illegal-dumping/reports');
  expect(await screen.findByRole('heading', { name: 'Reports page' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
});

// Every route below sits behind ProtectedRoute; these pin who gets in
describe('who can open a protected page', () => {
  const page = (props) => (
    <MemoryRouter initialEntries={['/requests']}>
      <Probe />
      <Routes>
        <Route path="/requests" element={<ProtectedRoute {...props}><h1>Requests</h1></ProtectedRoute>} />
        <Route path="/login" element={<h1>Sign in</h1>} />
        <Route path="/reset-password" element={<h1>New password</h1>} />
        <Route path="*" element={<h1>Somewhere else</h1>} />
      </Routes>
    </MemoryRouter>
  );
  const asManager = { role: 'manager', user: { email: 'ops@example.test' }, access: { role: 'manager' } };

  it('signed out: sent to sign in, the page never renders', () => {
    Object.assign(mockAuth, { isAuthenticated: false, user: null, role: 'user', access: null });
    render(page({ section: SECTIONS.REQUEST_PICKUP }));
    expect(screen.getByTestId('path')).toHaveTextContent('/login');
    expect(screen.queryByRole('heading', { name: 'Requests' })).not.toBeInTheDocument();
  });

  it('while sign-in is still being checked: a spinner, not the page and not a redirect', () => {
    Object.assign(mockAuth, { isAuthenticated: false, authInitialized: false, loading: true });
    render(page({ section: SECTIONS.REQUEST_PICKUP }));
    expect(screen.getByTestId('path')).toHaveTextContent('/requests');
    expect(screen.queryByRole('heading', { name: 'Requests' })).not.toBeInTheDocument();
  });

  it('opened from a password-reset link: the new password comes first', () => {
    Object.assign(mockAuth, asManager, { forceResetMode: true });
    render(page({ section: SECTIONS.REQUEST_PICKUP }));
    expect(screen.getByTestId('path')).toHaveTextContent('/reset-password');
  });

  it('waits for the access level from the database before deciding', () => {
    Object.assign(mockAuth, asManager, { accessLoading: true });
    render(page({ section: SECTIONS.REQUEST_PICKUP }));
    expect(screen.getByTestId('path')).toHaveTextContent('/requests');
    expect(screen.queryByRole('heading', { name: 'Requests' })).not.toBeInTheDocument();
  });

  it('a role allowed in the section sees the page', () => {
    Object.assign(mockAuth, asManager);
    render(page({ section: SECTIONS.REQUEST_PICKUP, capability: 'requests.view' }));
    expect(screen.getByRole('heading', { name: 'Requests' })).toBeInTheDocument();
  });

  it('a role outside the section goes to its own starting page', () => {
    render(page({ section: SECTIONS.REQUEST_PICKUP }));  // authority
    expect(screen.queryByRole('heading', { name: 'Requests' })).not.toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/illegal-dumping/reports');
  });

  it('a capability narrows a page inside a section the role can open', () => {
    Object.assign(mockAuth, { role: 'user', user: { email: 'someone@example.test' }, access: { role: 'user' } });
    render(page({ section: SECTIONS.SETTINGS, capability: 'requests.view' }));
    expect(screen.queryByRole('heading', { name: 'Requests' })).not.toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/settings');
  });
});
