import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';

/**
 * E2E Tests for Action Results Flow
 *
 * Tests the complete action results workflow including:
 * - Player views published action results via History tab
 * - Player cannot see unpublished results
 * - Results display with markdown content and character mentions
 * - Multiple results display correctly
 *
 * Uses dedicated E2E fixture (E2E_ACTION_RESULTS) which includes:
 * - Game with completed action phase (Phase 1)
 * - Published results for Player 1 and Player 2
 * - Unpublished result for Player 3 (should not be visible to players)
 * - Player 4 has no result (for empty state testing)
 *
 * CRITICAL: This tests CORE game mechanic - GM providing feedback to players
 */

test.describe('Action Results Flow', () => {

  test('player can view their published action results', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to History tab to see past phases
    await page.getByRole('tab', { name: 'History' }).click();
    await page.waitForLoadState('networkidle');

    // Click on Phase 1 (completed action phase) to view action results
    await page.locator('text=Phase 1').first().click();
    await page.waitForLoadState('networkidle');

    // Should see action results heading for the phase
    await expect(page.getByRole('heading', { name: /Completed Action Phase/ })).toBeVisible({ timeout: 10000 });

    // Should see Player 1's published result
    await expect(page.locator('text=Basement Investigation Results').first()).toBeVisible({ timeout: 10000 });

    // Should see result content with markdown
    await expect(page.locator('text=You descend into the basement')).toBeVisible();

    // Should see discovery outcome
    await expect(page.locator('text=You discovered')).toBeVisible();
    await expect(page.locator('text=A secret passage!')).toBeVisible();

    // Should see GM attribution
    await expect(page.locator('text=From: TestGM').first()).toBeVisible();
  });

  test('player can see character mentions in results', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to History tab
    await page.getByRole('tab', { name: 'History' }).click();
    await page.waitForLoadState('networkidle');

    // Click on Phase 1 to view action results
    await page.locator('text=Phase 1').first().click();
    await page.waitForLoadState('networkidle');

    // Player 1's result contains a character mention: "@Result Test Char 2"
    await expect(page.locator('text=@Result Test Char 2')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=might want to know about this')).toBeVisible();
  });

  test('player sees multiple results if they have multiple', async ({ page }) => {
    // Player 2 should have published results (based on fixture)
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to History tab
    await page.getByRole('tab', { name: 'History' }).click();
    await page.waitForLoadState('networkidle');

    // Click on Phase 1 to view action results
    await page.locator('text=Phase 1').first().click();
    await page.waitForLoadState('networkidle');

    // Should see action results heading
    await expect(page.getByRole('heading', { name: /Completed Action Phase/ })).toBeVisible({ timeout: 10000 });

    // Should see Player 2's result about library research
    await expect(page.locator('text=Library Research Results').first()).toBeVisible({ timeout: 10000 });

    // Should see result content
    await expect(page.locator('text=dusty tomes')).toBeVisible();
    await expect(page.locator('text=Order of the Crimson Moon')).toBeVisible();

    // Should see knowledge gained
    await expect(page.locator('text=Knowledge Gained')).toBeVisible();
    await expect(page.locator('text=+1 Occult Lore')).toBeVisible();
  });

  test('player cannot see unpublished results', async ({ page }) => {
    // Player 3 has an UNPUBLISHED result in the fixture
    await loginAs(page, 'PLAYER_3');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to History tab
    await page.getByRole('tab', { name: 'History' }).click();
    await page.waitForLoadState('networkidle');

    // Click on Phase 1 to view action results
    await page.locator('text=Phase 1').first().click();
    await page.waitForLoadState('networkidle');

    // Should NOT see unpublished result content
    await expect(page.locator('text=DRAFT: The symbols appear to be a warning')).not.toBeVisible();

    // Should see empty state message since unpublished results don't show
    const noResultsMessage = page.locator('text=No action results for this phase');
    await expect(noResultsMessage).toBeVisible({ timeout: 10000 });
  });

  test('player with no results sees empty state', async ({ page }) => {
    // Player 4 has no results in the fixture
    await loginAs(page, 'PLAYER_4');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Navigate to History tab
    await page.getByRole('tab', { name: 'History' }).click();
    await page.waitForLoadState('networkidle');

    // Click on Phase 1 to view action results
    await page.locator('text=Phase 1').first().click();
    await page.waitForLoadState('networkidle');

    // Should see empty state message
    await expect(page.locator('text=No action results for this phase')).toBeVisible({ timeout: 10000 });
  });
});
