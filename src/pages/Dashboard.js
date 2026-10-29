import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../constants/accessControl';
import { can } from '../lib/permissions';
import { fetchDashboard, fetchStaleRequests } from '../services/dashboardAdminService';
import { cancelRequest } from '../services/pickupAdminService';
import { setAlertStatus } from '../services/alertAdminService';
import { CANCEL_REASONS } from '../constants/pickupStatus';
import {
  RANGE_PRESETS, periodFromParams, pctChange, slaPct, ptsChange, SLA_HELP, statusRows, requestListUrl,
  wasteRows, bucketLabel, seriesTotal, normalizeDashboardAlert, durationSince,
} from '../utils/dashboardUtils';
import ConfirmDialog from '../components/pickupRequests/ConfirmDialog';
import { CHART } from '../theme/brand';
import { applyChartTheme, chartColor, describeValues } from '../theme/chartTheme';
import { useTheme } from '../context/ThemeContext';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);
applyChartTheme(ChartJS);

const NO_DATA = 'No data for this period';
const STALE_DAYS = 30;

const Empty = ({ text = NO_DATA }) => (
  <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-td-sage" data-testid="empty-state">
    <i className="far fa-chart-bar text-3xl mb-2" aria-hidden="true"></i>
    <p className="text-sm">{text}</p>
  </div>
);

const Help = ({ text }) => (
  <button type="button" className="relative ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full align-middle text-td-sage cursor-help group" aria-label={text}>
    <i className="fas fa-info-circle" aria-hidden="true"></i>
    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-lg bg-td-ink px-3 py-2 text-left text-xs font-normal text-white shadow-lg group-hover:block group-focus:block">{text}</span>
  </button>
);

const Skeleton = ({ className = 'h-full min-h-[160px]' }) => (
  <div className={`animate-pulse flex flex-col justify-center gap-3 ${className}`} data-testid="skeleton" aria-busy="true">
    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
  </div>
);

// A real failure (network, server): a plain message and a retry, never the backend's own text
const Failed = ({ onRetry, text = 'Couldn’t load these numbers. Try Refresh.' }) => (
  <div role="alert" data-testid="load-failed" className="h-full min-h-[120px] flex flex-col items-center justify-center text-center text-td-sage gap-2">
    <i className="fas fa-exclamation-circle text-2xl text-td-orange" aria-hidden="true"></i>
    <p className="text-sm">{text}</p>
    {onRetry && <button type="button" onClick={onRetry} className="text-sm text-green-700 hover:underline">Retry</button>}
  </div>
);

// The database refused this role even though the page allowed the call
const Locked = ({ role, what = 'these stats' }) => (
  <div data-testid="locked" className="bg-white rounded-xl border border-td-border p-6 flex items-center gap-4 text-td-sage">
    <i className="fas fa-lock text-2xl text-td-sage" aria-hidden="true"></i>
    <p className="text-sm">Your role ({ROLE_LABELS[role] || role}) doesn’t include {what}. Ask an admin if you need access.</p>
  </div>
);

// A number card. The help button sits beside it, not inside, so the card stays one control.
const Kpi = ({ icon, label, value, change, sub, help, onClick, loading, failed, testid }) => (
  <div className={`relative bg-white rounded-xl border border-td-border transition-colors ${onClick ? 'hover:border-td-forest' : ''}`}>
    <button type="button" onClick={onClick} data-testid={testid} disabled={!onClick}
      className={`w-full p-6 flex items-center text-left rounded-xl ${onClick ? '' : 'cursor-default'}`}>
      <div className="h-12 w-12 shrink-0 rounded-full mr-4 bg-td-tonal flex items-center justify-center"><i className={`fas fa-${icon} text-xl text-td-forest`} aria-hidden="true"></i></div>
      <div className="min-w-0">
        <p className="text-td-sage text-sm pr-6">{label}</p>
        {loading ? <div className="animate-pulse bg-gray-200 h-6 w-20 rounded mt-1"></div> : (
          <div className="flex items-baseline flex-wrap gap-x-2">
            <h3 className="text-[28px] leading-tight font-bold text-td-ink tabular-nums">{failed ? '—' : value}</h3>
            {!failed && change !== undefined && <span className="text-sm text-td-sage" title="Compared with the previous period of the same length">{change}</span>}
          </div>
        )}
        {(failed || sub) && !loading && <p className="text-xs text-td-sage mt-0.5">{failed ? 'Couldn’t load. Try Refresh.' : sub}</p>}
      </div>
    </button>
    {help && <span className="absolute top-5 right-4"><Help text={help} /></span>}
  </div>
);

