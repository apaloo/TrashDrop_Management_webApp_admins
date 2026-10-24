import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { card, muted, border } from '../pickupRequests/theme';
import { StatusBadge } from '../pickupRequests/StatusBadge';
import { shortId, shortAddress, formatGhs, fullDate, relativeAge } from '../../utils/pickupRequestUtils';
import { relativeTime } from '../../utils/liveMapUtils';
import { formatGhanaPhone, vehicleSummary } from '../../utils/collectorAdminUtils';
import { IN_PROGRESS_STATUSES, canonicalStatus, statusGroup } from '../../constants/pickupStatus';
import PresenceBadge from './PresenceBadge';
import EntityHistory from '../logs/EntityHistory';

const pinFor = (color) => L.divIcon({
  className: 'custom-collector-icon',
  html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const Stat = ({ label, value, sub }) => (
  <div className="rounded border p-3" style={border}>
    <p className="text-xs" style={muted}>{label}</p>
    <p className="text-lg font-semibold leading-tight">{value}</p>
    {sub && <p className="text-xs" style={muted}>{sub}</p>}
  </div>
);

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-xs" style={muted}>{label}</p>
    <div className="font-medium break-words">{children}</div>
  </div>
);

/** Everything about one collector; requests are the summary rows already loaded on the page */
const CollectorDetailsModal = ({ collector: c, requests, onClose, onCopy, actions }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mine = (requests || []).filter(r => r.collectorProfileId === c.id);
  const active = mine.filter(r => IN_PROGRESS_STATUSES.includes(canonicalStatus(r.status)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const done = mine.filter(r => statusGroup(r.status) === 'done')
    .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
    .slice(0, 10);
  const vehicle = vehicleSummary(c);

  return (
    <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border" style={card}
        role="dialog" aria-modal="true" aria-labelledby="collector-details-title" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b px-5 py-3 flex items-center gap-3" style={{ ...card, ...border }}>
          <h2 id="collector-details-title" className="font-semibold truncate">{c.name}</h2>
          <PresenceBadge presence={c.presence} />
          {c.status !== 'active' && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 capitalize">{c.status}</span>}
          <button type="button" onClick={onClose} className="ml-auto text-xl leading-none" style={muted} aria-label="Close">&times;</button>
        </div>

        <div className="p-5 space-y-5 text-sm">
          {c.status !== 'active' && c.deactivationReason && (
            <p className="rounded border border-red-300 bg-red-50 text-red-800 p-3">
              Deactivated{c.deactivatedAt ? ` ${fullDate(c.deactivatedAt)}` : ''}: {c.deactivationReason}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Total pickups" value={c.jobs.completed} />
            <Stat label="Active jobs" value={c.jobs.active} />
            <Stat label="Rating" value={c.jobs.rating !== null ? `★ ${c.jobs.rating.toFixed(1)}` : 'No ratings yet'}
              sub={c.jobs.ratingCount ? `${c.jobs.ratingCount} rating${c.jobs.ratingCount === 1 ? '' : 's'}` : null} />
            <Stat label="Earnings" value={formatGhs(c.jobs.earnings)} sub="completed jobs" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="ID">
              <span className="font-mono text-xs">{c.id}</span>
              <button type="button" className="ml-2 text-xs underline" style={muted} onClick={() => onCopy(c.id)}>Copy</button>
            </Field>
            <Field label="Service zone">{c.zone || <span style={muted}>Unassigned</span>}
              {c.signupRegion && c.signupRegion !== c.zone && <span className="block text-xs font-normal" style={muted}>Signed up in {c.signupRegion}</span>}
            </Field>
            <Field label="Phone">{c.phone ? formatGhanaPhone(c.phone) : '—'}</Field>
            <Field label="Email">{c.email || <span style={muted}>—</span>}</Field>
            <Field label="Vehicle">{vehicle || <span style={muted}>No vehicle info</span>}</Field>
            <Field label="Joined">{c.joinDate ? new Date(c.joinDate).toLocaleDateString() : '—'}</Field>
            <Field label="Last seen">
              {c.presence.lastSeen ? <span title={fullDate(c.presence.lastSeen)}>{relativeTime(c.presence.lastSeen)}</span> : 'Never reported a location'}
            </Field>
            <Field label="Last location update">
              {c.presence.locationAt ? <span title={fullDate(c.presence.locationAt)}>{relativeTime(c.presence.locationAt)}</span> : 'Never reported a location'}
            </Field>
            <Field label="App account">{c.userId ? 'Linked' : <span className="text-amber-700">Not signed in to the collector app yet</span>}</Field>
            {c.notes && <div className="sm:col-span-2"><Field label="Notes"><span className="whitespace-pre-wrap font-normal">{c.notes}</span></Field></div>}
          </div>

          <div>
            <p className="text-xs mb-1" style={muted}>Last known location</p>
            {c.position ? (
              <div className="h-48 rounded overflow-hidden border" style={border}>
                <MapContainer center={c.position} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={c.position} icon={pinFor(c.presence.color)} />
                </MapContainer>
              </div>
            ) : <p style={muted}>{c.locationIssue ? `No usable location (${c.locationIssue})` : 'No location reported yet'}</p>}
          </div>

          <div>
            <h3 className="font-medium mb-2">Active jobs ({active.length})</h3>
            {active.length === 0 ? <p style={muted}>None</p> : (
              <ul className="divide-y rounded border" style={border}>
                {active.map(r => (
                  <li key={`${r.source}-${r.id}`} className="px-3 py-2 flex flex-wrap items-center gap-2" style={border}>
                    <span className="font-mono text-xs">#{shortId(r.id)}</span>
                    <StatusBadge status={r.status} />
                    <span className="truncate flex-1 min-w-[8rem]">{shortAddress(r.address) || 'No address'}</span>
                    <span className="text-xs" style={muted}>{relativeAge(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-2">Last {done.length || ''} completed pickups</h3>
            {done.length === 0 ? <p style={muted}>No completed pickups yet</p> : (
              <ul className="divide-y rounded border" style={border}>
                {done.map(r => (
                  <li key={`${r.source}-${r.id}`} className="px-3 py-2 flex flex-wrap items-center gap-2" style={border}>
                    <span className="font-mono text-xs">#{shortId(r.id)}</span>
                    <span className="truncate flex-1 min-w-[8rem]">{shortAddress(r.address) || 'No address'}</span>
                    <span className="text-xs" style={muted}>{fullDate(r.completedAt || r.createdAt)}</span>
                    <span className="w-24 text-right">{formatGhs(r.payouts?.total ?? r.fee)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <EntityHistory entityId={c.id} includeAssignments />

          <Link to={`/request-pickup/requests?collector=${encodeURIComponent(c.id)}`} className="inline-block text-sm text-blue-600 hover:underline">
            See all of {c.name.split(' ')[0]}'s requests on the Pickup Requests page →
          </Link>
        </div>

        {actions && <div className="sticky bottom-0 border-t px-5 py-3 flex flex-wrap justify-end gap-2" style={{ ...card, ...border }}>{actions}</div>}
      </div>
    </div>
  );
};

export default CollectorDetailsModal;
