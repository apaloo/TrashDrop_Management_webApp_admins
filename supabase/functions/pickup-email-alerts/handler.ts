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
    ['Waste type', r.waste_type],
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

  const html = `<h2 style="font-family:Arial,sans-serif">New ${kind} request</h2>
<table style="font-family:Arial,sans-serif;border-collapse:collapse">${shown
    .map(([label, value]) =>
      `<tr><td style="padding:4px 16px 4px 0;color:#555">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`)
    .join('')}</table>
<p style="font-family:Arial,sans-serif"><a href="${REQUESTS_PAGE}">Open it in the portal</a></p>`;

  return { subject, text, html };
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

  // Checked before claiming, so a missing key uses up no attempts.
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return json(200, { sent: 0, note: 'RESEND_API_KEY is not set' });

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
