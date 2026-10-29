import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { fetchDashboard, fetchStaleRequests, DashboardError } from '../../services/dashboardAdminService';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../services/dashboardAdminService', () => {
  const actual = jest.requireActual('../../services/dashboardAdminService');
  return { ...actual, fetchDashboard: jest.fn(), fetchStaleRequests: jest.fn() };
});
jest.mock('../../services/pickupAdminService', () => ({ cancelRequest: jest.fn() }));
jest.mock('../../services/alertAdminService', () => ({ setAlertStatus: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
// Charts need a canvas; the tests look at the page, not the drawing
// (the stand-ins keep the role and label the page gives each chart)
jest.mock('react-chartjs-2', () => {
  const Chart = ({ role, 'aria-label': label }) => <div data-testid="chart" role={role} aria-label={label} />;
  return { Bar: Chart, Doughnut: Chart, Line: Chart };
});

const stats = {
  requests: { total: 12, prev_total: 10, pending: 3, prev_pending: 2, pending_all_dates: 5, by_status: { pending: 3, completed: 9 }, by_source: { pickup_requests: 8, digital_bins: 4 } },
  sla: { met: 7, measured: 9, prev_met: 5, prev_measured: 8 },
  collectors: { total: 6, active: 2, idle: 1, on_break: 0, off_duty: 3, unassigned_waiting: 5, completed_today: [] },
  dumping: [], dumping_total: 0,
  period: { bucket: 'day' },
};
const adminOnly = {
  waste: { plastic: 4 },
  bags: { series: [], all_time: { batches: 2, bags: 20, distributed: 10, collected: 5 } },
  alerts: { open: 1, latest: [] },
};
const stale = [{ source: 'pickup_requests', id: 'abcdef123456', status: 'pending', created_at: '2026-09-01T10:00:00Z', days_waiting: 40, customer_name: 'Ama', address: 'Madina' }];

const renderAs = (role) => {
  useAuth.mockReturnValue({ role, user: { id: 'u1', email: 'x@y.com' } });
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchDashboard.mockResolvedValue({ ...stats, ...adminOnly });
  fetchStaleRequests.mockResolvedValue(stale);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Dashboard by role', () => {
  it('Admin sees every card and panel', async () => {
    renderAs('admin');
    await waitFor(() => expect(screen.getByTestId('kpi-total')).toHaveTextContent('12'));
    ['kpi-pending', 'kpi-collectors', 'kpi-sla', 'panel-status', 'panel-source', 'panel-collectors', 'panel-waste', 'panel-bags', 'panel-dumping', 'panel-alerts', 'panel-stale']
      .forEach(id => expect(screen.getByTestId(id)).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Manager sees the stats and the live queue, with no bag or alert panels and no error', async () => {
    fetchDashboard.mockResolvedValue(stats); // the database leaves bags, waste and alerts out for a Manager
    renderAs('manager');
    await waitFor(() => expect(screen.getByTestId('kpi-total')).toHaveTextContent('12'));
    expect(screen.getByTestId('kpi-pending')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-collectors')).toHaveTextContent('3/6');
    expect(screen.getByTestId('kpi-sla')).toHaveTextContent('78%');
    expect(await screen.findByTestId('stale-list')).toBeInTheDocument();
    ['panel-waste', 'panel-bags', 'panel-alerts'].forEach(id => expect(screen.queryByTestId(id)).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('locked')).toBeNull();
    expect(screen.queryByText(/not allowed/i)).toBeNull();
  });

  it('a role without the dashboard makes no calls and sees the locked card, not zeros', () => {
    renderAs('authority');
    expect(fetchDashboard).not.toHaveBeenCalled();
    expect(fetchStaleRequests).not.toHaveBeenCalled();
    expect(screen.getByTestId('locked')).toHaveTextContent('Your role (Authority (MMDA)) doesn’t include the dashboard');
    expect(screen.queryByTestId('kpi-total')).toBeNull();
  });
});

describe('Dashboard states', () => {
  it('shows skeletons while loading, not zeros', async () => {
    fetchDashboard.mockReturnValue(new Promise(() => {}));
    fetchStaleRequests.mockReturnValue(new Promise(() => {}));
    renderAs('manager');
    expect((await screen.findAllByTestId('skeleton')).length).toBeGreaterThan(3);
    expect(screen.getByTestId('kpi-total')).not.toHaveTextContent(/^.*\b0\b/);
    expect(screen.queryByText('No data for this period')).toBeNull();
    expect(screen.queryByText('None waiting')).toBeNull();
  });

  it('a real failure shows "—", a plain message and a retry (never the backend text)', async () => {
    fetchDashboard.mockRejectedValueOnce(new DashboardError('failed', 'admin_dashboard_stats', 'boom: connection reset'));
    renderAs('manager');
    await waitFor(() => expect(screen.getAllByTestId('load-failed').length).toBeGreaterThan(0));
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('—');
    expect(screen.getByTestId('kpi-sla')).toHaveTextContent('—');
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('Couldn’t load');
    expect(screen.queryByText(/connection reset|not allowed/i)).toBeNull();
    expect(screen.queryByText('No data for this period')).toBeNull();
    fetchDashboard.mockResolvedValue(stats);
    fireEvent.click(screen.getAllByText('Retry')[0]);
    await waitFor(() => expect(screen.getByTestId('kpi-total')).toHaveTextContent('12'));
    expect(fetchDashboard).toHaveBeenCalledTimes(2);
  });

  it('a refusal from the database shows the neutral locked card and logs the mismatch', async () => {
    fetchDashboard.mockRejectedValue(new DashboardError('forbidden', 'admin_dashboard_stats', 'Not allowed (42501)'));
    renderAs('manager');
    const locked = await screen.findAllByTestId('locked');
    expect(locked[0]).toHaveTextContent('Your role (Manager) doesn’t include these stats. Ask an admin if you need access.');
    expect(screen.queryByTestId('kpi-total')).toBeNull();
    expect(screen.queryByText(/^Not allowed/)).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('out of step'), expect.stringContaining('42501'));
  });

  it('cards do not link to pages the role cannot open', async () => {
    renderAs('manager');
    await waitFor(() => expect(screen.getByTestId('kpi-total')).toHaveTextContent('12'));
    expect(screen.getByTestId('kpi-total')).not.toBeDisabled();       // requests.view
    expect(screen.getByTestId('kpi-collectors')).toBeDisabled();      // collectors.view is Admin only
  });
});

describe('Dashboard for screen readers', () => {
  it('describes each chart in words, with its numbers', async () => {
    renderAs('admin');
    await waitFor(() => expect(screen.getByTestId('kpi-total')).toHaveTextContent('12'));
    expect(screen.getByRole('img', { name: /requests by status: Pending 3,.*Completed 9/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Doughnut chart, requests by source: Pickup requests 8, Digital bins 4' })).toBeInTheDocument();
  });

  it('each info icon is a named button, outside the card it explains', async () => {
    renderAs('admin');
    await waitFor(() => expect(screen.getByTestId('kpi-total')).toHaveTextContent('12'));
    const help = screen.getByRole('button', { name: /Requests created in this period/ });
    expect(screen.getByTestId('kpi-total')).not.toContainElement(help);
  });
});
