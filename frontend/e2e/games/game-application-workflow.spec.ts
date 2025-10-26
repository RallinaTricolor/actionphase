import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * E2E Tests for Game Application Workflow
 *
 * Tests the complete game application process including:
 * - Player submits application to recruitment game
 * - GM receives application notification
 * - GM reviews and approves/rejects applications
 * - Player becomes participant after approval
 * - Duplicate application prevention
 * - Application visibility in GM dashboard
 *
 * Uses dedicated E2E fixtures (E2E_GAME_APPLICATION_*) which include:
 * - Fresh recruitment games with specific test scenarios
 * - Public games visible to all players
 * - GM ready to review applications
 *
 * CRITICAL: This tests CORE player onboarding mechanics
 */

test.describe('Game Application Workflow', () => {

  test('player can submit application to recruitment game', async ({ page }) => {
    await loginAs(page, 'PLAYER_3');

    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_SUBMIT');

    // Navigate directly to game details page
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the right game page
    await expect(page.locator('text=E2E Test: Game Application - Submit')).toBeVisible({ timeout: 10000 });

    // Should see "Apply to Join" button (not a participant yet)
    const applyButton = page.getByRole('button', { name: 'Apply to Join' });
    await expect(applyButton).toBeVisible({ timeout: 10000 });
    await applyButton.click();

    // Fill in application form
    await expect(page.locator('text=Apply to E2E Test: Game Application - Submit')).toBeVisible();

    // Role should default to "player"
    const roleSelect = page.locator('select#role');
    await expect(roleSelect).toHaveValue('player');

    // Write application message
    const messageTextarea = page.getByTestId('application-message');
    await messageTextarea.fill('I love fantasy games and would like to join as a skilled ranger character!');

    // Submit application
    const submitButton = page.getByTestId('submit-application');
    await submitButton.click();

    // Modal should close
    await expect(page.locator('text=Apply to E2E Test: Game Application - Submit').first()).not.toBeVisible({ timeout: 10000 });

    // Refresh page to see updated application status
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Should now see "Application Pending" or button should be disabled/hidden
    // (UI might show different states: Pending badge, disabled button, or no button)
    const pendingIndicator = page.locator('text=Application Pending').or(
      page.locator('text=Pending')
    ).or(
      page.locator('text=Applied').first()
    );

    // Verify either pending status OR Apply button is no longer visible
    const applyButtonAfter = page.getByRole('button', { name: 'Apply to Join' });
    const hasPendingStatus = await pendingIndicator.first().isVisible();
    const hasApplyButton = await applyButtonAfter.isVisible();

    // Either we see pending status OR the apply button is gone (both indicate application submitted)
    expect(hasPendingStatus || !hasApplyButton).toBeTruthy();
  });

  test('GM can view applications in dashboard', async ({ page }) => {
    // Login as GM and view applications
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_VIEW');

    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Click on Applications tab
    await page.click('text=Applications');
    await page.waitForLoadState('networkidle');

    // Wait for applications to finish loading
    await expect(page.locator('text=Loading applications...').first()).not.toBeVisible({ timeout: 10000 });

    // Should see pending applications heading
    await expect(page.getByRole('heading', { name: 'Pending Review' })).toBeVisible({ timeout: 10000 });

    // Should see application from PLAYER_4 (username: TestPlayer4)
    await expect(page.locator('text=TestPlayer4')).toBeVisible({ timeout: 10000 });

    // Should see application message (use first() to avoid strict mode violation with "fantasy" appearing in Genre)
    await expect(page.locator('text=I would like to join').first()).toBeVisible();

    // Should have action buttons (Approve/Reject)
    await expect(page.getByRole('button', { name: 'Approve' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reject' }).first()).toBeVisible();
  });

  test('GM can approve application and player becomes participant', async ({ page }) => {
    // Login as GM and approve the application
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_APPROVE');

    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Click on Applications tab
    await page.click('text=Applications');
    await page.waitForLoadState('networkidle');

    // Wait for applications to load
    await expect(page.locator('text=Loading applications...').first()).not.toBeVisible({ timeout: 10000 });

    // Should see PLAYER_3's application (username: TestPlayer3)
    await expect(page.locator('text=TestPlayer3')).toBeVisible({ timeout: 10000 });

    // Click Approve button for PLAYER_3's application
    const approveButton = page.getByRole('button', { name: 'Approve' }).first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    await approveButton.click();

    // Wait for approval to process
    await page.waitForTimeout(2000);

    // Now login as PLAYER_3 and verify they can access the game
    await loginAs(page, 'PLAYER_3');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Should no longer see "Apply to Join" button
    await expect(page.getByRole('button', { name: 'Apply to Join' })).not.toBeVisible();

    // Should see game tabs (Participants or Game Info) - use first() to avoid strict mode
    await expect(page.getByRole('tab', { name: /Participants|Game Info/ }).first()).toBeVisible({ timeout: 10000 });
  });

  test('GM can reject application with confirmation', async ({ page }) => {
    // Login as GM and reject the application
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_REJECT');

    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Click on Applications tab
    await page.click('text=Applications');
    await page.waitForLoadState('networkidle');

    // Wait for applications to load
    await expect(page.locator('text=Loading applications...').first()).not.toBeVisible({ timeout: 10000 });

    // Find reject button for PLAYER_1's application
    const rejectButton = page.getByRole('button', { name: 'Reject' }).first();
    await expect(rejectButton).toBeVisible({ timeout: 10000 });

    // Click reject and handle confirmation dialog
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('reject');
      dialog.accept();
    });

    await rejectButton.click();

    // Wait for rejection to process
    await page.waitForTimeout(2000);

    // Refresh to see updated status
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click Applications tab again
    await page.click('text=Applications');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Loading applications...').first()).not.toBeVisible({ timeout: 10000 });

    // Should now see the application in "Reviewed Applications" section
    await expect(page.getByRole('heading', { name: 'Reviewed Applications' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('player cannot apply to same game twice', async ({ page }) => {
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_DUPLICATE');

    // Navigate to game that already has application from PLAYER_2
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Should NOT see "Apply to Join" button (already applied)
    await expect(page.getByRole('button', { name: 'Apply to Join' })).not.toBeVisible();

    // Should see application status instead
    await expect(page.locator('text=Application Pending').or(page.locator('text=pending')).first()).toBeVisible();
  });
});
