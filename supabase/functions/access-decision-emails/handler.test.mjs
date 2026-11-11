// Run: node --experimental-strip-types --test supabase/functions/access-decision-emails/handler.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmail, handle } from './handler.ts';

const approved = {
  user_id: 'u-1',
  reviewed_at: '2026-11-11T09:15:00.123456+00:00',
  email: 'ama@example.com',
  first_name: 'Ama',
  decision: 'approved',
  role: 'authority',
  requested_role: 'authority',
  note: null,
};
const rejected = { ...approved, user_id: 'u-2', decision: 'rejected', role: 'user', note: 'Use your official\r\nassembly email' };
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 're_test' };
const post = (secret = 'right') =>
  new Request('https://fn.test', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} });
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });

function fakeFetch({ decisions = [approved], send = () => reply({ id: 'x' }) } = {}) {
  const calls = { marks: [], emails: [], claims: 0 };
  const fn = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url.endsWith('td_access_email_secret_ok')) return reply(body.p_secret === 'right');
    if (url.endsWith('td_access_email_claim')) { calls.claims += 1; return reply({ decisions }); }
    if (url.endsWith('td_access_email_mark')) { calls.marks.push(body); return reply(null); }
    if (url === 'https://api.resend.com/emails') { calls.emails.push({ body, headers: init.headers }); return send(); }
    throw new Error(`Unexpected call: ${url}`);
  };
  return { fn, calls };
}

test('approval email names the access and links to sign-in', () => {
  const email = buildEmail(approved);
  assert.equal(email.subject, 'Your TrashDrop account is approved: Authority (MMDA) access');
  assert.match(email.text, /^Hi Ama,/);
  assert.match(email.text, /now has Authority \(MMDA\) access/);
  assert.match(email.text, /https:\/\/trashdrops\.com\/login/);
  assert.match(email.html, /Sign in to TrashDrop/);
});

test('rejection email gives the reason on one line and escapes it', () => {
  const email = buildEmail({ ...rejected, note: '<b>Use</b> your\r\nofficial email', first_name: null });
  assert.equal(email.subject, 'Your TrashDrop Authority (MMDA) access request was not approved');
  assert.match(email.text, /^Hello,/);
  assert.match(email.text, /Reason: <b>Use<\/b> your official email/);
  assert.ok(!email.html.includes('<b>Use</b>'));
  assert.match(email.html, /&lt;b&gt;Use&lt;\/b&gt; your official email/);
});

test('no or wrong secret: nothing is read or sent', async () => {
  for (const secret of [null, 'wrong']) {
    const { fn, calls } = fakeFetch();
    const res = await handle(post(secret), env, fn);
    assert.equal(res.status, 401);
    assert.equal(calls.claims, 0);
    assert.equal(calls.emails.length, 0);
  }
});

test('no Resend key: nothing is claimed, so no attempts are used up', async () => {
  const { fn, calls } = fakeFetch();
  const res = await handle(post(), { ...env, RESEND_API_KEY: '' }, fn);
  assert.equal(res.status, 200);
  assert.equal(calls.claims, 0);
});

test('sends one email to the person only, with a stable idempotency key, and records it', async () => {
  const { fn, calls } = fakeFetch({ decisions: [approved, rejected] });
  const res = await handle(post(), env, fn);
  assert.deepEqual(await res.json(), { sent: 2, failed: 0 });
  assert.deepEqual(calls.emails.map(e => e.body.to), [['ama@example.com'], ['ama@example.com']]);
  assert.equal(calls.emails[0].headers['Idempotency-Key'], `access-email/u-1/${approved.reviewed_at}`);
  assert.equal(calls.emails[0].body.reply_to, 'hello@trashdrops.com');
  assert.deepEqual(calls.marks.map(m => [m.p_user_id, m.p_reviewed_at, m.p_ok]), [
    ['u-1', approved.reviewed_at, true],
    ['u-2', approved.reviewed_at, true],
  ]);
});

test('a failed send or a missing address is recorded for retry, not lost', async () => {
  const { fn, calls } = fakeFetch({
    decisions: [approved, { ...rejected, email: null }],
    send: () => new Response('rate limited', { status: 429 }),
  });
  const res = await handle(post(), env, fn);
  assert.deepEqual(await res.json(), { sent: 0, failed: 2 });
  assert.equal(calls.emails.length, 1);
  assert.match(calls.marks[0].p_error, /Resend 429/);
  assert.match(calls.marks[1].p_error, /no email address/);
});
