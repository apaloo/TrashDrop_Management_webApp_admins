import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IllegalDumpingHistory from '../IllegalDumpingHistory';
import IllegalDumpingManagement from '../IllegalDumpingManagement';
import { buildAuditRows } from '../../test-fixtures/illegalDumpingRows';
import { fetchAllIllegalDumpingReports, updateIllegalDumpingStatus } from '../../utils/databaseUtils';
import { areaVerifyReport, areaMarkCleaned } from '../../services/dumpingAreaService';

jest.mock('../../utils/databaseUtils', () => ({
  fetchAllIllegalDumpingReports: jest.fn(),
  updateIllegalDumpingStatus: jest.fn(),
  fetchIllegalDumpingHistory: jest.fn(),
  assignCleanupTeam: jest.fn(),
}));
jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../services/dumpingAreaService', () => ({
  usesAreaActions: (role) => role !== 'admin' && role !== 'manager',
  areaVerifyReport: jest.fn(), areaMarkCleaned: jest.fn(), areaAssignTeam: jest.fn(), fetchAreaTeams: jest.fn(),
}));
let mockAuth = { role: 'manager', area: { level: 'national' } };
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuth }));

beforeEach(() => {
  mockAuth = { role: 'manager', area: { level: 'national' } };
  fetchAllIllegalDumpingReports.mockResolvedValue(buildAuditRows());
  // eslint-disable-next-line global-require
  require('../../utils/databaseUtils').fetchIllegalDumpingHistory.mockResolvedValue([]);
});

const renderAt = (ui, path = '/') => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
// "Showing 1 to 10 of 13 results" is split across spans
const results = (count) => screen.getByText((_, el) => el?.tagName === 'P' && new RegExp(`of ${count} results`).test(el.textContent));
const loaded = () => waitFor(() => expect(screen.getByTestId('pending-count')).not.toHaveTextContent('—'));
const reportsLoaded = () => waitFor(() => expect(screen.getByTestId('kpi-total-reports')).not.toHaveTextContent('—'));

describe('History page', () => {
  it('lists only resolved and cancelled reports, with working tabs and chips', async () => {
    renderAt(<IllegalDumpingHistory />);
    await loaded();
    expect(results(13)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cancelled \(9\)/ }));
    expect(results(9)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Resolved \(4\)/ }));
    expect(results(4)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^All \(13\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelled', pressed: false }));
    expect(results(9)).toBeInTheDocument();
  });

  it('shows the average in days and the real pending count', async () => {
    renderAt(<IllegalDumpingHistory />);
    await loaded();
    expect(screen.getByTestId('avg-resolution')).toHaveTextContent('79.5 days');
    expect(screen.getByTestId('pending-count')).toHaveTextContent('51');
    expect(screen.getByRole('link', { name: /Review on Reports page/ })).toHaveAttribute('href', '/illegal-dumping/reports?status=pending');
  });

  it('shows real locations, not "Unknown location"', async () => {
    renderAt(<IllegalDumpingHistory />);
    await loaded();
    expect(screen.getAllByText('Pokuase, Greater Accra Region').length).toBeGreaterThan(0);
    expect(screen.queryByText('Unknown location')).not.toBeInTheDocument();
  });

  it('warns about an inverted date range', async () => {
    renderAt(<IllegalDumpingHistory />);
    await loaded();
    fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('To Date'), { target: { value: '2026-04-30' } });
    expect(screen.getByRole('alert')).toHaveTextContent('End date is before start date');
  });
});

