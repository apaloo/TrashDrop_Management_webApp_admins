import React, { useCallback, useEffect, useState } from 'react';
import { listPaymentsToConfirm, decidePayment } from '../services/paymentConfirmationService';
import ConfirmDialog from '../components/pickupRequests/ConfirmDialog';

const when = (v) => (v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const cedis = (v) => `GH₵${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const state = (r) => (r.status === 'success'
  ? (r.confirmed_by === 'collector' ? 'Collector says paid' : 'Paid, not confirmed')
  : 'Waiting for the client');

/**
 * Digital-bin MoMo payments the payment gateway hasn't confirmed. Collectors
 * can cash a bin out only once its payment is confirmed (TD53). Check the
 * transaction in TrendiPay, then confirm it or mark it failed.
 */
const PaymentConfirmations = () => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null); // { row, decision }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    setRows(null);
    listPaymentsToConfirm()
      .then(r => { setRows(r); setError(null); })
      .catch(e => { setRows([]); setError(e.message); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (text) => { setToast(text); setTimeout(() => setToast(null), 3500); };
  const open = (row, decision) => { setDialog({ row, decision }); setNote(''); };

  const save = async () => {
    setBusy(true);
    try {
      await decidePayment(dialog.row.id, dialog.decision, note);
      flash(dialog.decision === 'confirm'
        ? `${cedis(dialog.row.total_bill)} from ${dialog.row.client_momo}: confirmed`
        : `${cedis(dialog.row.total_bill)} from ${dialog.row.client_momo}: marked failed`);
      setDialog(null);
      load();
    } catch (e) {
      flash(e.message);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4">
      {toast && <div role="status" className="fixed bottom-4 right-4 z-[60] px-4 py-2 rounded shadow-lg text-white bg-gray-800">{toast}</div>}
      <div className="mb-4">
        <h1 className="text-[28px] leading-tight font-bold text-td-ink">MoMo payments to confirm</h1>
        <p className="text-sm text-td-sage">Digital-bin payments TrendiPay hasn't confirmed. A collector can cash a bin out only once its payment is confirmed. Look the transaction up in TrendiPay, then confirm it or mark it failed.</p>
      </div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm" data-testid="payments-table">
          <thead className="bg-td-cream text-xs uppercase text-td-sage text-left">
            <tr>
              <th className="px-3 py-3">Collector</th>
              <th className="px-3 py-3">Client paid</th>
              <th className="px-3 py-3">TrendiPay reference</th>
              <th className="px-3 py-3">State</th>
              <th className="px-3 py-3">Started</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-td-border">
            {rows === null ? <tr><td colSpan="6" className="py-10 text-center text-td-sage">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan="6" className="py-10 text-center text-td-sage">Nothing to confirm.</td></tr>
              : rows.map(r => (
                <tr key={r.id} className="align-top" data-testid="payment-row">
                  <td className="px-3 py-3">
                    <div className="font-medium text-td-ink">{r.collector_name}</div>
                    <div className="text-xs text-td-sage">Bin {String(r.digital_bin_id || '').slice(0, 8)} · {r.bin_status || '—'}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-td-ink">{cedis(r.total_bill)}</div>
                    <div className="text-xs text-td-sage">{r.payment_mode === 'e_cash' ? 'e-Cash' : 'MoMo'} {r.client_momo}</div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-td-ink">{r.gateway_reference || r.gateway_transaction_id || '—'}</td>
                  <td className="px-3 py-3 text-td-ink">{state(r)}</td>
                  <td className="px-3 py-3 text-td-sage whitespace-nowrap">{when(r.created_at)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => open(r, 'confirm')} className="text-green-700 hover:underline mr-3">Confirm paid</button>
                    <button type="button" onClick={() => open(r, 'fail')} className="text-red-700 hover:underline">Mark failed</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-td-sage mt-3">Payments TrendiPay confirms leave this list by themselves. Every decision is recorded in Logs with your note.</p>

      {dialog && (
        <ConfirmDialog
          title={dialog.decision === 'confirm' ? `Confirm ${cedis(dialog.row.total_bill)} was paid` : `Mark ${cedis(dialog.row.total_bill)} as failed`}
          confirmLabel={dialog.decision === 'confirm' ? 'Confirm paid' : 'Mark failed'} danger={dialog.decision === 'fail'} busy={busy}
          confirmDisabled={!note.trim()} onConfirm={save} onClose={() => setDialog(null)}>
          <p>{dialog.row.collector_name} · {dialog.row.client_momo} · reference {dialog.row.gateway_reference || dialog.row.gateway_transaction_id || 'none'}</p>
          {dialog.decision === 'confirm'
            ? <p>Only confirm once TrendiPay shows this payment as successful. The collector can then cash this bin out.</p>
            : <p>The collector won't be able to cash this bin out.</p>}
          <label className="block">What you checked in TrendiPay (recorded in Logs)
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="mt-1 w-full border rounded px-2 py-1.5" />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default PaymentConfirmations;
