import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { assertUrl } from '../utils/assertions';
import { SettingsPage } from '../pages/SettingsPage';
import { DEFAULT_TIMEOUT } from '../config/test-timeouts';

/**
 * Journey: User Account Security Management
 *
 * Tests the account security features available in Settings:
 * - Change Username
 * - Change Email (with verification)
 * - Delete Account (with soft delete)
 *
 * Prerequisites:
 * - Backend unit tests pass
 * - API endpoints return correct data
 * - Frontend component tests pass
 * - System running (backend + frontend)
 */
test.describe('Account Security Management', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/');
  });

  test('should successfully change username', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');
    await assertUrl(page, '/dashboard');

    // Wait for auth to fully stabilize (dashboard should be fully loaded)
    await page.waitForSelector('nav a[href="/dashboard"]', { state: 'visible' });

    // Navigate to settings using POM
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await assertUrl(page, '/settings');
    await settingsPage.clickAccountInformation();

    // Verify current username is displayed
    await expect(settingsPage.getCurrentUsernameDisplay()).toBeVisible();
    await expect(settingsPage.getCurrentUsernameDisplay()).toContainText('TestPlayer1');

    // Change username
    await settingsPage.changeUsername('TestPlayer1Updated', 'testpassword123');

    // Wait for success toast
    await expect(page.locator('text=/Username changed successfully/i')).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Wait for the username to update in the UI (AuthContext refetches currentUser)
    await expect(settingsPage.getCurrentUsernameDisplay()).toContainText('TestPlayer1Updated', { timeout: DEFAULT_TIMEOUT });
  });

  test('should show validation error when changing username without password', async ({ page }) => {
    // Login as Player 2
    await loginAs(page, 'PLAYER_2');

    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickAccountInformation();

    // Fill in only the new username (no password)
    await settingsPage.getNewUsernameInput().fill('TestPlayer2Updated');
    await settingsPage.getChangeUsernameSubmit().click();

    // Should show validation error
    await expect(settingsPage.getChangeUsernameForm().locator('text=/Current password is required/i')).toBeVisible();
  });

  test('should successfully request email change', async ({ page }) => {
    // Login as Player 3
    await loginAs(page, 'PLAYER_3');

    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickAccountInformation();

    // Scroll email form into view
    await settingsPage.getChangeEmailForm().scrollIntoViewIfNeeded();
    await expect(settingsPage.getChangeEmailForm()).toBeVisible();

    // Verify current email is displayed
    await expect(settingsPage.getCurrentEmailDisplay()).toBeVisible();
    await expect(settingsPage.getCurrentEmailDisplay()).toContainText('test_player3');

    // Verify info alert about verification is shown
    await expect(settingsPage.getEmailVerificationInfo()).toBeVisible();
    await expect(settingsPage.getEmailVerificationInfo()).toContainText('verification email will be sent');

    // Request email change
    await settingsPage.requestEmailChange('player3_updated@example.com', 'testpassword123');

    // Wait for success toast
    await expect(page.locator('text=/Verification email sent/i')).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Form should be cleared
    await expect(settingsPage.getNewEmailInput()).toHaveValue('');
    await expect(settingsPage.getEmailPasswordInput()).toHaveValue('');
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    // Login as Player 4
    await loginAs(page, 'PLAYER_4');

    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickAccountInformation();

    // Fill in with invalid email
    const newEmailInput = settingsPage.getNewEmailInput();
    await newEmailInput.fill('invalid-email');
    await settingsPage.getEmailPasswordInput().fill('testpassword123');
    await settingsPage.getChangeEmailSubmit().click();

    // HTML5 validation should prevent submission
    const isInvalid = await newEmailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should prevent username change with incorrect password', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickAccountInformation();

    // Fill in the form with wrong password
    await settingsPage.changeUsername('TestGMUpdated', 'wrongpassword');

    // Should show error (toast or alert)
    await expect(page.locator('text=/incorrect password|invalid password|authentication failed/i').first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  });

  test('should prevent email change with incorrect password', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickAccountInformation();

    // Fill in the form with wrong password
    await settingsPage.requestEmailChange('gm_updated@example.com', 'wrongpassword');

    // Should show error (toast or alert)
    await expect(page.locator('text=/incorrect password|invalid password|authentication failed/i').first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  });
});
