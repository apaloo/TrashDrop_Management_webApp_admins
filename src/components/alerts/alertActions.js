import { canonicalStatus, IN_PROGRESS_STATUSES } from '../../constants/pickupStatus';

export const ACTIONS = {
  assign_collector:  { label: 'Assign collector', icon: 'fas fa-user-plus' },
  open_request:      { label: 'Open request', icon: 'fas fa-external-link-alt' },
  contact_collector: { label: 'Contact collector', icon: 'fas fa-phone' },
  fix_location:      { label: 'Fix location', icon: 'fas fa-map-marker-alt' },
  merge_duplicates:  { label: 'Merge duplicates', icon: 'far fa-clone' },
  notify_customer:   { label: 'Notify customer', icon: 'fas fa-bell' },
  open_collector:    { label: 'Open collector', icon: 'fas fa-id-badge' },
  edit_collector:    { label: 'Edit collector details', icon: 'fas fa-pen' },
  open_zone:         { label: 'Collectors in this zone', icon: 'fas fa-map' },
};

/**
 * Actions that fit the alert and the current state of its record.
 * rel: relatedRecord(); rel.record is the summary request row or the collector.
 */
export const actionsFor = (alert, rel) => {
  if (!rel) return [];
  const out = [];
  if (rel.kind === 'pickup_request') {
    const r = rel.record;
    const canon = r ? canonicalStatus(r.status) : null;
    const workable = canon === 'pending' || IN_PROGRESS_STATUSES.includes(canon);
    const needsCollector = r ? (workable && !r.collectorProfileId) : ['request_delay', 'unassigned_job'].includes(alert.type);
    if (needsCollector) out.push('assign_collector');
    if (alert.type === 'invalid_location') out.push('fix_location');
    if (alert.type === 'duplicate_request' && alert.metadata?.duplicate_of) out.push('merge_duplicates');
    out.push('open_request');
    if (r?.collectorProfileId) out.push('contact_collector');
    if (r?.customer?.id || alert.metadata?.customer_id) out.push('notify_customer');
  } else if (rel.kind === 'collector') {
    out.push('contact_collector', 'open_collector');
    if (alert.type === 'invalid_contact') out.push('edit_collector');
  } else if (rel.kind === 'region') {
    out.push('open_zone');
  }
  return out;
};
