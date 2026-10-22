import { fetchIllegalDumpingReports } from '../realDataUtils';
import { fetchAreaDumpingReports } from '../../services/dumpingAreaService';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../services/dumpingAreaService', () => ({ fetchAreaDumpingReports: jest.fn() }));

it('Media, Volunteer and User accounts read through area_dumping_reports, with the reporter hidden', async () => {
  fetchAreaDumpingReports.mockResolvedValue([
    { id: 'r1', status: 'pending', severity: 'high', waste_type: 'plastic', region: 'Greater Accra', district: 'Madina', area_name: 'Madina market', latitude: 5.68, longitude: -0.17, photos: ['https://x/1.jpg'], reported_at: '2026-10-01T10:00:00Z' },
    { id: 'r2', status: 'in_progress', team_name: 'Bus Stop Boys', assigned_to: 'c5', assigned_via: 'claim', reported_at: '2026-10-02T10:00:00Z' },
  ]);
  const res = await fetchIllegalDumpingReports({ privateView: true, page: 1, limit: 1, area: { level: 'none' } });
  expect(supabase.from).not.toHaveBeenCalled(); // never the table directly
  expect(res.totalCount).toBe(2);
  expect(res.data).toHaveLength(1);
  expect(res.data[0]).toMatchObject({ id: 'r1', reporter: { hidden: true, name: null, email: null }, location: { address: 'Madina market', lat: 5.68, lng: -0.17 }, description_is_generated: true });
  const page2 = await fetchIllegalDumpingReports({ privateView: true, page: 2, limit: 1 });
  expect(page2.data[0]).toMatchObject({ id: 'r2', team_name: 'Bus Stop Boys', assigned_via: 'claim' });
});
