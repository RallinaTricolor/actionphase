import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../fixtures/auth-helpers';
import { assertUrl, assertTextVisible, assertElementExists } from '../utils/assertions';

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

  // SKIPPED: Requires JWT refactor to use user_id instead of username
  // See: JWT Username → User ID Migration Plan
  test.skip('should successfully change username', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');
    await assertUrl(page, '/dashboard');

    // Navigate to settings
    await page.goto('/settings');
    await assertUrl(page, '/settings');

    // Find the Change Username section
    const usernameSection = page.locator('h3:has-text("Change Username")').locator('..').locator('..');
    await expect(usernameSection).toBeVisible();

    // Verify current username is displayed
    await expect(usernameSection.locator('text=/Current username:.*TestPlayer1/i')).toBeVisible();

    // Fill in the form
    const newUsernameInput = usernameSection.locator('input[placeholder*="Enter new username"]');
    const passwordInput = usernameSection.locator('input[type="password"]');
    const submitButton = usernameSection.locator('button:has-text("Change Username")');

    await newUsernameInput.fill('TestPlayer1Updated');
    await passwordInput.fill('testpassword123');
    await submitButton.click();

    // Wait for success toast
    await expect(page.locator('text=/Username changed successfully/i')).toBeVisible({ timeout: 5000 });

    // Page should reload - wait for it
    await page.waitForLoadState('networkidle');

    // Verify the new username is displayed
    await expect(page.locator('text=/Current username:.*TestPlayer1Updated/i')).toBeVisible();
  });

  test('should show validation error when changing username without password', async ({ page }) => {
    // Login as Player 2
    await loginAs(page, 'PLAYER_2');
    await page.goto('/settings');

    // Find the Change Username section
    const usernameSection = page.locator('h3:has-text("Change Username")').locator('..').locator('..');

    // Fill in only the new username (no password)
    const newUsernameInput = usernameSection.locator('input[placeholder*="Enter new username"]');
    const submitButton = usernameSection.locator('button:has-text("Change Username")');

    await newUsernameInput.fill('TestPlayer2Updated');
    await submitButton.click();

    // Should show validation error
    await expect(usernameSection.locator('text=/Current password is required/i')).toBeVisible();
  });

  // SKIPPED: Requires JWT refactor to use user_id instead of username
  // See: JWT Username → User ID Migration Plan
  test.skip('should successfully request email change', async ({ page }) => {
    // Login as Player 3
    await loginAs(page, 'PLAYER_3');
    await page.goto('/settings');

    // Find the Change Email section
    const emailSection = page.locator('h3:has-text("Change Email")').locator('..').locator('..');
    await expect(emailSection).toBeVisible();

    // Verify current email is displayed
    await expect(emailSection.locator('text=/Current email:.*test_player3@example.com/i')).toBeVisible();

    // Verify info alert about verification is shown
    await expect(emailSection.locator('text=/verification email will be sent/i')).toBeVisible();

    // Fill in the form
    const newEmailInput = emailSection.locator('input[placeholder*="Enter new email address"]');
    const passwordInput = emailSection.locator('input[type="password"]');
    const submitButton = emailSection.locator('button:has-text("Send Verification Email")');

    await newEmailInput.fill('player3_updated@example.com');
    await passwordInput.fill('testpassword123');
    await submitButton.click();

    // Wait for success toast
    await expect(page.locator('text=/Verification email sent/i')).toBeVisible({ timeout: 5000 });

    // Form should be cleared
    await expect(newEmailInput).toHaveValue('');
    await expect(passwordInput).toHaveValue('');
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    // Login as Player 4
    await loginAs(page, 'PLAYER_4');
    await page.goto('/settings');

    // Find the Change Email section
    const emailSection = page.locator('h3:has-text("Change Email")').locator('..').locator('..');

    // Fill in with invalid email
    const newEmailInput = emailSection.locator('input[placeholder*="Enter new email address"]');
    const passwordInput = emailSection.locator('input[type="password"]');
    const submitButton = emailSection.locator('button:has-text("Send Verification Email")');

    await newEmailInput.fill('invalid-email');
    await passwordInput.fill('testpassword123');
    await submitButton.click();

    // HTML5 validation should prevent submission
    // Or our validation should show error
    const isInvalid = await newEmailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  // SKIPPED: Requires JWT refactor to use user_id instead of username
  // See: JWT Username → User ID Migration Plan
  test.skip('should successfully delete account', async ({ page }) => {
    // Login as Player 5 (we'll delete this account)
    await loginAs(page, 'PLAYER_5');
    await page.goto('/settings');

    // Find the Account Deletion section (Danger Zone)
    const dangerSection = page.locator('text=/Danger Zone|Delete Account/i').locator('..').locator('..');
    await expect(dangerSection).toBeVisible();

    // Verify warning message is shown
    await expect(dangerSection.locator('text=/permanently deleted|cannot be undone|30 days/i').first()).toBeVisible();

    // Click the delete button
    const deleteButton = dangerSection.locator('button:has-text("Delete My Account")');
    await deleteButton.click();

    // Confirmation dialog should appear
    await expect(page.locator('[role="dialog"], .modal, [data-testid*="dialog"]').locator('text=/Are you sure|confirm/i').first()).toBeVisible({ timeout: 3000 });

    // Find and fill the password input in the dialog
    const dialogPasswordInput = page.locator('[role="dialog"] input[type="password"], .modal input[type="password"], [data-testid*="dialog"] input[type="password"]').first();
    await dialogPasswordInput.fill('testpassword123');

    // Find and click the confirm button
    const confirmButton = page.locator('[role="dialog"], .modal, [data-testid*="dialog"]').locator('button:has-text("Delete Account"), button:has-text("Confirm")').last();
    await confirmButton.click();

    // Should show success toast
    await expect(page.locator('text=/account.*deleted|deletion.*scheduled/i')).toBeVisible({ timeout: 5000 });

    // Should be logged out and redirected to login
    await assertUrl(page, '/login');
  });

  // SKIPPED: Requires JWT refactor to use user_id instead of username
  // See: JWT Username → User ID Migration Plan
  test.skip('should cancel account deletion', async ({ page }) => {
    // Login as Audience user
    await loginAs(page, 'AUDIENCE');
    await page.goto('/settings');

    // Find the Account Deletion section
    const dangerSection = page.locator('text=/Danger Zone|Delete Account/i').locator('..').locator('..');
    const deleteButton = dangerSection.locator('button:has-text("Delete My Account")');
    await deleteButton.click();

    // Confirmation dialog should appear
    await expect(page.locator('[role="dialog"], .modal').locator('text=/Are you sure|confirm/i').first()).toBeVisible({ timeout: 3000 });

    // Find and click the cancel button
    const cancelButton = page.locator('[role="dialog"], .modal').locator('button:has-text("Cancel")').first();
    await cancelButton.click();

    // Dialog should close
    await expect(page.locator('[role="dialog"], .modal').locator('text=/Are you sure|confirm/i').first()).not.toBeVisible();

    // Should still be on settings page
    await assertUrl(page, '/settings');
  });

  // SKIPPED: Requires JWT refactor to use user_id instead of username
  // See: JWT Username → User ID Migration Plan
  test.skip('should prevent username change with incorrect password', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await page.goto('/settings');

    // Find the Change Username section
    const usernameSection = page.locator('h3:has-text("Change Username")').locator('..').locator('..');

    // Fill in the form with wrong password
    const newUsernameInput = usernameSection.locator('input[placeholder*="Enter new username"]');
    const passwordInput = usernameSection.locator('input[type="password"]');
    const submitButton = usernameSection.locator('button:has-text("Change Username")');

    await newUsernameInput.fill('TestGMUpdated');
    await passwordInput.fill('wrongpassword');
    await submitButton.click();

    // Should show error (toast or alert)
    await expect(page.locator('text=/incorrect password|invalid password|authentication failed/i').first()).toBeVisible({ timeout: 5000 });
  });

  // SKIPPED: Requires JWT refactor to use user_id instead of username
  // See: JWT Username → User ID Migration Plan
  test.skip('should prevent email change with incorrect password', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await page.goto('/settings');

    // Find the Change Email section
    const emailSection = page.locator('h3:has-text("Change Email")').locator('..').locator('..');

    // Fill in the form with wrong password
    const newEmailInput = emailSection.locator('input[placeholder*="Enter new email address"]');
    const passwordInput = emailSection.locator('input[type="password"]');
    const submitButton = emailSection.locator('button:has-text("Send Verification Email")');

    await newEmailInput.fill('gm_updated@example.com');
    await passwordInput.fill('wrongpassword');
    await submitButton.click();

    // Should show error (toast or alert)
    await expect(page.locator('text=/incorrect password|invalid password|authentication failed/i').first()).toBeVisible({ timeout: 5000 });
  });
});
