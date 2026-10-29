import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMetrics, createMetric, updateMetric, deleteMetric } from '../services/performanceService';
import { logAudit } from '../services/auditLogService';
import {
  ACTIVITIES, METRIC_ROLES, CALCULATORS, describeMetric, emptyForm, toForm, validateForm, toRow, makeKey, metricsFor,
} from '../utils/metricEditor';
import { formatValue } from '../utils/performanceUtils';

const DIRECTIONS = [
  { key: 'higher', label: 'Higher is better (ranked)' },
  { key: 'lower', label: 'Lower is better (ranked)' },
  { key: 'none', label: 'Just show it (not ranked)' },
];

const FieldError = ({ id, text }) => (text ? <p id={id} className="text-xs text-red-700 mt-1">{text}</p> : null);

const ActionChecklist = ({ legend, name, value, onChange, error }) => (
  <fieldset aria-describedby={error ? `${name}-error` : undefined}>
    <legend className="text-sm font-medium text-gray-700">{legend}</legend>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1">
      {ACTIVITIES.map(a => (
        <label key={a.key} className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={value.includes(a.key)}
            onChange={e => onChange(e.target.checked ? [...value, a.key] : value.filter(k => k !== a.key))} />
          {a.label}
        </label>
      ))}
    </div>
    <FieldError id={`${name}-error`} text={error} />
  </fieldset>
);

