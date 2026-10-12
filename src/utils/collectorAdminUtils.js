/**
 * Helpers for the Collectors page (/request-pickup/collectors): Ghana phone
 * numbers, email checks, vehicle fields, service zones, search, filters,
 * sorting and form validation.
 */
import { collectorPresence } from './liveMapUtils';
import { EMPTY_JOB_COUNTS } from './pickupRequestUtils';

/* ── phone ──────────────────────────────────────────────────────────────── */

/**
 * Ghana mobile/landline number as +233XXXXXXXXX, or null when it isn't one.
 * Accepts 0XX XXX XXXX, 233XXXXXXXXX, +233XXXXXXXXX, 00233…, with spaces,
 * dashes, dots or brackets.
 */
export const normalizeGhanaPhone = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw || /[a-z@]/i.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00233')) digits = digits.slice(5);
  else if (digits.startsWith('233')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  else if (raw.startsWith('+')) return null; // another country code
  if (!/^[2-5]\d{8}$/.test(digits)) return null;
  return `+233${digits}`;
};

/** The 9 national digits of a stored phone (any format), or '' */
export const nationalDigits = (value) => {
  const n = normalizeGhanaPhone(value);
  return n ? n.slice(4) : '';
};

/** +233 24 123 4567 */
export const formatGhanaPhone = (value) => {
  const n = normalizeGhanaPhone(value);
  if (!n) return value ? String(value) : '';
  const d = n.slice(4);
  return `+233 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
};

/* ── email ──────────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export const isValidEmail = (value) => EMAIL_RE.test(String(value || '').trim());

/** Stored email worth showing: not blank, not a placeholder, not a phone number */
export const cleanEmail = (value) => {
  const v = String(value ?? '').trim();
  if (!v || !isValidEmail(v)) return null;
  return v.toLowerCase();
};

/* ── vehicle ────────────────────────────────────────────────────────────── */

/** Types offered in the Add/Edit form */
export const VEHICLE_TYPES = [
  { key: 'cart', label: 'Cart', icon: 'fas fa-shopping-cart' },
  { key: 'motorcycle', label: 'Motorcycle', icon: 'fas fa-motorcycle' },
  { key: 'tricycle', label: 'Tricycle', icon: 'fas fa-truck-pickup' },
  { key: 'truck', label: 'Truck', icon: 'fas fa-truck' },
];
/** Also chosen at sign-up in the collector app; shown and kept, not offered for new entries */
export const OTHER_VEHICLE_TYPES = [
  { key: 'van', label: 'Van', icon: 'fas fa-shuttle-van' },
  { key: 'bicycle', label: 'Bicycle', icon: 'fas fa-bicycle' },
  { key: 'other', label: 'Other', icon: 'fas fa-car' },
];
const ALL_VEHICLE_TYPES = [...VEHICLE_TYPES, ...OTHER_VEHICLE_TYPES];

const VEHICLE_ALIASES = {
  pushcart: 'cart', 'push cart': 'cart', handcart: 'cart',
  motorbike: 'motorcycle', 'motor bike': 'motorcycle', okada: 'motorcycle',
  'motor king': 'tricycle', motorking: 'tricycle', aboboyaa: 'tricycle', 'tricycle (aboboyaa)': 'tricycle', 'tuk tuk': 'tricycle', 'tuk-tuk': 'tricycle',
  lorry: 'truck', 'pickup truck': 'truck',
  bike: 'bicycle',
};

/** A vehicle type key, or null when unknown/missing */
export const normalizeVehicleType = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v || v === 'n/a') return null;
  if (ALL_VEHICLE_TYPES.some(t => t.key === v)) return v;
  return VEHICLE_ALIASES[v] || null;
};

export const vehicleTypeInfo = (value) => ALL_VEHICLE_TYPES.find(t => t.key === normalizeVehicleType(value)) || null;

const present = (v) => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim().toUpperCase() !== 'N/A';

/** "Tricycle · GR 1234-21 · 20 bags", or null when nothing is known */
export const vehicleSummary = ({ vehicleType, vehicleRegistration, vehicleCapacityBags } = {}) => {
  const parts = [];
  const type = vehicleTypeInfo(vehicleType);
  if (type) parts.push(type.label);
  else if (present(vehicleType)) parts.push(String(vehicleType));
  if (present(vehicleRegistration)) parts.push(String(vehicleRegistration).toUpperCase());
  if (present(vehicleCapacityBags)) parts.push(`${vehicleCapacityBags} bag${Number(vehicleCapacityBags) === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : null;
};

/* ── zones ──────────────────────────────────────────────────────────────── */

export const UNASSIGNED = '__unassigned__';

/** Placeholders the old form saved by default (it preselected the first one) */
export const LEGACY_PLACEHOLDER_ZONES = ['North District', 'South District', 'East District', 'West District', 'Central District'];

/** The stored zone, or null for blank/"Unassigned"/"N/A"/old placeholders */
export const zoneOf = (value) => {
  const v = String(value ?? '').trim();
  if (!v || /^(unassigned|n\/a|none|null)$/i.test(v)) return null;
  if (LEGACY_PLACEHOLDER_ZONES.some(z => z.toLowerCase() === v.toLowerCase())) return null;
  return v;
};

/** Zone list for selects: configured zones first, then any other zone a collector already has */
export const zoneOptions = (zones, collectors = []) => {
  const names = [...zones];
  collectors.forEach(c => {
    if (c.zone && !names.some(n => n.toLowerCase() === c.zone.toLowerCase())) names.push(c.zone);
  });
  return names;
};

/* ── search, filters, sorting ───────────────────────────────────────────── */

/** Text search over name, email, ID and phone (+233…, 233… and 0… all match) */
export const matchesCollectorSearch = (collector, query) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const text = [collector.name, collector.email, collector.id, collector.zone, collector.vehicleRegistration]
    .filter(Boolean).join(' ').toLowerCase();
  if (text.includes(q)) return true;
  const qDigits = q.replace(/\D/g, '');
  if (qDigits.length >= 3 && /^[+\d\s().-]+$/.test(q)) {
    let core = qDigits;
    if (core.startsWith('00233')) core = core.slice(5);
    else if (core.startsWith('233')) core = core.slice(3);
    else if (core.startsWith('0')) core = core.slice(1);
    const phone = nationalDigits(collector.phone) || String(collector.phone || '').replace(/\D/g, '');
    return core.length > 0 && phone.includes(core);
  }
  return false;
};

