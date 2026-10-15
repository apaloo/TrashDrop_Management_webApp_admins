import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllIllegalDumpingReports } from '../utils/databaseUtils';
import {
  toReportViewModel, computeReportStats, countCleanupTeams, formatDuration, formatDate,
  matchesSearch, HISTORY_STATUSES, CLEANED_STATUSES, statusLabel, toTitle,
} from '../utils/illegalDumpingReportUtils';
import StatusBadge from '../components/illegalDumping/StatusBadge';
import ReportPhotos from '../components/illegalDumping/ReportPhotos';
import useEscapeKey from '../hooks/useEscapeKey';
import { useAuth } from '../context/AuthContext';
import AreaScopeNote from '../components/illegalDumping/AreaScopeNote';

// Tabs and chips filter on status only
const TABS = [
  ['all', 'All', HISTORY_STATUSES],
  ['resolved', 'Resolved', CLEANED_STATUSES],
  ['cancelled', 'Cancelled', ['cancelled']],
];
const RESOLUTION_CHIPS = [
  { key: 'completed', label: 'Completed', statuses: CLEANED_STATUSES, color: '#10B981' },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'], color: '#6B7280' },
];

/** History rows between two yyyy-mm-dd dates (inclusive) by the date they were closed */
const inDateRange = (report, start, end) => {
  if (!start && !end) return true;
  const closed = new Date(report.closedAt);
  if (Number.isNaN(closed.getTime())) return false;
  if (start && closed < new Date(`${start}T00:00:00`)) return false;
  if (end && closed > new Date(`${end}T23:59:59.999`)) return false;
  return true;
};