const Panel = ({ title, help, action, children, className = '', testid }) => (
  <div className={`bg-white rounded-xl border border-td-border p-6 ${className}`} data-testid={testid}>
    <div className="flex items-center justify-between mb-4 gap-2">
      <h2 className="text-lg font-semibold text-td-ink">{title}{help && <Help text={help} />}</h2>
      {action}
    </div>
    {children}
  </div>
);

const SEVERITY = {
  critical: { icon: 'exclamation-triangle', color: '#b91c1c', bg: '#fdecec' },
  high: { icon: 'exclamation-circle', color: '#b4530e', bg: '#fff5ee' },
  medium: { icon: 'exclamation-circle', color: '#92400e', bg: '#fdf6e3' },
  low: { icon: 'info-circle', color: '#1d4ed8', bg: '#eaf0fd' },
};
// Dark mode: deep fills and pale text, the same hues
const SEVERITY_DARK = {
  critical: { ...SEVERITY.critical, color: '#fca5a5', bg: '#3b1515' },
  high: { ...SEVERITY.high, color: '#fdba74', bg: '#3d220f' },
  medium: { ...SEVERITY.medium, color: '#fcd34d', bg: '#3a2a0c' },
  low: { ...SEVERITY.low, color: '#a5c0fd', bg: '#14213f' },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { isDark } = useTheme();
  applyChartTheme(ChartJS, isDark);
  const tc = (c) => chartColor(c, isDark);
  const chartKey = isDark ? 'dark' : 'light';
  const severities = isDark ? SEVERITY_DARK : SEVERITY;
  const [params, setParams] = useSearchParams();
  const rangeKey = params.get('range') || '';
  const customFrom = params.get('from') || '';
  const customTo = params.get('to') || '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const period = useMemo(() => periodFromParams(params), [rangeKey, customFrom, customTo]);

  // What this role may see (src/lib/permissions.js). The data calls below only
  // run for roles that have them, and panels a role can't use are not drawn.
  const canStats = can('dashboard.stats', role);
  const canQueue = can('dashboard.liveQueue', role);
  const canBags = can('bags.view', role);
  const canAlerts = can('alerts.view', role);
  const canCancel = can('requests.cancel', role);
  const canOpenRequests = can('requests.view', role);
  const canOpenCollectors = can('collectors.view', role);
  const canOpenDumping = can('dumping.view', role);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(canStats);
  const [error, setError] = useState(null); // DashboardError
  const [updatedAt, setUpdatedAt] = useState(null);
  const [stale, setStale] = useState(null);
  const [staleError, setStaleError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelling, setCancelling] = useState(null); // stale request row
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);
  const [resolving, setResolving] = useState(null); // { alert, to }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (text, kind = 'ok') => { setToast({ text, kind }); setTimeout(() => setToast(null), 3500); };

  const report = (e, capability) => {
    if (e?.kind === 'forbidden') {
      console.warn(`Dashboard: the database refused ${capability} for role "${role}" although the page allowed it. The page and the database permissions are out of step.`, e.detail);
    } else {
      console.error('Dashboard: load failed', e?.detail || e);
    }
  };

  useEffect(() => {
    let live = true;
    if (canStats) {
      setLoading(true);
      fetchDashboard(period)
        .then(d => { if (live) { setData(d); setError(null); setUpdatedAt(new Date()); } })
        .catch(e => { if (live) { setData(null); setError(e); report(e, 'dashboard.stats'); } })
        .finally(() => { if (live) setLoading(false); });
    } else {
      setLoading(false);
    }
    if (canQueue) {
      fetchStaleRequests(STALE_DAYS)
        .then(r => { if (live) { setStale(r); setStaleError(null); } })
        .catch(e => { if (live) { setStale(null); setStaleError(e); report(e, 'dashboard.liveQueue'); } });
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, reloadKey, canStats, canQueue]);

  // Refresh every 5 minutes while the page is open
  useEffect(() => {
    const t = setInterval(() => setReloadKey(k => k + 1), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const setRange = useCallback((key, from, to) => {
    const sp = new URLSearchParams();
    if (key !== '30d') sp.set('range', key);
    if (key === 'custom') { if (from) sp.set('from', from); if (to) sp.set('to', to); }
    setParams(sp, { replace: true });
  }, [setParams]);

  const req = data?.requests || {};
  const rows = statusRows(req.by_status);
  const statusSum = rows.reduce((s, r) => s + r.value, 0);
  const sla = data?.sla || {};
  const slaNow = slaPct(sla.met, sla.measured);
  const slaPrev = slaPct(sla.prev_met, sla.prev_measured);
  const col = data?.collectors || {};
  const online = (Number(col.active) || 0) + (Number(col.idle) || 0);
  const waste = wasteRows(data?.waste);
  const wasteTotal = waste.reduce((s, r) => s + r.value, 0);
  const bags = data?.bags || {};
  const bucket = data?.period?.bucket || 'day';
  const bagSeries = bags.series || [];
  const dumping = data?.dumping || [];
  const alerts = (data?.alerts?.latest || []).map(a => normalizeDashboardAlert(a));
  const bySource = req.by_source || {};

  // One status for the numbers from the database: loading → skeletons, a real
  // failure → "—" and a retry, a refusal → the locked card. Never zeros.
  const retry = () => setReloadKey(k => k + 1);
  const status = !canStats ? 'hidden' : loading && !data ? 'loading' : error ? (error.kind === 'forbidden' ? 'locked' : 'error') : 'ok';
  const staleStatus = !canQueue ? 'hidden' : staleError ? (staleError.kind === 'forbidden' ? 'locked' : 'error') : stale === null ? 'loading' : 'ok';
  const showQueueKpis = canStats && canQueue; // pending and collectors come with the same answer as the stats
  // Opens a page only if this role may open it; otherwise the card is not a link
  const go = (allowed, to) => (allowed ? () => navigate(to) : undefined);
  const body = (ok) => (status === 'loading' ? <Skeleton /> : status === 'error' ? <Failed onRetry={retry} /> : ok);

  /* ── actions ─────────────────────────────────────────────────────────── */

  const runCancel = async () => {
    setBusy(true);
    try {
      await cancelRequest({ source: cancelling.source, id: cancelling.id, status: cancelling.status },
        { reason: cancelReason, note: `Stale: no collector for ${cancelling.days_waiting} days (closed from Dashboard)`, userId: user?.id });
      showToast(`Request ${cancelling.id.slice(0, 8)} cancelled`);
      setCancelling(null);
      setReloadKey(k => k + 1);
    } catch (e) {
      showToast(`Not cancelled: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const runResolve = async () => {
    setBusy(true);
    try {
      await setAlertStatus({ id: resolving.alert.id }, resolving.to, { note, userId: user?.id });
      showToast(resolving.to === 'resolved' ? 'Alert resolved' : 'Alert dismissed');
      setResolving(null);
      setNote('');
      setReloadKey(k => k + 1);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ── charts ──────────────────────────────────────────────────────────── */

  const clickable = (onIndex) => ({
    onClick: (_evt, elements) => { if (elements?.length) onIndex(elements[0].index); },
    onHover: (evt, elements) => { if (evt?.native?.target) evt.native.target.style.cursor = elements?.length ? 'pointer' : 'default'; },
  });

  const statusChart = {
    labels: rows.map(r => r.label),
    datasets: [{ label: 'Requests', data: rows.map(r => r.value), backgroundColor: rows.map(r => tc(r.color)), borderWidth: 0 }],
  };
  const sourceChart = {
    labels: ['Pickup requests', 'Digital bins'],
    datasets: [{ data: [Number(bySource.pickup_requests) || 0, Number(bySource.digital_bins) || 0], backgroundColor: [tc(CHART.green), tc(CHART.orange)], borderWidth: 1 }],
  };
  const wasteChart = {
    labels: waste.map(w => w.key),
    datasets: [{ data: waste.map(w => w.value), backgroundColor: waste.map(w => tc(w.color)), borderWidth: 1 }],
  };
  const bagChart = {
    labels: bagSeries.map(b => bucketLabel(b.start, bucket)),
    datasets: [
      { label: 'Generated', data: bagSeries.map(b => b.generated), borderColor: tc(CHART.grey), backgroundColor: tc(CHART.grey), tension: 0.3 },
      { label: 'Distributed', data: bagSeries.map(b => b.distributed), borderColor: tc(CHART.orange), backgroundColor: tc(CHART.orange), tension: 0.3 },
      { label: 'Collected', data: bagSeries.map(b => b.collected), borderColor: tc(CHART.green), backgroundColor: tc(CHART.green), tension: 0.3 },
    ],
  };
  const dumpingChart = {
    labels: dumping.map(d => bucketLabel(d.start, bucket)),
    datasets: [{ label: 'Reports', data: dumping.map(d => d.reports), backgroundColor: tc(CHART.red), borderWidth: 0 }],
  };
  const axisOpts = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };

  const totalLink = requestListUrl(period);

  return (
    <div className="p-4">
      {toast && <div role="status" className={`fixed bottom-4 right-4 z-[60] px-4 py-2 rounded shadow-lg text-white ${toast.kind === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>{toast.text}</div>}

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Dashboard</h1>
          <p className="text-td-sage">Welcome to TrashDrop Management Portal</p>
        </div>
        <div className="flex flex-wrap items-end gap-2" data-testid="range-picker">
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden bg-white" role="group" aria-label="Period">
            {RANGE_PRESETS.map(p => (
              <button key={p.key} type="button" aria-pressed={period.key === p.key}
                onClick={() => setRange(p.key, period.fromDay, period.toDay)}
                className={`px-3 py-1.5 text-sm ${period.key === p.key ? 'bg-green-600 text-white' : 'text-td-ink hover:bg-td-cream'}`}>{p.label}</button>
            ))}
          </div>
          {period.key === 'custom' && (
            <>
              <input type="date" aria-label="From" value={period.fromDay} max={period.toDay} onChange={e => setRange('custom', e.target.value, period.toDay)} className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
              <input type="date" aria-label="To" value={period.toDay} min={period.fromDay} onChange={e => setRange('custom', period.fromDay, e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
            </>
          )}
          <span className="text-xs text-td-sage self-center" data-testid="last-updated">
            Last updated {updatedAt ? updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          </span>
          <button type="button" onClick={() => setReloadKey(k => k + 1)} disabled={loading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">
            <i className={`fas fa-sync-alt mr-1 ${loading ? 'animate-spin' : ''}`} aria-hidden="true"></i>Refresh
          </button>
        </div>
      </div>
      <p className="text-sm text-td-sage -mt-4 mb-4">
        Showing {period.fromDay} to {period.toDay}; changes compare with the {Math.round((period.to - period.from) / 864e5) || 1} days before.
      </p>

      {!canStats && !canQueue && <Locked role={role} what="the dashboard" />}
      {status === 'locked' && <div className="mb-8"><Locked role={role} /></div>}

      {/* KPI cards */}
      {canStats && status !== 'locked' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Kpi testid="kpi-total" icon="truck-loading" label="Total Requests" loading={status === 'loading'} failed={status === 'error'}
            value={req.total ?? 0} change={pctChange(req.total, req.prev_total)}
            sub="Pickup requests + digital bins" help="Requests created in this period (pickup requests and digital bins)."
            onClick={go(canOpenRequests, totalLink)} />
          {showQueueKpis && (
            <Kpi testid="kpi-pending" icon="clock" label="Pending Requests" loading={status === 'loading'} failed={status === 'error'}
              value={req.pending ?? 0} change={pctChange(req.pending, req.prev_pending)}
              sub={req.pending_all_dates ? `${req.pending_all_dates} waiting in total${req.oldest_pending_at ? `, oldest ${durationSince(req.oldest_pending_at)}` : ''}` : 'None waiting'}
              help="No collector assigned and not completed or cancelled (the same rule as the alerts). The number is for this period; the line below counts every date."
              onClick={go(canOpenRequests, requestListUrl(period, { status: 'status:pending', unassigned: '1' }))} />
          )}
          {showQueueKpis && (
            <Kpi testid="kpi-collectors" icon="users" label="Collectors Online" loading={status === 'loading'} failed={status === 'error'}
              value={`${online}/${col.total ?? 0}`} sub={`${col.active ?? 0} on a job · ${col.idle ?? 0} idle`}
              help="Online = location reported in the last 10 minutes (same rule as the Live Map). This is right now, not the selected period."
              onClick={go(canOpenCollectors, '/request-pickup/collectors')} />
          )}
          <Kpi testid="kpi-sla" icon="check-circle" label="SLA Compliance" loading={status === 'loading'} failed={status === 'error'}
            value={slaNow === null ? '—' : `${slaNow}%`} change={ptsChange(slaNow, slaPrev)}
            sub={sla.measured ? `${sla.met} of ${sla.measured} completed requests` : 'No completed requests to measure'}
            help={SLA_HELP} onClick={go(canOpenRequests, requestListUrl(period, { status: 'status:disposed' }))} />
        </div>
      )}

      {/* Requests */}
      {canStats && status !== 'locked' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Panel testid="panel-status" className="lg:col-span-2" title="Pickup Requests by Status"
            help="Every request created in this period, in exactly one group. The groups add up to Total Requests. Click a bar to open those requests."
            action={status === 'ok' && <span className="text-xs text-td-sage" data-testid="status-sum">Total {statusSum}</span>}>
            <div className="h-64">
              {body(statusSum === 0 ? <Empty /> : (
                <Bar key={chartKey} data={statusChart} role="img" aria-label={`Bar chart, requests by status: ${describeValues(statusChart.labels, statusChart.datasets[0].data)}`} options={{ ...axisOpts, indexAxis: 'y', plugins: { legend: { display: false } },
                  scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
                  ...(canOpenRequests ? clickable(i => navigate(requestListUrl(period, rows[i].filter))) : {}) }} />
              ))}
            </div>
          </Panel>
          <Panel testid="panel-source" title="Pickup Requests vs Digital Bins" help="Where this period's requests came from. Click a slice to open them.">
            <div className="h-64">
              {body((req.total || 0) === 0 ? <Empty /> : (
                <Doughnut key={chartKey} data={sourceChart} role="img" aria-label={`Doughnut chart, requests by source: ${describeValues(sourceChart.labels, sourceChart.datasets[0].data)}`} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
                  ...(canOpenRequests ? clickable(i => navigate(requestListUrl(period, { source: i === 0 ? 'pickup_requests' : 'digital_bins' }))) : {}) }} />
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Collectors + waste */}
      {((showQueueKpis && status !== 'locked') || (canBags && canStats && status !== 'locked')) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {showQueueKpis && (
            <Panel testid="panel-collectors" className={canBags ? '' : 'lg:col-span-2'} title="Collectors right now"
              help="Active = online and on a job; Idle = online with no job; On Break = profile status on break; Off Duty = no location in the last 10 minutes."
              action={canOpenCollectors && <button type="button" onClick={() => navigate('/request-pickup/collectors')} className="text-sm text-green-700 hover:underline">Collectors →</button>}>
              {status === 'loading' ? <Skeleton /> : status === 'error' ? <Failed onRetry={retry} /> : (col.total || 0) === 0 ? <Empty text="No collectors yet" /> : (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                    {[['Active', col.active, 'text-green-700 bg-green-50'], ['Idle', col.idle, 'text-amber-700 bg-amber-50'],
                      ['On Break', col.on_break, 'text-blue-700 bg-blue-50'], ['Off Duty', col.off_duty, 'text-gray-600 bg-gray-100']].map(([l, v, c]) => (
                      <div key={l} className={`rounded-md py-2 ${c}`}><div className="text-2xl font-bold">{v ?? 0}</div><div className="text-xs">{l}</div></div>
                    ))}
                  </div>
                  {canOpenRequests ? (
                    <button type="button" onClick={() => navigate(requestListUrl(null, { status: 'status:pending', unassigned: '1' }))}
                      className="w-full text-left text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 mb-3 hover:bg-amber-100" data-testid="unassigned-waiting">
                      <strong>{col.unassigned_waiting ?? 0}</strong> unassigned request{col.unassigned_waiting === 1 ? '' : 's'} waiting (all dates) →
                    </button>
                  ) : (
                    <p className="w-full text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 mb-3" data-testid="unassigned-waiting">
                      <strong>{col.unassigned_waiting ?? 0}</strong> unassigned request{col.unassigned_waiting === 1 ? '' : 's'} waiting (all dates)
                    </p>
                  )}
                  <p className="text-xs font-semibold text-td-sage uppercase tracking-wider mb-1">Completed today</p>
                  {(col.completed_today || []).length === 0 ? <p className="text-sm text-td-sage">No collector online or with completions today</p> : (
                    <ul className="divide-y divide-gray-100 text-sm max-h-40 overflow-y-auto">
                      {col.completed_today.map(c => (
                        <li key={c.id} className="py-1.5 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${c.state === 'active' ? 'bg-green-500' : c.state === 'idle' ? 'bg-amber-500' : 'bg-gray-300'}`} aria-hidden="true" />
                          <span className="truncate">{c.name}</span>
                          <span className="ml-auto font-medium">{c.done}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Panel>
          )}
          {canBags && (
            <Panel testid="panel-waste" className={showQueueKpis ? '' : 'lg:col-span-2'} title="Waste Distribution (bags)"
              help="Bags generated in this period, by the waste type saved on their batch (same types as Generate Bags). Unclassified = batches with no type saved."
              action={status === 'ok' && waste.find(w => w.key === 'Unclassified')?.value > 0 && (
                <span className="text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-0.5" data-testid="unclassified">Unclassified {waste.find(w => w.key === 'Unclassified').value}</span>)}>
              <div className="h-64">
                {body(wasteTotal === 0 ? <Empty /> : (
                  <Doughnut key={chartKey} data={wasteChart} role="img" aria-label={`Doughnut chart, bags by waste type: ${describeValues(wasteChart.labels, wasteChart.datasets[0].data)}`} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } },
                    ...clickable(() => navigate('/bin-management/manage')) }} />
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* Bags + dumping */}
      {canStats && status !== 'locked' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {canBags && (
            <Panel testid="panel-bags" title="Bag Utilization"
              help="Generated = bags in batches created then; Distributed = a household scanned the batch QR; Collected = the pickup using the bag was completed. Same data as Bag Management and Bag History."
              action={<button type="button" onClick={() => navigate('/bin-management/history')} className="text-sm text-green-700 hover:underline">Bag History →</button>}>
              <div className="h-56">
                {body(seriesTotal(bagSeries, 'generated') + seriesTotal(bagSeries, 'distributed') + seriesTotal(bagSeries, 'collected') === 0 ? <Empty /> : (
                  <Line key={chartKey} data={bagChart} role="img" aria-label={`Line chart of bags generated (${seriesTotal(bagSeries, 'generated')}), distributed (${seriesTotal(bagSeries, 'distributed')}) and collected (${seriesTotal(bagSeries, 'collected')}) in this period`} options={{ ...axisOpts, plugins: { legend: { position: 'bottom' } }, ...clickable(() => navigate('/bin-management/history')) }} />
                ))}
              </div>
              {status === 'ok' && bags.all_time && (
                <p className="text-xs text-td-sage mt-3" data-testid="bags-all-time">
                  All time (not archived): {bags.all_time.batches} batches · {bags.all_time.bags} bags · {bags.all_time.distributed} distributed · {bags.all_time.collected} collected
                  <span> — same totals as Bag History</span>
                </p>
              )}
            </Panel>
          )}
          <Panel testid="panel-dumping" className={canBags ? '' : 'lg:col-span-2'} title="Dumping Reports" help="Illegal dumping reports by the date they were submitted (created_at)."
            action={status === 'ok' && <span className="text-xs text-td-sage">Total {data?.dumping_total ?? 0}</span>}>
            <div className="h-56">
              {body((data?.dumping_total || 0) === 0 ? <Empty /> : (
                <Bar key={chartKey} data={dumpingChart} role="img" aria-label={`Bar chart, dumping reports over time: ${describeValues(dumpingChart.labels, dumpingChart.datasets[0].data)}`} options={{ ...axisOpts, plugins: { legend: { display: false } }, ...(canOpenDumping ? clickable(() => navigate('/illegal-dumping/reports')) : {}) }} />
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Alerts + stale requests */}
      {((canAlerts && canStats && status !== 'locked') || canQueue) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {canAlerts && canStats && status !== 'locked' && (
            <Panel testid="panel-alerts" className={canQueue ? '' : 'lg:col-span-2'} title={`Alerts${status === 'ok' && data?.alerts ? ` (${data.alerts.open} open)` : ''}`}
              action={<button type="button" className="text-sm text-green-700 hover:underline" onClick={() => navigate('/request-pickup/alerts')}>View All</button>}>
              {status === 'loading' ? <Skeleton /> : status === 'error' ? <Failed onRetry={retry} /> : alerts.length === 0 ? <Empty text="No open alerts" /> : (
                <ul className="divide-y divide-gray-200">
                  {alerts.map(a => {
                    const sev = severities[a.severity] || severities.low;
                    return (
                      <li key={a.id} className="py-3 flex items-start gap-3" data-testid="alert-row">
                        <div className="rounded-full p-2" style={{ backgroundColor: sev.bg }}><i className={`fas fa-${sev.icon}`} style={{ color: sev.color }} aria-hidden="true"></i></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900">{a.title}</p>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize whitespace-nowrap" style={{ backgroundColor: sev.bg, color: sev.color }}>{a.severity}</span>
                          </div>
                          <p className="text-xs text-td-sage">
                            {a.requestAge && <><strong className="text-gray-700">Request waiting {a.requestAge}</strong> · </>}
                            Alert raised {a.raisedAgo} ago
                          </p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs">
                            {a.isRequest && <button type="button" className="text-green-700 hover:underline" onClick={() => navigate(`/request-pickup/requests?open=${a.entityRef}`)}>Assign collector</button>}
                            {a.isRequest && <button type="button" className="text-green-700 hover:underline" onClick={() => navigate(`/request-pickup/requests?q=${a.entityRef}&open=${a.entityRef}`)}>View request</button>}
                            <button type="button" className="text-gray-600 hover:underline" onClick={() => { setNote(''); setResolving({ alert: a, to: 'resolved' }); }}>Resolve</button>
                            <button type="button" className="text-gray-600 hover:underline" onClick={() => { setNote(''); setResolving({ alert: a, to: 'closed' }); }}>Dismiss</button>
                            <button type="button" className="text-gray-600 hover:underline" onClick={() => navigate(`/request-pickup/alerts?alert=${a.id}`)}>Details</button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}
          {canQueue && (
            <Panel testid="panel-stale" className={canAlerts && canStats && status !== 'locked' ? '' : 'lg:col-span-2'} title={`Stale requests (no collector for ${STALE_DAYS}+ days)`}
              help="Pending with no collector for over 30 days, oldest first. Nothing is closed automatically; cancel each one only after checking it.">
              {staleStatus === 'locked' ? <Locked role={role} what="this list" />
                : staleStatus === 'error' ? <Failed onRetry={retry} text="Couldn’t load this list. Try Refresh." />
                : staleStatus === 'loading' ? <Skeleton className="min-h-[120px]" />
                : stale.length === 0 ? <Empty text="No stale requests" /> : (
                <ul className="divide-y divide-gray-100 text-sm max-h-80 overflow-y-auto" data-testid="stale-list">
                  {stale.map(r => (
                    <li key={`${r.source}-${r.id}`} className="py-2 flex items-center gap-3" data-testid="stale-row">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{r.customer_name || 'Customer'} · <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>{r.source === 'digital_bins' ? ' · bin' : ''}</p>
                        <p className="text-xs text-td-sage truncate">Since {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ({r.days_waiting} days){r.address ? ` · ${r.address}` : ''}</p>
                      </div>
                      {canOpenRequests && <button type="button" onClick={() => navigate(`/request-pickup/requests?q=${r.id}&open=${r.id}`)} className="text-xs text-green-700 hover:underline">View</button>}
                      {canCancel && <button type="button" onClick={() => { setCancelReason(CANCEL_REASONS[0]); setCancelling(r); }} className="text-xs text-red-600 hover:underline">Cancel</button>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      )}

      {cancelling && (
        <ConfirmDialog title={`Cancel request ${cancelling.id.slice(0, 8)}?`} confirmLabel="Cancel request" danger busy={busy}
          onConfirm={runCancel} onClose={() => setCancelling(null)}>
          <p>Waiting {cancelling.days_waiting} days with no collector{cancelling.address ? ` at ${cancelling.address}` : ''}. The customer's request is marked cancelled.</p>
          <label className="block">Reason
            <select value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5">
              {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </ConfirmDialog>
      )}
      {resolving && (
        <ConfirmDialog title={resolving.to === 'resolved' ? 'Resolve alert?' : 'Dismiss alert?'} confirmLabel={resolving.to === 'resolved' ? 'Resolve' : 'Dismiss'}
          busy={busy} confirmDisabled={resolving.to === 'resolved' && !note.trim()} onConfirm={runResolve} onClose={() => setResolving(null)}>
          <p className="font-medium">{resolving.alert.title}</p>
          <label className="block">{resolving.to === 'resolved' ? 'How was it resolved?' : 'Note (optional)'}
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="mt-1 w-full border rounded px-2 py-1.5" />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default Dashboard;
