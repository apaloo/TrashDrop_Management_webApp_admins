import React, { useMemo, useState } from 'react';
import { card, input, muted, border } from '../pickupRequests/theme';
import { shortId, shortAddress } from '../../utils/pickupRequestUtils';
import { statusLabel } from '../../constants/pickupStatus';
import { formatGhanaPhone } from '../../utils/collectorAdminUtils';

const optionsFor = (kind, { requests, collectors, zones }) => {
  if (kind === 'pickup_request') {
    return requests.map(r => ({
      type: 'pickup_request', source: r.source, ref: String(r.id),
      label: `#${shortId(r.id)} · ${r.customer?.name || 'Customer'}`,
      detail: [shortAddress(r.address), statusLabel(r.status)].filter(Boolean).join(' · '),
      search: [r.id, r.customer?.name, r.address, r.collectorName].filter(Boolean).join(' ').toLowerCase(),
    }));
  }
  if (kind === 'collector') {
    return collectors.map(c => ({
      type: 'collector', source: 'collector_profiles', ref: String(c.id),
      label: c.name, detail: [shortId(c.id), c.phone ? formatGhanaPhone(c.phone) : null, c.zone].filter(Boolean).join(' · '),
      search: [c.id, c.name, c.phone, c.email, c.zone].filter(Boolean).join(' ').toLowerCase(),
    }));
  }
  return zones.map(z => ({ type: 'region', source: 'service_zones', ref: z, label: z, detail: 'Service zone', search: z.toLowerCase() }));
};

/**
 * Search-as-you-type picker for the record an alert is about: requests by
 * short ID, customer, area or collector name; collectors by name, phone or ID;
 * service zones by name.
 */
const RecordPicker = ({ kind, value, onChange, requests = [], collectors = [], zones = [] }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const options = useMemo(() => optionsFor(kind, { requests, collectors, zones }), [kind, requests, collectors, zones]);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^#/, '');
    return (t ? options.filter(o => o.search.includes(t)) : options).slice(0, 8);
  }, [q, options]);
  const placeholder = { pickup_request: 'Search by short ID, customer, area or collector', collector: 'Search by name, phone or ID', region: 'Search service zones' }[kind];

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm" style={border} data-testid="picked-record">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{value.label}</p>
          {value.detail && <p className="text-xs truncate" style={muted}>{value.detail}</p>}
        </div>
        <button type="button" className="text-xs underline" style={muted} onClick={() => { onChange(null); setQ(''); }}>Change</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input type="search" value={q} placeholder={placeholder} aria-label={placeholder} role="combobox" aria-expanded={open} aria-controls={`record-options-${kind}`} aria-autocomplete="list"
        onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full border rounded px-3 py-2 text-sm" style={input} />
      {open && (
        <ul id={`record-options-${kind}`} role="listbox" className="absolute z-40 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded border shadow-lg text-sm" style={card}>
          {matches.length === 0 ? <li className="px-3 py-2" style={muted}>No matches</li> : matches.map(o => (
            <li key={`${o.source}-${o.ref}`} role="option" aria-selected="false">
              <button type="button" className="w-full text-left px-3 py-2 hover:bg-black hover:bg-opacity-5"
                onMouseDown={e => e.preventDefault()} onClick={() => { onChange(o); setOpen(false); }}>
                <span className="block truncate">{o.label}</span>
                <span className="block text-xs truncate" style={muted}>{o.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RecordPicker;
