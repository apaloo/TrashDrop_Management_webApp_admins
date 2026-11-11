import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiveMap from '../pages/LiveMap';
import { fetchCollectorsForMap } from '../utils/collectorService';
import { fetchPickupRequests } from '../utils/pickupService';

// Leaflet can't draw in jsdom: stand-ins that render their children
const mockMap = {
  on: jest.fn(), off: jest.fn(), once: jest.fn(),
  getContainer: () => document.createElement('div'),
  scrollWheelZoom: { enable: jest.fn(), disable: jest.fn(), enabled: () => false },
  invalidateSize: jest.fn(), setView: jest.fn(), fitBounds: jest.fn(), flyTo: jest.fn(),
  getZoom: () => 12, setZoom: jest.fn(),
};
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  Tooltip: () => null,
  useMap: () => mockMap,
}));
jest.mock('react-leaflet-cluster', () => ({ children }) => <div>{children}</div>);
jest.mock('../utils/collectorService', () => ({
  fetchCollectorsForMap: jest.fn(),
  updateCollectorStatus: jest.fn(),
}));
jest.mock('../utils/pickupService', () => ({ fetchPickupRequests: jest.fn() }));
// Plain functions: react-scripts resets jest.fn() implementations before each test
jest.mock('../utils/supabase', () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { channel: () => channel, removeChannel: () => {} } };
});

const today = new Date().toISOString();
const requests = [
  { id: 'r1', status: 'pending', requestTime: today, location: { lat: 5.6037, lng: -0.187 } },
  { id: 'r2', status: 'accepted', requestTime: today, location: { lat: 5.6145, lng: -0.2057 } },
  { id: 'r3', status: 'pending', requestTime: today, location: { lat: null, lng: null } }, // no position
];
const collectors = [
  { id: 'c1', name: 'Ama Owusu', status: 'active', currentLocation: { lat: 5.61, lng: -0.19 } },
];

describe('LiveMap', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchPickupRequests.mockResolvedValue(requests);
    fetchCollectorsForMap.mockResolvedValue(collectors);
  });
  afterEach(() => jest.restoreAllMocks());

  it('loads requests and collectors and summarises what is on the map', async () => {
    render(<LiveMap />);

    expect(await screen.findByRole('heading', { name: 'Live Map' })).toBeInTheDocument();
    expect(fetchPickupRequests).toHaveBeenCalledWith(expect.objectContaining({ strict: true }));
    // Only requests with a usable position count as "on map"
    expect(screen.getByTestId('summary-requests-on-map')).toHaveTextContent('2');
    expect(screen.getByTestId('summary-pending')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-collectors-online')).toHaveTextContent('/ 1');
  });

  it('shows the error with a retry when the first load fails', async () => {
    fetchPickupRequests.mockRejectedValueOnce(new Error('API Error'));
    render(<LiveMap />);

    expect(await screen.findByText("Couldn't load the live map")).toBeInTheDocument();
    expect(screen.getByText('API Error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Live Map' })).toBeInTheDocument();
  });
});
