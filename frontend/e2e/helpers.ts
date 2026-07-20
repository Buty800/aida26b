import { type Page, type Locator, expect } from '@playwright/test';

export interface Credentials {
  username: string;
  password: string;
  displayname?: string;
}

// Pre-seeded admin credentials (created by seed-admin.ts / docker init).
// These are NOT the database credentials — they are the application admin login.
export function seededAdminCredentials(): Credentials {
  return {
    username: 'admin',
    password: 'adminpass',
  };
}

export function uniqueUsername(prefix = 'e2e'): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// Switches the auth form into register mode and submits a new user.
// Registration also logs the user in automatically on success.
export async function registerUser(page: Page, creds: Credentials): Promise<void> {
  await page.goto('/');
  await page.locator('#toggle-auth-link').click();
  await expect(page.locator('#displayname-group')).toBeVisible();
  await page.locator('#login-username').fill(creds.username);
  if (creds.displayname) {
    await page.locator('#login-displayname').fill(creds.displayname);
  }
  await page.locator('#login-password').fill(creds.password);
  await page.locator('#login-password').press('Enter');
  await expectTrackerShell(page);
}

export async function loginUser(page: Page, creds: Credentials): Promise<void> {
  await page.goto('/');
  await page.locator('#login-username').fill(creds.username);
  await page.locator('#login-password').fill(creds.password);
  await page.locator('#login-password').press('Enter');
  await expectTrackerShell(page);
}

export async function logout(page: Page): Promise<void> {
  const trackerLogout = page.locator('#tracker-logout-btn');
  if (await trackerLogout.isVisible().catch(() => false)) {
    await trackerLogout.click();
  } else {
    await page.locator('#logout-btn').click();
  }
  await expect(page.locator('#auth-section')).toBeVisible();
}

export async function expectTrackerShell(page: Page): Promise<void> {
  await expect(page.locator('#tracker-shell')).toBeVisible();
  await expect(page.locator('#app-shell')).toBeHidden();
}

export async function expectAdminShell(page: Page): Promise<void> {
  await expect(page.locator('#app-shell')).toBeVisible();
  await expect(page.locator('#tracker-shell')).toBeHidden();
  await expect(page).toHaveURL(/\/panel$/);
}

export async function expectRedirectedToTracker(page: Page): Promise<void> {
  // A non-admin hitting /panel must be bounced to the tracker root.
  await expectTrackerShell(page);
  expect(page.url()).not.toMatch(/\/panel$/);
}

export async function openAdminPanel(page: Page): Promise<void> {
  const btn = page.locator('#go-to-admin-btn');
  await expect(btn).toBeVisible();
  await btn.click();
  await expectAdminShell(page);
}

export function adminButton(page: Page): Locator {
  return page.locator('#go-to-admin-btn');
}

export function downgradeCard(page: Page): Locator {
  return page.locator('#downgrade-card');
}

export function downgradeInput(page: Page): Locator {
  return page.locator('#downgrade-username');
}

export function downgradeButton(page: Page): Locator {
  return page.locator('#downgrade-btn');
}
