import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMyPerformance } from '../services/performanceService';
import { memberStats } from '../services/teamService';
import { relativeTime } from '../utils/liveMapUtils';
import {
  PERIODS, ACCOUNT_KINDS, formatValue, rankText, changeText, targetProgress, fillTrend, isCountMetric, hasActivity,
} from '../utils/performanceUtils';

// The database rebuilds the totals every 5 minutes; reload on that rhythm
const RELOAD_MS = 5 * 60 * 1000;

const Sparkline = ({ points, label }) => {
  const values = points.map(p => p.value);
  const known = values.filter(v => v !== null);
  if (known.length < 2) return null;
  const w = 160;
  const h = 36;
  const max = Math.max(...known);
  const min = Math.min(0, ...known);
  const span = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  // Break the line where a day has nothing to measure
  const segments = [];
  let current = [];
  values.forEach((v, i) => {
    if (v === null) { if (current.length) segments.push(current); current = []; return; }
    current.push(`${(i * step).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`);
  });
  if (current.length) segments.push(current);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="mt-3 max-w-full">
      {segments.map((s, i) => (s.length > 1
        ? <polyline key={i} points={s.join(' ')} fill="none" stroke="#1B6E35" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        : <circle key={i} cx={s[0].split(',')[0]} cy={s[0].split(',')[1]} r="2" fill="#1B6E35" />))}
    </svg>
  );
};

const MetricCard = ({ metric, role, area, period }) => {
  const rank = rankText(metric, role, area);
  const change = changeText(metric, period.days);
  const target = targetProgress(metric);
  const trend = metric.live ? [] : fillTrend(metric.trend, period.from, period.to, metric.unit, isCountMetric(metric));
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col" data-testid={`metric-${metric.key}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-td-sage text-sm font-medium">{metric.label}</p>
        {metric.live && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-td-forest whitespace-nowrap">Right now</span>}
      </div>
      <p className="text-3xl font-bold text-td-ink mt-1" data-testid="metric-value">{formatValue(metric.value, metric.unit)}</p>
      {metric.description && <p className="text-xs text-td-sage mt-1">{metric.description}</p>}
      {rank && (
        <p className="mt-3 text-sm font-medium text-green-800 bg-green-50 rounded px-2 py-1 self-start" data-testid="metric-rank">
          <i className="fas fa-medal mr-1" aria-hidden="true"></i>{rank}
        </p>
      )}
      {change && (
        <p data-testid="metric-change"
          className={`mt-2 text-xs ${change.good === true ? 'text-green-700' : change.good === false ? 'text-red-700' : 'text-td-sage'}`}>
          {change.text}
        </p>
      )}
      {target && (
        <div className="mt-3" data-testid="metric-target">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-label={`${metric.label}: ${target.text}`}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(target.pct)}>
            <div className={`h-full ${target.met ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${target.pct}%` }}></div>
          </div>
          <p className="text-xs text-td-sage mt-1">{target.text}</p>
        </div>
      )}
      <Sparkline points={trend} label={`${metric.label}, day by day`} />
    </div>
  );
};

const MEMBER_COLUMNS = [
  { key: 'verified', label: 'Verified' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'claimed', label: 'Claimed' },
  { key: 'completed', label: 'Cleaned up' },
  { key: 'marked_cleaned', label: 'Marked cleaned' },
];

