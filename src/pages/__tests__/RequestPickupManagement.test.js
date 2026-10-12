import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import RequestPickupManagement from '../RequestPickupManagement';
import * as svc from '../../services/pickupAdminService';
import { normalizeViewRow, applyFilters, sortRows, PAGE_SIZE } from '../../utils/pickupRequestUtils';

jest.mock('../../services/pickupAdminService', () => ({
  fetchRequestPage: jest.fn(), fetchSummaryRows: jest.fn(), fetchAllMatching: jest.fn(), fetchBatchPrice: jest.fn(),
  assignCollector: jest.fn(), changeStatus: jest.fn(), cancelRequest: jest.fn(),
}));
jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../utils/collectorService', () => ({ fetchCollectorsForMap: () => Promise.resolve([]) }));
jest.mock('../../utils/geocoding', () => ({ reverseGeocodeWithCache: () => Promise.resolve(null) }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));
jest.mock('react-leaflet', () => ({ MapContainer: ({ children }) => <div>{children}</div>, TileLayer: () => null, Marker: () => null }));

const base = { source: 'pickup_requests', created_at: '2026-10-14T09:00:00Z', user_id: 'u', customer_name: 'Ama', address: 'Osu, Accra', lat: 5.55, lng: -0.18, bag_count: 1, fee: 25, priority: 'normal' };
const rows = [
  { ...base, id: 'aaaa1111', status: 'pending' },
  { ...base, id: 'bbbb2222', status: 'arrived', collector_ref: 'u-j', collector_profile_id: 'j', collector_name: 'Jack' },
  { ...base, id: 'cccc3333', status: 'collecting', collector_ref: 'u-j', collector_profile_id: 'j', collector_name: 'Jack' },
  { ...base, id: 'dddd4444', status: 'disposed', collector_ref: 'u-j', collector_profile_id: 'j', collector_name: 'Jack' },
].map(normalizeViewRow);

let lastLocation;
const LocationSpy = () => { lastLocation = useLocation(); return null; };
const renderPage = (path = '/request-pickup/requests') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/request-pickup/requests" element={<><RequestPickupManagement /><LocationSpy /></>} /></Routes>
  </MemoryRouter>
);

beforeEach(() => {
  svc.fetchRequestPage.mockImplementation(async (f) => {
    const filtered = sortRows(applyFilters(rows, f), f.sort, f.dir);
    return { rows: filtered.slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE), total: filtered.length, mode: 'server' };
  });
  svc.fetchSummaryRows.mockResolvedValue(rows);
});

it('counts arrived + collecting as In progress and keeps cards on overall totals', async () => {
  renderPage('/request-pickup/requests?status=status:pending');
  await waitFor(() => expect(screen.getByTestId('stat-in-progress')).toHaveTextContent('2'));
  expect(screen.getByTestId('stat-total-requests')).toHaveTextContent('4');
  expect(screen.getAllByTestId('request-row')).toHaveLength(1);
});

it('clicking a stats card filters the table through the URL', async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByTestId('request-row')).toHaveLength(4));
  fireEvent.click(screen.getByRole('button', { name: /^In progress\s*2$/ }));
  await waitFor(() => expect(screen.getAllByTestId('request-row')).toHaveLength(2));
  expect(lastLocation.search).toBe('?status=group%3Ain_progress');
});

it('Normal priority rows match the Medium filter, and an empty result shows a message', async () => {
  renderPage('/request-pickup/requests?priority=medium');
  await waitFor(() => expect(screen.getAllByTestId('request-row')).toHaveLength(4));
  renderPage('/request-pickup/requests?q=nothing-matches');
  expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
});

it('shows pending rows with an Assign action and bag counts in words', async () => {
  renderPage();
  await waitFor(() => expect(screen.getAllByTestId('request-row')).toHaveLength(4));
  const pendingRow = screen.getAllByTestId('request-row').find(r => within(r).queryByText('Pending'));
  expect(within(pendingRow).getByRole('button', { name: 'Assign' })).toBeInTheDocument();
  expect(within(pendingRow).getByText('1 bag')).toBeInTheDocument();
});
