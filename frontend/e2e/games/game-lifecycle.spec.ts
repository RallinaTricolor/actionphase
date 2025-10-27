import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';

/**
 * E2E Tests for Game Lifecycle Management
 *
 * Tests GM's ability to manage game state transitions:
 * - Start game (character_creation → in_progress)
 * - Pause game (in_progress → paused)
 * - Resume game (paused → in_progress)
 * - Complete game (in_progress → completed)
 * - Cancel game (recruitment → cancelled)
 *
 * Uses dedicated E2E fixtures (E2E_GAME_LIFECYCLE_*) with games in specific states
 *
 * REFACTORED: Using GameDetailsPage POM exclusively
 * - Eliminated inline selectors
 * - Improved reliability with dedicated POM methods
 */

test.describe('Game Lifecycle Management', () => {

  test('GM can start game', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_START');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Verify we're on the right game page
    await expect(page.getByText('E2E Test: Game Lifecycle - Start')).toBeVisible({ timeout: 10000 });

    // Should see "Start Game" button for character_creation state
    const startButton = gamePage.getButton('Start Game');
    await expect(startButton).toBeVisible({ timeout: 10000 });

    // Start the game using POM
    await gamePage.startGame();

    // Wait for state transition
    await page.waitForTimeout(2000);

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should now see in_progress state buttons (Pause Game, Complete Game)
    await expect(page.getByRole('button', { name: /Pause Game|Complete Game/ }).first()).toBeVisible({ timeout: 10000 });
  });

  test('GM can pause game with confirmation', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_PAUSE');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Should see "Pause Game" button for in_progress state
    const pauseButton = gamePage.getButton('Pause Game');
    await expect(pauseButton).toBeVisible({ timeout: 10000 });

    // Pause the game using POM (handles confirmation modal)
    await gamePage.pauseGame();

    // Wait for state transition
    await page.waitForTimeout(2000);

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should now see "Resume Game" button
    await expect(gamePage.getButton('Resume Game')).toBeVisible({ timeout: 10000 });
  });

  test('GM can resume paused game', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_RESUME');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Should see "Resume Game" button for paused state
    const resumeButton = gamePage.getButton('Resume Game');
    await expect(resumeButton).toBeVisible({ timeout: 10000 });

    // Resume the game using POM
    await gamePage.resumeGame();

    // Wait for state transition
    await page.waitForTimeout(2000);

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should now see in_progress state buttons
    await expect(page.getByRole('button', { name: /Pause Game|Complete Game/ }).first()).toBeVisible({ timeout: 10000 });
  });

  test('GM can complete game with confirmation', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_COMPLETE');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Should see "Complete Game" button for in_progress state
    const completeButton = gamePage.getButton('Complete Game');
    await expect(completeButton).toBeVisible({ timeout: 10000 });

    // Complete the game using POM (handles confirmation modal)
    await gamePage.completeGame();

    // Wait for state transition
    await page.waitForTimeout(2000);

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // In completed state, GM management buttons should not be visible
    await expect(page.getByRole('button', { name: /Start Game|Pause Game|Resume Game|Complete Game|Cancel Game/ })).not.toBeVisible();
  });

  test('GM can cancel recruitment game', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_CANCEL');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Should see "Cancel Game" button for recruitment state
    const cancelButton = gamePage.getButton('Cancel Game');
    await expect(cancelButton).toBeVisible({ timeout: 10000 });

    // Cancel the game using POM
    await gamePage.cancelGame();

    // Wait for state transition
    await page.waitForTimeout(2000);

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // In cancelled state, GM management buttons should not be visible
    await expect(page.getByRole('button', { name: /Start Game|Pause Game|Resume Game|Complete Game|Cancel Game/ })).not.toBeVisible();
  });
});
