import React from 'react';
import { card, muted, border } from '../pickupRequests/theme';
import { alertType } from '../../constants/alerts';

const Card = ({ label, value, sub, accent, onClick, active, testId }) => (
  <button type="button" onClick={onClick} aria-pressed={!!active}
    className={`text-left rounded-lg border px-4 py-3 transition-shadow hover:shadow flex flex-col justify-between min-h-[96px] ${active ? 'ring-2 ring-green-500' : ''}`} style={card}>
    <p className="text-xs flex items-center gap-1.5" style={muted}>
      {accent && <span className="w-2 h-2 rounded-full" style={{ background: accent }} aria-hidden="true"></span>}{label}
    </p>
    <p className="text-2xl font-bold leading-tight" data-testid={testId}>{value}</p>
    {sub && <p className="text-xs" style={muted}>{sub}</p>}
  </button>
);

/**
 * Four cards (2 × 2) beside "Alerts by type", so the block has no gaps.
 * Counts are over every alert; the type list also shows how many are still open.
 */
const AlertStats = ({ stats, filters, setFilters, autoResolved = 0 }) => {
  const s = stats.byStatus;
  const maxType = Math.max(1, ...stats.types.map(t => t.total));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card label="Total alerts" value={stats.total} testId="stat-total"
          sub={`${s.open} open · ${s.acknowledged} acknowledged · ${s.in_progress} in progress · ${s.resolved} resolved · ${s.closed} closed`}
          onClick={() => setFilters({ status: 'all', priority: 'all', type: 'all' })} active={filters.status === 'all' && filters.priority === 'all' && filters.type === 'all'} />
        <Card label="Needs attention" value={stats.active} accent="#DC2626" testId="stat-active"
          sub="Open, acknowledged or in progress" onClick={() => setFilters({ status: 'active', priority: 'all' })} active={filters.status === 'active' && filters.priority === 'all'} />
        <Card label="Critical / High open" value={stats.openByPriority.critical + stats.openByPriority.high} accent="#EA580C" testId="stat-urgent"
          sub={`${stats.openByPriority.critical} critical · ${stats.openByPriority.high} high · ${stats.openByPriority.medium} medium · ${stats.openByPriority.low} low`}
          onClick={() => setFilters({ status: 'active', priority: 'critical' })} active={filters.status === 'active' && filters.priority === 'critical'} />
        <Card label="Resolved or closed" value={s.resolved + s.closed} accent="#16A34A" testId="stat-done"
          sub={`${autoResolved} resolved automatically by rules`} onClick={() => setFilters({ status: 'resolved', priority: 'all' })} active={filters.status === 'resolved'} />
      </div>

      <div className="rounded-lg border px-4 py-3 flex flex-col" style={card}>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold text-sm">Alerts by type</h2>
          <span className="text-xs" style={muted}>all alerts · open in brackets</span>
        </div>
        {stats.types.length === 0 ? <p className="text-sm" style={muted}>No alerts yet</p> : (
          <ul className="space-y-1.5 text-sm overflow-y-auto max-h-[180px] pr-1" data-testid="alerts-by-type">
            {stats.types.map(t => (
              <li key={t.key}>
                <button type="button" onClick={() => setFilters({ type: filters.type === t.key ? 'all' : t.key })}
                  className={`w-full text-left rounded px-1 -mx-1 hover:bg-black hover:bg-opacity-5 ${filters.type === t.key ? 'font-semibold' : ''}`}>
                  <span className="flex justify-between gap-2">
                    <span className="truncate"><i className={`${alertType(t.key).icon} w-4 mr-1.5`} style={muted} aria-hidden="true"></i>{t.label}</span>
                    <span className="whitespace-nowrap">{t.total} <span style={muted}>({t.open})</span></span>
                  </span>
                  <span className="block h-1 rounded mt-0.5" style={{ ...border, background: 'var(--td-card-border)' }}>
                    <span className="block h-1 rounded bg-green-500" style={{ width: `${(t.total / maxType) * 100}%` }}></span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AlertStats;
