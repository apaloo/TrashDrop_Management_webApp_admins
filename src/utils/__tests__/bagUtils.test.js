import {
  typeSizeLabel, orDash, normalizeBatch, normalizeBag, batchProgress, bagQrUrl, batchQrUrl,
  filtersFromParams, paramsFromFilters, cleanBatchSearch, dateBounds, weekCollectedPct, formatMinutes, DEFAULT_BATCH_FILTERS,
} from '../bagUtils';
import { normalizeBagStage, bagStageInfo, bagStageRank, BAG_STAGES, BATCH_STAGE_FILTERS } from '../../constants/bagStatus';

describe('bag steps', () => {
  it('has one ordered list plus archived', () => {
    expect(BAG_STAGES.map(s => s.key)).toEqual(['generated', 'distributed', 'filled', 'collected', 'processed']);
    expect(BATCH_STAGE_FILTERS.map(s => s.key).pop()).toBe('archived');
  });

  it('maps the household app values and any casing to a step', () => {
    expect(normalizeBagStage('used')).toBe('distributed');
    expect(normalizeBagStage('ACTIVE')).toBe('generated');
    expect(normalizeBagStage('Collected')).toBe('collected');
    expect(normalizeBagStage('archived')).toBe('archived');
    expect(normalizeBagStage(null)).toBe('generated');
    expect(bagStageInfo('Filled').label).toBe('Filled');
    expect(bagStageRank('collected')).toBe(4);
  });
});

describe('labels', () => {
  it('never shows "()" for type and size', () => {
    expect(typeSizeLabel('Organic', 'Medium')).toBe('Organic · Medium');
    expect(typeSizeLabel('Organic', null)).toBe('Organic');
    expect(typeSizeLabel(null, undefined)).toBe('—');
    expect(typeSizeLabel('', ' ')).toBe('—');
    expect(orDash('')).toBe('—');
    expect(orDash('TD-ORG-M')).toBe('TD-ORG-M');
  });
});

describe('rows', () => {
  const row = {
    id: 'b1', batch_number: '555', bag_count: 5, type: 'Recyclable', size: 'Large', qr_prefix: 'TD-REC-L', stage: 'distributed',
    raw_status: 'used', archived: false, generated_by_name: null, household_name: 'Abena Darko', bag_rows: 5,
    distributed_count: 5, filled_count: 3, collected_count: 2, processed_count: 0, created_at: '2026-10-01T10:00:00Z',
  };
  it('normalises a batch and its progress', () => {
    const b = normalizeBatch(row);
    expect(b).toMatchObject({ id: 'b1', bagCount: 5, stage: 'distributed', householdName: 'Abena Darko', filled: 3, collected: 2 });
    expect(batchProgress(b)).toMatchObject({ total: 5, distributedPct: 100, filledPct: 60, collectedPct: 40 });
    expect(normalizeBatch({ ...row, archived: true }).stage).toBe('archived');
  });
  it('uses the bag count when there are no bag rows', () => {
    expect(batchProgress(normalizeBatch({ ...row, bag_rows: 0, distributed_count: 0 })).total).toBe(5);
  });
  it('normalises a bag', () => {
    expect(normalizeBag({ id: 'g1', batch_id: 'b1', bag_no: 3, stage: 'filled', household_name: 'Abena', collector_name: null }))
      .toMatchObject({ id: 'g1', bagNo: 3, stage: 'filled', householdName: 'Abena', collectorName: null });
  });
});

describe('QR links', () => {
  it('keeps the existing /scan?batch= format', () => {
    expect(batchQrUrl('abc')).toBe('https://trashdrops.com/scan?batch=abc');
    expect(bagQrUrl('abc', 7, 'a@b.com')).toBe('https://trashdrops.com/scan?batch=abc&bag=7&email=a%40b.com');
    expect(bagQrUrl('abc', 7)).toBe('https://trashdrops.com/scan?batch=abc&bag=7');
  });
});

describe('filters', () => {
  it('reads and writes the URL', () => {
    const f = filtersFromParams(new URLSearchParams('q=org&stage=Collected&sort=bag_count&dir=asc&page=3&size=25&from=2026-10-01'));
    expect(f).toMatchObject({ q: 'org', stage: 'collected', sort: 'bag_count', dir: 'asc', page: 3, size: 25, from: '2026-10-01' });
    expect(paramsFromFilters(DEFAULT_BATCH_FILTERS)).toEqual({});
    expect(paramsFromFilters({ ...DEFAULT_BATCH_FILTERS, stage: 'archived', page: 2 })).toEqual({ stage: 'archived', page: '2' });
    expect(filtersFromParams(new URLSearchParams('sort=evil&size=999'))).toMatchObject({ sort: 'created_at', size: 10 });
  });
  it('cleans search and builds date bounds', () => {
    expect(cleanBatchSearch(' TD-ORG,(x)* ')).toBe('td-org  x');
    expect(dateBounds({ from: '2026-10-01', to: '2026-10-02' })).toEqual({ from: '2026-10-01T00:00:00Z', to: '2026-10-03T00:00:00.000Z' });
    expect(dateBounds({ from: '', to: '' })).toEqual({ from: null, to: null });
  });
});

describe('cards', () => {
  it('says "no data" instead of 0%', () => {
    expect(weekCollectedPct({ bags_requested: 0, bags_collected: 0 })).toBeNull();
    expect(weekCollectedPct(undefined)).toBeNull();
    expect(weekCollectedPct({ bags_requested: 4, bags_collected: 2 })).toBe(50);
    expect(formatMinutes(null)).toBeNull();
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(105)).toBe('1 h 45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(60 * 72)).toBe('3 days');
  });
});
