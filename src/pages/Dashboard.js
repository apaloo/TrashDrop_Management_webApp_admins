import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { fetchDashboard, fetchStaleRequests } from '../services/dashboardAdminService';
import { cancelRequest } from '../services/pickupAdminService';
import { setAlertStatus } from '../services/alertAdminService';
import { CANCEL_REASONS } from '../constants/pickupStatus';
import {
  RANGE_PRESETS, periodFromParams, pctChange, slaPct, ptsChange, SLA_HELP, statusRows, requestListUrl,
  wasteRows, bucketLabel, seriesTotal, normalizeDashboardAlert, durationSince,
} from '../utils/dashboardUtils';
import ConfirmDialog from '../components/pickupRequests/ConfirmDialog';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const NO_DATA = 'No data for this period';
const STALE_DAYS = 30;

const Empty = ({ text = NO_DATA }) => (
  <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-gray-400" data-testid="empty-state">
    <i className="far fa-chart-bar text-3xl mb-2" aria-hidden="true"></i>
    <p className="text-sm">{text}</p>
  </div>
);

const Help = ({ text }) => (
  <span className="relative ml-1 inline-flex items-center text-gray-400 cursor-help group" tabIndex={0} aria-label={text}>
    <i className="fas fa-info-circle" aria-hidden="true"></i>
    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block group-focus:block">{text}</span>
  </span>
);

