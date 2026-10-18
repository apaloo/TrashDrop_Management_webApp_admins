import {
  statusLabel, statusBadgeClass, formatDuration, formatDate, getReportLocation, splitReportPhotos,
  toReportViewModel, matchesSearch, countCleanupTeams, canTransition, computeReportStats, isOpenStatus,
} from '../illegalDumpingReportUtils';
import { buildAuditRows } from '../../test-fixtures/illegalDumpingRows';

const reports = () => buildAuditRows().map(toReportViewModel);

describe('status labels and colours', () => {
  it('uses human labels and one colour per status', () => {
    expect(statusLabel('in_progress')).toBe('In Progress');
    expect(statusLabel('cancelled')).toBe('Cancelled');
    expect(statusBadgeClass('completed')).toContain('green');
    expect(statusBadgeClass('cancelled')).toContain('gray');
    expect(statusBadgeClass('pending')).toContain('amber');
  });
});

describe('durations and dates', () => {
  it('shows hours under 48h and days above', () => {
    expect(formatDuration(18)).toBe('18.0 hrs');
    expect(formatDuration(80 * 24)).toBe('80.0 days');
    expect(formatDuration(null)).toBe('—');
  });

  it('formats dates as dd/mm/yyyy and never shows Invalid Date', () => {
    expect(formatDate('2025-11-29T10:00:00')).toBe('29/11/2025');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('nonsense')).toBe('—');
  });
});

describe('location', () => {
  it('prefers area name, then address, then coordinates', () => {
    expect(getReportLocation({ areaName: 'Pokuase, Greater Accra', location: { address: 'Unknown location', lat: 5.6, lng: -0.2 } })).toBe('Pokuase, Greater Accra');
    expect(getReportLocation({ areaName: null, location: { address: 'Osu, Accra', lat: 5.6, lng: -0.2 } })).toBe('Osu, Accra');
    expect(getReportLocation({ areaName: null, location: { address: 'Accra, Ghana (Coordinates: 6.7230, -1.4439)', lat: 6.723, lng: -1.4439 } })).toBe('6.72300, -1.44390');
    expect(getReportLocation({ location: { address: 'Unknown location', lat: null, lng: null } })).toBe('Unknown location');
  });
});

describe('photos', () => {
  it('keeps storage and inline images and counts lost blob: photos', () => {
    const { viewable, lost } = splitReportPhotos(['blob:https://trashdrop-mobile.windsurf.build/abc', 'https://x/p.jpg', 'data:image/jpeg;base64,AAAA']);
    expect(viewable).toEqual(['https://x/p.jpg', 'data:image/jpeg;base64,AAAA']);
    expect(lost).toBe(1);
  });

  it('upgrades http links so they load on the https site', () => {
    expect(splitReportPhotos(['http://x/p.jpg']).viewable).toEqual(['https://x/p.jpg']);
    const vm = toReportViewModel({ id: 1, images: ['HTTP://x/a.jpg'], cleanup_photos: ['http://x/b.jpg'] });
    expect(vm.images).toEqual(['https://x/a.jpg']);
    expect(vm.cleanupPhotos).toEqual(['https://x/b.jpg']);
  });
});

describe('row mapping', () => {
  it('maps reported_at, reporter and closed date', () => {
    const [pending] = reports();
    expect(pending.reportedAt).toBeTruthy();
    expect(pending.reportedBy).toBe('Ama Mensah');
    expect(pending.locationLabel).toBe('Pokuase, Greater Accra Region');
    const cancelled = reports().find(r => r.status === 'cancelled');
    expect(cancelled.closedAt).toBe(buildAuditRows().find(r => r.id === cancelled.id).updated_at);
    expect(toReportViewModel({ id: 'x', reporter: { anonymous: true } }).reportedBy).toBe('Anonymous');
  });
});

describe('audit acceptance numbers', () => {
  it('computes ~80 days average, 22 verified-or-beyond, 2 verified', () => {
    const stats = computeReportStats(reports());
    expect(stats.total).toBe(82);
    expect(stats.pending).toBe(51);
    expect(stats.verified).toBe(2);
    expect(stats.confirmed).toBe(22);
    expect(stats.cancelled).toBe(9);
    expect(formatDuration(stats.avgCleanupHours)).toBe('79.5 days');
  });

  it('search trims spaces and matches labels', () => {
    const all = reports();
    expect(all.filter(r => matchesSearch(r, '  pokuase  ')).length).toBe(77);
    expect(all.filter(r => matchesSearch(r, 'in progress')).length).toBe(16);
    expect(all.filter(r => matchesSearch(r, 'Margibi')).length).toBe(5);
  });

  it('counts distinct cleanup teams on completed reports', () => {
    expect(countCleanupTeams(reports())).toBe(1);
  });
});

describe('status flow', () => {
  it('allows only the next step or cancel', () => {
    expect(canTransition('pending', 'verified')).toBe(true);
    expect(canTransition('pending', 'completed')).toBe(false);
    expect(canTransition('verified', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'completed')).toBe(true);
    expect(canTransition('completed', 'disposed')).toBe(true);
    expect(canTransition('completed', 'pending')).toBe(false);
    expect(canTransition('cancelled', 'pending')).toBe(false);
    expect(canTransition('in_progress', 'cancelled')).toBe(true);
    expect(isOpenStatus('completed')).toBe(false);
  });
});
