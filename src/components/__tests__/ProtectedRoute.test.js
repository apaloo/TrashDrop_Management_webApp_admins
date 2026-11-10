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

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
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

  // Denied on Dashboard, sent to Reports, whose code is still downloading
  expect(screen.getByTestId('path')).toHaveTextContent('/illegal-dumping/reports');

  // The login page's timer sends the account to /dashboard again
  act(() => navigateTo('/dashboard'));
  await act(async () => { finishDownload(); await download; });

  expect(screen.getByTestId('path')).toHaveTextContent('/illegal-dumping/reports');
  expect(await screen.findByRole('heading', { name: 'Reports page' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
});