describe('Reports page', () => {
  it('shows correct KPI tiles for all reports', async () => {
    renderAt(<IllegalDumpingManagement />);
    await reportsLoaded();
    expect(screen.getByTestId('kpi-total-reports')).toHaveTextContent('82');
    expect(screen.getByTestId('kpi-verified-or-beyond')).toHaveTextContent('22');
    expect(screen.getByText('2 awaiting a collector')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-avg-cleanup-time')).toHaveTextContent('79.5 days');
  });

  it('loads every report, not just 100', async () => {
    const many = Array.from({ length: 3 }, buildAuditRows).flat().map((r, i) => ({ ...r, id: `${i}`.padStart(8, '0') + r.id.slice(8) }));
    fetchAllIllegalDumpingReports.mockResolvedValue(many);
    renderAt(<IllegalDumpingManagement />);
    await reportsLoaded();
    expect(screen.getByTestId('kpi-total-reports')).toHaveTextContent('246');
  });

  it('opens a pending report with a valid date, reporter, Verify and no Mark Cleaned', async () => {
    renderAt(<IllegalDumpingManagement />, '/illegal-dumping/reports?status=pending');
    await reportsLoaded();
    expect(screen.getByLabelText('Status')).toHaveValue('pending');
    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Invalid Date')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(within(dialog).getByText('Ama Mensah')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Mark as Cleaned Up/ })).not.toBeInTheDocument();
    expect(within(dialog).getByText('No photos were attached to this report.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the assignee and only offers Mark Cleaned for in-progress reports', async () => {
    renderAt(<IllegalDumpingManagement />, '/illegal-dumping/reports?status=in_progress');
    await reportsLoaded();
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Jack Bhone')).toBeInTheDocument();
    expect(within(rows[0]).getByText('In Progress')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('button', { name: 'Mark Cleaned' })).toBeInTheDocument();
  });

  it('trims search input', async () => {
    renderAt(<IllegalDumpingManagement />);
    await reportsLoaded();
    fireEvent.change(screen.getByPlaceholderText(/Search by ID/), { target: { value: '  margibi  ' } });
    expect(screen.getByText(/of 5$/)).toBeInTheDocument();
  });

  it('verifies a pending report', async () => {
    updateIllegalDumpingStatus.mockResolvedValue({ data: {}, error: null });
    renderAt(<IllegalDumpingManagement />, '/illegal-dumping/reports?status=pending');
    await reportsLoaded();
    fireEvent.click(screen.getAllByRole('button', { name: 'Verify' })[0]);
    await waitFor(() => expect(updateIllegalDumpingStatus).toHaveBeenCalledWith(expect.any(String), 'verified'));
  });
});

describe('Authority (district view)', () => {
  const area = { level: 'district', region: 'Greater Accra', district: 'La-Nkwantanang-Madina' };

  it('loads its district with reporters, and verifies and marks cleaned through the area functions', async () => {
    mockAuth = { role: 'authority', area };
    areaVerifyReport.mockResolvedValue({}); areaMarkCleaned.mockResolvedValue({});
    renderAt(<IllegalDumpingManagement />, '/illegal-dumping/reports?status=pending');
    await reportsLoaded();
    expect(fetchAllIllegalDumpingReports).toHaveBeenLastCalledWith({ area, privateView: false });
    expect(screen.getByTestId('area-scope')).toHaveTextContent('La-Nkwantanang-Madina, Greater Accra');
    fireEvent.click(screen.getAllByRole('button', { name: /^Verify$/ })[0]);
    await waitFor(() => expect(areaVerifyReport).toHaveBeenCalled());
    expect(updateIllegalDumpingStatus).not.toHaveBeenCalled();
  });

  it('says so when the account has no district', async () => {
    mockAuth = { role: 'authority', area: { level: 'none' } };
    renderAt(<IllegalDumpingHistory />);
    expect(await screen.findByTestId('area-none')).toBeInTheDocument();
  });
});

describe('Volunteer claims', () => {
  it('marks reports claimed by a volunteer group', async () => {
    const rows = buildAuditRows();
    rows[0] = { ...rows[0], team_name: 'Bus Stop Boys', assigned_to: 'c5', assigned_via: 'claim', cleanup_photos: ['https://cdn.example/after.jpg'] };
    fetchAllIllegalDumpingReports.mockResolvedValue(rows);
    renderAt(<IllegalDumpingManagement />);
    await reportsLoaded();
    expect(screen.getAllByText('(volunteers)').length).toBeGreaterThan(0);
  });
});

describe('Media, Volunteer and User accounts', () => {
  beforeEach(() => { areaVerifyReport.mockReset(); areaMarkCleaned.mockReset(); updateIllegalDumpingStatus.mockReset(); });
  const hidden = () => buildAuditRows().map(r => ({ ...r, reporter: { id: null, name: null, email: null, anonymous: false, hidden: true } }));

  it('Media reads nationally without reporter details and can only verify', async () => {
    mockAuth = { role: 'media', area: { level: 'national' } };
    fetchAllIllegalDumpingReports.mockResolvedValue(hidden());
    renderAt(<IllegalDumpingManagement />, '/illegal-dumping/reports?status=pending');
    await reportsLoaded();
    expect(fetchAllIllegalDumpingReports).toHaveBeenLastCalledWith({ area: null, privateView: true });
    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Reported By')).toBeNull();
    expect(within(dialog).queryByText('Ama Mensah')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Assign Cleanup' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Cancel Report' })).toBeNull();
  });

  it('Volunteer can mark cleaned through the area functions', async () => {
    mockAuth = { role: 'volunteer', area: { level: 'region', region: 'Greater Accra' } };
    fetchAllIllegalDumpingReports.mockResolvedValue(hidden());
    areaMarkCleaned.mockResolvedValue({});
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt(<IllegalDumpingManagement />, '/illegal-dumping/reports?status=in_progress');
    await reportsLoaded();
    expect(fetchAllIllegalDumpingReports).toHaveBeenLastCalledWith({ area: null, privateView: true });
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark Cleaned' })[0]);
    await waitFor(() => expect(areaMarkCleaned).toHaveBeenCalled());
    expect(updateIllegalDumpingStatus).not.toHaveBeenCalled();
  });

  it('User sees its home district, view only', async () => {
    mockAuth = { role: 'user', area: { level: 'none' } };
    fetchAllIllegalDumpingReports.mockResolvedValue(hidden());
    renderAt(<IllegalDumpingManagement />, '/illegal-dumping/reports?status=pending');
    await reportsLoaded();
    expect(screen.getByTestId('area-home')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Verify$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Mark Cleaned/ })).toBeNull();
  });
});
