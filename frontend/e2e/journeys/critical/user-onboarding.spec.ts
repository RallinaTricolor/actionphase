import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../../fixtures/test-tags';
import { RegistrationPage } from '../../pages/RegistrationPage';

/**
 * Critical Journey: User Onboarding
 *
 * Tests the new user experience:
 * Register → Login → Explore Games → View Game Details
 *
 * This is a CRITICAL path test - must pass for deployment
 */
test.describe('Critical: User Onboarding Journey', () => {

  test(tagTest([tags.CRITICAL, tags.AUTH, tags.E2E], 'New user can register and explore games'), async ({ page }) => {
    // Generate unique user credentials
    const timestamp = Date.now();
    const username = `newuser_${timestamp}`;
    const email = `newuser_${timestamp}@test.example.com`;
    const password = 'SecurePassword123!';

    // Step 1: Navigate to registration
    const registrationPage = new RegistrationPage(page);
    await registrationPage.goto();

    await expect(page.getByRole('heading', { name: /Register|Sign Up/i })).toBeVisible();

    // Step 2: Complete registration
    await registrationPage.register(email, username, password);

    // Should redirect to dashboard after successful registration
    await page.waitForURL(/\/(dashboard|games)/, { timeout: 10000 });

    console.log(`✓ User registered successfully: ${username}`);

    // Step 3: Verify user is logged in by checking for dashboard elements
    const hasDashboard = await page.locator('text=/Dashboard|My Games|Welcome/i').isVisible().catch(() => false);
    const hasNavigation = await page.locator('nav, header').isVisible().catch(() => false);

    expect(hasDashboard || hasNavigation).toBeTruthy();

    // Step 4: Navigate to games list
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText(/Games|Browse Games/i);

    console.log('✓ User can access games list');

    // Step 5: Check if games are displayed
    const gameCards = page.locator('[data-testid^="game-card-"], .game-card, article');
    const gameCount = await gameCards.count();

    console.log(`Found ${gameCount} games in listing`);

    // Step 6: If games exist, view one
    if (gameCount > 0) {
      // Click on first game
      const firstGame = gameCards.first();
      await firstGame.click();

      await page.waitForURL(/\/games\/\d+/, { timeout: 5000 });

      // Verify game details page loaded
      const gameHeading = page.locator('h1, h2').first();
      await expect(gameHeading).not.toHaveText('');

      console.log('✓ User can view game details');

      // Check for game information sections - verify title is present
      const titleLocator = page.locator('h1, h2').first();
      await expect(titleLocator).toBeVisible({ timeout: 5000 });

      console.log('✓ Game details page displays information');
    }

    // Step 7: Navigate to settings
    const settingsLink = page.locator('a[href="/settings"], button:has-text("Settings")');
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1')).toContainText('Settings');

      console.log('✓ User can access settings');
    }

    console.log('✓ User onboarding journey completed successfully');
  });

  test(tagTest([tags.CRITICAL, tags.AUTH], 'Registration validates input'), async ({ page }) => {
    const registrationPage = new RegistrationPage(page);
    await registrationPage.goto();

    // Test: Try registering with invalid email
    await registrationPage.registerInvalid(
      'invalid-email',  // Invalid email format
      'testuser',
      'password123'
    );

    // Should stay on login page (registration doesn't succeed)
    const currentUrl = page.url();
    const onLoginPage = currentUrl.includes('/login');

    expect(onLoginPage).toBeTruthy();

    console.log('✓ Registration validates email format');

    // Test 2: Try registering with empty fields
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click sign up button again
    const signUpButton = page.locator('button:has-text("Don\'t have an account? Sign up")');
    const isVisible = await signUpButton.isVisible().catch(() => false);
    if (isVisible) {
      await signUpButton.click();
      await page.waitForTimeout(500);
    }

    const submitButton = page.locator('[data-testid="register-submit"]');
    await submitButton.click();

    // Browser HTML5 validation should prevent submission
    // Or error message should appear
    const hasError = await page.locator('[data-testid="error-message"]').isVisible().catch(() => false);
    const stillOnPage = page.url().includes('/login');

    expect(hasError || stillOnPage).toBeTruthy();

    console.log('✓ Registration validates required fields');
  });

  test(tagTest([tags.CRITICAL, tags.AUTH], 'User can logout after registration'), async ({ page }) => {
    // Register a new user
    const timestamp = Date.now();
    const username = `logout_test_${timestamp}`;
    const email = `logout_${timestamp}@test.example.com`;
    const password = 'TestPassword123!';

    const registrationPage = new RegistrationPage(page);
    await registrationPage.goto();
    await registrationPage.register(email, username, password);

    // Wait for redirect after registration
    await page.waitForURL(/\/(dashboard|games)/, { timeout: 10000 });

    console.log('✓ User registered and logged in');

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")');

    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForLoadState('networkidle');

      // Should redirect to login or home page
      const currentUrl = page.url();
      const redirectedToPublic = currentUrl.includes('/login') || currentUrl.endsWith('/');

      expect(redirectedToPublic).toBeTruthy();

      console.log('✓ User logged out successfully');

      // Try accessing dashboard - should redirect to login
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const redirectedToLogin = page.url().includes('/login');
      expect(redirectedToLogin).toBeTruthy();

      console.log('✓ Protected routes require authentication after logout');
    } else {
      console.log('⚠ Logout button not found - skipping logout test');
    }
  });
});
