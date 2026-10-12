import React, { useEffect, useState } from 'react';
import { card, input, muted, border } from '../pickupRequests/theme';
import {
  EMPTY_COLLECTOR_FORM, VEHICLE_TYPES, formFromCollector, validateCollectorForm, vehicleTypeInfo,
} from '../../utils/collectorAdminUtils';

const Field = ({ label, required, error, hint, children, wide, htmlFor }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <label htmlFor={htmlFor} className="block text-sm font-medium mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error ? <p className="text-xs text-red-600 mt-1" role="alert">{error}</p> : hint ? <p className="text-xs mt-1" style={muted}>{hint}</p> : null}
  </div>
);

/**
 * Add / Edit collector. The form starts from scratch every time it opens
 * (the page mounts it fresh with a key), so nothing leaks between Add and Edit.
 */
const CollectorFormModal = ({ collector = null, collectors, zones, busy, serverError, onSave, onClose }) => {
  const editing = !!collector;
  const [form, setForm] = useState(() => (editing ? formFromCollector(collector) : { ...EMPTY_COLLECTOR_FORM }));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const set = (name) => (e) => {
    const next = { ...form, [name]: e.target.value };
    setForm(next);
    if (touched) setErrors(validateCollectorForm(next, collectors, collector?.id).errors);
  };

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    const result = validateCollectorForm(form, collectors, collector?.id);
    setErrors(result.errors);
    if (Object.keys(result.errors).length === 0) onSave(result.values);
  };

  // The collector's current zone/type stays selectable even if it's not in the lists
  const zoneList = form.zone && !zones.includes(form.zone) ? [...zones, form.zone] : zones;
  const currentType = vehicleTypeInfo(form.vehicleType);
  const typeList = currentType && !VEHICLE_TYPES.some(t => t.key === currentType.key) ? [...VEHICLE_TYPES, currentType] : VEHICLE_TYPES;
  const ctl = (name) => ({
    id: `collector-${name}`, name, value: form[name], onChange: set(name), disabled: busy,
    className: `w-full px-3 py-2 border rounded text-sm ${errors[name] ? 'border-red-500' : ''}`, style: errors[name] ? { ...input, borderColor: '#EF4444' } : input,
    'aria-invalid': !!errors[name],
  });

  return (
    <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4" onClick={() => !busy && onClose()}>
      <form onSubmit={submit} noValidate className="rounded-lg shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto border" style={card}
        role="dialog" aria-modal="true" aria-labelledby="collector-form-title" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b px-5 py-3 flex items-center" style={{ ...card, ...border }}>
          <h2 id="collector-form-title" className="font-semibold">{editing ? `Edit ${collector.name}` : 'Add collector'}</h2>
          <button type="button" onClick={onClose} disabled={busy} className="ml-auto text-xl leading-none" style={muted} aria-label="Close">&times;</button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {serverError && <p className="sm:col-span-2 rounded border border-red-300 bg-red-50 text-red-800 p-3 text-sm" role="alert">{serverError}</p>}

          <Field label="First name" required error={errors.firstName} htmlFor="collector-firstName">
            <input type="text" autoComplete="given-name" {...ctl('firstName')} />
          </Field>
          <Field label="Last name" error={errors.lastName} htmlFor="collector-lastName">
            <input type="text" autoComplete="family-name" {...ctl('lastName')} />
          </Field>
          <Field label="Phone" required error={errors.phone} hint="Collectors sign in with this number. 024…, 233… or +233… all work." htmlFor="collector-phone">
            <input type="tel" inputMode="tel" placeholder="024 123 4567" autoComplete="tel" {...ctl('phone')} />
          </Field>
          <Field label="Email" error={errors.email} hint="Optional" htmlFor="collector-email">
            <input type="email" placeholder="name@example.com" autoComplete="email" {...ctl('email')} />
          </Field>
          <Field label="Service zone" error={errors.zone} htmlFor="collector-zone">
            <select {...ctl('zone')}>
              <option value="">Unassigned</option>
              {zoneList.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          {!editing ? (
            <Field label="Status" htmlFor="collector-status">
              <select {...ctl('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          ) : (
            <Field label="Status">
              <p className="py-2 text-sm capitalize">{collector.status} <span style={muted}>· use Deactivate / Reactivate</span></p>
            </Field>
          )}

          <fieldset className="sm:col-span-2 rounded border p-3 grid grid-cols-1 sm:grid-cols-3 gap-3" style={border}>
            <legend className="px-1 text-sm font-medium">Vehicle</legend>
            <Field label="Type" error={errors.vehicleType} htmlFor="collector-vehicleType">
              <select {...ctl('vehicleType')}>
                <option value="">Not set</option>
                {typeList.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Registration" error={errors.vehicleRegistration} htmlFor="collector-vehicleRegistration">
              <input type="text" placeholder="GR 1234-21" {...ctl('vehicleRegistration')} />
            </Field>
            <Field label="Capacity (bags)" error={errors.vehicleCapacityBags} htmlFor="collector-vehicleCapacityBags">
              <input type="number" min="1" max="500" step="1" inputMode="numeric" {...ctl('vehicleCapacityBags')} />
            </Field>
          </fieldset>

          <Field label="Notes" wide htmlFor="collector-notes">
            <textarea rows="3" placeholder="Anything the team should know" {...ctl('notes')} />
          </Field>

          {editing && (
            <p className="sm:col-span-2 text-xs" style={muted}>
              ID <span className="font-mono">{collector.id}</span>
              {collector.joinDate ? ` · joined ${new Date(collector.joinDate).toLocaleDateString()}` : ''}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 border-t px-5 py-3 flex justify-end gap-2" style={{ ...card, ...border }}>
          <button type="button" className="px-4 py-2 rounded text-sm border" style={{ ...border, ...muted }} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add collector'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CollectorFormModal;
