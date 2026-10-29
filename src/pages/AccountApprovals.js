import React, { useCallback, useEffect, useState } from 'react';
import { listAccountRoles, reviewAccountRole, setAccountArea } from '../services/accountRoleService';
import { COMPANY_TYPES, ROLE_LABELS, ROLES } from '../constants/accessControl';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/pickupRequests/ConfirmDialog';
import { detailLabel } from '../constants/accountTypeFields';
import { GHANA_REGIONS, districtsOf } from '../constants/ghanaRegions';

const TABS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];
const ASSIGNABLE = [ROLES.USER, ROLES.VOLUNTEER, ROLES.MEDIA, ROLES.MANAGER, ROLES.AUTHORITY];

const companyLabel = (v) => COMPANY_TYPES.find(t => t.value === v)?.label || v || '—';
const where = (r) => [r.district, r.region].filter(Boolean).join(', ');
const detailEntries = (d) => Object.entries(d || {}).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object');

const DetailsList = ({ row }) => {
  const items = detailEntries(row.details);
  if (!items.length && !where(row)) return <p className="text-xs text-td-sage">No verification details were given.</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs" data-testid="request-details">
      {where(row) && <><dt className="text-td-sage">Area</dt><dd>{where(row)}</dd></>}
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-td-sage">{detailLabel(k)}</dt>
          <dd className="break-words">{/^https?:\/\//.test(String(v)) ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-green-700 underline">{v}</a> : String(v)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
};

// Roles whose view depends on the account's area
const needsDistrict = (role) => role === ROLES.AUTHORITY;
// A Waste Management Manager assigns pickups in its region only (20261103_manager_assign_scope.sql)
const assignsPickups = (role, companyType) => role === ROLES.MANAGER && companyType === 'waste_management';
const needsRegion = (role, companyType) => role === ROLES.AUTHORITY || role === ROLES.VOLUNTEER || assignsPickups(role, companyType);
const knownRegion = (r) => (GHANA_REGIONS.some(x => x.name === r) ? r : '');

const date = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const StatusPill = ({ status }) => {
  const cls = status === 'pending' ? 'bg-amber-100 text-amber-800' : status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  const label = status === 'pending' ? 'Waiting' : status === 'approved' ? 'Approved' : 'Rejected';
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
};

/** Admins approve or reject the access level people asked for at sign-up */
const AccountApprovals = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState(null); // { row, approve }
  const [role, setRole] = useState('');
  const [note, setNote] = useState('');
  const [areaRegion, setAreaRegion] = useState('');
  const [areaDistrict, setAreaDistrict] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    setRows(null);
    listAccountRoles(tab === 'all' ? null : tab)
      .then(r => { setRows(r); setError(null); })
      .catch(e => { setRows([]); setError(e.message); });
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const open = (row, approve) => {
    setDialog({ row, approve });
    setRole(approve ? (row.status === 'approved' ? row.role : row.requested_role) : '');
    setNote('');
    const reg = knownRegion(row.region);
    setAreaRegion(reg);
    setAreaDistrict(districtsOf(reg).includes(row.district) ? row.district : '');
  };

  const areaMissing = dialog?.approve && ((needsRegion(role, dialog.row.company_type) && !areaRegion) || (needsDistrict(role) && !areaDistrict));

  const save = async () => {
    setBusy(true);
    try {
      if (dialog.approve && needsRegion(role, dialog.row.company_type)) {
        const district = needsDistrict(role) ? areaDistrict : (areaRegion === dialog.row.region ? dialog.row.district : null);
        if (areaRegion !== (dialog.row.region || '') || (district || null) !== (dialog.row.district || null)) {
          await setAccountArea(dialog.row.user_id, { region: areaRegion, district });
        }
      }
      await reviewAccountRole(dialog.row.user_id, { approve: dialog.approve, role: dialog.approve ? role : null, note });
      setToast(dialog.approve ? `${dialog.row.email}: ${ROLE_LABELS[role]} access approved` : `${dialog.row.email}: request rejected`);
      setTimeout(() => setToast(null), 3500);
      setDialog(null);
      load();
    } catch (e) {
      setToast(e.message);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  const term = q.trim().toLowerCase();
  const shown = (rows || []).filter(r => !term || [r.email, r.name, r.org_name, r.district, r.region]
    .some(v => v && String(v).toLowerCase().includes(term)));

  return (
    <div className="p-4">
      {toast && <div role="status" className="fixed bottom-4 right-4 z-[60] px-4 py-2 rounded shadow-lg text-white bg-gray-800">{toast}</div>}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="mr-auto">
          <h1 className="text-[28px] leading-tight font-bold text-td-ink">Account approvals</h1>
          <p className="text-sm text-td-sage">People who asked for Volunteer, Media, Manager or Authority access at sign-up. Until approved they work as Users.</p>
        </div>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, organisation, district"
          className="border border-td-border-strong rounded-lg px-3 py-2 text-sm w-72 max-w-full" aria-label="Search accounts" />
      </div>
      <div className="inline-flex rounded-md border border-td-border-strong overflow-hidden bg-white mb-4" role="tablist">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm ${tab === t.key ? 'bg-green-600 text-white' : 'text-td-ink hover:bg-td-cream'}`}>{t.label}</button>
        ))}
      </div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full table-fixed text-sm" data-testid="accounts-table">
          <thead className="bg-td-cream text-xs uppercase text-td-sage text-left">
            <tr>
              <th className="px-3 py-3 w-[24%]">Person</th>
              <th className="px-3 py-3 w-[22%]">Organisation / type</th>
              <th className="px-3 py-3 w-[13%]">Asked for</th>
              <th className="px-3 py-3 w-[13%]">Has now</th>
              <th className="px-3 py-3 w-[11%]">Signed up</th>
              <th className="px-3 py-3 w-[17%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-td-border">
            {rows === null ? <tr><td colSpan="6" className="py-10 text-center text-td-sage">Loading…</td></tr>
              : shown.length === 0 ? <tr><td colSpan="6" className="py-10 text-center text-td-sage">{tab === 'pending' ? 'No one is waiting for approval.' : 'No accounts here.'}</td></tr>
              : shown.map(r => (
                <tr key={r.user_id} className="align-top" data-testid="account-row">
                  <td className="px-3 py-3">
                    <div className="font-medium text-td-ink truncate">{r.name}</div>
                    <div className="text-xs text-td-sage truncate">{r.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="truncate">{r.org_name || '—'}</div>
                    <div className="text-xs text-td-sage truncate">{companyLabel(r.company_type)}{where(r) ? ` · ${where(r)}` : ''}</div>
                    {detailEntries(r.details).length > 0 && <div className="text-xs text-td-sage truncate" title={detailEntries(r.details).map(([k, v]) => `${detailLabel(k)}: ${v}`).join('\n')}>{detailEntries(r.details).map(([k, v]) => `${detailLabel(k)}: ${v}`).join(' · ')}</div>}
                  </td>
                  <td className="px-3 py-3">{ROLE_LABELS[r.requested_role] || r.requested_role}<div className="mt-1"><StatusPill status={r.status} /></div></td>
                  <td className="px-3 py-3">{ROLE_LABELS[r.role] || r.role}{r.review_note && <div className="text-xs text-td-sage mt-1 line-clamp-2" title={r.review_note}>{r.review_note}</div>}</td>
                  <td className="px-3 py-3 text-td-sage">{date(r.signed_up_at || r.created_at)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {r.user_id === user?.id ? <span className="text-xs text-td-sage">You</span> : (
                      <>
                        <button type="button" onClick={() => open(r, true)} className="text-green-700 hover:underline mr-3">
                          {r.status === 'pending' ? 'Approve' : 'Change role'}
                        </button>
                        {r.status === 'pending' && <button type="button" onClick={() => open(r, false)} className="text-red-600 hover:underline">Reject</button>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-td-sage mt-3">Admins are the whitelisted TrashDrop emails and aren't listed as requests. Every decision is recorded in Logs and the person gets a notification.</p>

      {dialog && (
        <ConfirmDialog
          title={dialog.approve ? `Give ${dialog.row.email} access` : `Reject ${dialog.row.email}'s request`}
          confirmLabel={dialog.approve ? 'Save' : 'Reject'} danger={!dialog.approve} busy={busy}
          confirmDisabled={(!dialog.approve && !note.trim()) || areaMissing} onConfirm={save} onClose={() => setDialog(null)}>
          <p>{dialog.row.name} · {companyLabel(dialog.row.company_type)}{dialog.row.org_name ? ` · ${dialog.row.org_name}` : ''}</p>
          <DetailsList row={dialog.row} />
          {dialog.approve && (
            <label className="block">Access level
              <select value={role} onChange={e => setRole(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5" data-testid="role-select">
                {ASSIGNABLE.map(x => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}
              </select>
            </label>
          )}
          {dialog.approve && needsRegion(role, dialog.row.company_type) && (
            <div className="grid grid-cols-2 gap-2" data-testid="area-fields">
              <label className="block">Region
                <select value={areaRegion} onChange={e => { setAreaRegion(e.target.value); setAreaDistrict(''); }} className="mt-1 w-full border rounded px-2 py-1.5" data-testid="area-region">
                  <option value="">Select region</option>
                  {GHANA_REGIONS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </label>
              {needsDistrict(role) && (
                <label className="block">District
                  <select value={areaDistrict} onChange={e => setAreaDistrict(e.target.value)} disabled={!areaRegion} className="mt-1 w-full border rounded px-2 py-1.5" data-testid="area-district">
                    <option value="">Select district</option>
                    {districtsOf(areaRegion).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              )}
              <p className="col-span-2 text-xs text-td-sage">
                {needsDistrict(role) ? 'An Authority sees reports in this district only.'
                  : assignsPickups(role, dialog.row.company_type) ? 'This Manager assigns pickup requests in this region only, to collectors in this region.'
                  : 'A Volunteer works on reports in this region.'}
                {dialog.row.district && !districtsOf(knownRegion(dialog.row.region)).includes(dialog.row.district) ? ` They wrote "${dialog.row.district}"; pick the matching district.` : ''}
              </p>
            </div>
          )}
          <label className="block">{dialog.approve ? 'Note (optional, e.g. how you verified them)' : 'Reason (shown to the person)'}
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="mt-1 w-full border rounded px-2 py-1.5" />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default AccountApprovals;
