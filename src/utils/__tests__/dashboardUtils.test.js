import {
  periodFromParams, pctChange, slaPct, ptsChange, statusRows, requestListUrl, wasteRows, bucketLabel,
  seriesTotal, durationSince, normalizeDashboardAlert,
} from '../dashboardUtils';
import { statusFilterValues, applyFilters } from '../pickupRequestUtils';

const now = new Date('2026-10-12T15:00:00Z');
const P = (q) => periodFromParams(new URLSearchParams(q), now);

describe('period', () => {
  it('defaults to 30 days and reads presets', () => {
    expect(P('')).toMatchObject({ key: '30d', fromDay: '2026-09-12', toDay: '2026-10-12' });
    expect(P('range=7d').from.toISOString()).toBe('2026-10-05T15:00:00.000Z');
    expect(P('range=today')).toMatchObject({ key: 'today', fromDay: '2026-10-12' });
    expect(P('range=today').from.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(P('range=bogus').key).toBe('30d');
  });
  it('reads a custom range (inclusive end, never past now)', () => {
    const p = P('range=custom&from=2026-05-01&to=2026-05-31');
    expect(p.from.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(p.to.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(P('range=custom&from=2026-10-10').to.toISOString()).toBe(now.toISOString());
    expect(P('range=custom&from=nope').key).toBe('30d');
  });
});

describe('changes', () => {
  it('compares with the previous period and says "—" without one', () => {
    expect(pctChange(3, 1)).toBe('+200%');
    expect(pctChange(1, 2)).toBe('-50%');
    expect(pctChange(5, 5)).toBe('0%');
    expect(pctChange(5, 0)).toBe('—');
    expect(pctChange(0, undefined)).toBe('—');
  });
  it('works out SLA and its change in points', () => {
    expect(slaPct(1, 2)).toBe(50);
    expect(slaPct(0, 0)).toBeNull();
    expect(ptsChange(50, 100)).toBe('-50 pts');
    expect(ptsChange(50, null)).toBe('—');
  });
});

describe('requests', () => {
  it('status rows add up to the total and hide an empty Other', () => {
    const rows = statusRows({ pending: 4, assigned: 3, in_progress: 2, completed: 5, cancelled: 3, other: 0 });
    expect(rows.map(r => r.key)).toEqual(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']);
    expect(rows.reduce((s, r) => s + r.value, 0)).toBe(17);
    expect(statusRows({ other: 2 }).map(r => r.key)).toContain('other');
  });
  it('builds list links with the period and filters', () => {
    const url = requestListUrl(P('range=7d'), { status: 'status:pending', unassigned: '1' });
    expect(url).toBe('/request-pickup/requests?from=2026-10-05&to=2026-10-12&status=status%3Apending&unassigned=1');
    expect(requestListUrl(null, { source: 'digital_bins' })).toBe('/request-pickup/requests?source=digital_bins');
  });
  it('the request list understands those filters', () => {
    expect(statusFilterValues('status:en_route,arrived')).toEqual(expect.arrayContaining(['en_route', 'in_transit', 'arrived']));
    const rows = [
      { id: 'a', status: 'available', source: 'pickup_requests', collectorRef: null, createdAt: '2026-10-06T10:00:00Z' },
      { id: 'b', status: 'pending', source: 'pickup_requests', collectorRef: 'c1', createdAt: '2026-10-06T10:00:00Z' },
      { id: 'c', status: 'pending', source: 'digital_bins', collectorRef: null, createdAt: '2026-09-01T10:00:00Z' },
    ];
    expect(applyFilters(rows, { status: 'status:pending', unassigned: '1' }).map(r => r.id)).toEqual(['a', 'c']);
    expect(applyFilters(rows, { from: '2026-10-01', to: '2026-10-12' }).map(r => r.id)).toEqual(['a', 'b']);
    expect(applyFilters(rows, { source: 'digital_bins' }).map(r => r.id)).toEqual(['c']);
  });
});

describe('waste', () => {
  it('shows the four main types, Electronic only when present, and Unclassified', () => {
    expect(wasteRows({ Organic: 9, Recyclable: 2 }).map(r => r.key)).toEqual(['Organic', 'Recyclable', 'Hazardous', 'General', 'Unclassified']);
    const rows = wasteRows({ Organic: 1, Electronic: 3, Unclassified: 4, Plastic: 2 });
    expect(rows.find(r => r.key === 'Electronic').value).toBe(3);
    expect(rows.find(r => r.key === 'Other').value).toBe(2);
    expect(rows[rows.length - 1]).toMatchObject({ key: 'Unclassified', value: 4 });
  });
});

describe('series and alerts', () => {
  it('labels buckets with real dates', () => {
    expect(bucketLabel('2026-10-06T00:00:00Z', 'day')).toBe('6 Oct');
    expect(bucketLabel('2026-10-05T00:00:00Z', 'week')).toBe('w/c 5 Oct');
    expect(seriesTotal([{ a: 1 }, { a: 2 }], 'a')).toBe(3);
  });
  it('shows how long the request has waited and when the alert was raised', () => {
    const n = now.getTime();
    expect(durationSince('2026-06-01T00:00:00Z', n)).toBe('4 months');
    expect(durationSince('2026-10-12T10:00:00Z', n)).toBe('5 h');
    const a = normalizeDashboardAlert({ id: 'x', severity: 'Critical', entity_type: 'pickup_request', entity_ref: 'r1',
      raised_at: '2026-10-12T10:00:00Z', request_created_at: '2026-06-01T00:00:00Z' }, n);
    expect(a).toMatchObject({ severity: 'critical', requestAge: '4 months', raisedAgo: '5 h', isRequest: true });
  });
});
