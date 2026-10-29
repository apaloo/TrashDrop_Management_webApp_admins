import React, { useEffect, useState } from 'react';
import { card, input, muted, border } from '../pickupRequests/theme';
import { ALERT_PRIORITIES, ALERT_TYPES, ENTITY_TYPES } from '../../constants/alerts';
import RecordPicker from './RecordPicker';
import LocationPicker from './LocationPicker';

const EMPTY = { title: '', description: '', type: 'system', priority: 'medium', entityType: 'system', entity: null, assignedTo: '', location: null };

/** New alert by hand. Related record: searchable picker; location: address search or map. */
const CreateAlertModal = ({ requests, collectors, zones, staff, busy, error, onCreate, onClose }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const changeEntityType = (entityType) => {
    // Keep the type in step with what the alert is about
    const typeFits = ALERT_TYPES.find(t => t.key === form.type)?.entity === entityType;
    set({ entityType, entity: null, type: typeFits ? form.type : (ALERT_TYPES.find(t => t.entity === entityType)?.key || 'system') });
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = 'Enter a title';
    if (form.entityType !== 'system' && !form.entity) errs.entity = 'Pick the record this alert is about';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onCreate({ ...form, entity: form.entityType === 'system' ? null : form.entity });
  };

  const types = ALERT_TYPES.filter(t => form.entityType === 'system' || t.entity === form.entityType || t.key === 'system');

  return (
    <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4" onClick={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="rounded-xl shadow-xl w-full max-w-2xl max-h-[94vh] overflow-y-auto border" style={card}
        role="dialog" aria-modal="true" aria-labelledby="create-alert-title" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b px-5 py-3 flex items-center" style={{ ...card, ...border }}>
          <h2 id="create-alert-title" className="font-semibold">Create alert</h2>
          <button type="button" onClick={onClose} disabled={busy} className="ml-auto text-xl leading-none" style={muted} aria-label="Close">&times;</button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {error && <p className="sm:col-span-2 rounded border border-red-300 bg-red-50 text-red-800 p-3" role="alert">{error}</p>}
          <label className="sm:col-span-2">
            <span className="block font-medium mb-1">Title <span className="text-red-500">*</span></span>
            <input value={form.title} onChange={e => set({ title: e.target.value })} className="w-full border rounded px-3 py-2" style={input} aria-invalid={!!errors.title} />
            {errors.title && <span className="text-xs text-red-600">{errors.title}</span>}
          </label>
          <label className="sm:col-span-2">
            <span className="block font-medium mb-1">Description</span>
            <textarea rows="3" value={form.description} onChange={e => set({ description: e.target.value })} className="w-full border rounded px-3 py-2" style={input} />
          </label>
          <label>
            <span className="block font-medium mb-1">Related to</span>
            <select value={form.entityType} onChange={e => changeEntityType(e.target.value)} className="w-full border rounded px-2 py-2" style={input}>
              {ENTITY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <label>
            <span className="block font-medium mb-1">Type</span>
            <select value={form.type} onChange={e => set({ type: e.target.value })} className="w-full border rounded px-2 py-2" style={input}>
              {types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          {form.entityType !== 'system' && (
            <div className="sm:col-span-2">
              <span className="block font-medium mb-1">{ENTITY_TYPES.find(t => t.key === form.entityType).label} <span className="text-red-500">*</span></span>
              <RecordPicker kind={form.entityType} value={form.entity} onChange={entity => set({ entity })}
                requests={requests} collectors={collectors} zones={zones} />
              {errors.entity && <span className="text-xs text-red-600">{errors.entity}</span>}
            </div>
          )}
          <label>
            <span className="block font-medium mb-1">Priority</span>
            <select value={form.priority} onChange={e => set({ priority: e.target.value })} className="w-full border rounded px-2 py-2" style={input}>
              {ALERT_PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label>
            <span className="block font-medium mb-1">Assign to</span>
            <select value={form.assignedTo} onChange={e => set({ assignedTo: e.target.value })} className="w-full border rounded px-2 py-2" style={input}>
              <option value="">Unassigned</option>
              {staff.filter(u => u.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <span className="block font-medium mb-1">Location <span className="font-normal" style={muted}>(optional)</span></span>
            <LocationPicker value={form.location} onChange={location => set({ location })} />
          </div>
        </div>
        <div className="sticky bottom-0 border-t px-5 py-3 flex justify-end gap-2" style={{ ...card, ...border }}>
          <button type="button" className="px-4 py-2 rounded text-sm border" style={{ ...border, ...muted }} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
            {busy ? 'Creating…' : 'Create alert'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateAlertModal;
