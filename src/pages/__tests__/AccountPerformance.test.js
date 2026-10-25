import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AccountPerformance from '../AccountPerformance';
import { fetchPerformanceOverview, PerformanceError } from '../../services/performanceService';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../services/performanceService', () => {
  const actual = jest.requireActual('../../services/performanceService');
  return { ...actual, fetchPerformanceOverview: jest.fn() };
});

const overview = {
  role: 'volunteer', days: 30, refreshed_at: new Date().toISOString(),
  metrics: [
    { key: 'vol_cleanups_completed', label: 'Clean-ups completed', unit: 'count', higher_is_better: true },
    { key: 'vol_avg_cleanup_time', label: 'Average time to clean up', unit: 'minutes', higher_is_better: false },
  ],
  accounts: [
    { account_id: 'g2', name: 'Green Tema', region: 'Greater Accra', district: 'Tema Metropolitan', values: { vol_cleanups_completed: 1, vol_avg_cleanup_time: 30 } },
    { account_id: 'g1', name: 'Clean Accra', region: 'Greater Accra', district: 'Ga East', values: { vol_cleanups_completed: 3, vol_avg_cleanup_time: 120 } },
    { account_id: 'g3', name: 'Kasoa Youth', region: 'Greater Accra', district: null, values: { vol_cleanups_completed: 0, vol_avg_cleanup_time: null } },
  ],
};
const names = () => screen.getAllByTestId('account-row').map(r => within(r).getByRole('link').textContent);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  fetchPerformanceOverview.mockResolvedValue(overview);
});

const renderPage = () => render(<MemoryRouter><AccountPerformance /></MemoryRouter>);

it('lists every account with its numbers, best first, linking to each page', async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByTestId('account-row')).toHaveLength(3));
  expect(names()).toEqual(['Clean Accra', 'Green Tema', 'Kasoa Youth']);
  const first = screen.getAllByTestId('account-row')[0];
  expect(first).toHaveTextContent('Ga East, Greater Accra');
  expect(first).toHaveTextContent('2 h');
  expect(within(first).getByRole('link')).toHaveAttribute('href', '/performance/accounts/g1');
  expect(screen.getAllByTestId('account-row')[2]).toHaveTextContent('—');
  expect(fetchPerformanceOverview).toHaveBeenCalledWith('volunteer', '', 30);
});

it('sorts by any column, best first on the first click; empty values stay last', async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByTestId('account-row')).toHaveLength(3));
  const avg = () => screen.getByRole('button', { name: 'Average time to clean up' });
  fireEvent.click(avg()); // fastest first
  expect(names()).toEqual(['Green Tema', 'Clean Accra', 'Kasoa Youth']);
  expect(screen.getByRole('columnheader', { name: 'Average time to clean up' })).toHaveAttribute('aria-sort', 'ascending');
  fireEvent.click(avg()); // flipped
  expect(names()).toEqual(['Clean Accra', 'Green Tema', 'Kasoa Youth']);
  expect(screen.getByRole('columnheader', { name: 'Average time to clean up' })).toHaveAttribute('aria-sort', 'descending');
  fireEvent.click(screen.getByRole('button', { name: 'Account' })); // A–Z
  expect(names()).toEqual(['Clean Accra', 'Green Tema', 'Kasoa Youth']);
  fireEvent.click(screen.getByRole('button', { name: 'Account' }));
  expect(names()).toEqual(['Kasoa Youth', 'Green Tema', 'Clean Accra']);
});

it('switches to MMDAs, a region and a period', async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByTestId('account-row')).toHaveLength(3));
  fetchPerformanceOverview.mockResolvedValue({ ...overview, role: 'authority', metrics: [], accounts: [] });
  userEvent.click(screen.getByRole('button', { name: 'MMDAs' }));
  await waitFor(() => expect(fetchPerformanceOverview).toHaveBeenLastCalledWith('authority', '', 30));
  userEvent.selectOptions(screen.getByRole('combobox', { name: 'Region' }), 'Ashanti');
  await waitFor(() => expect(fetchPerformanceOverview).toHaveBeenLastCalledWith('authority', 'Ashanti', 30));
  userEvent.click(screen.getByRole('button', { name: '90 days' }));
  await waitFor(() => expect(fetchPerformanceOverview).toHaveBeenLastCalledWith('authority', 'Ashanti', 90));
  expect(await screen.findByTestId('no-accounts')).toHaveTextContent('No approved assemblies (MMDAs) in Ashanti yet.');
});

it('explains when the database refuses a non-admin', async () => {
  fetchPerformanceOverview.mockRejectedValue(new PerformanceError('forbidden', 'nope'));
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('Only TrashDrop admins can compare accounts.');
});
