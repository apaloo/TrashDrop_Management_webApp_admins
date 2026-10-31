import {
  matchesFilters, computeReportStats, getSeverityColor, isOutsideGhana, normalizeEnum, UNKNOWN_SEVERITY_COLOR,
  assignmentBlockReason, assignmentFailedMessage, standardCleanupPayment, isVolunteerTeam,
} from '../illegalDumpingReportUtils';

const report = (over = {}) => ({
  id: 'r', status: 'pending', severity: 'medium', wasteType: 'household',
  reportedAt: '2026-09-01T08:00:00Z', resolvedAt: null, location: { lat: 5.6, lng: -0.19 }, ...over,
});

describe('matchesFilters', () => {
  it('matches severity and waste type case-insensitively', () => {
    const r = report({ severity: 'high', wasteType: 'construction' });
    expect(matchesFilters(r, { severity: ['High'] })).toBe(true);
    expect(matchesFilters(r, { severity: ['HIGH'], wasteType: ['Construction'] })).toBe(true);
    expect(matchesFilters(r, { severity: ['low'] })).toBe(false);
  });

  it('treats the date range end as inclusive of the whole day', () => {
    const r = report({ reportedAt: '2026-09-10T22:00:00' });
    expect(matchesFilters(r, {}, { start: '2026-09-10', end: '2026-09-10' })).toBe(true);
    expect(matchesFilters(r, {}, { start: '2026-09-11' })).toBe(false);
  });
});

describe('computeReportStats', () => {
  const reports = [
    ...Array(51).fill(0).map(() => report({ status: 'pending' })),
    ...Array(16).fill(0).map(() => report({ status: 'in_progress' })),
    ...Array(9).fill(0).map(() => report({ status: 'cancelled' })),
    ...Array(2).fill(0).map(() => report({ status: 'verified' })),
    report({ status: 'completed', reportedAt: '2026-09-01T00:00:00Z', resolvedAt: '2026-09-01T10:00:00Z' }),
    report({ status: 'completed', reportedAt: '2026-09-01T00:00:00Z', resolvedAt: '2026-09-02T06:00:00Z' }),
    report({ status: 'Completed', reportedAt: '2026-09-01T00:00:00Z', resolvedAt: '2026-09-01T20:00:00Z' }),
    report({ status: 'completed', reportedAt: '2026-09-01T00:00:00Z', resolvedAt: '2026-09-01T12:00:00Z' }),
  ];

  it('derives every card from the report list', () => {
    const s = computeReportStats(reports);
    expect(s.total).toBe(82);
    expect(s.cleanedUp).toBe(4);
    expect(s.avgCleanupHours).toBeCloseTo((10 + 30 + 20 + 12) / 4);
    // (verified 2 + in_progress 16 + completed 4) / (82 - 9 cancelled)
    expect(s.verificationRate).toBeCloseTo((22 / 73) * 100);
  });

  it('returns null averages instead of stale numbers when there is no data', () => {
    const s = computeReportStats([report()]);
    expect(s.cleanedUp).toBe(0);
    expect(s.avgCleanupHours).toBeNull();
    expect(computeReportStats([]).verificationRate).toBeNull();
  });
});

describe('markers and bounds', () => {
  it('colours by severity regardless of case', () => {
    expect(getSeverityColor('LOW')).toBe('#22C55E');
    expect(getSeverityColor('high')).toBe('#F97316');
    expect(getSeverityColor(undefined)).toBe(UNKNOWN_SEVERITY_COLOR);
  });

  it('flags reports outside Ghana', () => {
    expect(isOutsideGhana(report({ location: { lat: 6.3156, lng: -10.8074 } }))).toBe(true); // Monrovia
    expect(isOutsideGhana(report())).toBe(false);
    expect(isOutsideGhana(report({ location: { lat: null, lng: null } }))).toBe(false);
  });

  it('normalises enum spellings', () => {
    expect(normalizeEnum('In Progress')).toBe('in_progress');
    expect(normalizeEnum(' Hazardous ')).toBe('hazardous');
  });
});

describe('assignmentBlockReason', () => {
  it('only a verified report with nobody on it can be assigned', () => {
    expect(assignmentBlockReason(report({ status: 'verified' }))).toBeNull();
  });
  it('asks to verify a pending report first (for collectors and volunteer groups alike)', () => {
    expect(assignmentBlockReason(report({ status: 'pending' }))).toMatch(/^Verify this report before assigning/);
    expect(assignmentBlockReason(report({ status: undefined }))).toMatch(/^Verify this report/);
  });
  it('names the team already on it', () => {
    expect(assignmentBlockReason(report({ status: 'verified', assignedTo: 'p1', cleanupTeam: 'Bus Stop Boys' })))
      .toBe('This report already has a cleanup team (Bus Stop Boys).');
    expect(assignmentBlockReason(report({ status: 'verified', cleanupAssigned: true }))).toMatch(/already has a cleanup team/);
  });
  it('refuses closed or running reports', () => {
    ['in_progress', 'completed', 'disposed', 'cancelled'].forEach(st =>
      expect(assignmentBlockReason(report({ status: st }))).toMatch(/can't be assigned/));
  });
});

describe('assignmentFailedMessage', () => {
  it('explains a report that changed meanwhile instead of showing the database text', () => {
    expect(assignmentFailedMessage({ code: 'PGRST116' })).toMatch(/changed since you opened it/);
    expect(assignmentFailedMessage(new Error('Database error with illegal_dumping_mobile: Cannot coerce the result to a single JSON object')))
      .toMatch(/changed since you opened it/);
  });
  it('maps the status-flow trigger and permission errors', () => {
    expect(assignmentFailedMessage({ message: 'Status cannot change from pending to in_progress' })).toBe('Verify this report before assigning a cleanup team.');
    expect(assignmentFailedMessage({ code: '42501', message: 'Not allowed' })).toMatch(/can't assign cleanups/);
    expect(assignmentFailedMessage({ message: 'network down' })).toBe("Couldn't assign the cleanup. Try again.");
  });
  it('maps the database rule that only verified reports can be assigned', () => {
    expect(assignmentFailedMessage({ code: 'P0001', message: 'Verify this report before assigning a cleanup team' }))
      .toBe('Verify this report before assigning a cleanup team.');
    expect(assignmentFailedMessage({ code: 'P0001', message: 'Only verified reports can be assigned a cleanup team (this one is completed)' }))
      .toBe("This report is completed, so it can't be assigned. Only verified reports can get a cleanup team.");
  });
});

describe('cleanup payment', () => {
  it('standard rate is size × severity (same as td_cleanup_payment)', () => {
    expect(standardCleanupPayment('small', 'low')).toBe(5);
    expect(standardCleanupPayment('Medium', 'medium')).toBe(10);
    expect(standardCleanupPayment('large', 'high')).toBe(30);
    expect(standardCleanupPayment(null, 'high')).toBe(15);
  });
  it('recognises volunteer group profiles', () => {
    expect(isVolunteerTeam({ collector_type: 'volunteer' })).toBe(true);
    expect(isVolunteerTeam({ collector_type: 'collector' })).toBe(false);
    expect(isVolunteerTeam({})).toBe(false);
  });
});

describe('waste types the household report form can send', () => {
  it('include plastic, so the map filter lists it', () => {
    const { WASTE_TYPE_OPTIONS } = require('../illegalDumpingReportUtils');
    expect(WASTE_TYPE_OPTIONS.map(o => o.value)).toEqual(
      ['mixed', 'household', 'construction', 'electronic', 'hazardous', 'organic', 'recyclables', 'plastic']
    );
  });
});
