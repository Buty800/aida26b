import { test, expect, type Page } from '@playwright/test';
import {
  loginUser,
  logout,
  registerUser,
  seededAdminCredentials,
  uniqueUsername,
  adminButton,
  expectTrackerShell,
} from './helpers';

test.describe('Auth & Registration', () => {
  test('a new user can register through the UI and lands on the tracker dashboard', async ({ page }) => {
    const creds = {
      username: uniqueUsername(),
      displayname: 'E2E User',
      password: 'password123',
    };
    await registerUser(page, creds);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#welcome-name')).toContainText(creds.username);
  });

  test('a registered user cannot see the admin panel button', async ({ page }) => {
    const creds = {
      username: uniqueUsername(),
      displayname: 'E2E User',
      password: 'password123',
    };
    await registerUser(page, creds);
    await expect(adminButton(page)).toBeHidden();
  });

  test('registering with a duplicate username shows an error and stays on auth', async ({ page }) => {
    const creds = {
      username: uniqueUsername(),
      displayname: 'E2E User',
      password: 'password123',
    };
    await registerUser(page, creds);

    // Log out, then attempt to register the same username again.
    await logout(page);
    await page.locator('#toggle-auth-link').click();
    await expect(page.locator('#displayname-group')).toBeVisible();
    await page.locator('#login-username').fill(creds.username);
    await page.locator('#login-displayname').fill('Another Name');
    await page.locator('#login-password').fill(creds.password);
    await page.locator('#login-submit-btn').click();

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#tracker-shell')).toBeHidden();
  });

  test('login with wrong password shows an error and does not enter the app', async ({ page }) => {
    const creds = {
      username: uniqueUsername(),
      displayname: 'E2E User',
      password: 'password123',
    };
    await registerUser(page, creds);
    await logout(page);

    await page.locator('#login-username').fill(creds.username);
    await page.locator('#login-password').fill('wrongpassword');
    await page.locator('#login-submit-btn').click({ force: true });

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#tracker-shell')).toBeHidden();
  });

  test('a non-admin cannot reach /panel even when navigating directly', async ({ page }) => {
    const creds = {
      username: uniqueUsername(),
      displayname: 'E2E User',
      password: 'password123',
    };
    await registerUser(page, creds);

    await page.goto('/panel');
    await expectTrackerShell(page);
    expect(page.url()).not.toMatch(/\/panel$/);
  });

  test('the seeded admin can log in and sees the admin panel button', async ({ page }) => {
    const admin = seededAdminCredentials();
    await loginUser(page, admin);
    await expect(adminButton(page)).toBeVisible();
  });

  test('logout returns the user to the auth screen', async ({ page }) => {
    const admin = seededAdminCredentials();
    await loginUser(page, admin);
    await logout(page);
    await expect(page.locator('#auth-section')).toBeVisible();
    await expect(page.locator('#tracker-shell')).toBeHidden();
  });
});
