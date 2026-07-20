import { test, expect, type Page } from '@playwright/test';
import {
  adminButton,
  downgradeButton,
  downgradeCard,
  downgradeInput,
  expectAdminShell,
  expectRedirectedToTracker,
  loginUser,
  logout,
  openAdminPanel,
  registerUser,
  seededAdminCredentials,
  uniqueUsername,
  expectTrackerShell,
} from './helpers';

test.describe('Dashboards & Admin Access', () => {
  test('a non-admin has no admin button and is bounced away from /panel', async ({ page }) => {
    const creds = {
      username: uniqueUsername(),
      displayname: 'E2E User',
      password: 'password123',
    };
    await registerUser(page, creds);

    await expect(adminButton(page)).toBeHidden();
    await page.goto('/panel');
    await expectRedirectedToTracker(page);
  });

  test('the admin opens the panel via the "Panel de Control" button and sees the downgrade card', async ({ page }) => {
    const admin = seededAdminCredentials();
    await loginUser(page, admin);

    await openAdminPanel(page);
    await expect(downgradeCard(page)).toBeVisible();
  });

  test('the admin can visit every tracker dashboard tab', async ({ page }) => {
    const admin = seededAdminCredentials();
    await loginUser(page, admin);

    await page.goto('/');
    await expect(page.locator('#tracker-tab-dashboard')).toBeVisible();

    await page.locator('#tab-groups-btn').click();
    await expect(page.locator('#tracker-tab-groups')).toBeVisible();

    await page.locator('#tab-friends-btn').click();
    await expect(page.locator('#tracker-tab-friends')).toBeVisible();
  });

  test('the admin can downgrade (session swap) to another user and loses admin access', async ({ page }) => {
    const admin = seededAdminCredentials();

    // Register a regular user first so the admin can act as them.
    const target = {
      username: uniqueUsername('target'),
      displayname: 'Target User',
      password: 'password123',
    };
    await registerUser(page, target);
    await logout(page);

    // Log in as admin and open the panel.
    await loginUser(page, admin);
    await openAdminPanel(page);

    // Perform the session swap.
    await downgradeInput(page).fill(target.username);
    await downgradeButton(page).click();

    // After downgrade the session belongs to the target user.
    await expectTrackerShell(page);
    await expect(page.locator('#tracker-current-user')).toContainText(target.username);
    await expect(adminButton(page)).toBeHidden();

    // The swapped session can no longer reach /panel.
    await page.goto('/panel');
    await expectRedirectedToTracker(page);
  });
});
