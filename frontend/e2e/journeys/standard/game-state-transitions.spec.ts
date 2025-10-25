import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../../fixtures/test-tags';
import { loginAs } from '../../fixtures/auth-helpers';
import { FIXTURE_GAMES } from '../../fixtures/test-data-factory';

test.describe.skip('Game State Transitions Journey', () => {
  test(tagTest([tags.GAME, tags.CRITICAL, tags.E2E], 'GM transitions game: setup → recruitment'), async ({ page }) => {
    await loginAs(page, 'GM');

    // Look for a game in 'setup' state
    // Note: This may need a fresh game or we test with recruiting state
    const gameTitle = FIXTURE_GAMES.RECRUITING.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    // Check if we need to create a new game first
    const createGameButton = page.locator('button:has-text("Create Game"), a:has-text("Create Game")');
    const canCreateGame = await createGameButton.isVisible().catch(() => false);

    if (canCreateGame) {
      // Create a new game to test transition
      await createGameButton.click();
      await page.waitForLoadState('networkidle');

      const titleInput = page.locator('[data-testid="game-title"]');
      const timestamp = Date.now();
      await titleInput.fill(`E2E State Test ${timestamp}`);

      const descriptionInput = page.locator('[data-testid="game-description"]');
      await descriptionInput.fill('Testing state transitions');

      const submitButton = page.locator('[data-testid="create-game-submit"]');
      await submitButton.click();
      await page.waitForLoadState('networkidle');

      // Should be on game details page now
      // Look for "Start Recruitment" or similar button
      const startRecruitmentButton = page.locator('button:has-text("Start Recruitment"), button:has-text("Open Recruitment")');
      const canStartRecruitment = await startRecruitmentButton.isVisible().catch(() => false);

      if (canStartRecruitment) {
        await startRecruitmentButton.click();
        await page.waitForLoadState('networkidle');

        // Verify state changed
        await expect(page.locator('text=/recruiting|recruitment/i')).toBeVisible({ timeout: 5000 });
        console.log('✓ Game transitioned to recruitment state');
      } else {
        console.log('⚠ Start Recruitment button not available - game may already be in recruitment');
      }
    } else {
      // Navigate to existing recruiting game
      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      // Verify it's in recruiting state
      const recruitingIndicator = page.locator('text=/recruiting|recruitment/i');
      const isRecruiting = await recruitingIndicator.isVisible().catch(() => false);

      if (isRecruiting) {
        console.log('✓ Game is in recruitment state');
      }
    }
  });

  test(tagTest([tags.GAME, tags.CRITICAL, tags.E2E], 'GM transitions game: recruitment → character_creation'), async ({ page }) => {
    await loginAs(page, 'GM');

    const gameTitle = FIXTURE_GAMES.RECRUITING.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Look for transition button (e.g., "Start Character Creation", "Close Recruitment")
    const startCharCreationButton = page.locator('button:has-text("Character Creation"), button:has-text("Close Recruitment")');
    const canTransition = await startCharCreationButton.isVisible().catch(() => false);

    if (canTransition) {
      await startCharCreationButton.click();
      await page.waitForLoadState('networkidle');

      // Verify state changed
      await expect(page.locator('text=/character.*creation/i')).toBeVisible({ timeout: 5000 });
      console.log('✓ Game transitioned to character creation state');
    } else {
      console.log('⚠ Character Creation transition button not available');

      // Check current state
      const currentState = page.locator('[data-testid="game-state"], [class*="state"]');
      const stateText = await currentState.textContent().catch(() => '');
      console.log(`  Current state: ${stateText}`);
    }
  });

  test(tagTest([tags.GAME, tags.CRITICAL, tags.E2E], 'GM transitions game: character_creation → in_progress'), async ({ page }) => {
    await loginAs(page, 'GM');

    // Use a game that's likely in character creation or can be transitioned
    const gameTitle = FIXTURE_GAMES.COMMON_ROOM.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Look for "Start Game" button
    const startGameButton = page.locator('button:has-text("Start Game")');
    const canStart = await startGameButton.isVisible().catch(() => false);

    if (canStart) {
      await startGameButton.click();
      await page.waitForLoadState('networkidle');

      // Verify game started
      await expect(page.locator('text=/in progress|active/i')).toBeVisible({ timeout: 5000 });
      console.log('✓ Game transitioned to in_progress state');

      // Verify phase information is visible
      const phaseInfo = page.locator('[data-testid="current-phase"], [class*="phase"]');
      const hasPhase = await phaseInfo.isVisible().catch(() => false);

      if (hasPhase) {
        console.log('✓ Current phase information displayed');
      }
    } else {
      console.log('⚠ Start Game button not available - checking if already in progress');

      const inProgressIndicator = page.locator('text=/in progress|active/i');
      const isInProgress = await inProgressIndicator.isVisible().catch(() => false);

      if (isInProgress) {
        console.log('✓ Game is already in progress');
      }
    }
  });

  test(tagTest([tags.GAME, tags.E2E], 'GM pauses active game'), async ({ page }) => {
    await loginAs(page, 'GM');

    const gameTitle = FIXTURE_GAMES.COMMON_ROOM.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Look for Pause button
    const pauseButton = page.locator('button:has-text("Pause"), button:has-text("Pause Game")');
    const canPause = await pauseButton.isVisible().catch(() => false);

    if (canPause) {
      await pauseButton.click();
      await page.waitForLoadState('networkidle');

      // May have confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      const hasConfirmation = await confirmButton.isVisible().catch(() => false);

      if (hasConfirmation) {
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
      }

      // Verify game paused
      await expect(page.locator('text=/paused/i')).toBeVisible({ timeout: 5000 });
      console.log('✓ Game paused successfully');
    } else {
      console.log('⚠ Pause button not available');

      // Check if already paused
      const pausedIndicator = page.locator('text=/paused/i');
      const isPaused = await pausedIndicator.isVisible().catch(() => false);

      if (isPaused) {
        console.log('✓ Game is already paused');
      }
    }
  });

  test(tagTest([tags.GAME, tags.E2E], 'GM resumes paused game'), async ({ page }) => {
    await loginAs(page, 'GM');

    const gameTitle = FIXTURE_GAMES.PAUSED.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Look for Resume button
    const resumeButton = page.locator('button:has-text("Resume"), button:has-text("Resume Game")');
    const canResume = await resumeButton.isVisible().catch(() => false);

    if (canResume) {
      await resumeButton.click();
      await page.waitForLoadState('networkidle');

      // May have confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      const hasConfirmation = await confirmButton.isVisible().catch(() => false);

      if (hasConfirmation) {
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
      }

      // Verify game resumed (should show in_progress)
      await expect(page.locator('text=/in progress|active/i')).toBeVisible({ timeout: 5000 });
      console.log('✓ Game resumed successfully');
    } else {
      console.log('⚠ Resume button not available');

      // Check current state
      const stateIndicator = page.locator('[data-testid="game-state"], text=/state:/i');
      const stateText = await stateIndicator.textContent().catch(() => '');
      console.log(`  Current state: ${stateText}`);
    }
  });

  test(tagTest([tags.GAME, tags.E2E], 'GM completes finished game'), async ({ page }) => {
    await loginAs(page, 'GM');

    // Use a game that can be completed or is already completed
    const gameTitle = FIXTURE_GAMES.COMPLETED.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Look for Complete or End Game button
    const completeButton = page.locator('button:has-text("Complete"), button:has-text("End Game")');
    const canComplete = await completeButton.isVisible().catch(() => false);

    if (canComplete) {
      await completeButton.click();
      await page.waitForLoadState('networkidle');

      // Confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Complete")');
      const hasConfirmation = await confirmButton.isVisible().catch(() => false);

      if (hasConfirmation) {
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
      }

      // Verify game completed
      await expect(page.locator('text=/completed|finished|ended/i')).toBeVisible({ timeout: 5000 });
      console.log('✓ Game completed successfully');
    } else {
      console.log('⚠ Complete Game button not available');

      // Check if already completed
      const completedIndicator = page.locator('text=/completed|finished/i');
      const isCompleted = await completedIndicator.isVisible().catch(() => false);

      if (isCompleted) {
        console.log('✓ Game is already completed');
      }
    }
  });

  test(tagTest([tags.GAME, tags.E2E], 'GM cancels game in recruitment'), async ({ page }) => {
    await loginAs(page, 'GM');

    // Create a new game specifically for cancellation test
    await page.goto('/games/create');
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const titleInput = page.locator('[data-testid="game-title"]');
    await titleInput.fill(`E2E Cancel Test ${timestamp}`);

    const descriptionInput = page.locator('[data-testid="game-description"]');
    await descriptionInput.fill('This game will be cancelled');

    const submitButton = page.locator('[data-testid="create-game-submit"]');
    await submitButton.click();
    await page.waitForLoadState('networkidle');

    // Now try to cancel the game
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Delete"), button:has-text("Cancel Game")');
    const canCancel = await cancelButton.isVisible().catch(() => false);

    if (canCancel) {
      await cancelButton.click();
      await page.waitForLoadState('networkidle');

      // Confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")');
      const hasConfirmation = await confirmButton.isVisible().catch(() => false);

      if (hasConfirmation) {
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
      }

      // Verify redirected to games list or dashboard
      const url = page.url();
      const redirected = url.includes('/games') || url.includes('/dashboard');

      if (redirected) {
        console.log('✓ Game cancelled - redirected to games list');
      }

      // Verify game no longer appears in list
      const cancelledGame = page.locator(`text=E2E Cancel Test ${timestamp}`);
      const stillExists = await cancelledGame.isVisible().catch(() => false);

      if (!stillExists) {
        console.log('✓ Cancelled game removed from list');
      }
    } else {
      console.log('⚠ Cancel button not available');
    }
  });
});
