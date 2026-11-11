/**
 * Emails a person once when their requested account type is approved or
 * rejected. Called once a minute by the td-access-decision-emails cron job
 * (supabase/migrations/20261115_access_decision_emails.sql).
 *
 * Tests: node --experimental-strip-types --test supabase/functions/access-decision-emails/handler.test.mjs
 */

export interface AccessDecision {
  user_id: string;
  reviewed_at: string;
  email: string | null;
  first_name: string | null;
  decision: 'approved' | 'rejected';
  role: string | null;
  requested_role: string | null;
  note: string | null;
}

export type Env = Record<string, string | undefined>;
type FetchFn = typeof fetch;

const SIGN_IN_PAGE = 'https://trashdrops.com/login';
const DEFAULT_FROM = 'TrashDrop <alerts@trashdrops.com>';
const DEFAULT_REPLY_TO = 'hello@trashdrops.com';

// Same names as the portal (src/constants/accessControl.js ROLE_LABELS)
const ROLE_LABELS: Record<string, string> = {
  user: 'User',
  volunteer: 'Volunteer',
  media: 'Media',
  manager: 'Manager',
  authority: 'Authority (MMDA)',
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Names and notes are typed by people, so strip anything that could alter a header. */
const oneLine = (value: string) => value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

const roleLabel = (role: string | null) => (role && ROLE_LABELS[role]) || 'requested';

export function buildEmail(d: AccessDecision) {
  const approved = d.decision === 'approved';
  const name = d.first_name ? oneLine(d.first_name).slice(0, 60) : null;
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const label = roleLabel(approved ? d.role : d.requested_role);
  const note = d.note ? oneLine(d.note).slice(0, 500) : null;

  const subject = approved
    ? `Your TrashDrop account is approved: ${label} access`
    : `Your TrashDrop ${label} access request was not approved`;

  const lines = approved
    ? [
        `Your TrashDrop account now has ${label} access.`,
        'Sign in to start using it. If you are already signed in, sign out and back in to see everything.',
      ]
    : [
        `Your request for ${label} access was not approved.`,
        ...(note ? [`Reason: ${note}`] : []),
        'You can still use TrashDrop with your current access. If you think this is wrong, reply to this email.',
      ];

  const text = [greeting, '', ...lines, '', `Sign in: ${SIGN_IN_PAGE}`].join('\n');
  const html = renderHtml({
    title: approved ? 'Your account is approved' : 'Access request not approved',
    badge: approved ? 'Approved' : 'Not approved',
    approved,
    greeting,
    lines,
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
  border: '#dfe4dc',
  muted: '#eceee9',
};
const FONT = "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
const LOGO = 'https://trashdrops.com/icon-192x192.png';

/** Tables and inline styles only: the layout email apps render reliably. */
function renderHtml(email: { title: string; badge: string; approved: boolean; greeting: string; lines: string[] }): string {
  const badge = `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${email.approved ? TD.tonal : TD.muted};color:${email.approved ? TD.forest : TD.sage};font-size:13px;font-weight:600;line-height:18px">${escapeHtml(email.badge)}</span>`;
  const paragraphs = [email.greeting, ...email.lines]
    .map((line) => `<p style="margin:12px 0 0;color:${TD.ink};font-size:15px;line-height:22px">${escapeHtml(line)}</p>`)
    .join('');

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
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(email.lines[0])}</div>
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
          <td align="right" style="color:${TD.lime};font-size:13px;font-weight:600;line-height:18px">Your account</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 24px 8px">
        <div>${badge}</div>
        <h1 style="margin:16px 0 0;color:${TD.ink};font-size:24px;font-weight:700;line-height:30px">${escapeHtml(email.title)}</h1>
        ${paragraphs}
      </td></tr>
      <tr><td style="padding:20px 24px 28px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${TD.forest}" style="background:${TD.forest};border-radius:8px">
          <a href="${SIGN_IN_PAGE}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:15px;font-weight:600;line-height:20px;text-decoration:none">Sign in to TrashDrop</a>
        </td></tr></table>
      </td></tr>
      <tr><td bgcolor="${TD.cream}" style="background:${TD.cream};border-top:1px solid ${TD.border};padding:14px 24px;color:${TD.sage};font-size:13px;line-height:18px">
        You're receiving this because you asked for an account type on TrashDrop.
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
  const check = await rpc('td_access_email_secret_ok', { p_secret: secret });
  if (!check.ok || (await check.json()) !== true) return json(401, { error: 'Unauthorized' });

  // Checked before claiming, so a missing key uses up no attempts.
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey || !apiKey.startsWith('re_')) return json(200, { sent: 0, note: 'RESEND_API_KEY is not set' });

  const claimed = await rpc('td_access_email_claim', { p_limit: 10 });
  if (!claimed.ok) return json(500, { error: 'Could not read new decisions' });
  const { decisions } = await claimed.json() as { decisions: AccessDecision[] };

  let sent = 0;
  let failed = 0;
  for (const d of decisions) {
    let ok = false;
    let error: string | null = null;
    try {
      if (!d.email) throw new Error('Account has no email address');
      const email = buildEmail(d);
      const response = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // A retry after a lost response cannot send a duplicate.
          'Idempotency-Key': `access-email/${d.user_id}/${d.reviewed_at}`,
        },
        body: JSON.stringify({
          from: env.ACCESS_EMAIL_FROM || DEFAULT_FROM,
          reply_to: env.ACCESS_EMAIL_REPLY_TO || DEFAULT_REPLY_TO,
          to: [d.email],
          ...email,
        }),
      });
      ok = response.ok;
      if (!ok) error = `Resend ${response.status}: ${(await response.text()).slice(0, 300)}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    await rpc('td_access_email_mark', { p_user_id: d.user_id, p_reviewed_at: d.reviewed_at, p_ok: ok, p_error: error });
    if (ok) sent += 1; else failed += 1;
  }

  return json(200, { sent, failed });
}
