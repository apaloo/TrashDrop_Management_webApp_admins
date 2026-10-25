import fs from 'fs';
import path from 'path';
import {
  ACTIVITIES, CALCULATORS, describeMetric, emptyForm, toForm, validateForm, toRow, makeKey, metricsFor,
} from '../metricEditor';

const form = (over) => ({ ...emptyForm(), label: 'Sites cleaned', ...over });

describe('the editor knows exactly what the database accepts', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../../supabase/migrations/20261109_account_performance.sql'), 'utf8');
  const fn = sql.slice(sql.indexOf('FUNCTION public.td_valid_metric'), sql.indexOf('CREATE TABLE IF NOT EXISTS public.performance_metrics'));

  it('offers the same actions', () => {
    const dbActs = [...new Set([...fn.matchAll(/'((?:report|cleanup)\.[a-z_]+)'/g)].map(m => m[1]))].sort();
    expect(ACTIVITIES.map(a => a.key).sort()).toEqual(dbActs);
  });

  it('offers the same calculations, with the database’s units', () => {
    const check = sql.slice(sql.indexOf('performance_metrics_calc_chk'));
    const dbCalcs = [...new Set([...fn.matchAll(/'((?:activity|area)_[a-z_]+)'/g)].map(m => m[1]))].sort();
    expect(Object.keys(CALCULATORS).sort()).toEqual(dbCalcs);
    expect(check).toMatch(/td_valid_metric\(calc, params\)/);
    Object.values(CALCULATORS).forEach(c => expect(['count', 'percent', 'minutes', 'hours']).toContain(c.unit));
  });
});

describe('form checks', () => {
  it('accepts a complete metric', () => {
    expect(validateForm(form({ activities: ['cleanup.completed'] }))).toEqual({});
  });

  it('names what is missing or wrong', () => {
    expect(validateForm(form({ label: ' ', roles: [], activities: [] })))
      .toEqual({ label: expect.any(String), roles: expect.any(String), activities: expect.any(String) });
    expect(validateForm(form({ calc: 'activity_ratio', activities: ['cleanup.completed'], of: [] }))).toHaveProperty('of');
    expect(validateForm(form({ calc: 'area_cleaned_within', days: 31 }))).toHaveProperty('days');
    expect(validateForm(form({ calc: 'area_cleaned_within', days: 2.5 }))).toHaveProperty('days');
    expect(validateForm(form({ calc: 'area_open_backlog', target: '-1' }))).toHaveProperty('target');
    expect(validateForm(form({ calc: 'area_open_backlog', target: 'abc' }))).toHaveProperty('target');
    expect(validateForm(form({ calc: 'area_open_backlog', target: '' }))).toEqual({});
  });
});

describe('form → row', () => {
  it('builds the params each calculation needs, and nothing else', () => {
    expect(toRow(form({ activities: ['cleanup.completed'], of: ['cleanup.claimed'] }))).toMatchObject({
      calc: 'activity_count', params: { activities: ['cleanup.completed'] }, unit: 'count', higher_is_better: true, target: null,
    });
    expect(toRow(form({ calc: 'activity_avg', direction: 'lower' }))).toMatchObject({
      params: { activities: ['cleanup.completed'] }, unit: 'minutes', higher_is_better: false,
    });
    expect(toRow(form({ calc: 'activity_ratio', activities: ['cleanup.completed'], of: ['cleanup.claimed'], target: '80' })))
      .toMatchObject({ params: { activities: ['cleanup.completed'], of: ['cleanup.claimed'] }, unit: 'percent', target: 80 });
    expect(toRow(form({ calc: 'area_reports', status: 'cleaned', direction: 'none', roles: ['authority'] })))
      .toMatchObject({ params: { status: 'cleaned' }, unit: 'count', higher_is_better: null, roles: ['authority'] });
    expect(toRow(form({ calc: 'area_cleaned_within', days: '14' }))).toMatchObject({ params: { days: 14 }, unit: 'percent' });
    expect(toRow(form({ calc: 'area_avg_clean_hours' }))).toMatchObject({ params: {}, unit: 'hours' });
    expect(toRow(form({ label: '  Waiting  ', description: '  ', calc: 'area_open_backlog' })))
      .toMatchObject({ label: 'Waiting', description: null, params: {} });
  });

  it('round-trips a saved metric through the form', () => {
    const saved = {
      key: 'mmda_cleaned_within_7d', label: 'Cleaned within 7 days', description: 'Share of new reports', roles: ['authority'],
      calc: 'area_cleaned_within', params: { days: 7 }, unit: 'percent', higher_is_better: true, target: 75, enabled: false,
    };
    const f = toForm(saved);
    expect(f).toMatchObject({ key: saved.key, direction: 'higher', target: '75', days: 7, enabled: false });
    const { key, ...rest } = saved;
    expect(toRow(f)).toEqual(rest);
  });
});

describe('keys and listing', () => {
  it('makes a valid, unique key from the name and account type', () => {
    expect(makeKey('Sites cleaned!', ['volunteer'], [])).toBe('vol_sites_cleaned');
    expect(makeKey('Sites cleaned', ['volunteer'], ['vol_sites_cleaned'])).toBe('vol_sites_cleaned_2');
    expect(makeKey('Backlog', ['volunteer', 'authority'], [])).toBe('all_backlog');
    expect(makeKey('Ọ̀sẹ̀ ✓', ['authority'], [])).toBe('mmda_o_se');
    expect(makeKey('!!!', ['authority'], [])).toBe('mmda_metric');
    const long = makeKey('x'.repeat(200), ['authority'], []);
    expect(long).toMatch(/^[a-z][a-z0-9_]{2,40}$/);
  });

  it('describes each metric in plain words', () => {
    expect(describeMetric({ calc: 'activity_count', params: { activities: ['cleanup.claimed', 'cleanup.completed'] } }))
      .toBe('Times the account: claimed a report or completed a clean-up');
    expect(describeMetric({ calc: 'area_cleaned_within', params: { days: 7 } })).toBe('% of the area’s new reports cleaned within 7 days');
  });

  it('lists an account type’s metrics in page order', () => {
    const m = [
      { key: 'b', roles: ['volunteer'], sort_order: 20 }, { key: 'a', roles: ['volunteer', 'authority'], sort_order: 20 },
      { key: 'c', roles: ['authority'], sort_order: 5 }, { key: 'd', roles: ['volunteer'], sort_order: 10 },
    ];
    expect(metricsFor(m, 'volunteer').map(x => x.key)).toEqual(['d', 'a', 'b']);
    expect(metricsFor(m, 'authority').map(x => x.key)).toEqual(['c', 'a']);
  });
});