export const DEFAULT_COLLECTOR_FILTERS = { q: '', status: 'all', zone: 'all', presence: 'all', sort: 'name', dir: 'asc' };

export const SORTS = [
  { key: 'name', label: 'Name', dir: 'asc' },
  { key: 'pickups', label: 'Pickups', dir: 'desc' },
  { key: 'rating', label: 'Rating', dir: 'desc' },
  { key: 'lastSeen', label: 'Last seen', dir: 'desc' },
];

/** Collector with its stats and presence, for display */
export const withCollectorStats = (collector, jobCounts = {}, now = Date.now()) => ({
  ...collector,
  jobs: jobCounts[collector.id] || EMPTY_JOB_COUNTS,
  presence: collectorPresence(collector, now),
});

export const filterCollectors = (collectors, f) => collectors.filter(c => {
  if (f.status !== 'all' && c.status !== f.status) return false;
  if (f.zone === UNASSIGNED && c.zone) return false;
  if (f.zone !== 'all' && f.zone !== UNASSIGNED && String(c.zone || '').toLowerCase() !== String(f.zone).toLowerCase()) return false;
  if (f.presence === 'online' && c.presence.key !== 'online') return false;
  if (f.presence === 'recent' && c.presence.key === 'offline') return false;
  if (f.presence === 'offline' && c.presence.key !== 'offline') return false;
  return matchesCollectorSearch(c, f.q);
});

const seenTime = (c) => {
  if (!c.presence?.lastSeen) return null; // new Date(null) is 1970, not "never"
  const t = new Date(c.presence.lastSeen).getTime();
  return Number.isFinite(t) ? t : null;
};

