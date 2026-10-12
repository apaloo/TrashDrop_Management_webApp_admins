import {
  statusGroupOf, isCollectorOnline, relativeTime, capacityBadgeClass, withRequestPosition,
  withCollectorPosition, matchesRequestFilters, summarize,
} from '../liveMapUtils';

const NOW = Date.parse('2026-10-12T12:00:00Z');

describe('status colours', () => {
  it('groups the statuses used by every request table', () => {
    expect(statusGroupOf('pending').color).toBe('#F59E0B');
    expect(statusGroupOf('available').key).toBe('pending');
    expect(statusGroupOf('accepted').color).toBe('#3B82F6');
    expect(statusGroupOf('assigned').key).toBe('assigned');
    expect(statusGroupOf('in_progress').color).toBe('#8B5CF6');
    expect(statusGroupOf('picked_up').key).toBe('in_progress');
    expect(statusGroupOf('completed').color).toBe('#10B981');
    expect(statusGroupOf('disposed').key).toBe('completed');
    expect(statusGroupOf('cancelled').color).toBe('#9CA3AF');
    expect(statusGroupOf('weird').key).toBe('other');
  });
});

describe('collectors', () => {
  const base = { id: 'c1', name: 'Kofi', currentLocation: { lat: 5.6, lng: -0.2 } };

  it('is online only if the location was reported in the last 10 minutes', () => {
    expect(isCollectorOnline({ locationUpdatedAt: '2026-10-12T11:55:00Z' }, NOW)).toBe(true);
    expect(isCollectorOnline({ locationUpdatedAt: '2026-10-12T11:45:00Z' }, NOW)).toBe(false);
    expect(isCollectorOnline({}, NOW)).toBe(false);
  });

  it('keeps collectors whose lat/lng columns are empty but whose PostGIS point is set', () => {
    const c = withCollectorPosition({ ...base, currentLocation: { lat: null, lng: null }, currentLocationPoint: '0101000020e6100000560e2db29defc7bf7c613255306a1640' });
    expect(c.position[0]).toBeCloseTo(5.6037, 4);
  });

  it('has no position (shown as "No location") when nothing valid is stored', () => {
    expect(withCollectorPosition({ ...base, currentLocation: { lat: null, lng: null } }).position).toBeNull();
    expect(withCollectorPosition({ ...base, currentLocation: { lat: 0, lng: 0 } }).locationIssue).toBe('Coordinates are 0,0');
  });

  it('shows 0% neutral, amber from 70%, red from 90%', () => {
    expect(capacityBadgeClass(0)).toContain('gray');
    expect(capacityBadgeClass(70)).toContain('amber');
    expect(capacityBadgeClass(95)).toContain('red');
  });
});

describe('relativeTime', () => {
  it('formats durations', () => {
    expect(relativeTime('2026-10-12T11:59:40Z', NOW)).toBe('just now');
    expect(relativeTime('2026-10-12T11:48:00Z', NOW)).toBe('12 min ago');
    expect(relativeTime('2026-10-12T09:00:00Z', NOW)).toBe('3 h ago');
    expect(relativeTime(null, NOW)).toBe('—');
  });
});

describe('requests', () => {
  const req = (over) => withRequestPosition({ id: 'r', status: 'pending', requestTime: '2026-10-12T09:00:00', collectorId: null, location: { lat: 5.6, lng: -0.2 }, ...over });

  it('drops invalid locations and corrects swapped ones', () => {
    expect(req({}).position).toEqual([5.6, -0.2]);
    expect(req({ location: { lat: null, lng: null } }).position).toBeNull();
    expect(req({ location: { lat: -0.2, lng: 5.6 } })).toMatchObject({ position: [5.6, -0.2], swapped: true });
  });

  it('filters by status group, date range and collector', () => {
    const r = req({ status: 'accepted', collectorId: 'c1' });
    expect(matchesRequestFilters(r, { statusGroups: ['assigned'] })).toBe(true);
    expect(matchesRequestFilters(r, { statusGroups: ['pending'] })).toBe(false);
    expect(matchesRequestFilters(r, { dateFrom: '2026-10-12', dateTo: '2026-10-12' })).toBe(true);
    expect(matchesRequestFilters(r, { dateFrom: '2026-10-13' })).toBe(false);
    expect(matchesRequestFilters(r, { collectorId: 'c1' })).toBe(true);
    expect(matchesRequestFilters(r, { collectorId: 'c2' })).toBe(false);
  });

  it('summarises counts', () => {
    const s = summarize([req({}), req({ status: 'in_progress' }), req({ status: 'completed' })], [{ online: true }, { online: false }]);
    expect(s).toEqual({ total: 3, pending: 1, inProgress: 1, collectorsOnline: 1, collectorsTotal: 2 });
  });
});
