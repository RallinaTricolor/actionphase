import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';

/**
 * Notification System Smoke Tests
 *
 * Basic tests to verify notification UI components are rendering correctly.
 * Full end-to-end notification flow tests require features that aren't fully implemented yet
 * (private messages UI, common room interactions, etc.)
 */

test.describe('Notification System - Smoke Tests', () => {

  test('should display notification bell in header after login', async ({ page }) => {
    // Login as a player
    await loginAs(page, 'PLAYER_1');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Notification bell should be visible
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toBeVisible();
  });

  test('should open notification dropdown when bell is clicked', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Click notification bell
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await notificationBell.click();

    // Dropdown should be visible
    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Should show "Notifications" header (use role to be specific)
    await expect(dropdown.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  });

  test('should close notification dropdown when clicking outside', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const notificationBell = page.locator('[data-testid="notification-bell"]');
    const dropdown = page.locator('[data-testid="notification-dropdown"]');

    // Open dropdown
    await notificationBell.click();
    await expect(dropdown).toBeVisible();

    // Close dropdown by clicking outside (on the body)
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await expect(dropdown).not.toBeVisible();
  });

  test('should load and display notification dropdown content', async ({ page }) => {
    // Use audience member
    await loginAs(page, 'AUDIENCE');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open notifications
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await notificationBell.click();

    const dropdown = page.locator('[data-testid="notification-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Verify the dropdown header is visible
    await expect(dropdown.getByRole('heading', { name: 'Notifications' })).toBeVisible();

    // The dropdown should show some content - either loading, empty state, or notifications
    // This verifies the component renders and attempts to load data
    const dropdownText = await dropdown.textContent();
    expect(dropdownText).toBeTruthy();
    expect(dropdownText?.length).toBeGreaterThan(0);
  });

  test('should not display notification badge when count is zero', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Badge should not be visible
    const badge = page.locator('[data-testid="notification-badge"]');
    await expect(badge).not.toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Block notification API requests to simulate error
    await page.route('**/api/v1/notifications/unread-count', route => route.abort());

    await loginAs(page, 'PLAYER_1');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Bell should still be visible even if API fails
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toBeVisible();

    // Badge should not be visible (failed to load count)
    const badge = page.locator('[data-testid="notification-badge"]');
    await expect(badge).not.toBeVisible();
  });

  test('notification bell should be present on all authenticated pages', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const pagesToCheck = ['/dashboard', '/games'];

    for (const pagePath of pagesToCheck) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      const notificationBell = page.locator('[data-testid="notification-bell"]');
      await expect(notificationBell).toBeVisible({ timeout: 5000 });
    }
  });
});