export const sortCollectors = (collectors, sort = 'name', dir = 'asc') => {
  const sign = dir === 'desc' ? -1 : 1;
  const value = {
    name: (c) => String(c.name || '').toLowerCase(),
    pickups: (c) => c.jobs?.completed ?? 0,
    rating: (c) => c.jobs?.rating,
    lastSeen: seenTime,
  }[sort] || ((c) => String(c.name || '').toLowerCase());
  return [...collectors].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Missing values (no ratings, never seen) always go last
    if (va === null || va === undefined) return vb === null || vb === undefined ? String(a.name).localeCompare(String(b.name)) : 1;
    if (vb === null || vb === undefined) return -1;
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    return String(a.name).localeCompare(String(b.name));
  });
};

/* ── form ───────────────────────────────────────────────────────────────── */

export const EMPTY_COLLECTOR_FORM = Object.freeze({
  firstName: '', lastName: '', email: '', phone: '', status: 'active', zone: '',
  vehicleType: '', vehicleRegistration: '', vehicleCapacityBags: '', notes: '',
});

/** Form values for an existing collector */
export const formFromCollector = (c) => ({
  firstName: c.firstName || '',
  lastName: c.lastName || '',
  email: c.email || '',
  phone: formatGhanaPhone(c.phone) || '',
  status: c.status === 'inactive' ? 'inactive' : (c.status || 'active'),
  zone: c.zone || '',
  vehicleType: normalizeVehicleType(c.vehicleType) || '',
  vehicleRegistration: present(c.vehicleRegistration) ? c.vehicleRegistration : '',
  vehicleCapacityBags: present(c.vehicleCapacityBags) ? String(c.vehicleCapacityBags) : '',
  notes: c.notes || '',
});

/**
 * Validate the Add/Edit form against the loaded collectors.
 * @returns {{ errors: object, values: object }} values are cleaned and ready to save
 */
export const validateCollectorForm = (form, collectors = [], editingId = null) => {
  const errors = {};
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const email = form.email.trim().toLowerCase();
  const phone = normalizeGhanaPhone(form.phone);
  const bags = String(form.vehicleCapacityBags ?? '').trim();

  if (!firstName) errors.firstName = 'Enter a first name';
  if (!form.phone.trim()) errors.phone = 'Enter a phone number (collectors sign in with it)';
  else if (!phone) errors.phone = 'Enter a Ghana number, e.g. 024 123 4567 or +233 24 123 4567';
  if (email && !isValidEmail(email)) errors.email = 'Enter a valid email address, or leave it empty';
  if (form.vehicleType && !ALL_VEHICLE_TYPES.some(t => t.key === form.vehicleType)) errors.vehicleType = 'Choose a vehicle type';
  if (bags && !(/^\d+$/.test(bags) && Number(bags) > 0 && Number(bags) <= 500)) errors.vehicleCapacityBags = 'Enter a whole number of bags (1–500)';

  const others = collectors.filter(c => c.id !== editingId);
  if (phone) {
    const clash = others.find(c => normalizeGhanaPhone(c.phone) === phone);
    if (clash) errors.phone = `${clash.name} already uses this phone number`;
  }
  if (email && !errors.email) {
    const clash = others.find(c => c.email && c.email.toLowerCase() === email);
    if (clash) errors.email = `${clash.name} already uses this email`;
  }

  return {
    errors,
    values: {
      firstName,
      lastName,
      email: email || null,
      phone,
      status: form.status === 'inactive' ? 'inactive' : 'active',
      zone: zoneOf(form.zone),
      vehicleType: form.vehicleType || null,
      vehicleRegistration: form.vehicleRegistration.trim().toUpperCase() || null,
      vehicleCapacityBags: bags ? Number(bags) : null,
      notes: form.notes.trim() || null,
    },
  };
};

/** Why Assign Pickups is unavailable for this collector, or null when it is */
export const assignBlockedReason = (c) => {
  if (c.status !== 'active') return 'Collector is inactive';
  if (!c.userId) return 'No app account linked: the collector has not signed in to the collector app';
  if (c.presence?.key === 'offline') return c.presence.lastSeen ? 'Collector is offline (not seen in the last 24 hours)' : 'Collector is offline (never reported a location)';
  return null;
};
