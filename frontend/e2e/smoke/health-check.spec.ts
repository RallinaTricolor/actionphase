import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../fixtures/test-tags';

/**
 * Smoke Tests: Application Health Checks
 *
 * Quick 5-minute tests to verify basic application functionality
 * Run before every deployment to catch critical failures
 *
 * Target execution time: < 5 minutes
 */
test.describe('Smoke: Application Health', () => {

  test(tagTest([tags.SMOKE], 'Frontend loads successfully'), async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Verify the page loaded
    await expect(page.locator('h1')).toContainText('ActionPhase');

    // Verify login link is present (use .first() to avoid strict mode violation)
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  });

  test(tagTest([tags.SMOKE], 'API health endpoint responds'), async ({ request }) => {
    // Check if backend API is responding
    const response = await request.get('http://localhost:3000/health');

    expect(response.status()).toBe(200);
  });

  test(tagTest([tags.SMOKE], 'Login page is accessible'), async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Verify login form is present
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-username"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
  });

  test(tagTest([tags.SMOKE], 'Dashboard requires authentication'), async ({ page }) => {
    // Try to access dashboard without being logged in
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test(tagTest([tags.SMOKE], 'Games list page requires auth'), async ({ page }) => {
    // Navigate to games list without being logged in
    await page.goto('/games');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test(tagTest([tags.SMOKE, tags.AUTH], 'Can toggle to registration form'), async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Click the toggle to show registration
    await page.click('text="Don\'t have an account? Sign up"');

    // Verify registration form appears
    await expect(page.locator('text="Already have an account? Sign in"')).toBeVisible();
  });

  test(tagTest([tags.SMOKE], 'Static assets load correctly'), async ({ page }) => {
    // Navigate to home
    await page.goto('/');

    // Check for 404 errors in console
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a moment for any async resource loading
    await page.waitForTimeout(1000);

    // Should not have critical asset loading errors
    const criticalErrors = errors.filter(e =>
      e.includes('404') || e.includes('Failed to load')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test(tagTest([tags.SMOKE], 'Unknown routes redirect appropriately'), async ({ page }) => {
    // Navigate to non-existent route
    await page.goto('/this-page-does-not-exist-12345');

    // Should redirect to login (if not authenticated)
    await expect(page).toHaveURL(/\/login/);
  });
});
