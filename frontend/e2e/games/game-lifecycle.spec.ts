import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

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
 * CRITICAL: This tests CORE game state management mechanics
 */

test.describe('Game Lifecycle Management', () => {

  test('GM can start game', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_START');

    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the right game page
    await expect(page.locator('text=E2E Test: Game Lifecycle - Start')).toBeVisible({ timeout: 10000 });

    // Should see "Start Game" button for character_creation state
    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible({ timeout: 10000 });

    // Click start game button
    await startButton.click();

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

    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Should see "Pause Game" button for in_progress state
    const pauseButton = page.getByRole('button', { name: 'Pause Game' }).first();
    await expect(pauseButton).toBeVisible({ timeout: 10000 });

    // Click pause button - this opens confirmation dialog
    await pauseButton.click();

    // Wait for modal to appear with heading (use first() to avoid strict mode - there are 2 headings)
    await expect(page.getByRole('heading', { name: 'Pause Game' }).first()).toBeVisible({ timeout: 5000 });

    // Find and click "Pause Game" button in the modal (the last one is the confirm button)
    const confirmButton = page.getByRole('button', { name: 'Pause Game' }).last();
    await confirmButton.click();

    // Wait for state transition
    await page.waitForTimeout(2000);

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should now see "Resume Game" button
    await expect(page.getByRole('button', { name: 'Resume Game' })).toBeVisible({ timeout: 10000 });
  });

  test('GM can resume paused game', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_RESUME');

    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Should see "Resume Game" button for paused state
    const resumeButton = page.getByRole('button', { name: 'Resume Game' });
    await expect(resumeButton).toBeVisible({ timeout: 10000 });

    // Click resume button
    await resumeButton.click();

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

    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Should see "Complete Game" button for in_progress state
    const completeButton = page.getByRole('button', { name: 'Complete Game' }).first();
    await expect(completeButton).toBeVisible({ timeout: 10000 });

    // Click complete button - this opens confirmation dialog
    await completeButton.click();

    // Wait for modal to appear with heading
    await expect(page.getByRole('heading', { name: 'Complete Game' })).toBeVisible({ timeout: 5000 });

    // Find the confirmation input field and type "completed"
    const confirmInput = page.getByPlaceholder('completed');
    await expect(confirmInput).toBeVisible({ timeout: 5000 });
    await confirmInput.fill('completed');

    // Find and click "Complete Game" button in dialog
    const confirmButton = page.getByRole('button', { name: 'Complete Game' }).last();
    await confirmButton.click();

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

    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Should see "Cancel Game" button for recruitment state
    const cancelButton = page.getByRole('button', { name: 'Cancel Game' });
    await expect(cancelButton).toBeVisible({ timeout: 10000 });

    // Click cancel button
    await cancelButton.click();

    // Wait for state transition
    await page.waitForTimeout(2000);

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // In cancelled state, GM management buttons should not be visible
    await expect(page.getByRole('button', { name: /Start Game|Pause Game|Resume Game|Complete Game|Cancel Game/ })).not.toBeVisible();
  });
});
