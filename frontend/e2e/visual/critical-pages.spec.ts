import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { FIXTURE_GAMES } from '../fixtures/test-data-factory';

/**
 * Visual Regression Tests - Critical Pages
 *
 * These tests capture screenshots of critical pages in both light and dark mode
 * to detect unintended visual changes.
 *
 * SKIPPED: Visual regression tests are skipped by default to speed up test suite.
 * To run: npx playwright test e2e/visual/critical-pages.spec.ts
 *
 * Running tests:
 *   npm run test:e2e -- visual/critical-pages.spec.ts
 *
 * Updating baselines:
 *   npm run test:e2e -- visual/critical-pages.spec.ts --update-snapshots
 */

test.describe.skip('Visual Regression - Critical Pages', () => {
  test.describe('Light Mode', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure light mode is active
      await page.emulateMedia({ colorScheme: 'light' });
    });

    test('Home page - light mode', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for main content to load
      await page.locator('h1').first().waitFor({ state: 'visible', timeout: 5000 });

      // Take full page screenshot
      await expect(page).toHaveScreenshot('home-page-light.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('Login page - light mode', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Wait for form to be visible
      await page.locator('[data-testid="login-form"]').waitFor({ state: 'visible', timeout: 5000 });

      await expect(page).toHaveScreenshot('login-page-light.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('Registration page - light mode', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Wait for form to be visible
      await page.locator('[data-testid="register-username"]').waitFor({ state: 'visible', timeout: 5000 });

      await expect(page).toHaveScreenshot('registration-page-light.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('Dashboard - light mode', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Wait for dashboard content
      await page.waitForTimeout(1000); // Brief wait for dynamic content

      await expect(page).toHaveScreenshot('dashboard-light.png', {
        fullPage: true,
        maxDiffPixels: 150, // Higher tolerance for dynamic content
        mask: [
          // Mask timestamps and dynamic content
          page.locator('text=/\\d+[mhd] ago/'),
          page.locator('text=/just now/'),
        ],
      });
    });

    test('Game details page - light mode', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.COMMON_ROOM.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      // Wait for game content
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('game-details-light.png', {
        fullPage: true,
        maxDiffPixels: 150,
        mask: [
          // Mask dynamic timestamps
          page.locator('text=/\\d+[mhd] ago/'),
          page.locator('text=/just now/'),
        ],
      });
    });

    test('Settings page - light mode', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('settings-page-light.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });
  });

  test.describe('Dark Mode', () => {
    test.beforeEach(async ({ page }) => {
      // Enable dark mode
      await page.emulateMedia({ colorScheme: 'dark' });
    });

    test('Home page - dark mode', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.locator('h1').first().waitFor({ state: 'visible', timeout: 5000 });

      await expect(page).toHaveScreenshot('home-page-dark.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('Login page - dark mode', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="login-form"]').waitFor({ state: 'visible', timeout: 5000 });

      await expect(page).toHaveScreenshot('login-page-dark.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('Registration page - dark mode', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="register-username"]').waitFor({ state: 'visible', timeout: 5000 });

      await expect(page).toHaveScreenshot('registration-page-dark.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('Dashboard - dark mode', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('dashboard-dark.png', {
        fullPage: true,
        maxDiffPixels: 150,
        mask: [
          page.locator('text=/\\d+[mhd] ago/'),
          page.locator('text=/just now/'),
        ],
      });
    });

    test('Game details page - dark mode', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.COMMON_ROOM.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('game-details-dark.png', {
        fullPage: true,
        maxDiffPixels: 150,
        mask: [
          page.locator('text=/\\d+[mhd] ago/'),
          page.locator('text=/just now/'),
        ],
      });
    });

    test('Settings page - dark mode', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('settings-page-dark.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });
  });
});
