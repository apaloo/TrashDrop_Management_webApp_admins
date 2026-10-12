import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CollectorsManagement from '../CollectorsManagement';
import * as svc from '../../services/pickupAdminService';
import * as collectorSvc from '../../utils/collectorService';
import { normalizeViewRow } from '../../utils/pickupRequestUtils';

jest.mock('../../services/pickupAdminService', () => ({
  fetchSummaryRows: jest.fn(), fetchUnassignedPending: jest.fn(), assignCollector: jest.fn(),
}));
jest.mock('../../utils/collectorService', () => ({
  fetchCollectorsAdmin: jest.fn(), createCollectorProfile: jest.fn(), updateCollectorProfile: jest.fn(),
  setCollectorActive: jest.fn(), findCollectorClashes: jest.fn(),
}));
jest.mock('../../services/serviceZoneService', () => ({
  fetchServiceZones: () => Promise.resolve({ zones: ['Accra – Ga North', 'Accra – Ayawaso West', 'Kumasi', 'Tamale'], source: 'config' }),
}));
jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));
jest.mock('react-leaflet', () => ({ MapContainer: ({ children }) => <div>{children}</div>, TileLayer: () => null, Marker: () => null }));

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const collector = (over) => ({
  userId: null, firstName: '', lastName: '', email: null, phone: null, status: 'active', zone: null,
  vehicleType: null, vehicleRegistration: null, vehicleCapacityBags: null, locationUpdatedAt: null,
  currentLocation: { lat: null, lng: null }, joinDate: '2026-01-01T00:00:00Z', ...over,
});
const collectors = [
  collector({ id: 'jack-0000-1111', userId: 'u-jack', name: 'Jack Bhone', firstName: 'Jack', lastName: 'Bhone', phone: '+233241234567', zone: 'Tamale',
    vehicleType: 'cart', vehicleRegistration: null, locationUpdatedAt: minutesAgo(3), currentLocation: { lat: 9.40, lng: -0.84 } }),
  collector({ id: 'ama-0000-2222', userId: 'u-ama', name: 'Ama Owusu', firstName: 'Ama', phone: '0201112222', locationUpdatedAt: minutesAgo(180) }),
  collector({ id: 'kofi-000-3333', name: 'Kofi Asante', firstName: 'Kofi', phone: '233501239999', status: 'inactive' }),
  collector({ id: 'esi-0000-4444', name: 'Esi Mensah', firstName: 'Esi' }),
  collector({ id: 'yaw-0000-5555', userId: 'u-yaw', name: 'Yaw Boateng', firstName: 'Yaw', zone: 'Kumasi', locationUpdatedAt: minutesAgo(1) }),
];

const base = { source: 'pickup_requests', created_at: '2026-10-14T09:00:00Z', user_id: 'u', address: 'Vitin Estate, Tamale', lat: 9.41, lng: -0.85, bag_count: 2, fee: 10 };
const jackJobs = [
  ...Array.from({ length: 12 }, (_, i) => ({ ...base, id: `done${i}`, status: i % 2 ? 'disposed' : 'completed', collector_ref: 'u-jack', collector_profile_id: 'jack-0000-1111', customer_rating: i < 2 ? 4 + i : null })),
  { ...base, id: 'active01', status: 'arrived', collector_ref: 'u-jack', collector_profile_id: 'jack-0000-1111' },
];
const pending = [
  { ...base, id: 'far00001', status: 'pending', address: 'Kumasi', lat: 6.69, lng: -1.62 },
  { ...base, id: 'near0001', status: 'pending', address: 'Lamashegu, Tamale', lat: 9.39, lng: -0.84 },
];
const summary = [...jackJobs, ...pending].map(normalizeViewRow);

const renderPage = (path = '/request-pickup/collectors') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/request-pickup/collectors" element={<CollectorsManagement />} />
      <Route path="/request-pickup/requests" element={<p>Pickup requests page</p>} />
    </Routes>
  </MemoryRouter>
);
const card = (name) => screen.getAllByTestId('collector-card').find(c => within(c).queryByText(name));

beforeEach(() => {
  collectorSvc.fetchCollectorsAdmin.mockImplementation(() => Promise.resolve(collectors));
  collectorSvc.findCollectorClashes.mockImplementation(() => Promise.resolve([]));
  svc.fetchSummaryRows.mockImplementation(() => Promise.resolve(summary));
  svc.fetchUnassignedPending.mockImplementation(() => Promise.resolve(summary.filter(r => r.status === 'pending')));
  svc.assignCollector.mockImplementation(() => Promise.resolve({}));
  try { localStorage.clear(); } catch (e) { /* ignore */ }
});

it('shows pickups, active jobs, rating and earnings from the requests', async () => {
  renderPage();
  await waitFor(() => expect(within(card('Jack Bhone')).getByTestId('stat-pickups')).toHaveTextContent('12'));
  const jack = card('Jack Bhone');
  expect(within(jack).getByText('★ 4.5')).toBeInTheDocument();
  expect(within(jack).getByText('GHS 120.00')).toBeInTheDocument();
  expect(within(jack).getByText('Online')).toBeInTheDocument();
  expect(within(jack).getAllByText('Cart').length).toBeGreaterThan(0);
  expect(jack).not.toHaveTextContent('N/A'); // no "cart - N/A - N/A"
  expect(within(card('Yaw Boateng')).getByText('No ratings yet')).toBeInTheDocument();
  expect(within(card('Ama Owusu')).getByText(/Last seen 3 h ago/)).toBeInTheDocument();
  expect(within(jack).getByText('jack-000')).toBeInTheDocument(); // short ID
});

