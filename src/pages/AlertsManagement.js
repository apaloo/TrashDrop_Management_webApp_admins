import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchAlerts, fetchActivity, fetchStaff, setAlertStatus, bulkSetStatus, assignAlert, createAlert, addComment,
  logAlertAction, sendNotification, setRequestLocation, subscribeToAlerts,
} from '../services/alertAdminService';
import {
  fetchSummaryRows, fetchRequestPage, assignCollector, setCollectorOnActiveRequest, changeStatus, cancelRequest,
} from '../services/pickupAdminService';
import { fetchCollectorsAdmin } from '../utils/collectorService';
import { fetchServiceZones } from '../services/serviceZoneService';
import { withCollectorPosition } from '../utils/liveMapUtils';
import { collectorJobCounts, DEFAULT_FILTERS as REQUEST_DEFAULT_FILTERS, shortId } from '../utils/pickupRequestUtils';
import { withCollectorStats } from '../utils/collectorAdminUtils';
import {
  DEFAULT_ALERT_FILTERS, filterAlerts, sortAlerts, alertStats, relatedRecord,
} from '../utils/alertUtils';
import { STATUS_ACTIONS, isOpenAlert, ALERT_STATUSES } from '../constants/alerts';
import { card, muted, border } from '../components/pickupRequests/theme';
import AlertStats from '../components/alerts/AlertStats';
import AlertsFilter from '../components/alerts/AlertsFilter';
import AlertsTable from '../components/alerts/AlertsTable';
import AlertExport from '../components/alerts/AlertExport';
import AlertDetailsModal from '../components/alerts/AlertDetailsModal';
import CreateAlertModal from '../components/alerts/CreateAlertModal';
import StatusChangeDialog from '../components/alerts/StatusChangeDialog';
import AlertRulesPanel from '../components/alerts/AlertRulesPanel';
import {
  AssignCollectorDialog, ContactCollectorDialog, NotifyCustomerDialog, FixLocationDialog, MergeDuplicatesDialog,
} from '../components/alerts/AlertActionDialogs';
import { ACTIONS } from '../components/alerts/alertActions';
import RequestDetailsModal from '../components/pickupRequests/RequestDetailsModal';
import CollectorDetailsModal from '../components/collectors/CollectorDetailsModal';

const SkeletonBlock = ({ className }) => <div className={`animate-pulse rounded bg-gray-300 opacity-40 ${className}`} />;

const readFilters = (params) => {
  const f = { ...DEFAULT_ALERT_FILTERS };
  Object.keys(f).forEach(k => { if (params.get(k) !== null) f[k] = params.get(k); });
  return f;
};

const AlertsManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const [searchText, setSearchText] = useState(filters.q);
  const [sort, setSort] = useState({ key: 'priority', dir: 'desc' });

  const [alerts, setAlerts] = useState([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [staff, setStaff] = useState([]);
  const [rawCollectors, setRawCollectors] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [zones, setZones] = useState([]);

  const [selected, setSelected] = useState(() => new Set());
  const [detailId, setDetailId] = useState(() => params.get('alert'));
  const [activity, setActivity] = useState([]);
  const [dialog, setDialog] = useState(null);   // { type, ... } for confirmations and actions
  const [related, setRelated] = useState(null); // { kind: 'request', row } | { kind: 'collector', id }
  const [showRules, setShowRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, tone = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ── URL-backed filters ─────────────────────────────────────────────── */
  const setFilters = useCallback((patch) => {
    const next = { ...filters, ...patch };
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v !== '' && v != null && String(v) !== String(DEFAULT_ALERT_FILTERS[k])) sp.set(k, String(v)); });
    setParams(sp, { replace: true });
  }, [filters, setParams]);
  useEffect(() => { setSearchText(filters.q); }, [filters.q]);
  useEffect(() => {
    if (searchText === filters.q) return undefined;
    const t = setTimeout(() => setFilters({ q: searchText }), 250);
    return () => clearTimeout(t);
  }, [searchText, filters.q, setFilters]);

  /* ── data ───────────────────────────────────────────────────────────── */
  const loadAlerts = useCallback(async () => {
    try {
      const result = await fetchAlerts();
      setAlerts(result.alerts);
      setNeedsMigration(result.needsMigration);
      setLoadError(null);
    } catch (error) {
      setLoadError(error.message);
    }
  }, []);

  const loadRequests = useCallback(async (list) => {
    try { setSummaryRows(await fetchSummaryRows(list)); } catch (error) { console.error('Alerts: requests failed to load', error); }
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const [, staffResult, collectorList, zoneResult] = await Promise.all([
        loadAlerts(),
        fetchStaff().catch(() => ({ staff: [] })),
        fetchCollectorsAdmin().catch(() => []),
        fetchServiceZones().catch(() => ({ zones: [] })),
      ]);
      if (!live) return;
      setStaff(staffResult.staff);
      setRawCollectors(collectorList);
      setZones(zoneResult.zones);
      setLoading(false);
      loadRequests(collectorList);
    })();
    return () => { live = false; };
  }, [loadAlerts, loadRequests]);

  // Live updates (new rule alerts, other admins' changes)
  const reloadTimer = useRef(null);
  useEffect(() => subscribeToAlerts(() => {
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(loadAlerts, 800);
  }), [loadAlerts]);

  const loadActivity = useCallback(async (id) => {
    try { setActivity(await fetchActivity(id)); } catch (error) { notify(error.message, 'error'); }
  }, [notify]);
  useEffect(() => { if (detailId) loadActivity(detailId); }, [detailId, loadActivity, alerts]);

  /* ── derived ────────────────────────────────────────────────────────── */
  const jobCounts = useMemo(() => collectorJobCounts(summaryRows), [summaryRows]);
  const collectors = useMemo(() => rawCollectors.map(c => withCollectorStats(withCollectorPosition(c), jobCounts)), [rawCollectors, jobCounts]);
  const ctx = useMemo(() => ({ requests: summaryRows, collectors }), [summaryRows, collectors]);
  const staffName = useCallback((id) => staff.find(u => u.id === id)?.name || 'Admin', [staff]);
  const stats = useMemo(() => alertStats(alerts), [alerts]);
  const visible = useMemo(() => sortAlerts(filterAlerts(alerts, filters, ctx), sort), [alerts, filters, ctx, sort]);
  const autoResolved = useMemo(() => alerts.filter(a => a.autoResolved).length, [alerts]);
  const detail = detailId ? alerts.find(a => a.id === detailId) : null;
  const detailRel = detail ? relatedRecord(detail, ctx) : null;
  const canEdit = !needsMigration;
  const selectedAlerts = alerts.filter(a => selected.has(a.id));

  const replaceAlert = (saved) => setAlerts(prev => prev.map(a => (a.id === saved.id ? saved : a)));

  /* ── status, assignment, comments ───────────────────────────────────── */
  const changeAlertStatus = async (alert, to, note) => {
    setBusy(true);
    try {
      replaceAlert(await setAlertStatus(alert, to, { note, userId: user?.id }));
      setDialog(null);
      notify(`Alert ${ALERT_STATUSES.find(s => s.key === to)?.label.toLowerCase()}`);
      if (detailId === alert.id) loadActivity(alert.id);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async (to, note) => {
    const eligible = selectedAlerts.filter(a => (STATUS_ACTIONS[a.status] || []).includes(to));
    const skipped = selectedAlerts.length - eligible.length;
    setBusy(true);
    const { ok, failed } = await bulkSetStatus(eligible, to, { note, userId: user?.id });
    setBusy(false);
    setDialog(null);
    setSelected(new Set());
    await loadAlerts();
    const parts = [`${ok} alert${ok === 1 ? '' : 's'} updated`];
    if (skipped) parts.push(`${skipped} skipped (already in that state)`);
    if (failed.length) parts.push(`${failed.length} failed: ${failed[0].message}`);
    notify(parts.join('; '), failed.length ? 'error' : 'ok');
  };

  const assignTo = async (alert, userId) => {
    setBusy(true);
    try {
      replaceAlert(await assignAlert(alert, userId));
      notify(userId ? `Assigned to ${staffName(userId)}; they've been notified` : 'Unassigned');
      loadActivity(alert.id);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const comment = async (text) => {
    try {
      await addComment(detail, text);
      await loadActivity(detail.id);
      return true;
    } catch (error) {
      notify(error.message, 'error');
      return false;
    }
  };

  const create = async (form) => {
    setBusy(true);
    setFormError(null);
    try {
      const saved = await createAlert(form, user?.id);
      setAlerts(prev => [saved, ...prev]);
      setDialog(null);
      notify('Alert created');
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };

  /* ── related records ────────────────────────────────────────────────── */
  const openRequest = async (id) => {
    try {
      const page = await fetchRequestPage({ ...REQUEST_DEFAULT_FILTERS, q: String(id) }, rawCollectors, { force: true });
      const row = page.rows.find(r => String(r.id) === String(id)) || summaryRows.find(r => String(r.id) === String(id));
      if (!row) throw new Error('Request not found');
      setRelated({ kind: 'request', row });
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const moreInfo = (alert, rel) => {
    if (!rel) return;
    if (rel.kind === 'pickup_request') openRequest(alert.entity.ref);
    else if (rel.kind === 'collector') {
      if (rel.record) setRelated({ kind: 'collector', id: rel.record.id });
      else notify('Collector not found', 'error');
    } else navigate(`/request-pickup/collectors?zone=${encodeURIComponent(alert.entity.ref)}`);
  };

  const refreshRequests = () => loadRequests(rawCollectors);

  /* ── actions ────────────────────────────────────────────────────────── */
  const resolveAfterFix = async (alert, note) => {
    if (!isOpenAlert(alert.status)) return;
    try { replaceAlert(await setAlertStatus(alert, 'resolved', { note, userId: user?.id })); } catch (error) { /* the rule resolves it on its next run */ }
  };

  /** Run an action, log it on the alert (and Logs page), show the outcome */
  const perform = async (alert, action, fn, { successMessage, resolveNote } = {}) => {
    setBusy(true);
    try {
      const note = await fn();
      await logAlertAction(alert, action, { ok: true, note: note || successMessage });
      if (resolveNote) await resolveAfterFix(alert, resolveNote);
      setDialog(null);
      notify(successMessage);
      refreshRequests();
    } catch (error) {
      await logAlertAction(alert, action, { ok: false, note: error.message });
      notify(`${ACTIONS[action].label} failed: ${error.message}`, 'error');
    } finally {
      setBusy(false);
      loadActivity(alert.id);
    }
  };

  const startAction = (alert, rel, action) => {
    const row = rel?.kind === 'pickup_request' ? rel.record : null;
    const collector = rel?.kind === 'collector' ? rel.record : (row?.collectorProfileId ? collectors.find(c => c.id === row.collectorProfileId) : null);
    switch (action) {
      case 'open_request': logAlertAction(alert, action, { note: `#${shortId(alert.entity.ref)}` }); openRequest(alert.entity.ref); break;
      case 'open_collector': if (collector) { logAlertAction(alert, action, { note: collector.name }); setRelated({ kind: 'collector', id: collector.id }); } break;
      case 'edit_collector': logAlertAction(alert, action, { note: 'Opened on the Collectors page' }); navigate(`/request-pickup/collectors?q=${encodeURIComponent(alert.entity.ref)}`); break;
      case 'open_zone': logAlertAction(alert, action, { note: alert.entity.ref }); navigate(`/request-pickup/collectors?zone=${encodeURIComponent(alert.entity.ref)}`); break;
      default:
        if (['assign_collector', 'fix_location', 'merge_duplicates', 'notify_customer'].includes(action) && !row) {
          notify('The request is not in the current data', 'error');
          return;
        }
        if (action === 'contact_collector' && !collector) { notify('Collector not found', 'error'); return; }
        setDialog({ type: action, alert, row, collector });
    }
  };

  const confirmAction = (payload) => {
    const { type, alert, row, collector } = dialog;
    if (type === 'assign_collector') {
      return perform(alert, type, async () => {
        await setCollectorOnActiveRequest(row, payload); // pending → normal assignment; under way → just sets the collector
        return `Assigned #${shortId(row.id)} to ${payload.name}`;
      }, { successMessage: `Assigned to ${payload.name}; they've been notified`, resolveNote: `Fixed: collector ${payload.name} assigned` });
    }
    if (type === 'contact_collector') {
      return perform(alert, type, async () => {
        await sendNotification(collector.userId, { title: 'Message from TrashDrop', message: payload, type: 'admin_message' });
        return `App message to ${collector.name}: ${payload}`;
      }, { successMessage: `Message sent to ${collector.name}` });
    }
    if (type === 'notify_customer') {
      return perform(alert, type, async () => {
        await sendNotification(row.customer.id, { title: 'Update on your pickup', message: payload, type: 'pickup_update' });
        return `Customer notified: ${payload}`;
      }, { successMessage: 'Customer notified' });
    }
    if (type === 'fix_location') {
      return perform(alert, type, async () => {
        await setRequestLocation(row.source, row.id, payload.lat, payload.lng);
        return `Location set to ${payload.lat}, ${payload.lng}${payload.address ? ` (${payload.address})` : ''}`;
      }, { successMessage: 'Location saved', resolveNote: 'Fixed: location corrected' });
    }
    if (type === 'merge_duplicates') {
      const other = alert.metadata.duplicate_of;
      return perform(alert, type, async () => {
        await cancelRequest(row, { reason: 'Duplicate request', note: `Duplicate of #${shortId(other)}`, userId: user?.id });
        return `Cancelled #${shortId(row.id)} as a duplicate of #${shortId(other)}`;
      }, { successMessage: `#${shortId(row.id)} cancelled as a duplicate`, resolveNote: 'Fixed: duplicate cancelled' });
    }
    return null;
  };

  /* ── selection ──────────────────────────────────────────────────────── */
  const toggle = (id) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = (on) => setSelected(on ? new Set(visible.map(a => a.id)) : new Set());
  const onSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  const filtered = Object.keys(DEFAULT_ALERT_FILTERS).some(k => filters[k] !== DEFAULT_ALERT_FILTERS[k]);
  const relatedCollector = related?.kind === 'collector' ? collectors.find(c => c.id === related.id) : null;

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 space-y-4" style={{ color: 'var(--td-text-primary)' }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Alerts</h1>
          <p className="text-sm" style={muted}>Problems found automatically every 5 minutes, plus alerts raised by the team</p>
        </div>
        <button type="button" onClick={() => setShowRules(v => !v)} aria-expanded={showRules} className="px-3 py-2 rounded border text-sm" style={border}>
          <i className="fas fa-sliders-h mr-1.5" aria-hidden="true"></i>Alert rules
        </button>
        <button type="button" onClick={() => { setFormError(null); setDialog({ type: 'create' }); }} disabled={!canEdit}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-40">
          <i className="fas fa-plus mr-1.5" aria-hidden="true"></i>Create alert
        </button>
      </div>

      {needsMigration && (
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm" role="status">
          The alerts table has no status column yet, so every alert shows as Open and can't be changed.
          Run <span className="font-mono">supabase/migrations/20261017_alerts_rules.sql</span> to turn on statuses, the activity log and automatic rules.
        </div>
      )}
      {loadError && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm flex gap-3" role="alert">
          <span>Couldn't load alerts: {loadError}</span><button type="button" className="ml-auto underline" onClick={loadAlerts}>Try again</button>
        </div>
      )}

      {showRules && <AlertRulesPanel userId={user?.id} onToast={notify} onRan={loadAlerts} />}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><SkeletonBlock className="h-52 lg:col-span-2" /><SkeletonBlock className="h-52" /></div>
      ) : (
        <AlertStats stats={stats} filters={filters} setFilters={setFilters} autoResolved={autoResolved} />
      )}

      <AlertsFilter filters={filters} setFilters={setFilters} searchText={searchText} setSearchText={setSearchText} staff={staff} />

      <div className="rounded-xl border p-4" style={card}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="font-semibold">{filtered ? 'Filtered alerts' : 'All alerts'}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{visible.length} of {alerts.length}</span>
          {selected.size > 0 && canEdit && (
            <div className="flex flex-wrap items-center gap-2 ml-0 sm:ml-3" data-testid="bulk-bar">
              <span className="text-sm" style={muted}>{selected.size} selected:</span>
              {['acknowledged', 'resolved', 'closed'].map(to => (
                <button key={to} type="button" onClick={() => setDialog({ type: 'bulk', to })} className="px-2.5 py-1 rounded border text-sm" style={border}>
                  {{ acknowledged: 'Acknowledge', resolved: 'Resolve', closed: 'Close' }[to]}
                </button>
              ))}
              <button type="button" className="text-sm underline" style={muted} onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
          <div className="ml-auto">
            <AlertExport alerts={visible} ctx={ctx} staffName={staffName} onDone={notify}
              summary={`${visible.length} alerts${filtered ? ' (filtered)' : ''}`} />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-10" />)}</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-10" data-testid="empty-state">
            <i className="fas fa-bell-slash text-2xl mb-2" style={muted} aria-hidden="true"></i>
            <p className="font-medium">No alerts found</p>
            <p className="text-sm" style={muted}>{filtered || searchText ? 'Try other filters.' : 'Nothing needs attention right now.'}</p>
          </div>
        ) : (
          <AlertsTable alerts={visible} ctx={ctx} staffName={staffName} selected={selected} onToggle={toggle} onToggleAll={toggleAll}
            onOpen={(a) => { setActivity([]); setDetailId(a.id); }} sort={sort} onSort={onSort} />
        )}
      </div>

      {/* Details */}
      {detail && !related && (
        <AlertDetailsModal alert={detail} rel={detailRel} staff={staff} staffName={staffName} activity={activity} busy={busy} canEdit={canEdit}
          onStatus={(to) => setDialog({ type: 'status', to, alert: detail })}
          onAssign={(uid) => assignTo(detail, uid)} onComment={comment}
          onAction={(key) => startAction(detail, detailRel, key)} onMoreInfo={() => moreInfo(detail, detailRel)}
          onClose={() => { if (!busy) setDetailId(null); }} />
      )}

      {/* Related records (opened from an alert) */}
      {related?.kind === 'request' && (
        <RequestDetailsModal row={related.row} address={related.row.address} collectors={collectors} duplicates={[]} outsideServiceArea={false} busy={busy}
          onAssign={async (row, c) => { setBusy(true); try { await assignCollector(row, c); notify(`Assigned to ${c.name}`); setRelated(null); refreshRequests(); } catch (e) { notify(e.message, 'error'); } finally { setBusy(false); } }}
          onStatus={async (row, to) => { setBusy(true); try { await changeStatus(row, to); notify('Status updated'); setRelated(null); refreshRequests(); } catch (e) { notify(e.message, 'error'); } finally { setBusy(false); } }}
          onCancel={(rows) => navigate(`/request-pickup/requests?q=${encodeURIComponent(rows[0].id)}`)}
          onCancelAsDuplicate={() => {}} onOpenRequest={(d) => openRequest(d.id)}
          onCopy={(id) => navigator.clipboard?.writeText(id).then(() => notify('Request ID copied')).catch(() => {})}
          onClose={() => setRelated(null)} />
      )}
      {related?.kind === 'collector' && relatedCollector && (
        <CollectorDetailsModal collector={relatedCollector} requests={summaryRows} onClose={() => setRelated(null)}
          onCopy={(id) => navigator.clipboard?.writeText(id).then(() => notify('Collector ID copied')).catch(() => {})} />
      )}

      {/* Dialogs */}
      {dialog?.type === 'create' && (
        <CreateAlertModal requests={summaryRows} collectors={collectors} zones={zones} staff={staff} busy={busy} error={formError}
          onCreate={create} onClose={() => !busy && setDialog(null)} />
      )}
      {dialog?.type === 'status' && (
        <StatusChangeDialog to={dialog.to} busy={busy} onConfirm={(note) => changeAlertStatus(dialog.alert, dialog.to, note)} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'bulk' && (
        <StatusChangeDialog to={dialog.to} count={selected.size} busy={busy} onConfirm={(note) => runBulk(dialog.to, note)} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'assign_collector' && (
        <AssignCollectorDialog request={dialog.row} collectors={collectors} busy={busy} onConfirm={confirmAction} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'contact_collector' && (
        <ContactCollectorDialog collector={dialog.collector} busy={busy} onConfirm={confirmAction} onClose={() => setDialog(null)}
          context={dialog.row ? `pickup #${shortId(dialog.row.id)}` : null} />
      )}
      {dialog?.type === 'notify_customer' && (
        <NotifyCustomerDialog request={dialog.row} busy={busy} onConfirm={confirmAction} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'fix_location' && (
        <FixLocationDialog request={{ ...dialog.row, rawLat: dialog.alert.metadata.lat ?? null, rawLng: dialog.alert.metadata.lng ?? null }}
          problem={dialog.alert.metadata.problem} busy={busy} onConfirm={confirmAction} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'merge_duplicates' && (
        <MergeDuplicatesDialog request={dialog.row} otherId={dialog.alert.metadata.duplicate_of} busy={busy} onConfirm={confirmAction} onClose={() => setDialog(null)} />
      )}

      {toast && (
        <div className={`fixed top-20 right-4 z-[4000] max-w-md rounded-lg shadow-xl px-4 py-3 text-sm text-white ${toast.tone === 'error' ? 'bg-red-700' : 'bg-gray-800'}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default AlertsManagement;
