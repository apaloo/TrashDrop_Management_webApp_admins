import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAllIllegalDumpingReports, updateIllegalDumpingStatus, fetchIllegalDumpingHistory, assignCleanupTeam } from '../utils/databaseUtils';
import { SEVERITY } from '../config/constants';
import AssignCleanupModal from '../components/illegalDumping/AssignCleanupModal';
import {
  toReportViewModel, computeReportStats, formatDuration, formatDate, matchesSearch,
  normalizeEnum, toTitle, statusLabel, severityBadgeClass, canTransition, isOpenStatus, STATUS_LABELS,
  assignmentBlockReason, assignmentFailedMessage,
} from '../utils/illegalDumpingReportUtils';
import StatusBadge from '../components/illegalDumping/StatusBadge';
import ReportPhotos from '../components/illegalDumping/ReportPhotos';
import useEscapeKey from '../hooks/useEscapeKey';
import { useAuth } from '../context/AuthContext';
import { canManageDumping } from '../constants/accessControl';
import { can } from '../lib/permissions';
import { usesAreaActions, areaVerifyReport, areaMarkCleaned, areaAssignTeam, fetchAreaTeams } from '../services/dumpingAreaService';
import AreaScopeNote from '../components/illegalDumping/AreaScopeNote';

const STATUS_FILTERS = ['pending', 'verified', 'in_progress', 'completed', 'disposed', 'cancelled'];

