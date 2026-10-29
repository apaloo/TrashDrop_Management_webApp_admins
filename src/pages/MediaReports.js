import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMediaReports, logMediaExport, toCsv, summarise, daysToClean, MEDIA_ROW_LIMIT } from '../services/mediaService';
import { GHANA_REGIONS, districtsOf } from '../constants/ghanaRegions';

const STATUSES = [
  ['', 'All statuses'], ['pending', 'Waiting for checks'], ['verified', 'Verified'],
  ['in_progress', 'Cleanup under way'], ['completed', 'Cleaned'], ['disposed', 'Cleaned and disposed'], ['cancelled', 'Cancelled'],
];
const STATUS_LABEL = Object.fromEntries(STATUSES.filter(([k]) => k));
const SHOWN_ROWS = 200;

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const date = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const title = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1).replace(/_/g, ' ') : '—');

const Kpi = ({ label, value, sub, testId }) => (
  <div className="bg-white rounded-xl shadow p-4" data-testid={testId}>
    <p className="text-xs uppercase text-td-sage">{label}</p>
    <p className="text-2xl font-semibold text-td-ink mt-1">{value}</p>
    {sub && <p className="text-xs text-td-sage mt-1">{sub}</p>}
  </div>
);

/** National report data for journalists: read-only, no reporter details, CSV download */
const MediaReports = () => {
  const [filters, setFilters] = useState({ from: daysAgo(90), to: iso(new Date()), region: '', district: '', status: '' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    setRows(null);
    fetchMediaReports(filters)
      .then(r => { setRows(r); setError(null); })
      .catch(e => { setRows([]); setError(e.message); });
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const set = (patch) => setFilters(f => ({ ...f, ...patch }));
  const stats = useMemo(() => summarise(rows || []), [rows]);

  const download = async () => {
    const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trashdrop-dumping-reports-${filters.from || 'all'}-to-${filters.to || 'now'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    try {
      await logMediaExport(filters, rows.length);
    } catch (e) {
      console.warn('Download not recorded in Logs:', e.message);
    }
    setToast(`Downloaded ${rows.length} reports`);
    setTimeout(() => setToast(null), 3000);
  };

  const inputCls = 'border border-td-border-strong rounded-lg px-3 py-2 text-sm bg-white';

  return (
    <div className="p-4">
      {toast && <div role="status" className="fixed bottom-4 right-4 z-[60] px-4 py-2 rounded shadow-lg text-white bg-gray-800">{toast}</div>}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="mr-auto">
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Illegal dumping: reports data</h1>
          <p className="text-sm text-td-sage">Reports across Ghana, read-only. Nothing that identifies the people who reported them is included.</p>
        </div>
        <button type="button" onClick={download} disabled={!rows || rows.length === 0}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50" data-testid="media-download">
          <i className="fas fa-download mr-2" aria-hidden="true"></i>Download CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="media-filters">
        <label className="text-xs text-td-sage">From
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={e => set({ from: e.target.value })} className={`${inputCls} w-full mt-1`} />
        </label>
        <label className="text-xs text-td-sage">To
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={e => set({ to: e.target.value })} className={`${inputCls} w-full mt-1`} />
        </label>
        <label className="text-xs text-td-sage">Region
          <select value={filters.region} onChange={e => set({ region: e.target.value, district: '' })} className={`${inputCls} w-full mt-1`} aria-label="Region">
            <option value="">All of Ghana</option>
            {GHANA_REGIONS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-td-sage">District
          <select value={filters.district} disabled={!filters.region} onChange={e => set({ district: e.target.value })} className={`${inputCls} w-full mt-1`} aria-label="District">
            <option value="">{filters.region ? 'All districts' : 'Choose a region first'}</option>
            {districtsOf(filters.region).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-xs text-td-sage">Status
          <select value={filters.status} onChange={e => set({ status: e.target.value })} className={`${inputCls} w-full mt-1`} aria-label="Status">
            {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {rows === null ? (
        <p className="py-10 text-center text-td-sage">Loading reports…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi label="Reports" value={stats.total} sub={rows.length >= MEDIA_ROW_LIMIT ? `First ${MEDIA_ROW_LIMIT}; narrow the dates for more` : null} testId="media-kpi-total" />
            <Kpi label="Still open" value={stats.open} testId="media-kpi-open" />
            <Kpi label="Cleaned up" value={stats.cleaned} sub={stats.byVolunteers ? `${stats.byVolunteers} by volunteer groups` : null} testId="media-kpi-cleaned" />
            <Kpi label="Typical time to clean" value={stats.medianDays == null ? '—' : `${stats.medianDays.toFixed(1)} days`} sub="median, report to cleanup" testId="media-kpi-days" />
          </div>

          {stats.regions.length > 1 && (
            <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
              <table className="w-full text-sm" data-testid="media-regions">
                <thead className="bg-td-cream text-xs uppercase text-td-sage text-left">
                  <tr><th className="px-3 py-2">Region</th><th className="px-3 py-2 text-right">Reports</th><th className="px-3 py-2 text-right">Open</th><th className="px-3 py-2 text-right">Cleaned</th></tr>
                </thead>
                <tbody className="divide-y divide-td-border">
                  {stats.regions.map(r => (
                    <tr key={r.region}><td className="px-3 py-2">{r.region}</td><td className="px-3 py-2 text-right">{r.total}</td><td className="px-3 py-2 text-right">{r.open}</td><td className="px-3 py-2 text-right">{r.cleaned}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm" data-testid="media-table">
              <thead className="bg-td-cream text-xs uppercase text-td-sage text-left">
                <tr>
                  <th className="px-3 py-2">Reported</th><th className="px-3 py-2">Where</th><th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Severity</th><th className="px-3 py-2">Waste</th><th className="px-3 py-2">Cleanup by</th>
                  <th className="px-3 py-2 text-right">Days to clean</th><th className="px-3 py-2">Photos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-td-border">
                {rows.length === 0 ? (
                  <tr><td colSpan="8" className="py-10 text-center text-td-sage">No reports match these filters.</td></tr>
                ) : rows.slice(0, SHOWN_ROWS).map(r => {
                  const d = daysToClean(r);
                  const photos = [...(r.photos || []), ...(r.cleanup_photos || [])];
                  return (
                    <tr key={r.id} data-testid="media-row">
                      <td className="px-3 py-2 whitespace-nowrap">{date(r.reported_at)}</td>
                      <td className="px-3 py-2">
                        <div>{r.area_name || r.district || '—'}</div>
                        <div className="text-xs text-td-sage">{[r.district, r.region].filter(Boolean).join(', ') || 'Outside Ghana'}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{STATUS_LABEL[r.status] || title(r.status)}</td>
                      <td className="px-3 py-2">{title(r.severity)}</td>
                      <td className="px-3 py-2">{title(r.waste_type)}</td>
                      <td className="px-3 py-2">{r.cleanup_by ? title(r.cleanup_by) : '—'}</td>
                      <td className="px-3 py-2 text-right">{d == null ? '—' : d.toFixed(1)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {photos.length === 0 ? '—' : photos.slice(0, 3).map((u, i) => (
                          <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-green-700 underline mr-2">
                            {i < (r.photos || []).length ? `Report ${i + 1}` : `Cleanup ${i - (r.photos || []).length + 1}`}
                          </a>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > SHOWN_ROWS && <p className="text-xs text-td-sage mt-2">Showing the latest {SHOWN_ROWS} of {rows.length}. The download has all of them.</p>}
        </>
      )}
      <p className="text-xs text-td-sage mt-4">
        Source: TrashDrop community reports. Regions and districts: geoBoundaries (CC BY 4.0) and OpenStreetMap (CC BY-SA 2.0).
        Downloads are recorded with your account.
      </p>
    </div>
  );
};

export default MediaReports;