const MetricForm = ({ initial, saving, onSave, onCancel }) => {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (patch) => setF(prev => ({ ...prev, ...patch }));
  const calc = CALCULATORS[f.calc];
  const unit = calc?.unit;

  const submit = (e) => {
    e.preventDefault();
    const problems = validateForm(f);
    setErrors(problems);
    if (Object.keys(problems).length === 0) onSave(f);
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-lg shadow-sm p-5 mb-6 space-y-4" aria-labelledby="metric-form-title" noValidate>
      <h2 id="metric-form-title" className="text-lg font-semibold text-gray-800">{f.key ? 'Edit metric' : 'New metric'}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="metric-label" className="text-sm font-medium text-gray-700">Name</label>
          <input id="metric-label" value={f.label} onChange={e => set({ label: e.target.value })} maxLength={80}
            aria-invalid={!!errors.label} aria-describedby={errors.label ? 'label-error' : undefined}
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="e.g. Sites cleaned" />
          <FieldError id="label-error" text={errors.label} />
        </div>
        <div>
          <label htmlFor="metric-description" className="text-sm font-medium text-gray-700">Explanation shown under the number (optional)</label>
          <input id="metric-description" value={f.description} onChange={e => set({ description: e.target.value })} maxLength={160}
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>

      <fieldset aria-describedby={errors.roles ? 'roles-error' : undefined}>
        <legend className="text-sm font-medium text-gray-700">Show on the pages of</legend>
        <div className="flex flex-wrap gap-4 mt-1">
          {METRIC_ROLES.map(r => (
            <label key={r.key} className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={f.roles.includes(r.key)}
                onChange={e => set({ roles: e.target.checked ? [...f.roles, r.key] : f.roles.filter(k => k !== r.key) })} />
              {r.label}
            </label>
          ))}
        </div>
        <FieldError id="roles-error" text={errors.roles} />
      </fieldset>

      <div>
        <label htmlFor="metric-calc" className="text-sm font-medium text-gray-700">What to measure</label>
        <select id="metric-calc" value={f.calc} onChange={e => set({ calc: e.target.value })}
          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
          {Object.entries(CALCULATORS).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
        </select>
        {f.calc.startsWith('area_') && (
          <p className="text-xs text-gray-500 mt-1">Area = the MMDA’s district, or the volunteer group’s region.</p>
        )}
      </div>

      {calc?.fields.includes('activities') && (
        <ActionChecklist legend={f.calc === 'activity_ratio' ? 'Count these actions…' : 'Actions to count'} name="activities"
          value={f.activities} onChange={v => set({ activities: v })} error={errors.activities} />
      )}
      {calc?.fields.includes('of') && (
        <ActionChecklist legend="…as a share of these actions" name="of" value={f.of} onChange={v => set({ of: v })} error={errors.of} />
      )}
      {calc?.fields.includes('status') && (
        <div>
          <label htmlFor="metric-status" className="text-sm font-medium text-gray-700">Which reports</label>
          <select id="metric-status" value={f.status} onChange={e => set({ status: e.target.value })}
            className="mt-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="new">New reports in the period</option>
            <option value="cleaned">Reports cleaned up in the period</option>
          </select>
        </div>
      )}
      {calc?.fields.includes('days') && (
        <div>
          <label htmlFor="metric-days" className="text-sm font-medium text-gray-700">Within how many days</label>
          <input id="metric-days" type="number" min={1} max={30} value={f.days} onChange={e => set({ days: e.target.value })}
            aria-invalid={!!errors.days} aria-describedby={errors.days ? 'days-error' : undefined}
            className="mt-1 w-28 border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <FieldError id="days-error" text={errors.days} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="metric-direction" className="text-sm font-medium text-gray-700">Ranking</label>
          <select id="metric-direction" value={f.direction} onChange={e => set({ direction: e.target.value })}
            className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            {DIRECTIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="metric-target" className="text-sm font-medium text-gray-700">
            Target (optional, in {unit === 'percent' ? '%' : unit === 'count' ? 'number' : unit})
          </label>
          <input id="metric-target" inputMode="decimal" value={f.target} onChange={e => set({ target: e.target.value })}
            aria-invalid={!!errors.target} aria-describedby={errors.target ? 'target-error' : undefined}
            className="mt-1 w-40 border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <FieldError id="target-error" text={errors.target} />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={f.enabled} onChange={e => set({ enabled: e.target.checked })} />
        Show this metric
      </label>

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
          {saving ? 'Saving…' : f.key ? 'Save changes' : 'Add metric'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50">
          Cancel
        </button>
        <span className="text-xs text-gray-500 ml-2">Changes show on every account’s page the next time it loads.</span>
      </div>
    </form>
  );
};

/**
 * Admin: the metrics on account performance pages (performance_metrics).
 * Add, edit, hide, reorder or delete them without code.
 */
const PerformanceMetrics = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // form values, or null
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    setStatus(s => (s === 'ready' ? 'ready' : 'loading'));
    return fetchMetrics()
      .then(rows => { setMetrics(rows); setStatus('ready'); })
      .catch(e => { setError(e.message); setStatus('error'); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const keys = useMemo(() => metrics.map(m => m.key), [metrics]);

  const run = async (fn, success) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice(success);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = async (form) => {
    const row = toRow(form);
    if (form.key) {
      const before = metrics.find(m => m.key === form.key);
      const ok = await run(async () => {
        const after = await updateMetric(form.key, row, user?.id);
        logAudit({ source: 'admin', action: 'performance.metric_updated', entityType: 'performance_metric', entityId: form.key,
          message: `Metric “${row.label}” changed`, before, after });
      }, `Saved “${row.label}”.`);
      if (ok) setEditing(null);
      return;
    }
    const key = makeKey(row.label, row.roles, keys);
    const sortOrder = Math.max(0, ...metrics.map(m => m.sort_order || 0)) + 10;
    const ok = await run(async () => {
      const after = await createMetric({ ...row, key, sort_order: sortOrder }, user?.id);
      logAudit({ source: 'admin', action: 'performance.metric_created', entityType: 'performance_metric', entityId: key,
        message: `Metric “${row.label}” added`, after });
    }, `Added “${row.label}”.`);
    if (ok) setEditing(null);
  };

  const toggle = (m) => run(async () => {
    const after = await updateMetric(m.key, { enabled: !m.enabled }, user?.id);
    logAudit({ source: 'admin', action: 'performance.metric_updated', entityType: 'performance_metric', entityId: m.key,
      message: `Metric “${m.label}” ${m.enabled ? 'hidden' : 'shown'}`, before: m, after });
  }, m.enabled ? `Hid “${m.label}”.` : `Showing “${m.label}”.`);

  // Swap places with the neighbour on this account type's page
  const move = (list, index, delta) => {
    const a = list[index];
    const b = list[index + delta];
    if (!a || !b) return;
    const [sa, sb] = a.sort_order === b.sort_order ? [b.sort_order + delta, a.sort_order] : [b.sort_order, a.sort_order];
    run(async () => {
      await updateMetric(a.key, { sort_order: sa }, user?.id);
      await updateMetric(b.key, { sort_order: sb }, user?.id);
    }, `Moved “${a.label}”.`);
  };

  const remove = (m) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete “${m.label}”? Its daily history is deleted too. To keep the history, hide it instead.`)) return;
    run(async () => {
      await deleteMetric(m.key);
      logAudit({ source: 'admin', action: 'performance.metric_deleted', entityType: 'performance_metric', entityId: m.key,
        message: `Metric “${m.label}” deleted`, before: m });
    }, `Deleted “${m.label}”.`);
  };

  return (
    <div className="p-4">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <Link to="/performance/accounts" className="text-sm text-green-700 hover:underline">← Account performance</Link>
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Performance metrics</h1>
          <p className="text-gray-600">What volunteer groups and MMDAs see on their My Performance page.</p>
        </div>
        {!editing && (
          <button type="button" onClick={() => { setNotice(null); setEditing(emptyForm()); }}
            className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700">
            <i className="fas fa-plus mr-1" aria-hidden="true"></i>Add metric
          </button>
        )}
      </div>

      {error && <div role="alert" className="mb-4 rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-md bg-green-50 text-green-800 px-4 py-3 text-sm">{notice}</div>}

      {editing && (
        <MetricForm key={editing.key || 'new'} initial={editing} saving={saving}
          onSave={save} onCancel={() => { setEditing(null); setError(null); }} />
      )}

      {status === 'loading' && <p className="text-gray-500">Loading…</p>}

      {status === 'ready' && METRIC_ROLES.map(r => {
        const list = metricsFor(metrics, r.key);
        return (
          <section key={r.key} className="mb-8" aria-labelledby={`metrics-${r.key}`}>
            <h2 id={`metrics-${r.key}`} className="text-lg font-semibold text-gray-800 mb-2">{r.label}</h2>
            {list.length === 0 ? (
              <p className="text-sm text-gray-500">No metrics yet.</p>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Order</th>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Metric</th>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Ranking</th>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Target</th>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Shown</th>
                      <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m, i) => (
                      <tr key={m.key} className={`border-t border-gray-100 ${m.enabled ? '' : 'text-gray-400'}`} data-testid={`row-${r.key}-${m.key}`}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button type="button" onClick={() => move(list, i, -1)} disabled={saving || i === 0}
                            aria-label={`Move ${m.label} up`} className="px-1.5 disabled:opacity-30"><i className="fas fa-arrow-up" aria-hidden="true"></i></button>
                          <button type="button" onClick={() => move(list, i, 1)} disabled={saving || i === list.length - 1}
                            aria-label={`Move ${m.label} down`} className="px-1.5 disabled:opacity-30"><i className="fas fa-arrow-down" aria-hidden="true"></i></button>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-800">{m.label}</p>
                          <p className="text-xs text-gray-500">{describeMetric(m)}</p>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {m.higher_is_better === true ? 'Higher is better' : m.higher_is_better === false ? 'Lower is better' : 'Not ranked'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{m.target === null || m.target === undefined ? '—' : formatValue(m.target, m.unit)}</td>
                        <td className="px-3 py-2">
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={!!m.enabled} disabled={saving} onChange={() => toggle(m)}
                              aria-label={`Show ${m.label}`} />
                            <span className="text-xs">{m.enabled ? 'Shown' : 'Hidden'}</span>
                          </label>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <button type="button" onClick={() => { setNotice(null); setEditing(toForm(m)); }} disabled={saving}
                            className="text-green-700 hover:underline mr-3">Edit<span className="sr-only"> {m.label}</span></button>
                          <button type="button" onClick={() => remove(m)} disabled={saving}
                            className="text-red-700 hover:underline">Delete<span className="sr-only"> {m.label}</span></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default PerformanceMetrics;
