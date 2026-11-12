import React, { useCallback, useEffect, useState } from 'react';
import { listAdmins, addAdmin, removeAdmin } from '../../services/staffAdminService';
import ConfirmDialog from '../pickupRequests/ConfirmDialog';

const date = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/**
 * Admins can add and remove other admins. The database checks the caller,
 * records every change in Logs and keeps at least one admin.
 */
const AdminsPanel = ({ currentUserId }) => {
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [removing, setRemoving] = useState(null); // admin row
  const [removeNote, setRemoveNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    listAdmins()
      .then(a => { setAdmins(a); setError(null); })
      .catch(e => { setAdmins([]); setError(e.message); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const say = (text) => { setMessage(text); setTimeout(() => setMessage(null), 4000); };

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addAdmin(email, note);
      say(`${email.trim()} is now an admin`);
      setEmail(''); setNote('');
      load();
    } catch (err) {
      say(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeAdmin(removing.userId, removeNote);
      say(`${removing.email || 'That account'} is no longer an admin`);
      setRemoving(null); setRemoveNote('');
      load();
    } catch (err) {
      say(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8" data-testid="admins-panel">
      <h2 className="text-xl font-bold text-td-ink">Admins</h2>
      <p className="text-sm text-td-sage mb-3">Admins can see and manage everything in this site. Every change is recorded in Logs, and the last admin can't be removed.</p>
      {message && <div role="status" className="mb-3 rounded border border-td-border bg-td-cream px-4 py-2 text-sm">{message}</div>}
      {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
        <table className="w-full text-sm" data-testid="admins-table">
          <thead className="bg-td-cream text-xs uppercase text-td-sage text-left">
            <tr><th className="px-3 py-3">Admin</th><th className="px-3 py-3">Since</th><th className="px-3 py-3">Note</th><th className="px-3 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-td-border">
            {admins === null ? <tr><td colSpan="4" className="py-6 text-center text-td-sage">Loading…</td></tr>
              : admins.map(a => (
                <tr key={a.userId} data-testid="admin-row">
                  <td className="px-3 py-3">{a.email || a.userId}</td>
                  <td className="px-3 py-3 text-td-sage">{date(a.addedAt)}</td>
                  <td className="px-3 py-3 text-td-sage">{a.note || '—'}</td>
                  <td className="px-3 py-3 text-right">
                    {a.userId === currentUserId ? <span className="text-xs text-td-sage">You</span>
                      : <button type="button" className="text-red-600 hover:underline" onClick={() => { setRemoving(a); setRemoveNote(''); }}>Remove</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2" data-testid="add-admin-form">
        <label className="text-sm">Email of an existing account
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-72 max-w-full border rounded px-2 py-1.5" />
        </label>
        <label className="text-sm">Note (why)
          <input type="text" value={note} onChange={e => setNote(e.target.value)} className="mt-1 block w-72 max-w-full border rounded px-2 py-1.5" />
        </label>
        <button type="submit" disabled={busy || !email.trim()} className="px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50">Make admin</button>
      </form>
      {removing && (
        <ConfirmDialog title={`Remove ${removing.email || 'this admin'}`} confirmLabel="Remove" danger busy={busy}
          onConfirm={remove} onClose={() => setRemoving(null)}>
          <p>They will keep their account but lose admin access straight away.</p>
          <label className="block">Reason (recorded in Logs)
            <textarea value={removeNote} onChange={e => setRemoveNote(e.target.value)} rows={2} className="mt-1 w-full border rounded px-2 py-1.5" />
          </label>
        </ConfirmDialog>
      )}
    </section>
  );
};

export default AdminsPanel;
