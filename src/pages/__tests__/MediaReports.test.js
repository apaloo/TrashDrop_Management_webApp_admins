import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MediaReports from '../MediaReports';
import { fetchMediaReports, logMediaExport } from '../../services/mediaService';
import { canAccessSection, SECTIONS } from '../../constants/accessControl';

jest.mock('../../services/mediaService', () => {
  const actual = jest.requireActual('../../services/mediaService');
  return { ...actual, fetchMediaReports: jest.fn(), logMediaExport: jest.fn() };
});
jest.mock('../../utils/supabase', () => ({ supabase: {} }));

const rows = [
  { id: 'a', reported_at: '2026-10-01T10:00:00Z', status: 'disposed', severity: 'high', waste_type: 'plastic', region: 'Greater Accra', district: 'La-Nkwantanang-Madina', cleaned_at: '2026-10-03T10:00:00Z', cleanup_by: 'volunteer group', photos: [], cleanup_photos: ['https://x/2.jpg'] },
  { id: 'b', reported_at: '2026-10-02T10:00:00Z', status: 'verified', severity: 'low', waste_type: 'mixed', region: 'Ashanti', district: 'Kumasi Metropolitan', photos: ['https://x/1.jpg'], cleanup_photos: [] },
];

describe('Reports data page', () => {
  beforeEach(() => {
    fetchMediaReports.mockResolvedValue(rows);
    logMediaExport.mockResolvedValue();
    global.URL.createObjectURL = jest.fn(() => 'blob:x');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('is for Media, Managers and Admins only', () => {
    expect(canAccessSection(SECTIONS.MEDIA_DATA, 'media', { email: 'x@y.com' })).toBe(true);
    expect(canAccessSection(SECTIONS.MEDIA_DATA, 'manager', { email: 'x@y.com' })).toBe(true);
    ['user', 'volunteer', 'authority'].forEach(r => expect(canAccessSection(SECTIONS.MEDIA_DATA, r, { email: 'x@y.com' })).toBe(false));
  });

  it('shows the national numbers and the reports', async () => {
    render(<MediaReports />);
    expect(await screen.findAllByTestId('media-row')).toHaveLength(2);
    expect(screen.getByTestId('media-kpi-total')).toHaveTextContent('2');
    expect(screen.getByTestId('media-kpi-cleaned')).toHaveTextContent('1 by volunteer groups');
    expect(screen.getByTestId('media-kpi-days')).toHaveTextContent('2.0 days');
    expect(screen.getByTestId('media-regions')).toHaveTextContent('Ashanti');
  });

  it('filters by region and district through the database', async () => {
    render(<MediaReports />);
    await screen.findAllByTestId('media-row');
    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'Ashanti' } });
    await waitFor(() => expect(fetchMediaReports).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'Ashanti', district: '' })));
    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'Kumasi Metropolitan' } });
    await waitFor(() => expect(fetchMediaReports).toHaveBeenLastCalledWith(expect.objectContaining({ district: 'Kumasi Metropolitan' })));
  });

  it('downloads a CSV and records the download', async () => {
    render(<MediaReports />);
    await screen.findAllByTestId('media-row');
    fireEvent.click(screen.getByTestId('media-download'));
    await waitFor(() => expect(logMediaExport).toHaveBeenCalledWith(expect.objectContaining({ region: '' }), 2));
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});
