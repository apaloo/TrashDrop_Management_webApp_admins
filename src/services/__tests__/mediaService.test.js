import { toCsv, summarise, daysToClean } from '../mediaService';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));

const rows = [
  { id: 'a', reported_at: '2026-10-01T10:00:00Z', status: 'disposed', severity: 'high', region: 'Greater Accra', district: 'La-Nkwantanang-Madina',
    cleaned_at: '2026-10-03T10:00:00Z', cleanup_by: 'volunteer group', photos: ['https://x/1.jpg'], cleanup_photos: ['https://x/2.jpg'], area_name: 'Madina, "Zongo"' },
  { id: 'b', reported_at: '2026-10-02T10:00:00Z', status: 'completed', region: 'Ashanti', cleaned_at: '2026-10-06T10:00:00Z', cleanup_by: 'TrashDrop collector' },
  { id: 'c', reported_at: '2026-10-05T10:00:00Z', status: 'verified', region: 'Ashanti', area_name: '=HYPERLINK("http://evil")' },
  { id: 'd', reported_at: '2026-10-05T10:00:00Z', status: 'cancelled', region: null },
];

describe('media data', () => {
  it('counts open, cleaned, volunteer cleanups and the median days to clean', () => {
    const s = summarise(rows);
    expect(s).toMatchObject({ total: 4, open: 1, cleaned: 2, byVolunteers: 1, medianDays: 3 });
    expect(s.regions.map(r => [r.region, r.total, r.open, r.cleaned])).toEqual([
      ['Ashanti', 2, 1, 1], ['Greater Accra', 1, 0, 1], ['Outside Ghana / unknown', 1, 0, 0],
    ]);
    expect(daysToClean(rows[2])).toBeNull();
  });

  it('writes a CSV that spreadsheets read safely', () => {
    const lines = toCsv(rows).split('\r\n');
    expect(lines[0]).toBe('Report ID,Reported at,Status,Severity,Waste type,Size,Region,District,Area,Latitude,Longitude,Cleaned at,Disposed at,Cleanup by,Report photos,Cleanup photos');
    expect(lines).toHaveLength(5);
    expect(lines[1]).toContain('"Madina, ""Zongo"""');
    expect(lines[1]).toContain('https://x/1.jpg,https://x/2.jpg');
    // a formula in the data is kept as text, not run
    expect(lines[3]).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it('never includes reporter details', () => {
    const csv = toCsv([{ ...rows[0], reported_by: 'user-uuid', description: 'Call Kofi 0244123456' }]);
    expect(csv).not.toMatch(/user-uuid|0244123456/);
  });
});
