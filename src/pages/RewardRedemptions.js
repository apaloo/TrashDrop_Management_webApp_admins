import React, { useCallback, useEffect, useState } from 'react';
import { listRedemptions, setRedemptionStatus } from '../services/rewardRedemptionService';
import ConfirmDialog from '../components/pickupRequests/ConfirmDialog';

const TABS = [
  { key: 'pending', label: 'To send' },
  { key: 'sent', label: 'Sent' },
  { key: 'rejected', label: 'Rejected' },
];

const when = (v) => (v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
// 0244123456 → 024 412 3456
const phone = (p) => (p && p.length === 10 ? `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}` : p || '—');
const cedis = (points) => `GH₵${(Number(points || 0) / 200).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

/**
 * Airtime and data households redeemed with their points. Staff top up the
 * number on the given network, then mark it Sent; Reject gives the points back.
 */
const RewardRedemptions = () => {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null); // { row, status }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    setRows(null);
    listRedemptions(tab)
      .then(r => { setRows(r); setError(null); })
      .catch(e => { setRows([]); setError(e.message); });
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const flash = (text) => { setToast(text); setTimeout(() => setToast(null), 3500); };

  const open = (row, status) => { setDialog({ row, status }); setNote(''); };

  const save = async () => {
    setBusy(true);
    try {
      await setRedemptionStatus(dialog.row.id, dialog.status, note.trim());
      flash(dialog.status === 'sent'
        ? `${dialog.row.reward_name} to ${phone(dialog.row.phone_number)}: marked sent`
        : `${dialog.row.reward_name}: rejected, ${dialog.row.points_spent} points returned`);
      setDialog(null);
      load();
    } catch (e) {
      flash(e.message);
      load();
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); flash(`Copied ${phone(text)}`); } catch { /* not available */ }
  };

  return (
    <div className="p-4">
      {toast && <div role="status" className="fixed bottom-4 right-4 z-[60] px-4 py-2 rounded shadow-lg text-white bg-gray-800">{toast}</div>}
      <div className="mb-4">
        <h1 className="text-[28px] leading-tight font-bold text-td-ink">Reward redemptions</h1>
        <p className="text-sm text-td-sage">Airtime and data households redeemed with their points (200 points = GH₵1). Top up the number on its network, then mark it sent.</p>
      </div>
      <div className="inline-flex rounded-md border border-td-border-strong overflow-hidden bg-white mb-4" role="tablist">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm ${tab === t.key ? 'bg-green-600 text-white' : 'text-td-ink hover:bg-td-cream'}`}>{t.label}</button>
        ))}
      </div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm" data-testid="redemptions-table">
          <thead className="bg-td-cream text-xs uppercase text-td-sage text-left">
            <tr>
              <th className="px-3 py-3">Household</th>
              <th className="px-3 py-3">Reward</th>
              <th className="px-3 py-3">Send to</th>
              <th className="px-3 py-3">{tab === 'pending' ? 'Asked' : tab === 'sent' ? 'Sent' : 'Rejected'}</th>
              <th className="px-3 py-3 text-right">{tab === 'pending' ? 'Actions' : 'Note'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-td-border">
            {rows === null ? <tr><td colSpan="5" className="py-10 text-center text-td-sage">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan="5" className="py-10 text-center text-td-sage">{tab === 'pending' ? 'Nothing to send.' : 'None yet.'}</td></tr>
              : rows.map(r => (
                <tr key={r.id} className="align-top" data-testid="redemption-row">
                  <td className="px-3 py-3">
                    <div className="font-medium text-td-ink">{r.household_name || '—'}</div>
                    <div className="text-xs text-td-sage">{r.household_email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-td-ink">{r.reward_name || 'Reward'}</div>
                    <div className="text-xs text-td-sage">{Number(r.points_spent || 0).toLocaleString('en-GB')} points · {cedis(r.points_spent)}</div>
                  </td>
                  <td className="px-3 py-3">
                    {r.phone_number ? (
                      <>
                        <button type="button" onClick={() => copy(r.phone_number)} className="font-mono text-td-ink hover:underline" title="Copy number">{phone(r.phone_number)}</button>
                        <div className="text-xs text-td-sage">{r.network || 'Network not given'}</div>
                      </>
                    ) : <span className="text-xs text-td-sage">No number (older reward)</span>}
                  </td>
                  <td className="px-3 py-3 text-td-sage whitespace-nowrap">{when(tab === 'sent' ? r.sent_at : r.created_at)}</td>
                  <td className="px-3 py-3 text-right">
                    {tab === 'pending' ? (
                      <span className="whitespace-nowrap">
                        <button type="button" onClick={() => open(r, 'sent')} disabled={!r.phone_number}
                          className="text-green-700 hover:underline mr-3 disabled:text-td-sage disabled:no-underline">Mark sent</button>
                        <button type="button" onClick={() => open(r, 'rejected')} className="text-red-700 hover:underline">Reject</button>
                      </span>
                    ) : <span className="text-xs text-td-sage">{r.staff_note || '—'}</span>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-td-sage mt-3">Households see each one's status in the app. Every decision is recorded in Logs.</p>

      {dialog && (
        <ConfirmDialog
          title={dialog.status === 'sent' ? `Mark ${dialog.row.reward_name} sent` : `Reject ${dialog.row.reward_name}`}
          confirmLabel={dialog.status === 'sent' ? 'Mark sent' : 'Reject'} danger={dialog.status === 'rejected'} busy={busy}
          confirmDisabled={dialog.status === 'rejected' && !note.trim()} onConfirm={save} onClose={() => setDialog(null)}>
          <p>{dialog.row.household_name} · {phone(dialog.row.phone_number)} · {dialog.row.network || 'network not given'}</p>
          {dialog.status === 'sent'
            ? <p>Only mark it sent once the {dialog.row.reward_category === 'data' ? 'data bundle' : 'airtime'} has gone through.</p>
            : <p>The household gets its {Number(dialog.row.points_spent || 0).toLocaleString('en-GB')} points back.</p>}
          <label className="block">{dialog.status === 'sent' ? 'Note (optional, e.g. transaction ID)' : 'Reason (shown in Logs)'}
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="mt-1 w-full border rounded px-2 py-1.5" />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default RewardRedemptions;
