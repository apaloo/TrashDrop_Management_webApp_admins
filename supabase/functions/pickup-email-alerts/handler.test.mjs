// Run: node --experimental-strip-types --test supabase/functions/pickup-email-alerts/handler.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmail, handle } from './handler.ts';

const bin = {
  source: 'digital_bins',
  request_id: 'bin-1',
  created_at: '2026-11-09T10:30:00Z',
  address: 'Osu, Accra',
  waste_type: 'general',
  bag_count: 2,
  bin_size_liters: 120,
  fee: 40,
  is_urgent: false,
  scheduled_date: null,
};
const bag = { ...bin, source: 'pickup_requests', request_id: 'bag-1', bag_count: 1, bin_size_liters: null };
const env = {
  SUPABASE_URL: 'https://db.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  RESEND_API_KEY: 'resend',
};
const post = (secret = 'right') =>
  new Request('https://fn.test', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} });
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });

function fakeFetch({ requests = [bin], recipients = ['admin@test.example'], send = () => reply({ id: 'x' }) } = {}) {
  const calls = { marks: [], emails: [], claims: 0 };
  const fn = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url.endsWith('td_pickup_email_secret_ok')) return reply(body.p_secret === 'right');
    if (url.endsWith('td_pickup_email_claim')) { calls.claims += 1; return reply({ recipients, requests }); }
    if (url.endsWith('td_pickup_email_mark')) { calls.marks.push(body); return reply(null); }
    if (url === 'https://api.resend.com/emails') { calls.emails.push({ body, headers: init.headers }); return send(); }
    throw new Error(`Unexpected call: ${url}`);
  };
  return { fn, calls };
}

test('describes a digital bin and a bag pickup', () => {
  assert.match(buildEmail(bin).subject, /^New digital bin request: Osu, Accra$/);
  assert.match(buildEmail(bin).text, /Quantity: 2 bins x 120 L/);
  assert.match(buildEmail(bag).subject, /^New bag pickup request/);
  assert.match(buildEmail(bag).text, /Quantity: 1 bag\n/);
  assert.match(buildEmail({ ...bin, is_urgent: true }).subject, /^URGENT: new digital bin/);
});

test('customer-typed text cannot inject HTML or a second header line', () => {
  const email = buildEmail({ ...bin, address: '<img src=x>\r\nBcc: a@b.example' });
  assert.ok(!email.html.includes('<img'));
  assert.ok(!/[\r\n]/.test(email.subject));
});

test('rejects a missing or wrong secret without reading or sending', async () => {
  for (const secret of ['', 'wrong']) {
    const { fn, calls } = fakeFetch();
    const res = await handle(post(secret), env, fn);
    assert.equal(res.status, 401);
    assert.equal(calls.claims, 0);
    assert.equal(calls.emails.length, 0);
  }
});

test('without an email key it claims nothing, so no attempts are used', async () => {
  const { fn, calls } = fakeFetch();
  const res = await handle(post(), { ...env, RESEND_API_KEY: undefined }, fn);
  assert.equal(res.status, 200);
  assert.equal(calls.claims, 0);
});

test('sends once per request and records it as sent', async () => {
  const { fn, calls } = fakeFetch({ requests: [bin, bag] });
  const res = await handle(post(), env, fn);
  assert.deepEqual(await res.json(), { sent: 2, failed: 0 });
  assert.equal(calls.emails.length, 2);
  assert.deepEqual(calls.emails[0].body.to, ['admin@test.example']);
  assert.equal(calls.emails[0].headers['Idempotency-Key'], 'pickup-email/digital_bins/bin-1');
  assert.ok(calls.marks.every((m) => m.p_ok === true && m.p_error === null));
});

test('a provider failure is recorded and does not stop the next request', async () => {
  let n = 0;
  const { fn, calls } = fakeFetch({
    requests: [bin, bag],
    send: () => (++n === 1 ? new Response('nope', { status: 500 }) : reply({ id: 'x' })),
  });
  const res = await handle(post(), env, fn);
  assert.deepEqual(await res.json(), { sent: 1, failed: 1 });
  assert.equal(calls.marks[0].p_ok, false);
  assert.match(calls.marks[0].p_error, /Resend 500/);
  assert.equal(calls.marks[1].p_ok, true);
});

test('a network error is recorded rather than crashing the run', async () => {
  const { fn, calls } = fakeFetch({ send: () => { throw new Error('offline'); } });
  const res = await handle(post(), env, fn);
  assert.deepEqual(await res.json(), { sent: 0, failed: 1 });
  assert.equal(calls.marks[0].p_error, 'offline');
});