/** Each member's part in the group's numbers (only people in the group can load it) */
const MemberTable = ({ days }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    memberStats(days).then(r => { if (live) { setRows(r); setError(null); } })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [days]);
  if (error) return <p className="text-sm text-td-sage mt-6">{error}</p>;
  if (!rows) return null;
  return (
    <section className="bg-white rounded-xl shadow-sm mt-6 overflow-x-auto" aria-labelledby="members-title">
      <div className="flex items-baseline gap-3 px-5 pt-5">
        <h2 id="members-title" className="text-lg font-semibold text-td-ink">Members</h2>
        <Link to="/team" className="text-sm text-green-700 hover:underline">Manage team</Link>
      </div>
      <p className="px-5 text-xs text-td-sage">What each person did for the group in the last {days} days. Only people in your group see this.</p>
      <table className="min-w-full text-sm mt-2">
        <thead className="bg-td-cream text-td-sage">
          <tr>
            <th scope="col" className="text-left px-5 py-2 font-medium">Member</th>
            {MEMBER_COLUMNS.map(c => <th key={c.key} scope="col" className="text-right px-3 py-2 font-medium">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.member_id} className="border-t border-td-border" data-testid="member-stats-row">
              <td className="px-5 py-2">
                {r.name}
                {r.is_group && <span className="block text-xs text-td-sage">The shared group login (e.g. the collector app)</span>}
              </td>
              {MEMBER_COLUMNS.map(c => <td key={c.key} className="px-3 py-2 text-right tabular-nums">{r[c.key] ?? 0}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length <= 1 && (
        <p className="px-5 py-3 text-sm text-td-sage" data-testid="no-members-yet">No members yet. <Link to="/team" className="text-green-700 hover:underline">Invite your group</Link> so each person signs in with their own account.</p>
      )}
    </section>
  );
};

/**
 * "My performance": the signed-in volunteer group's or MMDA's own numbers,
 * with their rank among accounts of the same type in their region. Admins
 * reach it for any account at /performance/accounts/:accountId.
 */
const MyPerformance = () => {
  const { accountId } = useParams();
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const request = useRef(0);

  const load = useCallback(() => {
    const id = ++request.current;
    setState(s => ({ ...s, status: s.data ? 'refreshing' : 'loading' }));
    fetchMyPerformance(days, accountId)
      .then(data => { if (id === request.current) setState({ status: 'ready', data, error: null }); })
      .catch(error => {
        if (id !== request.current) return;
        console.warn('My performance:', error?.detail || error);
        setState(s => ({ status: 'error', data: s.data, error }));
      });
  }, [days, accountId]);

  useEffect(() => { load(); }, [load, reloadKey]);

  // Reload every 5 minutes, and when the page comes back into view
  useEffect(() => {
    const timer = setInterval(load, RELOAD_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const data = state.data;
  const metrics = data?.metrics || [];
  const kind = ACCOUNT_KINDS[data?.role];
  const area = data?.rank_area || 'Ghana';
  const period = { days, from: data?.period?.from, to: data?.period?.to };
  const loading = state.status === 'loading';

  return (
    <div className="p-4">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          {accountId && <Link to="/performance/accounts" className="text-sm text-green-700 hover:underline">← All accounts</Link>}
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">{accountId ? (data?.name || 'Account performance') : 'My performance'}</h1>
          {data && (
            <p className="text-td-sage" data-testid="account-line">
              {[kind ? kind.one.replace(/^./, c => c.toUpperCase()) : null, data.district, data.region].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-td-border-strong overflow-hidden bg-white" role="group" aria-label="Period">
            {PERIODS.map(p => (
              <button key={p.days} type="button" aria-pressed={days === p.days} onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-sm ${days === p.days ? 'bg-green-600 text-white' : 'text-td-ink hover:bg-td-cream'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-td-sage" data-testid="updated">
            {data?.refreshed_at ? `Updated ${relativeTime(data.refreshed_at)} · every 5 minutes` : ''}
          </span>
          <button type="button" onClick={() => setReloadKey(k => k + 1)} disabled={loading || state.status === 'refreshing'}
            className="px-3 py-1.5 text-sm border border-td-border-strong rounded-md bg-white hover:bg-td-cream disabled:opacity-50">
            <i className={`fas fa-sync-alt mr-1 ${state.status === 'refreshing' ? 'animate-spin' : ''}`} aria-hidden="true"></i>Refresh
          </button>
        </div>
      </div>

      {state.status === 'error' && (
        <div role="alert" className="mb-4 rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm">
          {state.error?.message || 'Couldn’t load the numbers. Try Refresh.'}
          {data && ' Showing the last numbers loaded.'}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map(i => <div key={i} className="bg-white rounded-xl shadow-sm p-5 h-40 animate-pulse"></div>)}
        </div>
      )}

      {data && metrics.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 text-td-ink" data-testid="no-metrics">
          <p className="font-medium">Performance numbers are for approved volunteer groups and assemblies (MMDAs).</p>
          <p className="text-sm text-td-sage mt-1">If your account should be one of these, ask an admin to approve its access request.</p>
        </div>
      )}

      {data && metrics.length > 0 && (
        <>
          {!hasActivity(metrics) && (
            <div className="mb-4 rounded-md bg-amber-50 text-amber-900 px-4 py-3 text-sm" data-testid="no-activity">
              No activity in the last {days} days yet. Your numbers fill in as {data.role === 'authority'
                ? 'reports in your district are verified, assigned and cleaned up'
                : 'your group claims and cleans up reports'}.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {metrics.map(m => <MetricCard key={m.key} metric={m} role={data.role} area={area} period={period} />)}
          </div>
          <p className="text-xs text-td-sage mt-4">
            Ranks compare approved {kind?.many || 'accounts'} in {area} over the same {days} days; other accounts’ numbers stay private.
          </p>
          {data.role === 'volunteer' && !accountId && <MemberTable days={days} />}
        </>
      )}
    </div>
  );
};

export default MyPerformance;
