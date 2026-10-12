import {
  normalizeLog, formatAccra, relativeFromNow, changeRows, recordLink, rangeBounds, cleanLogSearch, logsToCsv,
} from '../logUtils';
import { normalizeLogLevel } from '../../constants/alerts';

describe('normalizeLogLevel', () => {
  it('matches levels case-insensitively and maps aliases', () => {
    expect(normalizeLogLevel('WARN')).toBe('warn');
    expect(normalizeLogLevel('Warning')).toBe('warn');
    expect(normalizeLogLevel('ERROR')).toBe('error');
    expect(normalizeLogLevel('critical')).toBe('critical');
    expect(normalizeLogLevel(undefined)).toBe('info');
  });
});

describe('normalizeLog', () => {
  it('reads new audit rows', () => {
    const l = normalizeLog({
      id: 7, created_at: '2026-10-12T14:05:00Z', level: 'WARN', source: 'collectors', action: 'collector.deactivated',
      entity_type: 'collector', entity_id: 'c1', actor_id: 'u1', actor_name: 'Otis', actor_role: 'admin',
      message: 'Deactivated', before: { status: 'active' }, after: { status: 'inactive' }, metadata: { reason: 'x' }, is_sample: false,
    });
    expect(l).toMatchObject({ id: '7', level: 'warn', actorName: 'Otis', entityId: 'c1', isSample: false, metadata: { reason: 'x' } });
  });

  it('reads legacy rows (timestamp, data as JSON text, no actor)', () => {
    const l = normalizeLog({ id: 'a', timestamp: '2026-10-01T00:00:00Z', level: 'INFO', data: '{"k":1}', message: 'old' });
    expect(l.createdAt).toBe('2026-10-01T00:00:00Z');
    expect(l.metadata).toEqual({ k: 1 });
    expect(l.actorName).toBe('System');
    expect(l.actorRole).toBe('system');
  });
});

describe('time formatting', () => {
  it('shows Accra time as "12 Oct 2026, 14:05"', () => {
    expect(formatAccra('2026-10-12T14:05:00Z')).toBe('12 Oct 2026, 14:05');
    expect(formatAccra(null)).toBe('—');
    expect(formatAccra('nope')).toBe('—');
  });

  it('gives relative time', () => {
    const now = Date.parse('2026-10-12T14:05:00Z');
    expect(relativeFromNow('2026-10-12T14:04:50Z', now)).toBe('just now');
    expect(relativeFromNow('2026-10-12T14:00:00Z', now)).toBe('5 min ago');
    expect(relativeFromNow('2026-10-12T11:05:00Z', now)).toBe('3 h ago');
    expect(relativeFromNow('2026-10-09T14:05:00Z', now)).toBe('3 d ago');
  });
});

describe('changeRows', () => {
  it('lists only changed fields with labels', () => {
    expect(changeRows({ status: 'active', notes: 'a' }, { status: 'inactive', notes: 'a', deactivation_reason: 'Left' })).toEqual([
      { field: 'status', label: 'Status', from: 'active', to: 'inactive' },
      { field: 'deactivation_reason', label: 'Deactivation reason', from: '—', to: 'Left' },
    ]);
    expect(changeRows(null, null)).toEqual([]);
  });
});

describe('recordLink', () => {
  it('deep-links to the record', () => {
    expect(recordLink('pickup_request', 'r1')).toBe('/request-pickup/requests?q=r1&open=r1');
    expect(recordLink('collector', 'c1')).toBe('/request-pickup/collectors?q=c1&open=c1');
    expect(recordLink('alert', 'a1')).toBe('/request-pickup/alerts?alert=a1');
    expect(recordLink('user', 'u1')).toBeNull();
    expect(recordLink('alert', null)).toBeNull();
  });
});

describe('rangeBounds', () => {
  const now = new Date('2026-10-12T14:05:00Z');
  it('handles presets and custom dates', () => {
    expect(rangeBounds({ range: '24h' }, now).from).toBe('2026-10-11T14:05:00.000Z');
    expect(rangeBounds({ range: 'today' }, now).from).toBe('2026-10-12T00:00:00Z');
    expect(rangeBounds({ range: 'all' }, now)).toEqual({ from: null, to: null });
    expect(rangeBounds({ range: 'custom', from: '2026-10-01', to: '2026-10-02' }, now))
      .toEqual({ from: '2026-10-01T00:00:00Z', to: '2026-10-03T00:00:00.000Z' });
  });
});

describe('cleanLogSearch / logsToCsv', () => {
  it('strips characters that break PostgREST filters', () => {
    expect(cleanLogSearch(' a,b(c)*%d ')).toBe('a b c   d');
  });

  it('builds CSV with quoting and changes', () => {
    const csv = logsToCsv([normalizeLog({
      id: 1, created_at: '2026-10-12T14:05:00Z', level: 'info', action: 'request.assigned', message: 'Hello, "world"',
      before: { status: 'pending' }, after: { status: 'accepted' }, actor_name: 'Otis', actor_role: 'admin',
    })]);
    const [header, row] = csv.split('\n');
    expect(header.startsWith('Time (Accra),Level,Actor')).toBe(true);
    expect(row).toContain('"Hello, ""world"""');
    expect(row).toContain('Status: pending → accepted');
  });
});
