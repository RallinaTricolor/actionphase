import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId, getWorkerUsername } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { GameApplicationsPage } from '../pages/GameApplicationsPage';

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
    const applicationsPage = new GameApplicationsPage(page, gameId);
    const gamePage = new GameDetailsPage(page);

    // Navigate to game details page using POM
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Verify we're on the right game page
    await expect(page.locator('text=E2E Test: Game Application - Submit')).toBeVisible({ timeout: 10000 });

    // Should see "Apply to Join" button (not a participant yet)
    expect(await applicationsPage.hasApplyButton()).toBe(true);

    // Submit application using POM
    await applicationsPage.submitApplication(
      'I love fantasy games and would like to join as a skilled ranger character!',
      'player'
    );

    // Wait for submission to process
    await page.waitForTimeout(1000);

    // Refresh page to see updated application status
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Apply button should no longer be visible after application submitted
    expect(await applicationsPage.hasApplyButton()).toBe(false);
  });

  test('GM can view applications in dashboard', async ({ page }) => {
    // Login as GM and view applications
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_VIEW');
    const applicationsPage = new GameApplicationsPage(page, gameId);

    // Navigate to applications tab using POM
    await applicationsPage.goto();

    // Should see application from PLAYER_4 (username: TestPlayer4 or TestPlayer4_N for worker N)
    const pendingApplications = await applicationsPage.getPendingApplications();
    expect(pendingApplications).toContain(getWorkerUsername('TestPlayer4'));

    // Verify pending applications count
    const pendingCount = await applicationsPage.getPendingApplicationsCount();
    expect(pendingCount).toBeGreaterThan(0);
  });

  test('GM can approve application and player becomes participant', async ({ page }) => {
    // === STEP 1: GM approves the application ===
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_APPROVE');
    const applicationsPage = new GameApplicationsPage(page, gameId);

    // Navigate to applications tab using POM
    await applicationsPage.goto();
    await page.waitForLoadState('networkidle');

    // Should see PLAYER_3's application (username: TestPlayer3 or TestPlayer3_N for worker N)
    const pendingApplications = await applicationsPage.getPendingApplications();
    expect(pendingApplications).toContain(getWorkerUsername('TestPlayer3'));

    // Approve PLAYER_3's application using POM
    await applicationsPage.approveApplication(getWorkerUsername('TestPlayer3'));

    // Wait for approval to process
    await page.waitForTimeout(2000);

    // === STEP 2: Verify player DOES have access after approval ===
    // (Approval immediately grants participant access)
    await loginAs(page, 'PLAYER_3');
    const playerGamePage = new GameDetailsPage(page);
    await playerGamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Should NOT see "Apply to Join" button anymore
    const applyButton = page.getByRole('button', { name: 'Apply to Join' });
    await expect(applyButton).not.toBeVisible();

    // Should see participant tabs (user is now a participant) - use .locator('visible=true').first() to avoid strict mode violation
    await expect(page.getByRole('tab', { name: 'Participants' }).or(page.getByRole('tab', { name: 'Game Info' })).locator('visible=true').first()).toBeVisible({ timeout: 10000 });
  });

  test('GM can reject application with confirmation', async ({ page }) => {
    // Login as GM and reject the application
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_REJECT');
    const applicationsPage = new GameApplicationsPage(page, gameId);

    // Navigate to applications tab using POM
    await applicationsPage.goto();

    // Should see pending applications
    const pendingCount = await applicationsPage.getPendingApplicationsCount();
    expect(pendingCount).toBeGreaterThan(0);

    // Handle confirmation dialog
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('reject');
      dialog.accept();
    });

    // Reject first pending application using POM
    const pendingApplications = await applicationsPage.getPendingApplications();
    await applicationsPage.rejectApplication(pendingApplications[0]);

    // Wait for rejection to process
    await page.waitForTimeout(2000);

    // Refresh and navigate back to applications
    await applicationsPage.goto();

    // Should now see reviewed applications section
    const reviewedCount = await applicationsPage.getReviewedApplicationsCount();
    expect(reviewedCount).toBeGreaterThan(0);
  });

  test('player cannot apply to same game twice', async ({ page }) => {
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_DUPLICATE');
    const applicationsPage = new GameApplicationsPage(page, gameId);
    const gamePage = new GameDetailsPage(page);

    // Navigate to game that already has application from PLAYER_2
    await gamePage.goto(gameId);

    // Should NOT see "Apply to Join" button (already applied)
    expect(await applicationsPage.hasApplyButton()).toBe(false);

    // Should see application status instead
    await expect(page.locator('text=Application Pending').or(page.locator('text=pending')).locator('visible=true').first()).toBeVisible();
  });

  test('player can withdraw their pending application', async ({ page }) => {
    // First, player submits an application
    await loginAs(page, 'PLAYER_4');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_SUBMIT');
    const applicationsPage = new GameApplicationsPage(page, gameId);
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Submit application using POM
    expect(await applicationsPage.hasApplyButton()).toBe(true);
    await applicationsPage.submitApplication('I would like to join this game.', 'player');

    // Wait for submission to process
    await page.waitForTimeout(1000);

    // Refresh to see updated status
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Should see application pending status
    const pendingIndicator = page.locator('text=Application Pending').or(
      page.locator('text=Pending')
    ).or(
      page.locator('text=Applied').locator('visible=true').first()
    );
    await expect(pendingIndicator.locator('visible=true').first()).toBeVisible({ timeout: 10000 });

    // Handle confirmation dialog if present
    page.once('dialog', dialog => {
      expect(dialog.message()).toMatch(/withdraw|cancel/i);
      dialog.accept();
    });

    // Withdraw application using POM
    await applicationsPage.withdrawApplication();

    // Wait for withdrawal to process
    await page.waitForTimeout(1000);

    // Refresh page to see updated state
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Should now see "Apply to Join" button again (able to reapply)
    expect(await applicationsPage.hasApplyButton()).toBe(true);

    // Should NOT see pending status anymore
    const pendingAfterWithdraw = page.locator('text=Application Pending').or(page.locator('text=pending')).locator('visible=true').first();
    const stillPending = await pendingAfterWithdraw.isVisible().catch(() => false);
    expect(stillPending).toBe(false);
  });

  test('public applicants list is visible during recruitment', async ({ page }) => {
    // === STEP 1: PLAYER_2 and PLAYER_3 apply to the game ===
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_SUBMIT');
    const applicationsPage = new GameApplicationsPage(page, gameId);
    const gamePage = new GameDetailsPage(page);

    // PLAYER_2 applies
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    if (await applicationsPage.hasApplyButton()) {
      await applicationsPage.submitApplication('I want to join!', 'player');
      await page.waitForTimeout(1000);
    }

    // PLAYER_3 applies
    await loginAs(page, 'PLAYER_3');
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    if (await applicationsPage.hasApplyButton()) {
      await applicationsPage.submitApplication('Count me in!', 'player');
      await page.waitForTimeout(1000);
    }

    // === STEP 2: Navigate to Game Info tab to see public applicants ===
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Click on Game Info tab
    const infoTab = page.getByRole('tab', { name: 'Game Info' }).or(page.getByRole('tab', { name: 'Info' }));
    await infoTab.click();
    await page.waitForTimeout(500);

    // === STEP 3: Verify public applicants section is visible ===
    // Should see "Applicants" heading
    await expect(page.locator('text=Applicants').or(page.locator('text=applicants')).first()).toBeVisible({ timeout: 5000 });

    // Should see player badges/names (usernames are visible, NOT status)
    const player2Username = getWorkerUsername('TestPlayer2');
    const player3Username = getWorkerUsername('TestPlayer3');

    // At least one of the applicants should be visible
    const hasApplicants = await page.locator(`text=${player2Username}`).or(page.locator(`text=${player3Username}`)).first().isVisible().catch(() => false);
    expect(hasApplicants).toBe(true);

    // === STEP 4: Verify NO status badges are shown (pending/approved/rejected) ===
    // The public list should NOT show application status
    const statusBadge = page.locator('text=Pending Review').or(page.locator('text=Approved')).or(page.locator('text=Rejected'));
    const hasStatus = await statusBadge.first().isVisible().catch(() => false);
    expect(hasStatus).toBe(false); // Status should NOT be visible to non-GMs
  });
});
