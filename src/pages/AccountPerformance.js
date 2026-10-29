import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPerformanceOverview } from '../services/performanceService';
import { GHANA_REGIONS } from '../constants/ghanaRegions';
import { relativeTime } from '../utils/liveMapUtils';
import { PERIODS, ACCOUNT_KINDS, formatValue, sortAccounts } from '../utils/performanceUtils';

/**
 * Admin: every volunteer group or MMDA side by side, per region and period.
 * Click a column to sort; click an account to open its own page.
 */
const AccountPerformance = () => {
  const [role, setRole] = useState('volunteer');
  const [region, setRegion] = useState('');
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState(null); // { key, dir }
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    setState(s => ({ ...s, status: 'loading' }));
    fetchPerformanceOverview(role, region, days)
      .then(data => { if (id === request.current) setState({ status: 'ready', data, error: null }); })
      .catch(error => {
        if (id !== request.current) return;
        console.warn('Account performance:', error?.detail || error);
        setState({ status: 'error', data: null, error });
      });
  }, [role, region, days]);

  const metrics = useMemo(() => state.data?.metrics || [], [state.data]);
  // Default order: the first metric that has a better direction, best first
  const activeSort = sort || (() => {
    const m = metrics.find(x => x.higher_is_better !== null && x.higher_is_better !== undefined);
    return m ? { key: m.key, dir: m.higher_is_better ? 'desc' : 'asc' } : { key: 'name', dir: 'asc' };
  })();
  const rows = sortAccounts(state.data?.accounts || [], activeSort.key, activeSort.dir);

  // First click on a column puts the best accounts first (fastest for times,
  // A–Z for names); clicking again flips it
  const bestDir = (key) => (key === 'name' || metrics.find(m => m.key === key)?.higher_is_better === false ? 'asc' : 'desc');
  const sortBy = (key) => {
    const flip = (d) => (d === 'asc' ? 'desc' : 'asc');
    setSort({ key, dir: activeSort.key === key ? flip(activeSort.dir) : bestDir(key) });
  };
  const ariaSort = (key) => (activeSort.key === key ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  const kind = ACCOUNT_KINDS[role];

  return (
    <div className="p-4">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Account performance</h1>
          <p className="text-td-sage">Compare {kind.many} over the same period. Each account sees only its own numbers and rank.</p>
          <Link to="/performance/metrics" className="text-sm text-green-700 hover:underline">Edit the metrics →</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-td-border-strong overflow-hidden bg-white" role="group" aria-label="Account type">
            {Object.entries(ACCOUNT_KINDS).map(([key, k]) => (
              <button key={key} type="button" aria-pressed={role === key} onClick={() => { setRole(key); setSort(null); }}
                className={`px-3 py-1.5 text-sm ${role === key ? 'bg-green-600 text-white' : 'text-td-ink hover:bg-td-cream'}`}>{k.label}</button>
            ))}
          </div>
          <select aria-label="Region" value={region} onChange={e => setRegion(e.target.value)}
            className="border border-td-border-strong rounded-md px-2 py-1.5 text-sm bg-white">
            <option value="">All regions</option>
            {GHANA_REGIONS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
          <div className="inline-flex rounded-md border border-td-border-strong overflow-hidden bg-white" role="group" aria-label="Period">
            {PERIODS.map(p => (
              <button key={p.days} type="button" aria-pressed={days === p.days} onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-sm ${days === p.days ? 'bg-green-600 text-white' : 'text-td-ink hover:bg-td-cream'}`}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {state.status === 'error' && (
        <div role="alert" className="mb-4 rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm">
          {state.error?.kind === 'forbidden' ? 'Only TrashDrop admins can compare accounts.' : state.error?.message}
        </div>
      )}

      {state.status !== 'error' && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto" aria-busy={state.status === 'loading'}>
          <table className="min-w-full text-sm">
            <thead className="bg-td-cream text-td-sage">
              <tr>
                <th scope="col" aria-sort={ariaSort('name')} className="text-left px-3 py-2 font-medium">
                  <button type="button" onClick={() => sortBy('name')} className="hover:underline">Account</button>
                </th>
                <th scope="col" className="text-left px-3 py-2 font-medium">Area</th>
                {metrics.map(m => (
                  <th key={m.key} scope="col" aria-sort={ariaSort(m.key)} className="text-right px-3 py-2 font-medium whitespace-nowrap">
                    <button type="button" onClick={() => sortBy(m.key)} className="hover:underline">{m.label}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.status === 'loading' && (
                <tr><td colSpan={2 + metrics.length} className="px-3 py-6 text-center text-td-sage">Loading…</td></tr>
              )}
              {state.status === 'ready' && rows.length === 0 && (
                <tr><td colSpan={2 + metrics.length} className="px-3 py-6 text-center text-td-sage" data-testid="no-accounts">
                  No approved {kind.many}{region ? ` in ${region}` : ''} yet.
                </td></tr>
              )}
              {state.status === 'ready' && rows.map(a => (
                <tr key={a.account_id} className="border-t border-td-border" data-testid="account-row">
                  <td className="px-3 py-2">
                    <Link to={`/performance/accounts/${a.account_id}`} className="text-green-700 hover:underline font-medium">
                      {a.name || 'Unnamed account'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-td-sage">{[a.district, a.region].filter(Boolean).join(', ') || '—'}</td>
                  {metrics.map(m => (
                    <td key={m.key} className="px-3 py-2 text-right tabular-nums">{formatValue(a.values?.[m.key], m.unit)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state.data?.refreshed_at && (
        <p className="text-xs text-td-sage mt-3" data-testid="updated">Totals updated {relativeTime(state.data.refreshed_at)} · every 5 minutes</p>
      )}
    </div>
  );
};

export default AccountPerformance;
