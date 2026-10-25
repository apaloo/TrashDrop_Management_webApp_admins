import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyPerformance from '../MyPerformance';
import { fetchMyPerformance, PerformanceError } from '../../services/performanceService';
import { memberStats } from '../../services/teamService';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../services/teamService', () => ({ memberStats: jest.fn(() => Promise.resolve([])) }));
jest.mock('../../services/performanceService', () => {
  const actual = jest.requireActual('../../services/performanceService');
  return { ...actual, fetchMyPerformance: jest.fn() };
});

const page = (metrics, extra = {}) => ({
  account_id: 'g1', role: 'volunteer', name: 'Clean Accra', region: 'Greater Accra', district: 'Ga East',
  rank_area: 'Greater Accra', refreshed_at: new Date(Date.now() - 2 * 60000).toISOString(),
  period: { from: '2026-09-26', to: '2026-10-25', days: 30 }, metrics, ...extra,
});
const completed = {
  key: 'vol_cleanups_completed', label: 'Clean-ups completed', description: 'Sites your group cleaned up', unit: 'count',
  higher_is_better: true, target: 10, value: 3, previous: 1, rank: 1, of: 3, live: false,
  trend: [{ day: '2026-10-20', value: 1 }, { day: '2026-10-24', value: 2 }],
};
const avgTime = {
  key: 'vol_avg_cleanup_time', label: 'Average time to clean up', unit: 'minutes', higher_is_better: false,
  target: null, value: 120, previous: 90, rank: 2, of: 2, live: false, trend: [{ day: '2026-10-24', value: 120 }],
};

const renderPage = (path = '/performance') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/performance" element={<MyPerformance />} />
      <Route path="/performance/accounts/:accountId" element={<MyPerformance />} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
  memberStats.mockResolvedValue([]);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

it('shows each metric with its value, rank in the region, change and target', async () => {
  fetchMyPerformance.mockResolvedValue(page([completed, avgTime]));
  renderPage();
  const card = await screen.findByTestId('metric-vol_cleanups_completed');
  expect(within(card).getByTestId('metric-value')).toHaveTextContent('3');
  expect(within(card).getByTestId('metric-rank')).toHaveTextContent('1st of 3 volunteer groups in Greater Accra');
  expect(within(card).getByTestId('metric-change')).toHaveTextContent('+2 vs previous 30 days');
  expect(within(card).getByTestId('metric-change')).toHaveClass('text-green-700');
  expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
  expect(within(card).getByText('Target 10')).toBeInTheDocument();
  expect(within(card).getByRole('img', { name: 'Clean-ups completed, day by day' })).toBeInTheDocument();

  const slow = screen.getByTestId('metric-vol_avg_cleanup_time');
  expect(within(slow).getByTestId('metric-value')).toHaveTextContent('2 h');
  expect(within(slow).getByTestId('metric-change')).toHaveTextContent('+30 min vs previous 30 days');
  expect(within(slow).getByTestId('metric-change')).toHaveClass('text-red-700'); // slower is worse
  expect(screen.getByTestId('account-line')).toHaveTextContent('Volunteer group · Ga East · Greater Accra');
  expect(screen.getByTestId('updated')).toHaveTextContent('Updated 2 min ago · every 5 minutes');
  expect(screen.queryByTestId('no-activity')).not.toBeInTheDocument();
  expect(fetchMyPerformance).toHaveBeenCalledWith(30, undefined);
});

it('loads another period when it is picked', async () => {
  fetchMyPerformance.mockResolvedValue(page([completed]));
  renderPage();
  await screen.findByTestId('metric-vol_cleanups_completed');
  userEvent.click(screen.getByRole('button', { name: '7 days' }));
  await waitFor(() => expect(fetchMyPerformance).toHaveBeenLastCalledWith(7, undefined));
  expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
});

it('explains an empty period instead of showing a page of zeros alone', async () => {
  fetchMyPerformance.mockResolvedValue(page([{ ...completed, value: 0, previous: 0, rank: 1, of: 3, trend: [] }]));
  renderPage();
  expect(await screen.findByTestId('no-activity')).toHaveTextContent('No activity in the last 30 days yet');
});

it('tells an account without metrics who the page is for', async () => {
  fetchMyPerformance.mockResolvedValue({ account_id: 'u1', role: 'user', metrics: [] });
  renderPage();
  expect(await screen.findByTestId('no-metrics')).toHaveTextContent('approved volunteer groups and assemblies (MMDAs)');
});

it('admins open any account’s page by its id', async () => {
  fetchMyPerformance.mockResolvedValue(page([completed]));
  renderPage('/performance/accounts/g1');
  expect(await screen.findByRole('heading', { name: 'Clean Accra' })).toBeInTheDocument();
  expect(fetchMyPerformance).toHaveBeenCalledWith(30, 'g1');
  expect(screen.getByRole('link', { name: '← All accounts' })).toHaveAttribute('href', '/performance/accounts');
});

it('keeps the last numbers on screen when a reload fails', async () => {
  fetchMyPerformance.mockResolvedValueOnce(page([completed]))
    .mockRejectedValueOnce(new PerformanceError('failed', 'network'));
  renderPage();
  await screen.findByTestId('metric-vol_cleanups_completed');
  userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load the numbers. Try Refresh. Showing the last numbers loaded.');
  expect(screen.getByTestId('metric-vol_cleanups_completed')).toBeInTheDocument();
});

it('says so when the database refuses', async () => {
  fetchMyPerformance.mockRejectedValue(new PerformanceError('forbidden', 'nope'));
  renderPage('/performance/accounts/someone-else');
  expect(await screen.findByRole('alert')).toHaveTextContent('You can only see your own performance.');
});

it('shows a volunteer group each member’s part in its numbers', async () => {
  memberStats.mockResolvedValue([
    { member_id: 'g1', is_group: true, name: 'Group account', verified: 0, assigned: 0, claimed: 2, completed: 2, marked_cleaned: 0 },
    { member_id: 'm1', is_group: false, name: 'Kofi Asante', verified: 3, assigned: 1, claimed: 0, completed: 0, marked_cleaned: 1 },
  ]);
  fetchMyPerformance.mockResolvedValue(page([completed]));
  renderPage();
  const rows = await screen.findAllByTestId('member-stats-row');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('The shared group login');
  expect(rows[1]).toHaveTextContent('Kofi Asante31001');
  expect(memberStats).toHaveBeenCalledWith(30);
  expect(screen.queryByTestId('no-members-yet')).not.toBeInTheDocument();
});

it('has no members table for MMDAs or when an admin views a group', async () => {
  fetchMyPerformance.mockResolvedValue(page([completed], { role: 'authority' }));
  renderPage();
  await screen.findByTestId('metric-vol_cleanups_completed');
  expect(memberStats).not.toHaveBeenCalled();
});
