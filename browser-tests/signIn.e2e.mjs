// The admin site in a real browser against the built app: the public home
// page, signing in, and what an account may see once in. Who is staff is the
// database's answer (my_access); the fake in fakeSupabase.mjs gives it, and
// nothing reaches a real project or account.
import { test, expect } from '@playwright/test';
import { fakeSupabase, household, collectPageErrors } from './fakeSupabase.mjs';

const account = household({ email: 'staff@example.test' });
// my_access as the database returns it (functions/my_access.sql in the schema snapshot)
const ADMIN = { role: 'admin', requested_role: 'admin', status: 'approved', team: null };
const ORDINARY = { role: 'user', requested_role: null, status: 'approved', team: null };

async function signIn(page, password = 'correct-horse') {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email address').fill('staff@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

const menu = (page) => page.getByRole('navigation').first();

test('the public home page books pickups and links to sign-in', async ({ page }) => {
  const errors = collectPageErrors(page);
  await fakeSupabase(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Waste pickup in Ghana, booked in minutes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request pickup' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test('signed out, the dashboard leads to sign-in', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('a wrong password is refused, and stays on sign-in', async ({ page }) => {
  const calls = await fakeSupabase(page, { account, rpc: { my_access: ADMIN } });
  await signIn(page, 'wrong-password');
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');
  await expect(page).toHaveURL(/\/login$/);
  expect(calls.some((c) => c.path === '/rest/v1/rpc/my_access')).toBe(false);
});

test('an ordinary account gets only its settings and dumping reports, even by typing /dashboard', async ({ page }) => {
  const errors = collectPageErrors(page);
  await fakeSupabase(page, { account, rpc: { my_access: ORDINARY } });
  await signIn(page);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('link', { name: 'Request partner access' })).toBeVisible();
  await expect(menu(page).getByRole('button', { name: 'Illegal Dumping' })).toBeVisible();
  for (const staffOnly of ['Dashboard', 'Account Approvals', 'Reward Redemptions', 'MoMo Payments']) {
    await expect(page.getByRole('link', { name: staffOnly, exact: true }), staffOnly).toHaveCount(0);
  }

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toHaveCount(0);
  await expect(page.getByText('Total Requests')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an admin lands on the dashboard with the staff menu, and the sign-in is audited', async ({ page }) => {
  const errors = collectPageErrors(page);
  const calls = await fakeSupabase(page, { account, rpc: { my_access: ADMIN } });
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  for (const name of ['Dashboard', 'Account Approvals', 'Reward Redemptions', 'MoMo Payments']) {
    await expect(page.getByRole('link', { name, exact: true }).first(), name).toBeVisible();
  }
  const audit = calls.find((c) => c.path === '/rest/v1/rpc/log_audit');
  expect(audit?.body).toMatchObject({ p_source: 'auth', p_action: 'auth.login', p_entity_id: account.user.id });
  expect(calls.find((c) => c.path === '/rest/v1/rpc/admin_dashboard_stats')).toBeTruthy();
  expect(errors).toEqual([]);
});
