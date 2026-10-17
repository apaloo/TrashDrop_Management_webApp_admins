import {
  mapPublicReport, isPublicMapReport, timeAgo, cleanupDurationText, PUBLIC_REPORT_COLUMNS,
  computePublicStats, countHotspots, formatDuration, describeArea, cleanAreaName, nearestTown,
} from '../publicDumpingReportsService';

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

describe('public map stats', () => {
  const at = (lat, lng, over = {}) => mapPublicReport(row({ latitude: lat, longitude: lng, ...over }));

  it('derives total, cleanup rate and average response from the same reports', () => {
    const reports = [
      at(5.60, -0.19), at(5.61, -0.19), at(5.62, -0.19),
      at(5.63, -0.19, { status: 'completed', created_at: '2026-10-01T00:00:00Z', completed_at: '2026-10-01T10:00:00Z' }),
      at(5.64, -0.19, { status: 'completed', created_at: '2026-10-01T00:00:00Z', completed_at: '2026-10-02T02:00:00Z' }),
    ];
    const s = computePublicStats(reports);
    expect(s.total).toBe(5);
    expect(s.active).toBe(3);
    expect(s.cleanedUp).toBe(2);
    expect(s.cleanupRate).toBeCloseTo(40);
    expect(s.avgResponseHours).toBeCloseTo(18);
    expect(formatDuration(s.avgResponseHours)).toBe('18.0h');
    expect(formatDuration(72)).toBe('3.0 days');
    expect(formatDuration(null)).toBe('—');
    expect(computePublicStats([]).cleanupRate).toBeNull();
  });

  it('counts distinct areas, ignoring case and reports with no area', () => {
    const reports = [row({ area_name: 'Osu, Accra' }), row({ id: 'b', area_name: 'osu, accra' }), row({ id: 'c', area_name: 'Madina' }), row({ id: 'd', area_name: null })]
      .map(mapPublicReport);
    expect(computePublicStats(reports).areas).toBe(2);
  });

  it('counts hotspots as 3+ active reports chained within 500 m', () => {
    const pokuase = [at(5.6726, -0.2809), at(5.6727, -0.2810), at(5.6740, -0.2800)]; // within ~200 m
    const pair = [at(5.60, -0.19), at(5.6001, -0.1901)];                               // only 2
    const cleaned = [at(5.70, -0.10, { status: 'completed' }), at(5.70, -0.10, { status: 'completed' }), at(5.70, -0.10, { status: 'completed' })];
    expect(countHotspots([...pokuase, ...pair, ...cleaned])).toBe(1);
  });
});

describe('area names', () => {
  it('never shows placeholders or raw coordinates', () => {
    expect(cleanAreaName('Ghana (Coordinates: 6.7230, -1.4439)')).toBeNull();
    expect(cleanAreaName('Unknown location')).toBeNull();
    expect(cleanAreaName('Pokuase, Greater Accra Region')).toBe('Pokuase, Greater Accra Region');
  });

  it('falls back to the nearest town, then a neutral label', () => {
    expect(describeArea({ areaName: 'Osu, Accra', location: { lat: 5.55, lng: -0.18 } })).toBe('Osu, Accra');
    expect(describeArea({ areaName: null, location: { lat: 6.7230, lng: -1.4439 } })).toBe('Near Ejisu');
    expect(nearestTown({ lat: 6.69, lng: -1.62 })).toBe('Kumasi');
    expect(describeArea({ areaName: null, location: { lat: 8.5, lng: -2.9 } })).toBe('Location pinned on map');
  });
});
