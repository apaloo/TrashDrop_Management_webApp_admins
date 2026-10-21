import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import useEscapeKey from '../../hooks/useEscapeKey';
import { standardCleanupPayment, isVolunteerTeam } from '../../utils/illegalDumpingReportUtils';

const money = (n) => `GHS ${Number(n).toFixed(2)}`;
const teamName = (t) => `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email || 'Unnamed team';

/**
 * Assign a cleanup team to a verified illegal dumping report (used by the
 * Reports page and the Map page).
 *
 * Step 1: pick a paid collector or a volunteer group.
 * Step 2: for a collector, set the payment (blank = the standard size ×
 *         severity rate); a volunteer group is unpaid, so it only confirms.
 *
 * onAssign({ teamId, teamName, fee, volunteer }) does the database work and
 * resolves true when the report was assigned.
 */
const AssignCleanupModal = ({ report, onClose, onAssign }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [team, setTeam] = useState(null);
  const [fee, setFee] = useState('');
  const [busy, setBusy] = useState(false);

  useEscapeKey(true, onClose);

  useEffect(() => {
    let live = true;
    (async () => {
      // '*' so the list still loads where collector_type isn't in the database yet (everyone is then a collector)
      const { data, error } = await supabase
        .from('collector_profiles')
        .select('*')
        .eq('status', 'active')
        .order('first_name', { ascending: true });
      if (!live) return;
      if (error) {
        console.error('Error fetching cleanup teams:', error);
        setLoadError(true);
      }
      setTeams(data || []);
      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  const collectors = teams.filter(t => !isVolunteerTeam(t));
  const volunteers = teams.filter(isVolunteerTeam);
  const standard = standardCleanupPayment(report?.size, report?.severity);
  const typed = parseFloat(fee);
  const hasFee = fee !== '' && Number.isFinite(typed) && typed > 0;
  const feeInvalid = fee !== '' && (!Number.isFinite(typed) || typed < 0);

  const confirm = async () => {
    if (!team || busy || feeInvalid) return;
    setBusy(true);
    const volunteer = isVolunteerTeam(team);
    const ok = await onAssign({ teamId: team.id, teamName: teamName(team), fee: volunteer || !hasFee ? null : typed, volunteer });
    setBusy(false);
    if (ok) onClose();
  };

  const TeamRow = ({ t }) => (
    <button type="button" onClick={() => { setTeam(t); setFee(''); }} data-testid="team-option"
      className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-green-500 hover:bg-green-50 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{teamName(t)}</p>
          {t.email && <p className="text-sm text-gray-500 truncate">{t.email}</p>}
          {t.phone && <p className="text-sm text-gray-500">Phone: {t.phone}</p>}
          {t.vehicle_type && <p className="text-sm text-gray-500">Vehicle: {t.vehicle_type} {t.vehicle_plate && `(${t.vehicle_plate})`}</p>}
        </div>
        {isVolunteerTeam(t)
          ? <span className="px-2 py-1 text-xs rounded-full bg-teal-100 text-teal-800 whitespace-nowrap">Volunteer group · unpaid</span>
          : <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 whitespace-nowrap">Paid collector</span>}
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="assign-cleanup-title">
        <div className="flex justify-between items-center mb-4">
          <h3 id="assign-cleanup-title" className="text-lg font-semibold text-gray-900">
            {!team ? 'Choose a cleanup team' : isVolunteerTeam(team) ? 'Assign to a volunteer group' : 'Set the cleanup payment'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
        </div>

        {report && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-medium">Report {String(report.id).slice(0, 8)}…</p>
            {(report.locationLabel || report.location?.address) && <p className="text-gray-600">{report.locationLabel || report.location?.address}</p>}
            <p className="text-gray-500 capitalize">Severity: {report.severity || 'N/A'} • Size: {report.size || 'N/A'}</p>
          </div>
        )}

        {!team ? (
          /* Step 1: who does the cleanup */
          loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>
          ) : loadError && teams.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Couldn’t load the teams. Close this window and try again.</p>
          ) : teams.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No active collectors or volunteer groups</p>
              <p className="text-sm mt-2">Add collectors in Collectors Management, or approve a volunteer group.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {collectors.length > 0 && (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Paid collectors</p>
                  <div className="space-y-2">{collectors.map(t => <TeamRow key={t.id} t={t} />)}</div>
                </section>
              )}
              {volunteers.length > 0 && (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Volunteer groups</p>
                  <div className="space-y-2">{volunteers.map(t => <TeamRow key={t.id} t={t} />)}</div>
                </section>
              )}
            </div>
          )
        ) : isVolunteerTeam(team) ? (
          /* Step 2, volunteer group: no payment */
          <div data-testid="volunteer-confirm">
            <p className="text-sm text-gray-700 mb-2"><strong>{teamName(team)}</strong> is a volunteer group. Volunteer cleanups are unpaid, so no fee is set.</p>
            <p className="text-sm text-gray-500 mb-6">The group accepts the job in the TrashDrop collector app, cleans up and uploads cleanup photos.</p>
          </div>
        ) : (
          /* Step 2, paid collector: payment */
          <div>
            <p className="text-sm text-gray-600 mb-3">Payment for <strong>{teamName(team)}</strong>. TrashDrop pays it into their earnings once the waste is disposed.</p>
            <label htmlFor="cleanup-fee" className="block text-sm font-medium text-gray-700 mb-1">Cleanup fee (GHS)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">GHS</span>
              <input id="cleanup-fee" type="number" min="0" step="0.01" placeholder={standard.toFixed(2)} value={fee}
                onChange={e => setFee(e.target.value)} autoFocus
                className="w-full border border-gray-300 rounded-lg pl-14 pr-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
            </div>
            <p className="mt-2 text-sm text-gray-500" data-testid="fee-hint">
              {feeInvalid ? <span className="text-red-600">Enter an amount of 0 or more.</span>
                : hasFee ? <>The collector will be paid <strong className="text-green-700">{money(typed)}</strong>.</>
                : <>Leave blank for the standard rate: <strong>{money(standard)}</strong> ({report?.size || 'medium'} size{String(report?.severity).toLowerCase() === 'high' ? ', high severity × 1.5' : ''}).</>}
            </p>
          </div>
        )}

        {team && (
          <div className="mt-6 flex justify-between gap-3">
            <button type="button" onClick={() => setTeam(null)} disabled={busy} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">← Back</button>
            <button type="button" onClick={confirm} disabled={busy || feeInvalid} data-testid="assign-confirm"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">
              {busy ? 'Assigning…' : isVolunteerTeam(team) ? `Assign to ${teamName(team)}` : `Assign · ${money(hasFee ? typed : standard)}`}
            </button>
          </div>
        )}
        {!team && (
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignCleanupModal;
