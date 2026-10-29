import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicDumpingMap from '../PublicDumpingMap';

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="leaflet">{children}</div>,
  TileLayer: () => null,
  Marker: ({ title, eventHandlers }) => <button type="button" onClick={eventHandlers.click}>{title}</button>,
  useMap: () => ({ invalidateSize: jest.fn(), setView: jest.fn(), fitBounds: jest.fn() }),
}));
jest.mock('react-leaflet-cluster', () => ({ children }) => <>{children}</>);
jest.mock('../../../services/publicDumpingReportsService', () => ({
  fetchPublicDumpingReports: jest.fn(),
  timeAgo: () => '2 hours ago',
  cleanupDurationText: () => null,
  describeArea: () => 'Osu, Accra',
}));

const lp = { mapLegendBg: '#fff', mapLegendBorder: '#ddd', mapLegendText: '#111', mapLegendLabel: '#333' };
const report = {
  id: 'r1', severity: 'high', status: 'verified', wasteType: 'plastic', isCleanedUp: false, photos: [],
  createdAt: '2026-10-28T10:00:00Z', location: { lat: 5.55, lng: -0.18 },
};
const renderMap = (props = {}) => render(
  <MemoryRouter>
    <PublicDumpingMap lp={lp} isDark data={{ reports: [report], status: 'ready', reload: jest.fn() }} {...props} />
  </MemoryRouter>
);

afterEach(() => { document.body.style.overflow = ''; });

it('a report’s details offer "View more details", to sign-up by default', () => {
  renderMap();
  fireEvent.click(screen.getByRole('button', { name: 'High risk · Osu, Accra' }));
  expect(screen.getByTestId('public-report-card')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /View more details/ })).toHaveAttribute('href', '/signup');
});

it('"View more details" follows detailsHref (signed-in users)', () => {
  renderMap({ detailsHref: '/illegal-dumping/map' });
  fireEvent.click(screen.getByRole('button', { name: 'High risk · Osu, Accra' }));
  expect(screen.getByRole('link', { name: /View more details/ })).toHaveAttribute('href', '/illegal-dumping/map');
});

it('the Full Analytics Map button opens the map full screen; Exit and Escape close it', () => {
  renderMap({ expandable: true });
  const map = screen.getByTestId('public-map');
  expect(map).toHaveAttribute('data-expanded', 'false');

  fireEvent.click(screen.getByRole('button', { name: /Full Analytics Map/ }));
  expect(map).toHaveAttribute('data-expanded', 'true');
  expect(map).toHaveStyle({ position: 'fixed' });
  expect(document.body.style.overflow).toBe('hidden');

  fireEvent.click(screen.getByRole('button', { name: /Exit full screen/ }));
  expect(map).toHaveAttribute('data-expanded', 'false');
  expect(document.body.style.overflow).toBe('');

  fireEvent.click(screen.getByRole('button', { name: /Full Analytics Map/ }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(map).toHaveAttribute('data-expanded', 'false');
});

it('has no full-screen button unless asked for', () => {
  renderMap();
  expect(screen.queryByRole('button', { name: /Full Analytics Map/ })).not.toBeInTheDocument();
});
