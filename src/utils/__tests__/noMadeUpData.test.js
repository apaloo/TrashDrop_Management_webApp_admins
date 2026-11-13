// Staff act on what the admin site shows, so it never shows made-up data:
// a failed or missing read is an error or an empty list, never invented
// pickup requests, people or positions.
import fs from 'fs';
import path from 'path';
import { getUserContacts } from '../dbUtils';
import { fetchPickupRequests } from '../pickupService';
import { safeDatabaseService } from '../safeDatabaseService';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../safeDatabaseService', () => ({
  safeDatabaseService: { safeRPC: jest.fn(), safeQuery: jest.fn(), checkTableExists: jest.fn() },
}));

// Any supabase.from(...) chain resolves to no rows unless a test says otherwise
const chain = (result = { data: [], error: null }) => {
  const q = {};
  ['select', 'order', 'limit', 'eq', 'in', 'or'].forEach((m) => { q[m] = () => q; });
  q.single = () => Promise.resolve({ data: null, error: null });
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  supabase.from.mockImplementation(() => chain());
});
afterEach(() => jest.restoreAllMocks());

describe('message contacts', () => {
  it('are the people the database returns', async () => {
    safeDatabaseService.safeRPC.mockResolvedValue([{ id: 'u-9', first_name: 'Ama', last_name: 'Owusu' }]);
    expect(await getUserContacts('me')).toEqual({ data: [{ id: 'u-9', first_name: 'Ama', last_name: 'Owusu' }], error: null });
    expect(safeDatabaseService.safeRPC).toHaveBeenCalledWith({ functionName: 'get_user_contacts', params: { p_user_id: 'me' } });
  });

  it('are none when the database returns nothing', async () => {
    safeDatabaseService.safeRPC.mockResolvedValue(null);
    expect(await getUserContacts('me')).toEqual({ data: [], error: null });
  });

  it('are none, with the error, when the read fails', async () => {
    const err = new Error('permission denied');
    safeDatabaseService.safeRPC.mockRejectedValue(err);
    expect(await getUserContacts('me')).toEqual({ data: [], error: err });
  });
});

describe('pickup requests', () => {
  it('fails instead of inventing requests when the view is missing', async () => {
    supabase.from.mockImplementation(() => chain({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.admin_pickup_requests'" } }));
    await expect(fetchPickupRequests()).rejects.toThrow('admin_pickup_requests');
  });

  it('fails instead of inventing requests when the read fails', async () => {
    supabase.from.mockImplementation(() => chain({ data: null, error: { message: 'canceling statement due to statement timeout' } }));
    await expect(fetchPickupRequests()).rejects.toThrow('timeout');
  });

  it('leaves a request without coordinates off the map instead of placing it in Accra', async () => {
    supabase.from.mockImplementation(() => chain({
      data: [{ id: 'p-1', source: 'pickup_requests', user_id: null, status: 'pending', created_at: '2026-11-12T10:00:00Z', lat: null, lng: null }], error: null,
    }));
    const rows = await fetchPickupRequests();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'p-1' });
    expect(rows[0].location?.lat ?? rows[0].lat ?? null).toBeNull();
    expect(JSON.stringify(rows[0])).not.toMatch(/5\.6037|-0\.187|example\.com|Unknown/);
  });
});

describe('app code', () => {
  // Fake-data generators and fallbacks were removed on 2026-11-12; keep them out
  const SRC = path.join(__dirname, '..', '..');
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['__tests__', 'tests', 'test-fixtures', '__mocks__'].includes(e.name)) walk(p); }
    else if (/\.(js|jsx)$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) files.push(p);
  });
  walk(SRC);

  it('has no fake-data generators or fallbacks', () => {
    const offenders = files.filter((f) => /\bgenerateMock\w*|\bmockDataFn\b|\bmockFallback\b|\bmockContacts\b/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
