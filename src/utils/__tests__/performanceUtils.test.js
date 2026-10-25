import {
  ordinal, formatValue, rankText, changeText, targetProgress, fillTrend, hasActivity, sortAccounts,
} from '../performanceUtils';

describe('numbers in their units', () => {
  it('formats counts, %, minutes and hours', () => {
    expect(formatValue(1204, 'count')).toBe('1,204');
    expect(formatValue(0, 'count')).toBe('0');
    expect(formatValue(25, 'percent')).toBe('25%');
    expect(formatValue(66.67, 'percent')).toBe('67%');
    expect(formatValue(45, 'minutes')).toBe('45 min');
    expect(formatValue(125, 'minutes')).toBe('2 h 5 min');
    expect(formatValue(120, 'minutes')).toBe('2 h');
    expect(formatValue(4320, 'minutes')).toBe('3 days');
    expect(formatValue(0.5, 'hours')).toBe('30 min');
    expect(formatValue(5.54, 'hours')).toBe('5.5 h');
    expect(formatValue(132, 'hours')).toBe('5.5 days');
  });

  it('shows a dash when there is nothing to measure', () => {
    expect(formatValue(null, 'minutes')).toBe('—');
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue('', 'percent')).toBe('—');
  });
});

describe('rank line', () => {
  it('says where the account stands among its type in its region', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(22)).toBe('22nd');
    expect(rankText({ rank: 3, of: 12 }, 'volunteer', 'Greater Accra')).toBe('3rd of 12 volunteer groups in Greater Accra');
    expect(rankText({ rank: 1, of: 4 }, 'authority', 'Ashanti')).toBe('1st of 4 assemblies (MMDAs) in Ashanti');
    expect(rankText({ rank: 1, of: 1 }, 'volunteer', 'Northern')).toBe('The only volunteer group in Northern with this number');
  });

  it('has no rank line for unranked metrics or unknown types', () => {
    expect(rankText({ rank: null, of: null }, 'volunteer', 'Greater Accra')).toBeNull();
    expect(rankText({ rank: 1, of: 3 }, 'media', 'Greater Accra')).toBeNull();
  });
});

describe('change against the previous period', () => {
  it('marks a change as good or bad by the metric’s direction', () => {
    expect(changeText({ value: 5, previous: 3, unit: 'count', higher_is_better: true }, 30))
      .toEqual({ text: '+2 vs previous 30 days', good: true });
    expect(changeText({ value: 1, previous: 0, unit: 'count', higher_is_better: false }, 7))
      .toEqual({ text: '+1 vs previous 7 days', good: false });
    expect(changeText({ value: 90, previous: 120, unit: 'minutes', higher_is_better: false }, 30))
      .toEqual({ text: '−30 min vs previous 30 days', good: true });
    expect(changeText({ value: 40, previous: 55, unit: 'percent', higher_is_better: true }, 30))
      .toEqual({ text: '−15 pts vs previous 30 days', good: false });
    expect(changeText({ value: 4, previous: 2, unit: 'count', higher_is_better: null }, 30))
      .toEqual({ text: '+2 vs previous 30 days', good: null });
    expect(changeText({ value: 2, previous: 2, unit: 'count', higher_is_better: true }, 30))
      .toEqual({ text: 'Same as previous 30 days', good: null });
  });

  it('has no change line without both numbers, or for live numbers', () => {
    expect(changeText({ value: 3, previous: null, unit: 'percent' }, 30)).toBeNull();
    expect(changeText({ value: null, previous: 2, unit: 'minutes' }, 30)).toBeNull();
    expect(changeText({ value: 3, previous: 1, live: true }, 30)).toBeNull();
  });
});

describe('target', () => {
  it('fills towards the target in the metric’s better direction', () => {
    expect(targetProgress({ value: 5, target: 10, unit: 'count', higher_is_better: true }))
      .toEqual({ pct: 50, met: false, text: 'Target 10' });
    expect(targetProgress({ value: 12, target: 10, unit: 'count', higher_is_better: true }))
      .toEqual({ pct: 100, met: true, text: 'Target 10 · met' });
    expect(targetProgress({ value: 48, target: 24, unit: 'hours', higher_is_better: false }))
      .toEqual({ pct: 50, met: false, text: 'Target 24 h' });
    expect(targetProgress({ value: 12, target: 24, unit: 'hours', higher_is_better: false }))
      .toEqual({ pct: 100, met: true, text: 'Target 24 h · met' });
    expect(targetProgress({ value: null, target: 80, unit: 'percent', higher_is_better: true }))
      .toEqual({ pct: 0, met: false, text: 'Target 80%' });
    expect(targetProgress({ value: 3, target: null })).toBeNull();
  });
});

describe('daily trend', () => {
  it('has a point for every day: 0 for counts, empty for averages', () => {
    const trend = [{ day: '2026-10-02', value: 3 }];
    expect(fillTrend(trend, '2026-10-01', '2026-10-03', 'count', true).map(p => p.value)).toEqual([0, 3, 0]);
    expect(fillTrend(trend, '2026-10-01', '2026-10-03', 'minutes', false).map(p => p.value)).toEqual([null, 3, null]);
    expect(fillTrend([], null, '2026-10-03')).toEqual([]);
  });

  it('knows when nothing happened yet (live numbers aside)', () => {
    expect(hasActivity([{ value: 0 }, { value: null }, { value: 4, live: true }])).toBe(false);
    expect(hasActivity([{ value: 0 }, { value: 2 }])).toBe(true);
  });
});

describe('comparison table order', () => {
  it('sorts by a metric with empty values last, or by name', () => {
    const accounts = [
      { name: 'b', values: { x: 2 } }, { name: 'a', values: { x: null } }, { name: 'c', values: { x: 5 } },
    ];
    expect(sortAccounts(accounts, 'x', 'desc').map(a => a.name)).toEqual(['c', 'b', 'a']);
    expect(sortAccounts(accounts, 'x', 'asc').map(a => a.name)).toEqual(['b', 'c', 'a']);
    expect(sortAccounts(accounts, 'name', 'asc').map(a => a.name)).toEqual(['a', 'b', 'c']);
  });
});
