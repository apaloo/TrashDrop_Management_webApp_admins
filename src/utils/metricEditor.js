/**
 * The admin metric editor (Performance metrics page): what each calculation
 * means in plain words, the form <-> performance_metrics row mapping, and the
 * same checks the database makes (td_valid_metric() in
 * supabase/migrations/20261109_account_performance.sql), so mistakes are
 * shown on the form before saving.
 */

// Steps recorded in account_activity (20261108), as admins read them
export const ACTIVITIES = [
  { key: 'report.created', label: 'Reported a site' },
  { key: 'report.verified', label: 'Verified a report' },
  { key: 'cleanup.assigned', label: 'Put a team on a clean-up' },
  { key: 'cleanup.received', label: 'Was given a clean-up' },
  { key: 'cleanup.claimed', label: 'Claimed a report' },
  { key: 'cleanup.released', label: 'Gave a claim back' },
  { key: 'cleanup.claim_expired', label: 'Let a claim run out' },
  { key: 'cleanup.started', label: 'Started a clean-up' },
  { key: 'cleanup.completed', label: 'Completed a clean-up' },
  { key: 'cleanup.marked_cleaned', label: 'Marked a site cleaned' },
];
export const activityLabel = (key) => ACTIVITIES.find(a => a.key === key)?.label || key;

// Account types with a performance page
export const METRIC_ROLES = [
  { key: 'volunteer', label: 'Volunteer groups', prefix: 'vol' },
  { key: 'authority', label: 'MMDAs', prefix: 'mmda' },
];

// The calculations the database knows; unit follows from the calculation
export const CALCULATORS = {
  activity_count: { label: 'How many times the account did something', unit: 'count', fields: ['activities'] },
  activity_avg: { label: 'Average time to clean up (from taking a report on)', unit: 'minutes', fields: [] },
  activity_ratio: { label: 'Share of one action that led to another (%)', unit: 'percent', fields: ['activities', 'of'] },
  area_reports: { label: 'Reports in the account’s area', unit: 'count', fields: ['status'] },
  area_cleaned_within: { label: 'Share of the area’s new reports cleaned within a number of days (%)', unit: 'percent', fields: ['days'] },
  area_avg_clean_hours: { label: 'Average time from report to clean-up in the area', unit: 'hours', fields: [] },
  area_open_backlog: { label: 'Reports in the area waiting for clean-up right now', unit: 'count', fields: [] },
};

const list = (v) => (Array.isArray(v) ? v : []);

/** One line describing what a metric counts */
export const describeMetric = (m) => {
  const p = m.params || {};
  const acts = (keys) => list(keys).map(activityLabel).join(' or ').toLowerCase();
  switch (m.calc) {
    case 'activity_count': return `Times the account: ${acts(p.activities)}`;
    case 'activity_avg': return 'Average minutes from taking a report on to finishing the clean-up';
    case 'activity_ratio': return `% of “${acts(p.of)}” followed by “${acts(p.activities)}”`;
    case 'area_reports': return p.status === 'cleaned' ? 'Reports in the area cleaned up in the period' : 'New reports in the area in the period';
    case 'area_cleaned_within': return `% of the area’s new reports cleaned within ${p.days} days`;
    case 'area_avg_clean_hours': return 'Average hours from report to clean-up in the area';
    case 'area_open_backlog': return 'Reports in the area not cleaned up yet (right now)';
    default: return m.calc;
  }
};

export const emptyForm = () => ({
  key: null, label: '', description: '', roles: ['volunteer'], calc: 'activity_count',
  activities: [], of: [], status: 'new', days: 7, direction: 'higher', target: '', enabled: true,
});

/** performance_metrics row → form */
export const toForm = (m) => ({
  key: m.key,
  label: m.label || '',
  description: m.description || '',
  roles: list(m.roles),
  calc: m.calc,
  activities: list(m.params?.activities),
  of: list(m.params?.of),
  status: m.params?.status || 'new',
  days: m.params?.days ?? 7,
  direction: m.higher_is_better === true ? 'higher' : m.higher_is_better === false ? 'lower' : 'none',
  target: m.target === null || m.target === undefined ? '' : String(m.target),
  enabled: m.enabled !== false,
});

/** Problems with the form, by field; empty when it can be saved */
export const validateForm = (f) => {
  const errors = {};
  const label = (f.label || '').trim();
  if (label.length < 2 || label.length > 80) errors.label = 'Give the metric a name (2 to 80 characters)';
  if (!list(f.roles).length) errors.roles = 'Choose at least one account type';
  if (!CALCULATORS[f.calc]) errors.calc = 'Choose what to measure';
  const fields = CALCULATORS[f.calc]?.fields || [];
  if (fields.includes('activities') && !list(f.activities).length) errors.activities = 'Choose at least one action';
  if (fields.includes('of') && !list(f.of).length) errors.of = 'Choose at least one action to compare with';
  if (fields.includes('days')) {
    const d = Number(f.days);
    if (!Number.isInteger(d) || d < 1 || d > 30) errors.days = 'Use a whole number of days from 1 to 30';
  }
  if (String(f.target ?? '').trim() !== '') {
    const t = Number(f.target);
    if (!Number.isFinite(t) || t < 0) errors.target = 'Use a number of 0 or more, or leave it empty';
  }
  return errors;
};

/** Form → the row to save (without key, sort_order and audit fields) */
export const toRow = (f) => {
  const calc = CALCULATORS[f.calc];
  const params = {};
  if (f.calc === 'activity_avg') params.activities = ['cleanup.completed'];
  if (calc.fields.includes('activities')) params.activities = list(f.activities);
  if (calc.fields.includes('of')) params.of = list(f.of);
  if (calc.fields.includes('status')) params.status = f.status === 'cleaned' ? 'cleaned' : 'new';
  if (calc.fields.includes('days')) params.days = Number(f.days);
  const target = String(f.target ?? '').trim();
  return {
    label: f.label.trim(),
    description: (f.description || '').trim() || null,
    roles: list(f.roles),
    calc: f.calc,
    params,
    unit: calc.unit,
    higher_is_better: f.direction === 'higher' ? true : f.direction === 'lower' ? false : null,
    target: target === '' ? null : Number(target),
    enabled: f.enabled !== false,
  };
};

/** A new metric's key: "vol_sites_cleaned", unique among `taken` (^[a-z][a-z0-9_]{2,40}$) */
export const makeKey = (label, roles, taken = []) => {
  const prefix = list(roles).length === 1 ? (METRIC_ROLES.find(r => r.key === roles[0])?.prefix || 'all') : 'all';
  const slug = String(label || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'metric';
  const base = `${prefix}_${slug}`;
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) key = `${base}_${n}`;
  return key;
};

/** Metrics shown to one account type, in page order */
export const metricsFor = (metrics, role) =>
  list(metrics).filter(m => list(m.roles).includes(role))
    .sort((a, b) => (a.sort_order - b.sort_order) || a.key.localeCompare(b.key));
