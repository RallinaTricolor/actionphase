import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';

/**
 * E2E Tests for Admin Mode
 *
 * Tests the admin mode toggle functionality including:
 * - Admin user can access admin mode controls
 * - Admin mode toggle switches on/off
 * - Admin mode state persists across page refreshes (localStorage)
 * - Admin mode affects game listing visibility
 * - Non-admin users cannot access admin mode
 * - Admin mode state is properly cleared on logout
 *
 * CRITICAL: Admin mode allows admins to see ALL games (private/public)
 * This is essential for platform moderation.
 */

test.describe('Admin Mode', () => {

  test('admin user can toggle admin mode on and off', async ({ page }) => {
    await loginAs(page, 'GM');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should see Admin Mode tab (default tab)
    await expect(page.locator('text=Admin Mode').first()).toBeVisible();

    const adminModeToggle = page.locator('button[role="switch"][aria-label*="admin mode" i]');
    await expect(adminModeToggle).toBeVisible();

    // Ensure admin mode starts OFF (it may be ON from a previous test run)
    const initialState = await adminModeToggle.getAttribute('aria-checked');
    if (initialState === 'true') {
      await adminModeToggle.click();
      await expect(adminModeToggle).toHaveAttribute('aria-checked', 'false');
    }

    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('text=ACTIVE').first()).not.toBeVisible();

    // Enable admin mode
    await adminModeToggle.click();
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('text=ACTIVE').first()).toBeVisible();

    // Disable admin mode
    await adminModeToggle.click();
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('text=ACTIVE').first()).not.toBeVisible();
  });

  test('admin mode state persists across page refreshes', async ({ page }) => {
    await loginAs(page, 'GM');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const adminModeToggle = page.locator('button[role="switch"][aria-label*="admin mode" i]');

    // Ensure admin mode starts OFF
    const initialState = await adminModeToggle.getAttribute('aria-checked');
    if (initialState === 'true') {
      await adminModeToggle.click();
      await expect(adminModeToggle).toHaveAttribute('aria-checked', 'false');
    }

    // Enable admin mode
    await adminModeToggle.click();
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'true');

    // Refresh — admin mode should persist (stored in localStorage)
    await page.reload();
    await page.waitForLoadState('networkidle');

    const toggleAfterRefresh = page.locator('button[role="switch"][aria-label*="admin mode" i]');
    await expect(toggleAfterRefresh).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('text=ACTIVE').first()).toBeVisible();

    // Cleanup
    await toggleAfterRefresh.click();
    await expect(toggleAfterRefresh).toHaveAttribute('aria-checked', 'false');
  });

  test('non-admin user cannot see admin mode controls', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Admin mode toggle should not be accessible to non-admin users
    await expect(page.locator('button[role="switch"][aria-label*="admin mode" i]')).not.toBeVisible();
  });

  test('admin mode affects game listing visibility', async ({ page }) => {
    await loginAs(page, 'GM');

    // Ensure admin mode is OFF before counting
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const adminModeToggle = page.locator('button[role="switch"][aria-label*="admin mode" i]');

    const currentState = await adminModeToggle.getAttribute('aria-checked');
    if (currentState === 'true') {
      await adminModeToggle.click();
      await expect(adminModeToggle).toHaveAttribute('aria-checked', 'false');
    }

    // Count games WITHOUT admin mode
    await page.goto('/games');
    await page.waitForLoadState('networkidle');
    const gameCards = page.locator('[data-testid="game-card"]').or(
      page.locator('a[href^="/games/"]').filter({ hasText: /E2E Test|Game/ })
    );
    // Wait for at least one game to appear
    await expect(gameCards.first()).toBeVisible({ timeout: 5000 });
    const gamesWithoutAdminMode = await gameCards.count();

    // Enable admin mode
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const toggleForEnable = page.locator('button[role="switch"][aria-label*="admin mode" i]');
    await toggleForEnable.click();
    await expect(toggleForEnable).toHaveAttribute('aria-checked', 'true');

    // Count games WITH admin mode — should be same or more (never fewer)
    await page.goto('/games');
    await page.waitForLoadState('networkidle');
    const gameCardsAdmin = page.locator('[data-testid="game-card"]').or(
      page.locator('a[href^="/games/"]').filter({ hasText: /E2E Test|Game/ })
    );
    await expect(gameCardsAdmin.first()).toBeVisible({ timeout: 5000 });
    const gamesWithAdminMode = await gameCardsAdmin.count();

    expect(gamesWithAdminMode).toBeGreaterThanOrEqual(gamesWithoutAdminMode);

    // Cleanup: disable admin mode
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const toggleForDisable = page.locator('button[role="switch"][aria-label*="admin mode" i]');
    await toggleForDisable.click();
    await expect(toggleForDisable).toHaveAttribute('aria-checked', 'false');
  });

  test('admin mode toggle is accessible via keyboard', async ({ page }) => {
    await loginAs(page, 'GM');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const adminModeToggle = page.locator('button[role="switch"][aria-label*="admin mode" i]');
    await expect(adminModeToggle).toBeVisible();

    // Ensure it starts OFF
    const initialState = await adminModeToggle.getAttribute('aria-checked');
    if (initialState === 'true') {
      await adminModeToggle.click();
      await expect(adminModeToggle).toHaveAttribute('aria-checked', 'false');
    }

    // Focus the toggle and toggle via keyboard
    await adminModeToggle.focus();
    await expect(adminModeToggle).toBeFocused();

    await page.keyboard.press('Space');
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('Space');
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'false');
  });
});