const IllegalDumpingHistory = () => {
  const { area } = useAuth();
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [filters, setFilters] = useState({ resolution: [], startDate: '', endDate: '' });

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAllIllegalDumpingReports({ area });
      setAllReports(rows.map(toReportViewModel));
      setLoadError(null);
    } catch (error) {
      console.error('Error loading illegal dumping history:', error);
      setLoadError('Could not load reports. Try again.');
    } finally {
      setLoading(false);
    }
  }, [area]);

  useEffect(() => { loadReports(); }, [loadReports]);

  // KPIs use the same function as the Reports page, over all reports
  const stats = useMemo(() => computeReportStats(allReports), [allReports]);
  const cleanupTeams = useMemo(() => countCleanupTeams(allReports), [allReports]);
  const pendingReports = useMemo(() => allReports.filter(r => r.status === 'pending'), [allReports]);

  const historyReports = useMemo(
    () => allReports
      .filter(r => HISTORY_STATUSES.includes(r.status))
      .sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0)),
    [allReports]
  );

  const dateRangeInvalid = Boolean(filters.startDate && filters.endDate && filters.endDate < filters.startDate);

  const filteredData = useMemo(() => {
    const tabStatuses = TABS.find(([key]) => key === selectedTab)[2];
    const chipStatuses = RESOLUTION_CHIPS.filter(c => filters.resolution.includes(c.key)).flatMap(c => c.statuses);
    return historyReports.filter(item =>
      tabStatuses.includes(item.status) &&
      (chipStatuses.length === 0 || chipStatuses.includes(item.status)) &&
      (dateRangeInvalid || inDateRange(item, filters.startDate, filters.endDate)) &&
      matchesSearch(item, searchTerm)
    );
  }, [historyReports, selectedTab, filters, searchTerm, dateRangeInvalid]);

  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map(([key, , statuses]) => [key, historyReports.filter(r => statuses.includes(r.status)).length])),
    [historyReports]
  );

  const toggleResolution = (key) => {
    setFilters(prev => ({
      ...prev,
      resolution: prev.resolution.includes(key) ? prev.resolution.filter(k => k !== key) : [...prev.resolution, key],
    }));
    setCurrentPage(1);
  };
  const setDate = (field, value) => { setFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); };
  const resetFilters = () => {
    setFilters({ resolution: [], startDate: '', endDate: '' });
    setSearchTerm('');
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const closeModal = useCallback(() => setSelectedItem(null), []);
  useEscapeKey(Boolean(selectedItem), closeModal);

  const activeFilterCount = filters.resolution.length + (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0);

  return (
    <div className="bg-gray-50 min-h-screen">
      <AreaScopeNote area={area} />
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Illegal Dumping History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resolved and cancelled illegal dumping reports</p>
        </div>
        <div className="relative w-full sm:w-72">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input
            type="text"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm"
            placeholder="Search ID, location, team..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <i className="fas fa-times text-xs"></i>
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center justify-between">
          {loadError}
          <button onClick={loadReports} className="underline">Retry</button>
        </div>
      )}

      {/* KPI Cards — all reports, same calculation as the Reports page */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Resolved Reports', value: stats.cleanedUp, icon: 'fa-check-circle', border: 'border-blue-100', bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Cleanup Teams (completed)', value: cleanupTeams, icon: 'fa-users', border: 'border-green-100', bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Avg. Resolution Time', value: formatDuration(stats.avgCleanupHours), icon: 'fa-clock', border: 'border-purple-100', bg: 'bg-purple-50', color: 'text-purple-600', testId: 'avg-resolution' },
        ].map(({ label, value, icon, border, bg, color, testId }) => (
          <div key={label} className={`bg-white rounded-xl shadow-sm border ${border} p-4 flex items-center gap-4`}>
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${icon} ${color}`}></i>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-gray-800" data-testid={testId}>{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending verification — same data as the Reports page */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-4 mb-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-sm font-semibold text-gray-700">
            Pending verification{' '}
            <span className="ml-1 bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full" data-testid="pending-count">
              {loading ? '—' : pendingReports.length}
            </span>
          </h2>
          <Link to="/illegal-dumping/reports?status=pending" className="text-sm text-green-700 hover:underline">
            Review on Reports page →
          </Link>
        </div>
        {!loading && pendingReports.length === 0 && <p className="text-sm text-gray-500">No reports are waiting for verification.</p>}
        {!loading && pendingReports.length > 0 && (
          <ul className="divide-y divide-gray-100 text-sm">
            {pendingReports.slice(0, 5).map(r => (
              <li key={r.id} className="py-2 flex justify-between gap-3">
                <span className="truncate text-gray-700">{r.locationLabel}</span>
                <span className="text-gray-400 whitespace-nowrap">{formatDate(r.reportedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 mb-5">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <i className="fas fa-filter text-gray-400 text-sm"></i>
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">{activeFilterCount} active</span>
            )}
          </div>
          <button className="text-xs text-gray-500 flex items-center gap-1 hover:text-red-500 transition-colors" onClick={resetFilters}>
            <i className="fas fa-times-circle text-xs"></i> Reset All
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Resolution Type</p>
            <div className="flex gap-1.5">
              {RESOLUTION_CHIPS.map(({ key, label, color }) => {
                const isActive = filters.resolution.includes(key);
                return (
                  <button key={key}
                    className="text-xs px-3 py-1 rounded-full border font-medium transition-all whitespace-nowrap"
                    style={{ backgroundColor: isActive ? color : '#F9FAFB', borderColor: isActive ? color : '#E5E7EB', color: isActive ? 'white' : '#374151' }}
                    aria-pressed={isActive}
                    onClick={() => toggleResolution(key)}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <label>
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">From Date</span>
              <input type="date" max={filters.endDate || undefined}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={filters.startDate} onChange={(e) => setDate('startDate', e.target.value)} />
            </label>
            <span className="text-gray-400 mb-2 text-sm">→</span>
            <label>
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">To Date</span>
              <input type="date" min={filters.startDate || undefined}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={filters.endDate} onChange={(e) => setDate('endDate', e.target.value)} />
            </label>
          </div>
        </div>
        {dateRangeInvalid && (
          <p className="mt-2 text-xs text-red-600" role="alert">End date is before start date, so the date filter is not applied.</p>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map(([tab, label]) => (
            <button key={tab}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${selectedTab === tab ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => { setSelectedTab(tab); setCurrentPage(1); }}>
              {label} <span className="text-xs text-gray-400">({loading ? '—' : tabCounts[tab]})</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Data Table */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Report ID', 'Location', 'Resolution', 'Cleanup Team', 'Closed On', ''].map(h => (
                  <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-6 text-center text-gray-500">Loading history…</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-500">No history records match your filters</td></tr>
              ) : paginatedData.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedItem(item)}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900" title={item.id}>{item.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={item.locationLabel}>{item.locationLabel}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.cleanupTeam || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(item.closedAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                    <button className="text-blue-600 hover:text-blue-900" onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}>View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-700">
          <p>
            Showing <span className="font-medium">{filteredData.length ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to{' '}
            <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of{' '}
            <span className="font-medium">{filteredData.length}</span> results
          </p>
          <div className="inline-flex gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-md border ${currentPage === 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-50'}`} aria-label="Previous page">
              <i className="fas fa-chevron-left"></i>
            </button>
            <span className="px-3 py-1.5">{currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className={`px-3 py-1.5 rounded-md border ${currentPage >= totalPages ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-50'}`} aria-label="Next page">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Detail View Modal */}
      {selectedItem && (
        <div className="fixed inset-0 overflow-y-auto z-50" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" aria-hidden="true" onClick={closeModal}></div>
            <div className="relative bg-white rounded-lg text-left shadow-xl w-full max-w-xl">
              <div className="px-6 pt-5 pb-4 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium text-gray-900" id="history-modal-title">Report Details</h3>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Close">&times;</button>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Report ID</span>
                  <span className="font-mono">{selectedItem.id}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Resolution</span>
                  <StatusBadge status={selectedItem.status} />
                </div>
                <hr className="border-gray-200" />
                <div>
                  <h4 className="font-medium mb-1">Location</h4>
                  <p className="text-sm">{selectedItem.locationLabel}</p>
                  {selectedItem.location.lat !== null && (
                    <p className="text-xs text-gray-500">Lat: {selectedItem.location.lat.toFixed(5)} · Lng: {selectedItem.location.lng.toFixed(5)}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-500">Waste type</span><span>{toTitle(selectedItem.wasteType)}</span>
                  <span className="text-gray-500">Severity</span><span>{toTitle(selectedItem.severity)}</span>
                  <span className="text-gray-500">Reported on</span><span>{formatDate(selectedItem.reportedAt, { withTime: true })}</span>
                  <span className="text-gray-500">{selectedItem.status === 'cancelled' ? 'Cancelled on' : 'Resolved on'}</span>
                  <span>{formatDate(selectedItem.closedAt, { withTime: true })}</span>
                  {selectedItem.disposedAt && (<><span className="text-gray-500">Disposed on</span><span>{formatDate(selectedItem.disposedAt, { withTime: true })}{selectedItem.disposalSite ? ` · ${selectedItem.disposalSite}` : ''}</span></>)}
                  <span className="text-gray-500">Cleanup team</span><span>{selectedItem.cleanupTeam || '—'}</span>
                  <span className="text-gray-500">Status</span><span>{statusLabel(selectedItem.status)}</span>
                </div>
                {selectedItem.notes && (
                  <div>
                    <h4 className="font-medium mb-1">Notes</h4>
                    <p className="text-sm bg-gray-50 p-3 rounded">{selectedItem.notes}</p>
                  </div>
                )}
                <ReportPhotos photos={selectedItem.images} enhanced={false} />
                {selectedItem.cleanupPhotos.length > 0 && (
                  <ReportPhotos photos={selectedItem.cleanupPhotos} enhanced={false} title={selectedItem.claimedByVolunteers ? 'Cleanup photos from the volunteer group' : 'Cleanup photos'} />
                )}
              </div>
              <div className="bg-gray-50 px-6 py-3 flex justify-end rounded-b-lg">
                <button type="button" className="rounded-md px-4 py-2 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700" onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IllegalDumpingHistory;
