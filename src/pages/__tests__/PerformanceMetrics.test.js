import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PerformanceMetrics from '../PerformanceMetrics';
import { fetchMetrics, createMetric, updateMetric, deleteMetric } from '../../services/performanceService';
import { logAudit } from '../../services/auditLogService';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../services/performanceService', () => ({
  fetchMetrics: jest.fn(), createMetric: jest.fn(), updateMetric: jest.fn(), deleteMetric: jest.fn(),
}));
jest.mock('../../services/auditLogService', () => ({ logAudit: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));

const metrics = [
  { key: 'vol_cleanups_completed', label: 'Clean-ups completed', roles: ['volunteer'], calc: 'activity_count',
    params: { activities: ['cleanup.completed'] }, unit: 'count', higher_is_better: true, target: null, sort_order: 10, enabled: true },
  { key: 'vol_claims', label: 'Reports claimed', roles: ['volunteer'], calc: 'activity_count',
    params: { activities: ['cleanup.claimed'] }, unit: 'count', higher_is_better: true, target: 5, sort_order: 20, enabled: false },
  { key: 'mmda_open_backlog', label: 'Waiting for clean-up now', roles: ['authority'], calc: 'area_open_backlog',
    params: {}, unit: 'count', higher_is_better: false, target: null, sort_order: 70, enabled: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { id: 'admin-1' } });
  fetchMetrics.mockResolvedValue(metrics);
  createMetric.mockImplementation(row => Promise.resolve(row));
  updateMetric.mockImplementation((key, patch) => Promise.resolve({ key, ...patch }));
  deleteMetric.mockResolvedValue();
});

const renderPage = async () => {
  render(<MemoryRouter><PerformanceMetrics /></MemoryRouter>);
  await screen.findByTestId('row-volunteer-vol_cleanups_completed');
};
const section = (name) => screen.getByRole('region', { name });

it('lists each account type’s metrics in order, with hidden ones marked', async () => {
  await renderPage();
  const vol = section('Volunteer groups');
  expect(within(vol).getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[1].textContent))
    .toEqual(['Clean-ups completedTimes the account: completed a clean-up', 'Reports claimedTimes the account: claimed a report']);
  expect(within(screen.getByTestId('row-volunteer-vol_claims')).getByText('Hidden')).toBeInTheDocument();
  expect(within(screen.getByTestId('row-volunteer-vol_claims')).getByText('5')).toBeInTheDocument();
  expect(within(section('MMDAs')).getByText('Waiting for clean-up now', { selector: 'p' })).toBeInTheDocument();
  expect(within(section('MMDAs')).getByText('Lower is better')).toBeInTheDocument();
});

it('adds a metric: the form shows what is missing, then saves a valid row and logs it', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: /Add metric/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Add metric' }));
  expect(screen.getByText('Give the metric a name (2 to 80 characters)')).toBeInTheDocument();
  expect(screen.getByText('Choose at least one action')).toBeInTheDocument();
  expect(createMetric).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Clean-ups started' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Started a clean-up' }));
  fireEvent.change(screen.getByLabelText(/^Target/), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add metric' }));

  await waitFor(() => expect(createMetric).toHaveBeenCalledWith({
    key: 'vol_clean_ups_started', label: 'Clean-ups started', description: null, roles: ['volunteer'],
    calc: 'activity_count', params: { activities: ['cleanup.started'] }, unit: 'count',
    higher_is_better: true, target: 4, enabled: true, sort_order: 80,
  }, 'admin-1'));
  expect(await screen.findByRole('status')).toHaveTextContent('Added “Clean-ups started”.');
  expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'performance.metric_created', entityId: 'vol_clean_ups_started' }));
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
});

it('shows only the fields a calculation needs', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: /Add metric/ }));
  fireEvent.change(screen.getByLabelText('What to measure'), { target: { value: 'area_cleaned_within' } });
  expect(screen.getByLabelText('Within how many days')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Actions to count' })).not.toBeInTheDocument();
  expect(screen.getByText(/Area = the MMDA’s district/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('What to measure'), { target: { value: 'activity_ratio' } });
  expect(screen.getByRole('group', { name: 'Count these actions…' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: '…as a share of these actions' })).toBeInTheDocument();
});

it('edits a metric’s name and target', async () => {
  await renderPage();
  fireEvent.click(within(screen.getByTestId('row-volunteer-vol_cleanups_completed')).getByRole('button', { name: /Edit/ }));
  expect(screen.getByLabelText('Name')).toHaveValue('Clean-ups completed');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sites cleaned' } });
  fireEvent.change(screen.getByLabelText(/^Target/), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(updateMetric).toHaveBeenCalledWith('vol_cleanups_completed',
    expect.objectContaining({ label: 'Sites cleaned', target: 10, params: { activities: ['cleanup.completed'] } }), 'admin-1'));
  expect(createMetric).not.toHaveBeenCalled();
  expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'performance.metric_updated', before: metrics[0] }));
});

it('hides and shows a metric', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show Clean-ups completed' }));
  await waitFor(() => expect(updateMetric).toHaveBeenCalledWith('vol_cleanups_completed', { enabled: false }, 'admin-1'));
  expect(await screen.findByRole('status')).toHaveTextContent('Hid “Clean-ups completed”.');
});

it('moves a metric down by swapping places with the next one', async () => {
  await renderPage();
  expect(screen.getByRole('button', { name: 'Move Clean-ups completed up' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Move Clean-ups completed down' }));
  await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(2));
  expect(updateMetric).toHaveBeenNthCalledWith(1, 'vol_cleanups_completed', { sort_order: 20 }, 'admin-1');
  expect(updateMetric).toHaveBeenNthCalledWith(2, 'vol_claims', { sort_order: 10 }, 'admin-1');
});

it('deletes only after confirming', async () => {
  await renderPage();
  const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  const del = () => within(screen.getByTestId('row-volunteer-vol_claims')).getByRole('button', { name: /Delete/ });
  fireEvent.click(del());
  expect(deleteMetric).not.toHaveBeenCalled();
  fireEvent.click(del());
  await waitFor(() => expect(deleteMetric).toHaveBeenCalledWith('vol_claims'));
  expect(confirm.mock.calls[0][0]).toMatch(/hide it instead/);
  await waitFor(() => expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'performance.metric_deleted', entityId: 'vol_claims' })));
});

it('shows the database’s refusal and keeps the form open', async () => {
  createMetric.mockRejectedValue(new Error('A metric with that name already exists. Give it another name.'));
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: /Add metric/ }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Backlog' } });
  fireEvent.change(screen.getByLabelText('What to measure'), { target: { value: 'area_open_backlog' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add metric' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A metric with that name already exists');
  expect(screen.getByLabelText('Name')).toHaveValue('Backlog');
});
