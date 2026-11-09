/**
 * Emails one alert per new digital bin or bag pickup request.
 * Called once a minute by the td-pickup-email-alerts cron job
 * (supabase/migrations/20261114_pickup_email_alerts.sql).
 *
 * Tests: node --experimental-strip-types --test supabase/functions/pickup-email-alerts/handler.test.mjs
 */

export interface PickupRequest {
  source: 'pickup_requests' | 'digital_bins';
  request_id: string;
  created_at: string | null;
  address: string | null;
  waste_type: string | null;
  bag_count: number | null;
  bin_size_liters: number | null;
  fee: number | null;
  is_urgent: boolean | null;
  scheduled_date: string | null;
}

export type Env = Record<string, string | undefined>;
type FetchFn = typeof fetch;

const REQUESTS_PAGE = 'https://trashdrops.com/request-pickup/requests';
const DEFAULT_FROM = 'TrashDrop Alerts <alerts@trashdrops.com>';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Addresses are typed by customers, so strip anything that could alter the header. */
const oneLine = (value: string) => value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

const sentenceCase = (value: string) => {
  const words = value.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Accra',
  }).format(date) + ' GMT';
}

function formatQuantity(r: PickupRequest): string | null {
  const count = r.bag_count ?? null;
  if (r.source === 'digital_bins') {
    if (count === null && r.bin_size_liters === null) return null;
    const size = r.bin_size_liters === null ? '' : ` x ${r.bin_size_liters} L`;
    return `${count ?? 1} bin${count === 1 || count === null ? '' : 's'}${size}`;
  }
  return count === null ? null : `${count} bag${count === 1 ? '' : 's'}`;
}

export function buildEmail(r: PickupRequest) {
  const kind = r.source === 'digital_bins' ? 'digital bin' : 'bag pickup';
  const address = r.address ? oneLine(r.address) : null;
  const subject = oneLine(
    `${r.is_urgent ? 'URGENT: new' : 'New'} ${kind} request${address ? `: ${address}` : ''}`,
  ).slice(0, 150);

  const rows: Array<[string, string | null]> = [
    ['Type', r.source === 'digital_bins' ? 'Digital bin' : 'Bag pickup'],
    ['Priority', r.is_urgent ? 'Urgent' : null],
    ['Location', address],
    ['Waste type', r.waste_type ? sentenceCase(r.waste_type) : null],
    ['Quantity', formatQuantity(r)],
    ['Fee', r.fee === null || r.fee === undefined ? null : `GHS ${r.fee}`],
    ['Requested for', formatTime(r.scheduled_date) ],
    ['Received', formatTime(r.created_at)],
  ];
  const shown = rows.filter((row): row is [string, string] => Boolean(row[1]));

  const text = [
    `New ${kind} request`,
    '',
    ...shown.map(([label, value]) => `${label}: ${value}`),
    '',
    `Open it in the portal: ${REQUESTS_PAGE}`,
  ].join('\n');

  const typeLabel = r.source === 'digital_bins' ? 'Digital bin' : 'Bag pickup';
  const details = shown.filter(([label]) => !['Type', 'Priority', 'Location'].includes(label));
  const html = renderHtml({
    title: `New ${kind} request`,
    typeLabel,
    urgent: Boolean(r.is_urgent),
    address,
    details,
  });

  return { subject, text, html };
}

// The portal's design system (docs/DESIGN_SYSTEM.md, src/theme/brand.js)
const TD = {
  lime: '#b6ee69',
  forest: '#1b6e35',
  ink: '#0a0f0a',
  sage: '#525c52',
  cream: '#f6f8f4',
  tonal: '#e6f2e9',
  orange: '#f98b38',
  border: '#dfe4dc',
};
const FONT = "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
// PNG because Gmail does not show SVG; opaque white, so it sits on a white tile
const LOGO = 'https://trashdrops.com/icon-192x192.png';

const pill = (label: string, background: string, color: string) =>
  `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${background};color:${color};font-size:13px;font-weight:600;line-height:18px">${escapeHtml(label)}</span>`;

