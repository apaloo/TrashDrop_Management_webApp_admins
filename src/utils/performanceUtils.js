/**
 * Account performance pages: periods, number formats, rank and change wording.
 * The numbers come from my_performance() / performance_overview()
 * (supabase/migrations/20261109_account_performance.sql).
 */

export const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

// Account types with a performance page, as the rank line names them
export const ACCOUNT_KINDS = {
  volunteer: { one: 'volunteer group', many: 'volunteer groups', label: 'Volunteer groups' },
  authority: { one: 'assembly', many: 'assemblies (MMDAs)', label: 'MMDAs' },
};

const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

export const ordinal = (n) => {
  const v = n % 100;
  const suffix = ['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th';
  return `${n}${suffix}`;
};

const round1 = (v) => Math.round(v * 10) / 10;

/** A metric value in its unit: "1,204", "25%", "2 h 5 min", "5.5 h", "3.2 days", or "—" */
export const formatValue = (value, unit = 'count') => {
  if (!isNum(value)) return '—';
  const v = Number(value);
  if (unit === 'percent') return `${Math.round(v)}%`;
  if (unit === 'minutes') {
    if (v < 60) return `${Math.round(v)} min`;
    if (v < 24 * 60) {
      const h = Math.floor(v / 60);
      const m = Math.round(v - h * 60);
      return m ? `${h} h ${m} min` : `${h} h`;
    }
    return `${round1(v / 1440)} days`;
  }
  if (unit === 'hours') {
    if (v < 1) return `${Math.round(v * 60)} min`;
    if (v < 48) return `${round1(v)} h`;
    return `${round1(v / 24)} days`;
  }
  return Math.round(v).toLocaleString('en-GB');
};

/** "3rd of 12 volunteer groups in Greater Accra"; null when the metric isn't ranked */
export const rankText = (metric, role, area) => {
  const kind = ACCOUNT_KINDS[role];
  if (!kind || !metric?.rank || !metric?.of) return null;
  if (metric.of === 1) return `The only ${kind.one} in ${area} with this number`;
  return `${ordinal(metric.rank)} of ${metric.of} ${kind.many} in ${area}`;
};

/**
 * Change against the previous period of the same length.
 * good: true / false when the metric has a better direction, null otherwise.
 */
export const changeText = (metric, days) => {
  if (!metric || metric.live || !isNum(metric.value) || !isNum(metric.previous)) return null;
  const diff = Number(metric.value) - Number(metric.previous);
  const vs = `vs previous ${days} days`;
  if (Math.abs(diff) < 1e-9) return { text: `Same as previous ${days} days`, good: null };
  const sign = diff > 0 ? '+' : '−';
  const amount = metric.unit === 'percent' ? `${Math.round(Math.abs(diff))} pts` : formatValue(Math.abs(diff), metric.unit);
  const good = metric.higher_is_better === null || metric.higher_is_better === undefined
    ? null : (diff > 0) === metric.higher_is_better;
  return { text: `${sign}${amount} ${vs}`, good };
};

/** Progress towards the target: { pct 0-100, met, text } or null without a target */
export const targetProgress = (metric) => {
  if (!metric || !isNum(metric.target)) return null;
  const target = Number(metric.target);
  const value = isNum(metric.value) ? Number(metric.value) : null;
  const goal = `Target ${formatValue(target, metric.unit)}`;
  if (value === null) return { pct: 0, met: false, text: goal };
  if (metric.higher_is_better === false) {
    const met = value <= target;
    return { pct: met ? 100 : Math.max(0, Math.min(100, (target / value) * 100)), met, text: met ? `${goal} · met` : goal };
  }
  const met = value >= target;
  return { pct: target > 0 ? Math.max(0, Math.min(100, (value / target) * 100)) : 100, met, text: met ? `${goal} · met` : goal };
};

const dayKey = (d) => d.toISOString().slice(0, 10);

/**
 * One point per day from..to (YYYY-MM-DD). Counts fill quiet days with 0;
 * averages and % leave them empty (null), since there was nothing to measure.
 */
export const fillTrend = (trend = [], from, to, unit = 'count', countLike = true) => {
  if (!from || !to) return [];
  const byDay = Object.fromEntries((trend || []).map(p => [String(p.day).slice(0, 10), p.value]));
  const out = [];
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(`${from}T00:00:00Z`); d <= end && out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = dayKey(d);
    const v = byDay[k];
    out.push({ day: k, value: isNum(v) ? Number(v) : (countLike ? 0 : null) });
  }
  return out;
};

/** Counts add up per day; averages and % don't */
export const isCountMetric = (metric) => metric?.unit === 'count';

/** Did anything happen in the period? (live numbers like "waiting now" don't count) */
export const hasActivity = (metrics = []) =>
  metrics.some(m => !m.live && isNum(m.value) && Number(m.value) !== 0);

/** Sort accounts for the comparison table by one metric (nulls last) */
export const sortAccounts = (accounts = [], key, dir = 'desc') => {
  const val = (a) => (key === 'name' ? (a.name || '').toLowerCase() : a.values?.[key]);
  return [...accounts].sort((x, y) => {
    const a = val(x);
    const b = val(y);
    const aNull = a === null || a === undefined;
    const bNull = b === null || b === undefined;
    if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1;
    if (a < b) return dir === 'asc' ? -1 : 1;
    if (a > b) return dir === 'asc' ? 1 : -1;
    return 0;
  });
};
