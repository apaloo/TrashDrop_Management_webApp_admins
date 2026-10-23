import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AlertsManagement from '../AlertsManagement';
import * as alertSvc from '../../services/alertAdminService';
import * as pickupSvc from '../../services/pickupAdminService';
import { normalizeAlert } from '../../utils/alertUtils';
import { normalizeViewRow } from '../../utils/pickupRequestUtils';

jest.mock('../../services/alertAdminService', () => ({
  fetchAlerts: jest.fn(), fetchActivity: jest.fn(), fetchStaff: jest.fn(), setAlertStatus: jest.fn(), bulkSetStatus: jest.fn(),
  assignAlert: jest.fn(), createAlert: jest.fn(), addComment: jest.fn(), logAlertAction: jest.fn(), sendNotification: jest.fn(),
  setRequestLocation: jest.fn(), subscribeToAlerts: jest.fn(), fetchRuleSettings: jest.fn(), saveRuleSetting: jest.fn(), runRules: jest.fn(),
}));
jest.mock('../../services/pickupAdminService', () => ({
  fetchSummaryRows: jest.fn(), fetchRequestPage: jest.fn(), assignCollector: jest.fn(), setCollectorOnActiveRequest: jest.fn(),
  changeStatus: jest.fn(), cancelRequest: jest.fn(), fetchBatchPrice: jest.fn(), fetchZoneBinPrice: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../utils/collectorService', () => ({ fetchCollectorsAdmin: () => Promise.resolve([
  { id: 'c1', userId: 'u-c1', name: 'Jack Bhone', firstName: 'Jack', status: 'active', phone: '+233241234567', currentLocation: { lat: 9.41, lng: -0.85 }, locationUpdatedAt: new Date().toISOString() },
]) }));
jest.mock('../../services/serviceZoneService', () => ({ fetchServiceZones: () => Promise.resolve({ zones: ['Tamale'] }) }));
jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));
jest.mock('react-leaflet', () => ({ MapContainer: ({ children }) => <div>{children}</div>, TileLayer: () => null, Marker: () => null, useMap: () => ({}), useMapEvents: () => null }));

const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const raw = [
  { id: 's1', title: 'System Alert', description: 'Sample alert for dashboard display', status: 'open', severity: 'medium', type: 'system', created_at: ago(400) },
  { id: 'a1', title: 'Request #10000001 not assigned for 30+ min', status: 'open', severity: 'high', type: 'request_delay', rule_key: 'pending_unassigned', entity_source: 'pickup_requests', entity_ref: '10000001-aaaa', created_at: ago(2) },
  { id: 'a2', title: 'Old fee', status: 'closed', severity: 'low', type: 'fee_mismatch', entity_source: 'pickup_requests', entity_ref: '10000009', created_at: ago(30) },
];
const request = normalizeViewRow({ id: '10000001-aaaa', source: 'pickup_requests', status: 'pending', created_at: ago(2), user_id: 'cust-1', customer_name: 'Abena Darko', address: 'Vitin Estate, Tamale', lat: 9.4, lng: -0.85 });

const renderPage = (path = '/request-pickup/alerts') => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path="/request-pickup/alerts" element={<AlertsManagement />} /></Routes></MemoryRouter>
);

beforeEach(() => {
  alertSvc.fetchAlerts.mockImplementation(async () => ({ alerts: raw.map(normalizeAlert), needsMigration: false }));
  alertSvc.fetchStaff.mockImplementation(async () => ({ staff: [{ id: 'admin-1', name: 'Otis Adomako', email: 'o@x.com' }, { id: 'admin-2', name: 'Xahlijah', email: 'x@x.com' }] }));
  alertSvc.fetchActivity.mockImplementation(async () => [
    { id: 1, kind: 'created', actor_name: 'Rule: pending_unassigned', created_at: ago(2) },
    { id: 2, kind: 'assigned', to_value: 'admin-2', actor_name: 'Otis Adomako', created_at: ago(1) },
  ]);
  alertSvc.subscribeToAlerts.mockImplementation(() => () => {});
  alertSvc.setAlertStatus.mockImplementation(async (a, to) => ({ ...a, status: to }));
  alertSvc.bulkSetStatus.mockImplementation(async (list) => ({ ok: list.length, failed: [] }));
  alertSvc.logAlertAction.mockImplementation(async () => {});
  pickupSvc.fetchSummaryRows.mockImplementation(async () => [request]);
  pickupSvc.fetchRequestPage.mockImplementation(async () => ({ rows: [request], total: 1 }));
  pickupSvc.setCollectorOnActiveRequest.mockImplementation(async () => ({}));
});

