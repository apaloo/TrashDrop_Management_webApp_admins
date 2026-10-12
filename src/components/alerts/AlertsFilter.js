import React from 'react';
import { card, input, muted } from '../pickupRequests/theme';
import { ALERT_STATUSES, ALERT_PRIORITIES, ALERT_TYPES } from '../../constants/alerts';
import { DEFAULT_ALERT_FILTERS } from '../../utils/alertUtils';

const Select = ({ label, value, onChange, children, className = '' }) => (
  <label className={`w-full sm:w-auto ${className}`}>
    <span className="block text-xs mb-1" style={muted}>{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
      className="w-full sm:min-w-[11rem] border rounded px-2 py-1.5 text-sm" style={input}>
      {children}
    </select>
  </label>
);

/** Filters; every option value comes from src/constants/alerts.js */
const AlertsFilter = ({ filters, setFilters, searchText, setSearchText, staff }) => {
  const changed = Object.keys(DEFAULT_ALERT_FILTERS).some(k => filters[k] !== DEFAULT_ALERT_FILTERS[k]) || searchText;
  return (
    <div className="rounded-lg border px-4 py-3 flex flex-wrap gap-3 items-end" style={card}>
      <label className="flex-1 min-w-[220px]">
        <span className="block text-xs mb-1" style={muted}>Search</span>
        <input type="search" value={searchText} onChange={e => setSearchText(e.target.value)}
          placeholder="Title, request ID, customer, collector, area" className="w-full border rounded px-3 py-1.5 text-sm" style={input} />
      </label>
      <Select label="Status" value={filters.status} onChange={v => setFilters({ status: v })}>
        <option value="all">All statuses</option>
        <option value="active">Needs attention</option>
        {ALERT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </Select>
      <Select label="Priority" value={filters.priority} onChange={v => setFilters({ priority: v })}>
        <option value="all">All priorities</option>
        {ALERT_PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </Select>
      <Select label="Type" value={filters.type} onChange={v => setFilters({ type: v })}>
        <option value="all">All types</option>
        {ALERT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
      </Select>
      <Select label="Assigned to" value={filters.assignee} onChange={v => setFilters({ assignee: v })}>
        <option value="all">Anyone</option>
        <option value="none">Unassigned</option>
        {staff.filter(u => u.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </Select>
      <Select label="Created" value={filters.range} onChange={v => setFilters({ range: v })}>
        <option value="all">Any time</option>
        <option value="today">Today</option>
        <option value="last24h">Last 24 hours</option>
        <option value="last7Days">Last 7 days</option>
        <option value="last30Days">Last 30 days</option>
        <option value="custom">Custom range…</option>
      </Select>
      {filters.range === 'custom' && (
        <div className="flex gap-2 w-full sm:w-auto">
          <label className="flex-1"><span className="block text-xs mb-1" style={muted}>From</span>
            <input type="date" value={filters.from} onChange={e => setFilters({ from: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" style={input} /></label>
          <label className="flex-1"><span className="block text-xs mb-1" style={muted}>To</span>
            <input type="date" value={filters.to} onChange={e => setFilters({ to: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" style={input} /></label>
        </div>
      )}
      {changed && (
        <button type="button" className="text-sm underline pb-1.5" style={muted} onClick={() => { setSearchText(''); setFilters({ ...DEFAULT_ALERT_FILTERS }); }}>
          Clear filters
        </button>
      )}
    </div>
  );
};

export default AlertsFilter;