/** Tables and inline styles only: the layout email apps render reliably. */
function renderHtml(email: {
  title: string;
  typeLabel: string;
  urgent: boolean;
  address: string | null;
  details: Array<[string, string]>;
}): string {
  const pills = [
    pill(email.typeLabel, TD.tonal, TD.forest),
    email.urgent ? pill('Urgent', TD.orange, TD.ink) : '',
  ].filter(Boolean).join('&nbsp;');

  const rows = email.details.map(([label, value]) =>
    `<tr>
      <td style="padding:12px 16px 12px 0;border-top:1px solid ${TD.border};color:${TD.sage};font-size:14px;line-height:20px">${escapeHtml(label)}</td>
      <td align="right" style="padding:12px 0;border-top:1px solid ${TD.border};color:${TD.ink};font-size:15px;font-weight:500;line-height:20px">${escapeHtml(value)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(email.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${TD.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(email.address ?? email.title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${TD.cream}" style="background:${TD.cream};font-family:${FONT}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:separate;background:#ffffff;border:1px solid ${TD.border};border-radius:12px;overflow:hidden">
      <tr><td bgcolor="${TD.ink}" style="background:${TD.ink};padding:16px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="40" style="width:40px">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:8px;padding:4px 10px;line-height:0">
              <img src="${LOGO}" width="19" height="32" alt="" style="display:block;border:0">
            </td></tr></table>
          </td>
          <td style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:700;line-height:24px">TrashDrop</td>
          <td align="right" style="color:${TD.lime};font-size:13px;font-weight:600;line-height:18px">Pickup alert</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 24px 8px">
        <div>${pills}</div>
        <h1 style="margin:16px 0 0;color:${TD.ink};font-size:24px;font-weight:700;line-height:30px">${escapeHtml(email.title)}</h1>
        ${email.address ? `<p style="margin:8px 0 0;color:${TD.sage};font-size:15px;line-height:22px">${escapeHtml(email.address)}</p>` : ''}
      </td></tr>
      <tr><td style="padding:12px 24px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>
      <tr><td style="padding:20px 24px 28px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${TD.forest}" style="background:${TD.forest};border-radius:8px">
          <a href="${REQUESTS_PAGE}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:15px;font-weight:600;line-height:20px;text-decoration:none">View request</a>
        </td></tr></table>
      </td></tr>
      <tr><td bgcolor="${TD.cream}" style="background:${TD.cream};border-top:1px solid ${TD.border};padding:14px 24px;color:${TD.sage};font-size:13px;line-height:18px">
        You're receiving this as a TrashDrop admin.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function handle(req: Request, env: Env, fetchFn: FetchFn = fetch): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'Supabase is not configured' });

  const rpc = (name: string, args: unknown) =>
    fetchFn(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });

  // Fail closed: no valid secret means nothing is read or sent.
  const secret = req.headers.get('x-cron-secret');
  if (!secret) return json(401, { error: 'Unauthorized' });
  const check = await rpc('td_pickup_email_secret_ok', { p_secret: secret });
  if (!check.ok || (await check.json()) !== true) return json(401, { error: 'Unauthorized' });

  // Checked before claiming, so a missing or placeholder key uses up no
  // attempts: alerts wait and go out once a real key is saved.
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey || !apiKey.startsWith('re_')) return json(200, { sent: 0, note: 'RESEND_API_KEY is not set' });

  const claimed = await rpc('td_pickup_email_claim', { p_limit: 10 });
  if (!claimed.ok) return json(500, { error: 'Could not read new requests' });
  const { recipients, requests } = await claimed.json() as { recipients: string[]; requests: PickupRequest[] };

  let sent = 0;
  let failed = 0;
  for (const request of requests) {
    let ok = false;
    let error: string | null = null;
    try {
      const email = buildEmail(request);
      const response = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // A retry after a lost response cannot send a duplicate.
          'Idempotency-Key': `pickup-email/${request.source}/${request.request_id}`,
        },
        body: JSON.stringify({ from: env.ALERT_EMAIL_FROM || DEFAULT_FROM, to: recipients, ...email }),
      });
      ok = response.ok;
      if (!ok) error = `Resend ${response.status}: ${(await response.text()).slice(0, 300)}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    await rpc('td_pickup_email_mark', {
      p_source: request.source,
      p_request_id: request.request_id,
      p_ok: ok,
      p_error: error,
    });
    if (ok) sent += 1; else failed += 1;
  }

  return json(200, { sent, failed });
}
