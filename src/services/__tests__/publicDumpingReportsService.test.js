import { mapPublicReport, isPublicMapReport, timeAgo, cleanupDurationText, PUBLIC_REPORT_COLUMNS } from '../publicDumpingReportsService';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));

const row = (over = {}) => ({
  id: 'a', latitude: 5.6, longitude: -0.19, severity: 'HIGH', waste_type: 'Household', status: 'pending',
  created_at: '2026-10-01T00:00:00Z', completed_at: null, area_name: 'Osu, Accra', photo_urls: ['https://x/p.jpg', 'blob:local'], ...over,
});

describe('public dumping reports', () => {
  it('requests only the allowed public columns', () => {
    expect(PUBLIC_REPORT_COLUMNS.split(',').map(s => s.trim()).sort()).toEqual(
      ['area_name', 'completed_at', 'created_at', 'id', 'latitude', 'longitude', 'photo_urls', 'severity', 'status', 'waste_type']);
  });

  it('normalises values and keeps only https photos', () => {
    const r = mapPublicReport(row());
    expect(r.severity).toBe('high');
    expect(r.wasteType).toBe('household');
    expect(r.photos).toEqual(['https://x/p.jpg']);
    expect(r.isCleanedUp).toBe(false);
    expect(mapPublicReport(row({ status: 'Completed' })).isCleanedUp).toBe(true);
  });

  it('drops cancelled, out-of-Ghana and unlocated reports', () => {
    expect(isPublicMapReport(mapPublicReport(row()))).toBe(true);
    expect(isPublicMapReport(mapPublicReport(row({ status: 'cancelled' })))).toBe(false);
    expect(isPublicMapReport(mapPublicReport(row({ latitude: 6.3156, longitude: -10.8074 })))).toBe(false);
    expect(isPublicMapReport(mapPublicReport(row({ latitude: null })))).toBe(false);
  });

  it('formats relative dates and cleanup durations', () => {
    const now = Date.parse('2026-10-04T00:00:00Z');
    expect(timeAgo('2026-10-01T00:00:00Z', now)).toBe('3 days ago');
    expect(timeAgo('2026-10-03T23:00:00Z', now)).toBe('1 hour ago');
    expect(cleanupDurationText('2026-10-01T00:00:00Z', '2026-10-03T00:00:00Z')).toBe('Cleaned up 2 days after report');
    expect(cleanupDurationText('2026-10-01T00:00:00Z', '2026-10-01T05:00:00Z')).toBe('Cleaned up 5 hours after report');
    expect(cleanupDurationText('2026-10-01T00:00:00Z', null)).toBeNull();
  });
});
