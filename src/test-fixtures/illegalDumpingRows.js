// Rows shaped like fetchIllegalDumpingReports() output, mirroring the QA audit
// dataset: 82 reports — 51 pending, 2 verified, 16 in progress, 4 completed,
// 9 cancelled; 5 in Liberia; 4 completions taking ~9, 68, 54 and 187 days.
const day = 864e5;
const base = Date.parse('2025-09-01T08:00:00Z');
const iso = (t) => new Date(t).toISOString();

let n = 0;
const row = (status, extra = {}) => {
  n += 1;
  const id = `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const reported = base + n * day;
  return {
    id,
    status,
    severity: 'medium',
    waste_type: 'household',
    location: { address: 'Accra, Ghana (Coordinates: 5.6726, -0.2809)', lat: 5.6726, lng: -0.2809 },
    area_name: 'Pokuase, Greater Accra Region',
    reporter: { id: 'u1', name: 'Ama Mensah', email: 'ama@example.com', anonymous: false },
    images: [],
    reported_at: iso(reported),
    updated_at: iso(reported + day),
    resolved_at: null,
    assigned_to: null,
    team_name: null,
    ...extra,
  };
};

export const buildAuditRows = () => {
  n = 0;
  const rows = [];
  for (let i = 0; i < 46; i++) rows.push(row('pending'));
  for (let i = 0; i < 5; i++) rows.push(row('pending', { area_name: 'Kakata, Margibi', location: { address: 'Margibi, Liberia', lat: 6.53, lng: -10.35 } }));
  for (let i = 0; i < 2; i++) rows.push(row('verified'));
  for (let i = 0; i < 16; i++) rows.push(row('in_progress', { assigned_to: 'c1', team_name: 'Jack Bhone' }));
  [9, 68, 54, 187].forEach((days, i) => {
    const r = row('completed', i < 2 ? { assigned_to: 'c1', team_name: 'Jack Bhone' } : {});
    r.resolved_at = iso(Date.parse(r.reported_at) + days * day);
    rows.push(r);
  });
  for (let i = 0; i < 9; i++) rows.push(row('cancelled'));
  return rows;
};