const Kpi = ({ icon, iconBg, iconColor, label, value, change, sub, help, onClick, loading, testid }) => (
  <button type="button" onClick={onClick} data-testid={testid}
    className="bg-white rounded-lg shadow-sm border-0 p-6 flex items-center text-left hover:shadow-md transition-shadow w-full">
    <div className={`p-3 rounded-full mr-4 ${iconBg}`}><i className={`fas fa-${icon} text-2xl`} style={{ color: iconColor }} aria-hidden="true"></i></div>
    <div className="min-w-0">
      <p className="text-gray-600 text-sm">{label}{help && <Help text={help} />}</p>
      {loading ? <div className="animate-pulse bg-gray-200 h-6 w-20 rounded mt-1"></div> : (
        <div className="flex items-baseline flex-wrap gap-x-2">
          <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
          {change !== undefined && <span className="text-sm text-gray-500" title="Compared with the previous period of the same length">{change}</span>}
        </div>
      )}
      {sub && !loading && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  </button>
);

const Panel = ({ title, help, action, children, className = '', testid }) => (
  <div className={`bg-white rounded-lg shadow-sm border-0 p-6 ${className}`} data-testid={testid}>
    <div className="flex items-center justify-between mb-4 gap-2">
      <h3 className="text-lg font-semibold text-gray-800">{title}{help && <Help text={help} />}</h3>
      {action}
    </div>
    {children}
  </div>
);

const SEVERITY = {
  critical: { icon: 'exclamation-triangle', color: '#dc3545', bg: 'rgba(220, 53, 69, 0.1)' },
  high: { icon: 'exclamation-circle', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)' },
  medium: { icon: 'exclamation-circle', color: '#d97706', bg: 'rgba(255, 193, 7, 0.15)' },
  low: { icon: 'info-circle', color: '#2196F3', bg: 'rgba(33, 150, 243, 0.1)' },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const rangeKey = params.get('range') || '';
  const customFrom = params.get('from') || '';
  const customTo = params.get('to') || '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const period = useMemo(() => periodFromParams(params), [rangeKey, customFrom, customTo]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchDashboard(period)
      .then(d => { if (live) { setData(d); setError(null); setUpdatedAt(new Date()); } })
      .catch(e => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    fetchStaleRequests(STALE_DAYS)
      .then(r => { if (live) { setStale(r); setStaleError(null); } })
      .catch(e => { if (live) { setStale([]); setStaleError(e.message); } });
    return () => { live = false; };
  }, [period, reloadKey]);

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
    datasets: [{ label: 'Requests', data: rows.map(r => r.value), backgroundColor: rows.map(r => r.color), borderWidth: 0 }],
  };
  const sourceChart = {
    labels: ['Pickup requests', 'Digital bins'],
    datasets: [{ data: [Number(bySource.pickup_requests) || 0, Number(bySource.digital_bins) || 0], backgroundColor: ['#2196F3', '#10b981'], borderWidth: 1 }],
  };
  const wasteChart = {
    labels: waste.map(w => w.key),
    datasets: [{ data: waste.map(w => w.value), backgroundColor: waste.map(w => w.color), borderWidth: 1 }],
  };
  const bagChart = {
    labels: bagSeries.map(b => bucketLabel(b.start, bucket)),
    datasets: [
      { label: 'Generated', data: bagSeries.map(b => b.generated), borderColor: '#6B7280', backgroundColor: 'rgba(107, 114, 128, 0.1)', tension: 0.3 },
      { label: 'Distributed', data: bagSeries.map(b => b.distributed), borderColor: '#2196F3', backgroundColor: 'rgba(33, 150, 243, 0.1)', tension: 0.3 },
      { label: 'Collected', data: bagSeries.map(b => b.collected), borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)', tension: 0.3 },
    ],
  };
  const dumpingChart = {
    labels: dumping.map(d => bucketLabel(d.start, bucket)),
    datasets: [{ label: 'Reports', data: dumping.map(d => d.reports), backgroundColor: '#FF5722', borderColor: '#E64A19', borderWidth: 1 }],
  };
  const axisOpts = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };

  const totalLink = requestListUrl(period);

  return (
    <div className="p-4">
      {toast && <div role="status" className={`fixed bottom-4 right-4 z-[60] px-4 py-2 rounded shadow-lg text-white ${toast.kind === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>{toast.text}</div>}

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-600">Welcome to TrashDrop Management Portal</p>
        </div>
        <div className="flex flex-wrap items-end gap-2" data-testid="range-picker">
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden bg-white" role="group" aria-label="Period">
            {RANGE_PRESETS.map(p => (
              <button key={p.key} type="button" aria-pressed={period.key === p.key}
                onClick={() => setRange(p.key, period.fromDay, period.toDay)}
                className={`px-3 py-1.5 text-sm ${period.key === p.key ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>{p.label}</button>
            ))}
          </div>
          {period.key === 'custom' && (
            <>
              <input type="date" aria-label="From" value={period.fromDay} max={period.toDay} onChange={e => setRange('custom', e.target.value, period.toDay)} className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
              <input type="date" aria-label="To" value={period.toDay} min={period.fromDay} onChange={e => setRange('custom', period.fromDay, e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
            </>
          )}
          <span className="text-xs text-gray-500 self-center" data-testid="last-updated">
            Last updated {updatedAt ? updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          </span>
          <button type="button" onClick={() => setReloadKey(k => k + 1)} disabled={loading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">
            <i className={`fas fa-sync-alt mr-1 ${loading ? 'animate-spin' : ''}`} aria-hidden="true"></i>Refresh
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-4 mb-4">
        Showing {period.fromDay} to {period.toDay}; changes compare with the {Math.round((period.to - period.from) / 864e5) || 1} days before.
      </p>

      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi testid="kpi-total" icon="truck-loading" iconBg="bg-green-100" iconColor="#4CAF50" label="Total Requests" loading={loading && !data}
          value={req.total ?? 0} change={pctChange(req.total, req.prev_total)}
          sub="Pickup requests + digital bins" help="Requests created in this period (pickup requests and digital bins)."
          onClick={() => navigate(totalLink)} />
        <Kpi testid="kpi-pending" icon="clock" iconBg="bg-yellow-100" iconColor="#FFC107" label="Pending Requests" loading={loading && !data}
          value={req.pending ?? 0} change={pctChange(req.pending, req.prev_pending)}
          sub={req.pending_all_dates ? `${req.pending_all_dates} waiting in total${req.oldest_pending_at ? `, oldest ${durationSince(req.oldest_pending_at)}` : ''}` : 'None waiting'}
          help="No collector assigned and not completed or cancelled (the same rule as the alerts). The number is for this period; the line below counts every date."
          onClick={() => navigate(requestListUrl(period, { status: 'status:pending', unassigned: '1' }))} />
        <Kpi testid="kpi-collectors" icon="users" iconBg="bg-blue-100" iconColor="#2196F3" label="Collectors Online" loading={loading && !data}
          value={`${online}/${col.total ?? 0}`} sub={`${col.active ?? 0} on a job · ${col.idle ?? 0} idle`}
          help="Online = location reported in the last 10 minutes (same rule as the Live Map). This is right now, not the selected period."
          onClick={() => navigate('/request-pickup/collectors')} />
        <Kpi testid="kpi-sla" icon="check-circle" iconBg="bg-purple-100" iconColor="#9C27B0" label="SLA Compliance" loading={loading && !data}
          value={slaNow === null ? '—' : `${slaNow}%`} change={ptsChange(slaNow, slaPrev)}
          sub={sla.measured ? `${sla.met} of ${sla.measured} completed requests` : 'No completed requests to measure'}
          help={SLA_HELP} onClick={() => navigate(requestListUrl(period, { status: 'status:disposed' }))} />
      </div>

      {/* Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Panel testid="panel-status" className="lg:col-span-2" title="Pickup Requests by Status"
          help="Every request created in this period, in exactly one group. The groups add up to Total Requests. Click a bar to open those requests."
          action={<span className="text-xs text-gray-500" data-testid="status-sum">Total {statusSum}</span>}>
          <div className="h-64">
            {statusSum === 0 ? <Empty /> : (
              <Bar data={statusChart} options={{ ...axisOpts, indexAxis: 'y', plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
                ...clickable(i => navigate(requestListUrl(period, rows[i].filter))) }} />
            )}
          </div>
        </Panel>
        <Panel testid="panel-source" title="Pickup Requests vs Digital Bins" help="Where this period's requests came from. Click a slice to open them.">
          <div className="h-64">
            {(req.total || 0) === 0 ? <Empty /> : (
              <Doughnut data={sourceChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
                ...clickable(i => navigate(requestListUrl(period, { source: i === 0 ? 'pickup_requests' : 'digital_bins' }))) }} />
            )}
          </div>
        </Panel>
      </div>

      {/* Collectors + waste */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Panel testid="panel-collectors" title="Collectors right now"
          help="Active = online and on a job; Idle = online with no job; On Break = profile status on break; Off Duty = no location in the last 10 minutes."
          action={<button type="button" onClick={() => navigate('/request-pickup/collectors')} className="text-sm text-green-700 hover:underline">Collectors →</button>}>
          {(col.total || 0) === 0 ? <Empty text="No collectors yet" /> : (
            <>
              <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                {[['Active', col.active, 'text-green-700 bg-green-50'], ['Idle', col.idle, 'text-amber-700 bg-amber-50'],
                  ['On Break', col.on_break, 'text-blue-700 bg-blue-50'], ['Off Duty', col.off_duty, 'text-gray-600 bg-gray-100']].map(([l, v, c]) => (
                  <div key={l} className={`rounded-md py-2 ${c}`}><div className="text-2xl font-bold">{v ?? 0}</div><div className="text-xs">{l}</div></div>
                ))}
              </div>
              <button type="button" onClick={() => navigate(requestListUrl(null, { status: 'status:pending', unassigned: '1' }))}
                className="w-full text-left text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 mb-3 hover:bg-amber-100" data-testid="unassigned-waiting">
                <strong>{col.unassigned_waiting ?? 0}</strong> unassigned request{col.unassigned_waiting === 1 ? '' : 's'} waiting (all dates) →
              </button>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Completed today</p>
              {(col.completed_today || []).length === 0 ? <p className="text-sm text-gray-400">No collector online or with completions today</p> : (
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
        <Panel testid="panel-waste" title="Waste Distribution (bags)"
          help="Bags generated in this period, by the waste type saved on their batch (same types as Generate Bags). Unclassified = batches with no type saved."
          action={waste.find(w => w.key === 'Unclassified')?.value > 0 && (
            <span className="text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-0.5" data-testid="unclassified">Unclassified {waste.find(w => w.key === 'Unclassified').value}</span>)}>
          <div className="h-64">
            {wasteTotal === 0 ? <Empty /> : (
              <Doughnut data={wasteChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } },
                ...clickable(() => navigate('/bin-management/manage')) }} />
            )}
          </div>
        </Panel>
      </div>

      {/* Bags + dumping */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Panel testid="panel-bags" title="Bag Utilization"
          help="Generated = bags in batches created then; Distributed = a household scanned the batch QR; Collected = the pickup using the bag was completed. Same data as Bag Management and Bag History."
          action={<button type="button" onClick={() => navigate('/bin-management/history')} className="text-sm text-green-700 hover:underline">Bag History →</button>}>
          <div className="h-56">
            {seriesTotal(bagSeries, 'generated') + seriesTotal(bagSeries, 'distributed') + seriesTotal(bagSeries, 'collected') === 0 ? <Empty /> : (
              <Line data={bagChart} options={{ ...axisOpts, plugins: { legend: { position: 'bottom' } }, ...clickable(() => navigate('/bin-management/history')) }} />
            )}
          </div>
          {bags.all_time && (
            <p className="text-xs text-gray-500 mt-3" data-testid="bags-all-time">
              All time (not archived): {bags.all_time.batches} batches · {bags.all_time.bags} bags · {bags.all_time.distributed} distributed · {bags.all_time.collected} collected
              <span className="text-gray-400"> — same totals as Bag History</span>
            </p>
          )}
        </Panel>
        <Panel testid="panel-dumping" title="Dumping Reports" help="Illegal dumping reports by the date they were submitted (created_at)."
          action={<span className="text-xs text-gray-500">Total {data?.dumping_total ?? 0}</span>}>
          <div className="h-56">
            {(data?.dumping_total || 0) === 0 ? <Empty /> : (
              <Bar data={dumpingChart} options={{ ...axisOpts, plugins: { legend: { display: false } }, ...clickable(() => navigate('/illegal-dumping/reports')) }} />
            )}
          </div>
        </Panel>
      </div>

      {/* Alerts + stale requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel testid="panel-alerts" title={`Alerts${data?.alerts ? ` (${data.alerts.open} open)` : ''}`}
          action={<button type="button" className="text-sm text-green-700 hover:underline" onClick={() => navigate('/request-pickup/alerts')}>View All</button>}>
          {alerts.length === 0 ? <Empty text="No open alerts" /> : (
            <ul className="divide-y divide-gray-200">
              {alerts.map(a => {
                const s = SEVERITY[a.severity] || SEVERITY.low;
                return (
                  <li key={a.id} className="py-3 flex items-start gap-3" data-testid="alert-row">
                    <div className="rounded-full p-2" style={{ backgroundColor: s.bg }}><i className={`fas fa-${s.icon}`} style={{ color: s.color }} aria-hidden="true"></i></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{a.title}</p>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize whitespace-nowrap" style={{ backgroundColor: s.bg, color: s.color }}>{a.severity}</span>
                      </div>
                      <p className="text-xs text-gray-500">
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
        <Panel testid="panel-stale" title={`Stale requests (no collector for ${STALE_DAYS}+ days)`}
          help="Pending with no collector for over 30 days, oldest first. Nothing is closed automatically; cancel each one only after checking it.">
          {staleError ? <p className="text-sm text-red-600">{staleError}</p> : stale === null ? <p className="text-sm text-gray-400">Loading…</p> : stale.length === 0 ? (
            <Empty text="No stale requests" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm max-h-80 overflow-y-auto" data-testid="stale-list">
              {stale.map(r => (
                <li key={`${r.source}-${r.id}`} className="py-2 flex items-center gap-3" data-testid="stale-row">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{r.customer_name || 'Customer'} · <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>{r.source === 'digital_bins' ? ' · bin' : ''}</p>
                    <p className="text-xs text-gray-500 truncate">Since {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ({r.days_waiting} days){r.address ? ` · ${r.address}` : ''}</p>
                  </div>
                  <button type="button" onClick={() => navigate(`/request-pickup/requests?q=${r.id}&open=${r.id}`)} className="text-xs text-green-700 hover:underline">View</button>
                  <button type="button" onClick={() => { setCancelReason(CANCEL_REASONS[0]); setCancelling(r); }} className="text-xs text-red-600 hover:underline">Cancel</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

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