it('shows statuses consistently and the cards count every status', async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(3));
  expect(screen.getByTestId('stat-total')).toHaveTextContent('3');
  expect(screen.getByText(/2 open · 0 acknowledged · 0 in progress · 0 resolved · 1 closed/)).toBeInTheDocument();
  const rows = screen.getAllByTestId('alert-row');
  expect(within(rows[0]).getByText('High')).toBeInTheDocument(); // highest open priority first
  expect(within(rows[0]).getByText('Abena Darko')).toBeInTheDocument();
  expect(within(rows[1]).getAllByText('System')).toHaveLength(2); // type and related record (no linked record)
  expect(rows[1]).not.toHaveTextContent('Unknown');
  expect(within(rows[2]).getByText('Closed')).toBeInTheDocument();
});

it('filters by Closed, Medium and System', async () => {
  renderPage('/request-pickup/alerts?status=closed');
  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(1));
  renderPage('/request-pickup/alerts?priority=medium&type=system');
  await waitFor(() => expect(screen.getAllByTestId('alert-row').slice(-1)[0]).toHaveTextContent('System Alert'));
});

it('opens details with the related request, timeline and fitting actions; resolving needs a note', async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(3));
  fireEvent.click(screen.getAllByTestId('alert-row')[0]);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByTestId('related-record')).toHaveTextContent('Abena Darko');
  expect(await within(dialog).findByText('Assigned to Xahlijah')).toBeInTheDocument();
  expect(within(dialog).getByText('Created automatically')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Assign collector' })).toBeInTheDocument();
  expect(within(dialog).queryByText(/dispatch_maintenance/)).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
  const confirm = screen.getAllByRole('dialog').slice(-1)[0];
  const resolveBtn = within(confirm).getByRole('button', { name: 'Resolve' });
  expect(resolveBtn).toBeDisabled();
  fireEvent.change(within(confirm).getByLabelText('Note'), { target: { value: 'Assigned by phone' } });
  fireEvent.click(resolveBtn);
  await waitFor(() => expect(alertSvc.setAlertStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'resolved', { note: 'Assigned by phone', userId: 'admin-1' }));
});

it('"Assign collector" assigns, logs the action and resolves the alert', async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(3));
  fireEvent.click(screen.getAllByTestId('alert-row')[0]);
  fireEvent.click(await screen.findByRole('button', { name: 'Assign collector' }));
  const confirm = screen.getAllByRole('dialog').slice(-1)[0];
  fireEvent.click(within(confirm).getByRole('button', { name: 'Assign' }));
  await waitFor(() => expect(pickupSvc.setCollectorOnActiveRequest).toHaveBeenCalledWith(expect.objectContaining({ id: '10000001-aaaa' }), expect.objectContaining({ id: 'c1' })));
  await waitFor(() => expect(alertSvc.logAlertAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'assign_collector', expect.objectContaining({ ok: true })));
  expect(alertSvc.setAlertStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'resolved', expect.objectContaining({ note: expect.stringMatching(/Jack Bhone/) }));
  expect(await screen.findByText(/they've been notified/)).toBeInTheDocument();
});

it('bulk-acknowledges checked rows and the export menu offers CSV and PDF', async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(3));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all alerts' }));
  fireEvent.click(within(screen.getByTestId('bulk-bar')).getByRole('button', { name: 'Acknowledge' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Acknowledge' }));
  await waitFor(() => expect(alertSvc.bulkSetStatus).toHaveBeenCalled());
  expect(alertSvc.bulkSetStatus.mock.calls[0][0].map(a => a.id).sort()).toEqual(['a1', 's1']); // closed one skipped
  expect(await screen.findByText(/2 alerts updated; 1 skipped/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Export/ }));
  expect(screen.getByRole('menuitem', { name: /CSV/ })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: /PDF/ })).toBeInTheDocument();
});