const IllegalDumpingManagement = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = normalizeEnum(searchParams.get('status'));
  const [reports, setReports] = useState([]);
  const { role, area } = useAuth();
  const canManage = canManageDumping(role); // everything, e.g. cancel (Admin, Manager)
  // What this account may do (src/lib/permissions.js); Media, Volunteer and User
  // read without reporter details, and their actions go through the area functions
  const privateView = !can('dumping.reporters', role);
  const viaArea = usesAreaActions(role);
  const canVerify = can('dumping.verify', role);
  const canAssign = can('dumping.assign', role);
  const canMarkCleaned = can('dumping.markCleaned', role);
  const canAct = canVerify || canAssign || canMarkCleaned || canManage;
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReportHistory, setSelectedReportHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(STATUS_FILTERS.includes(initialStatus) ? initialStatus : 'All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [actionPending, setActionPending] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshIntervalMs] = useState(60000);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Collector selection state
  const [showCollectorModal, setShowCollectorModal] = useState(false);
  const [selectedReportForAssignment, setSelectedReportForAssignment] = useState(null);

  const toast = (message, ms = 3000) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), ms);
  };

  // Open collector selection modal
  const openCollectorModal = (report) => {
    const blocked = assignmentBlockReason(report);
    if (blocked) { toast(blocked, 5000); return; }
    setSelectedReportForAssignment(report);
    setShowCollectorModal(true);
  };

  // Loads every report (no row cap); filters and KPIs are applied on the page
  const refreshReports = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const rows = await fetchAllIllegalDumpingReports({ area: privateView ? null : area, privateView });
      const mapped = rows.map(toReportViewModel);
      setReports(mapped);
      setSelectedReport(prev => (prev ? mapped.find(r => r.id === prev.id) || prev : prev));
      setLastUpdated(new Date());
      if (!silent) toast('Data refreshed', 2000);
    } catch (error) {
      console.error('Error refreshing illegal dumping data:', error);
      if (!silent) toast('Failed to refresh data', 2500);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [area, privateView]);

  // Initial load
  useEffect(() => {
    refreshReports(true).finally(() => setLoading(false));
  }, [refreshReports]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshEnabled) return undefined;
    const id = setInterval(() => refreshReports(true), autoRefreshIntervalMs);
    return () => clearInterval(id);
  }, [autoRefreshEnabled, autoRefreshIntervalMs, refreshReports]);

  // KPIs: all reports, same calculation as the History page
  const metrics = useMemo(() => computeReportStats(reports), [reports]);

  const loadHistory = async (reportId) => {
    try {
      setSelectedReportHistory(await fetchIllegalDumpingHistory(reportId));
    } catch (error) {
      console.error('Error fetching report history:', error);
      setSelectedReportHistory([]);
    }
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setSelectedReportHistory([]);
    loadHistory(report.id);
  };

  const closeDetails = useCallback(() => setSelectedReport(null), []);
  useEscapeKey(Boolean(selectedReport) && !showCollectorModal, closeDetails);
  const closeCollectorModal = useCallback(() => {
    setShowCollectorModal(false);
    setSelectedReportForAssignment(null);
  }, []);
  useEscapeKey(showCollectorModal, closeCollectorModal);

  const CONFIRM_TEXT = {
    completed: 'Mark this report as cleaned up? This cannot be undone.',
    cancelled: 'Cancel this report? It will move to History and cannot be reopened.',
  };

  const updateReportStatus = async (report, newStatus) => {
    if (!canTransition(report.status, newStatus)) {
      toast(`A ${statusLabel(report.status)} report can't be set to ${statusLabel(newStatus)}`);
      return;
    }
    if (CONFIRM_TEXT[newStatus] && !window.confirm(CONFIRM_TEXT[newStatus])) return;
    setActionPending(report.id);
    try {
      if (viaArea) {
        await (newStatus === 'verified' ? areaVerifyReport(report.id) : areaMarkCleaned(report.id));
      } else {
        const result = await updateIllegalDumpingStatus(report.id, newStatus);
        if (result?.error) throw new Error(result.error.message || 'Failed to update status');
      }
      toast(`Status updated to ${statusLabel(newStatus)}`);
      await refreshReports(true);
      if (selectedReport?.id === report.id) loadHistory(report.id);
    } catch (error) {
      console.error('Error updating report status:', error);
      toast(`Failed to update status: ${error.message}`);
    } finally {
      setActionPending(null);
    }
  };

  // Called by the assignment window; true when the report was assigned
  const assignCleanup = async ({ teamId, teamName, fee, volunteer }) => {
    const reportId = selectedReportForAssignment?.id;
    const blocked = assignmentBlockReason(reports.find(r => r.id === reportId) || selectedReportForAssignment);
    if (blocked) { toast(blocked, 5000); return false; }
    try {
      const estimatedCleanupDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      // Keeps status verified so the job shows in the team's Available tab until they accept
      if (viaArea) {
        await areaAssignTeam(reportId, teamId, fee);
      } else {
        const result = await assignCleanupTeam(reportId, teamId, estimatedCleanupDate, fee);
        if (result?.error) throw result.error;
      }
      toast(volunteer ? `Cleanup assigned to volunteer group ${teamName}` : `Cleanup assigned to ${teamName}`);
      await refreshReports(true);
      if (selectedReport?.id === reportId) loadHistory(reportId);
      return true;
    } catch (error) {
      console.error('Error assigning cleanup team:', error);
      toast(assignmentFailedMessage(error), 5000);
      return false;
    }
  };

  const filteredReports = useMemo(() => reports.filter(report =>
    (filterStatus === 'All' || report.status === filterStatus) &&
    (filterSeverity === 'All' || report.severity === normalizeEnum(filterSeverity)) &&
    matchesSearch(report, searchTerm)
  ), [reports, filterStatus, filterSeverity, searchTerm]);

  // Pagination calculations
  const totalCount = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterSeverity, itemsPerPage]);

  const copyId = (id) => {
    if (navigator.clipboard) navigator.clipboard.writeText(id).then(() => toast('Report ID copied', 1500)).catch(() => {});
  };

  // The next step each status allows (one primary action per row)
  const rowAction = (report) => {
    if (report.status === 'pending' && canVerify) return { label: 'Verify', to: 'verified', cls: 'bg-teal-50 text-teal-700 hover:bg-teal-100' };
    if (report.status === 'in_progress' && canMarkCleaned) return { label: 'Mark Cleaned', to: 'completed', cls: 'bg-green-50 text-green-700 hover:bg-green-100' };
    return null;
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <AreaScopeNote area={privateView && role === 'user' ? { level: 'home' } : area} readOnly={!(canVerify || canAssign || canMarkCleaned)} />
      {/* Page Header + Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Illegal Dumping Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage illegal dumping reports and cleanups</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastUpdated && (
            <span className="text-xs text-gray-500 hidden sm:block">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none bg-white border border-gray-200 rounded-md px-3 py-2">
            <input
              type="checkbox"
              className="accent-green-600 h-3.5 w-3.5"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
            />
            Auto-Refresh 60s
          </label>
          <button
            onClick={() => refreshReports(false)}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              loading ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
            }`}
          >
            <i className={`fas fa-sync-alt text-xs ${loading ? 'fa-spin' : ''}`}></i>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-20 right-4 bg-gray-800 text-white shadow-xl rounded-lg px-4 py-3 z-[10000] flex items-center gap-3 max-w-sm" role="status">
          <i className="fas fa-info-circle text-blue-300 flex-shrink-0"></i>
          <span className="text-sm">{toastMessage}</span>
          <button className="ml-auto text-gray-500 hover:text-white" onClick={() => setShowToast(false)} aria-label="Dismiss">
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>
      )}

      {/* KPI Cards — all reports, not affected by the filters below */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">All reports</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Reports', value: metrics.total, icon: 'fa-flag', bg: 'bg-blue-50', color: 'text-blue-600', border: 'border-blue-100' },
          { label: 'Verified or Beyond', value: metrics.confirmed, sub: `${metrics.verified} awaiting a collector`, title: 'Verified, in progress, completed or disposed', icon: 'fa-shield-alt', bg: 'bg-green-50', color: 'text-green-600', border: 'border-green-100' },
          { label: 'Cleaned Up', value: metrics.cleanedUp, icon: 'fa-broom', bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Avg Cleanup Time', value: formatDuration(metrics.avgCleanupHours), sub: metrics.cleanupSampleSize ? `from ${metrics.cleanupSampleSize} cleanups` : 'no cleanups yet', icon: 'fa-clock', bg: 'bg-orange-50', color: 'text-orange-600', border: 'border-orange-100' },
        ].map(({ label, value, sub, title, icon, bg, color, border }) => (
          <div key={label} className={`bg-white rounded-xl shadow-sm border ${border} p-4 flex items-center gap-4`} title={title}>
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${icon} ${color}`}></i>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-gray-800 leading-tight" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}>{loading ? '—' : value}</p>
              {sub && !loading && <p className="text-xs text-gray-500">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
            <input
              type="text"
              placeholder="Search by ID, location, status, reporter or team..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="py-2 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[150px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Status"
          >
            <option value="All">All Statuses</option>
            {STATUS_FILTERS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select
            className="py-2 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[150px]"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            aria-label="Severity"
          >
            <option value="All">All Severities</option>
            <option value={SEVERITY.LOW}>Low</option>
            <option value={SEVERITY.MEDIUM}>Medium</option>
            <option value={SEVERITY.HIGH}>High</option>
            <option value={SEVERITY.CRITICAL}>Critical</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Report ID', 'Reported', 'Location', 'Waste Type', 'Severity', 'Status', 'Assignee'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                    {filteredReports.length === 0 ? 'No reports match your filters' : 'No entries on this page'}
                  </td>
                </tr>
              ) : paginatedReports.map((report) => {
                const action = rowAction(report);
                return (
                  <tr key={report.id} className="hover:bg-gray-50 group">
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-mono text-gray-900" title={report.id}>
                      {report.id.slice(0, 8)}
                      <button onClick={() => copyId(report.id)} className="ml-1 text-gray-300 hover:text-gray-600" aria-label="Copy report ID" title="Copy full ID">
                        <i className="far fa-copy text-xs"></i>
                      </button>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(report.reportedAt)}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      <div className="truncate max-w-[14rem]" title={report.locationLabel}>{report.locationLabel}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{toTitle(report.wasteType)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBadgeClass(report.severity)}`}>{toTitle(report.severity)}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={report.status} /></td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{report.cleanupTeam || '—'}{report.claimedByVolunteers && <span className="ml-1 text-xs text-teal-700" title="Claimed by a volunteer group">(volunteers)</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-right sticky right-0 bg-white group-hover:bg-gray-50">
                      <button
                        onClick={() => handleViewDetails(report)}
                        className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        Details
                      </button>
                      {action && (
                        <button
                          onClick={() => updateReportStatus(report, action.to)}
                          disabled={actionPending === report.id}
                          className={`ml-2 inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${action.cls}`}
                        >
                          {action.label}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Left: rows per page + entry info */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <label htmlFor="idmRowsPerPage" className="whitespace-nowrap">Rows per page:</label>
                  <select
                    id="idmRowsPerPage"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="border border-gray-300 rounded-md py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 bg-white"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <span className="hidden sm:inline text-gray-500">|</span>
                <span>
                  {totalCount === 0
                    ? 'No entries'
                    : `Showing ${(currentPage - 1) * itemsPerPage + 1}\u2013${Math.min(currentPage * itemsPerPage, totalCount)} of ${totalCount}`}
                </span>
              </div>

              {/* Right: page navigation */}
              <nav className="inline-flex items-center gap-1" aria-label="Pagination">
                {/* First */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-md text-sm ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                  title="First page"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                </button>
                {/* Previous */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-md text-sm ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                  title="Previous page"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>

                {/* Page numbers */}
                {(() => {
                  const pages = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push('...');
                    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                      pages.push(i);
                    }
                    if (currentPage < totalPages - 2) pages.push('...');
                    pages.push(totalPages);
                  }
                  return pages.map((page, idx) =>
                    page === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-500 text-sm select-none">&hellip;</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[36px] h-9 rounded-md text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  );
                })()}

                {/* Next */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className={`p-2 rounded-md text-sm ${currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                  title="Next page"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
                {/* Last */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className={`p-2 rounded-md text-sm ${currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                  title="Last page"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}


      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4" onClick={closeDetails}>
          <div
            className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            role="dialog" aria-modal="true" aria-labelledby="report-details-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4 gap-4">
              <h2 className="text-xl font-semibold break-all" id="report-details-title">Dumping Report <span className="font-mono text-base text-gray-500">{selectedReport.id}</span></h2>
              <button onClick={closeDetails} className="text-gray-500 hover:text-gray-700 text-2xl leading-none" aria-label="Close">&times;</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Reported At</p>
                <p className="font-medium">{formatDate(selectedReport.reportedAt, { withTime: true })}</p>
              </div>
              {!selectedReport.reporterHidden && (
                <div>
                  <p className="text-gray-600 text-sm">Reported By</p>
                  <p className="font-medium">{selectedReport.reportedBy}</p>
                </div>
              )}
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <StatusBadge status={selectedReport.status} />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Severity</p>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBadgeClass(selectedReport.severity)}`}>{toTitle(selectedReport.severity)}</span>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-600 text-sm">Location</p>
                <p className="font-medium">{selectedReport.locationLabel}</p>
                {selectedReport.location.lat !== null && (
                  <p className="text-xs text-gray-500">
                    {selectedReport.location.lat.toFixed(5)}, {selectedReport.location.lng.toFixed(5)}
                    {selectedReport.location.address && selectedReport.location.address !== selectedReport.locationLabel ? ` · ${selectedReport.location.address}` : ''}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-600 text-sm">Description</p>
                <p className="font-medium">{selectedReport.description || 'No description given'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Waste Type</p>
                <p className="font-medium">{toTitle(selectedReport.wasteType)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Assigned Collector</p>
                <p className="font-medium">{selectedReport.cleanupTeam || 'Not assigned'}{selectedReport.claimedByVolunteers && <span className="ml-1 text-xs font-normal text-teal-700">(volunteer group claim)</span>}</p>
              </div>
              {selectedReport.cleanupFee != null && (
                <div>
                  <p className="text-gray-600 text-sm">Cleanup Payment</p>
                  <p className="font-medium text-green-700">GHS {Number(selectedReport.cleanupFee).toFixed(2)}</p>
                </div>
              )}
              {selectedReport.resolvedAt && (
                <div>
                  <p className="text-gray-600 text-sm">Resolved At</p>
                  <p className="font-medium">{formatDate(selectedReport.resolvedAt, { withTime: true })}</p>
                </div>
              )}
              {selectedReport.status === 'cancelled' && (
                <div>
                  <p className="text-gray-600 text-sm">Cancelled At</p>
                  <p className="font-medium">{formatDate(selectedReport.closedAt, { withTime: true })}</p>
                </div>
              )}
              {selectedReport.disposedAt && (
                <div>
                  <p className="text-gray-600 text-sm">Disposed</p>
                  <p className="font-medium">{formatDate(selectedReport.disposedAt, { withTime: true })}{selectedReport.disposalSite ? ` · ${selectedReport.disposalSite}` : ''}</p>
                </div>
              )}
              {selectedReport.notes && (
                <div className="md:col-span-2">
                  <p className="text-gray-600 text-sm">Notes</p>
                  <p className="font-medium whitespace-pre-line">{selectedReport.notes}</p>
                </div>
              )}
            </div>

            <div className="mb-6">
              <ReportPhotos photos={selectedReport.images} />
            </div>
            {selectedReport.cleanupPhotos.length > 0 && (
              <div className="mb-6" data-testid="cleanup-photos">
                <ReportPhotos photos={selectedReport.cleanupPhotos} title={selectedReport.claimedByVolunteers ? 'Cleanup photos from the volunteer group' : 'Cleanup photos'} />
              </div>
            )}

            {/* History Timeline */}
            {selectedReportHistory.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium mb-2">Activity History</h3>
                <div className="border-l-2 border-gray-200 ml-3">
                  {selectedReportHistory.map((item) => (
                    <div key={item.id} className="ml-6 mb-4 relative">
                      <div className="absolute -left-9 mt-1.5 w-4 h-4 rounded-full bg-blue-500"></div>
                      <p className="text-sm text-gray-500">{formatDate(item.at, { withTime: true })}</p>
                      <p className="font-medium">{statusLabel(item.status)}</p>
                      {item.notes && <p className="text-sm mt-1">{item.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions: only the steps the current status allows */}
            {canAct && isOpenStatus(selectedReport.status) && (
              <div className="border-t pt-4 flex flex-wrap justify-end items-center gap-2">
                {selectedReport.cleanupTeam && selectedReport.status === 'verified' && (
                  <div className="px-4 py-2 bg-green-100 text-green-800 rounded text-sm mr-auto">
                    Assigned to <strong>{selectedReport.cleanupTeam}</strong>, waiting for the collector to accept
                  </div>
                )}
                {selectedReport.status === 'pending' && canVerify && (
                  <button onClick={() => updateReportStatus(selectedReport, 'verified')} disabled={actionPending === selectedReport.id}
                    className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">
                    Verify
                  </button>
                )}
                {canAssign && ['pending', 'verified'].includes(selectedReport.status) && !selectedReport.assignedTo && (
                  <button onClick={() => openCollectorModal(selectedReport)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Assign Cleanup
                  </button>
                )}
                {selectedReport.status === 'in_progress' && canMarkCleaned && (
                  <button onClick={() => updateReportStatus(selectedReport, 'completed')} disabled={actionPending === selectedReport.id}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    Mark as Cleaned Up
                  </button>
                )}
                {canManage && (
                  <button onClick={() => updateReportStatus(selectedReport, 'cancelled')} disabled={actionPending === selectedReport.id}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                    Cancel Report
                  </button>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button onClick={closeDetails} className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">Close</button>
            </div>
          </div>
        </div>
      )}

      {showCollectorModal && selectedReportForAssignment && (
        <AssignCleanupModal report={selectedReportForAssignment} onAssign={assignCleanup}
          loadTeams={viaArea ? fetchAreaTeams : undefined} allowFee={can('dumping.fee', role)}
          onClose={() => { setShowCollectorModal(false); setSelectedReportForAssignment(null); }} />
      )}
    </div>
  );
};

export default IllegalDumpingManagement;