it('"Unassigned" lists every collector without a zone, and phone search accepts any format', async () => {
  renderPage('/request-pickup/collectors?zone=__unassigned__');
  await waitFor(() => expect(screen.getAllByTestId('collector-card')).toHaveLength(3));
  renderPage('/request-pickup/collectors?q=%2B233%2020%20111%202222');
  await waitFor(() => expect(screen.getAllByTestId('collector-card').slice(-1)[0]).toHaveTextContent('Ama Owusu'));
});

it('the Add form always opens empty with no zone preselected', async () => {
  renderPage();
  await screen.findAllByTestId('collector-card');
  fireEvent.click(within(card('Jack Bhone')).getByRole('button', { name: /More actions/ }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  expect(screen.getByLabelText(/First name/)).toHaveValue('Jack');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: /Add collector/ }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByLabelText(/First name/)).toHaveValue('');
  expect(within(dialog).getByLabelText(/Service zone/)).toHaveValue('');
  expect(within(dialog).getByRole('option', { name: 'Accra – Ayawaso West' })).toBeInTheDocument();
  expect(within(dialog).queryByRole('option', { name: 'North District' })).not.toBeInTheDocument();
});

it('validates and normalises the phone, and blocks duplicates', async () => {
  collectorSvc.createCollectorProfile.mockImplementation((v) => Promise.resolve({ collector: collector({ id: 'new', name: v.firstName, ...v }), skipped: [] }));
  renderPage();
  await screen.findAllByTestId('collector-card');
  fireEvent.click(screen.getByRole('button', { name: /Add collector/ }));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByLabelText(/First name/), { target: { value: 'Abena' } });
  fireEvent.change(dialog.getByLabelText(/Phone/), { target: { value: '024 123 4567' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Add collector' }));
  expect(await dialog.findByText('Jack Bhone already uses this phone number')).toBeInTheDocument();
  fireEvent.change(dialog.getByLabelText(/Phone/), { target: { value: '0551234567' } });
  fireEvent.change(dialog.getByLabelText(/Email/), { target: { value: 'not-an-email' } });
  expect(dialog.getByText(/valid email/)).toBeInTheDocument();
  fireEvent.change(dialog.getByLabelText(/Email/), { target: { value: '' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Add collector' }));
  await waitFor(() => expect(collectorSvc.createCollectorProfile).toHaveBeenCalledWith(expect.objectContaining({ phone: '+233551234567', email: null, zone: null })));
});

it('assigns the nearest pending pickups after confirmation', async () => {
  renderPage();
  await waitFor(() => expect(within(card('Jack Bhone')).getByTestId('stat-pickups')).toHaveTextContent('12'));
  fireEvent.click(within(card('Jack Bhone')).getByRole('button', { name: /Assign pickups to Jack Bhone/ }));
  const first = await screen.findByRole('checkbox', { name: 'Select request near0001' });
  const rows = screen.getAllByRole('checkbox', { name: /Select request/ });
  expect(rows[0]).toBe(first); // nearest first
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
  fireEvent.click(screen.getByRole('button', { name: /Review 2 assignments/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Assign 2' }));
  await waitFor(() => expect(svc.assignCollector).toHaveBeenCalledTimes(2));
  expect(svc.assignCollector.mock.calls[0][1]).toMatchObject({ id: 'jack-0000-1111', userId: 'u-jack' });
  expect(await screen.findByText(/Assigned 2 pickups to Jack Bhone/)).toBeInTheDocument();
});

it('disables Assign for inactive, offline and app-less collectors', async () => {
  renderPage();
  await screen.findAllByTestId('collector-card');
  expect(within(card('Kofi Asante')).getByRole('button', { name: /Assign pickups/ })).toBeDisabled();
  expect(within(card('Esi Mensah')).getByRole('button', { name: /Assign pickups/ })).toBeDisabled();
  expect(within(card('Esi Mensah')).getByTitle(/No app account linked/)).toBeInTheDocument();
  expect(within(card('Ama Owusu')).getByRole('button', { name: /Assign pickups/ })).toBeEnabled();
});

it('blocks deactivating a collector with active jobs; others need a reason', async () => {
  collectorSvc.setCollectorActive.mockImplementation((id, active) => Promise.resolve({ collector: { ...collectors.find(c => c.id === id), status: active ? 'active' : 'inactive' }, skipped: [] }));
  renderPage();
  await waitFor(() => expect(within(card('Jack Bhone')).getByTestId('stat-pickups')).toHaveTextContent('12'));
  fireEvent.click(within(card('Jack Bhone')).getByRole('button', { name: /More actions/ }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
  expect(screen.getByText(/has 1 active job/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));

  fireEvent.click(within(card('Yaw Boateng')).getByRole('button', { name: /More actions/ }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
  const confirm = screen.getByRole('button', { name: 'Deactivate' });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Left TrashDrop' } });
  fireEvent.click(confirm);
  await waitFor(() => expect(collectorSvc.setCollectorActive).toHaveBeenCalledWith('yaw-0000-5555', false, { reason: 'Left TrashDrop', userId: 'admin-1' }));
  expect(await within(card('Yaw Boateng')).findByText('inactive')).toBeInTheDocument();
});

it('table view keeps every action visible', async () => {
  renderPage();
  await screen.findAllByTestId('collector-card');
  fireEvent.click(screen.getByRole('button', { name: 'Table' }));
  const table = await screen.findByTestId('collector-table');
  expect(within(table).getByRole('button', { name: 'Deactivate Jack Bhone' })).toBeInTheDocument();
  expect(within(table).getByRole('button', { name: 'Reactivate Kofi Asante' })).toBeInTheDocument();
});
