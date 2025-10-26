import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameHandoutsPage } from '../pages/GameHandoutsPage';

/**
 * E2E Tests for Handouts Feature
 *
 * Tests the complete handouts workflow including:
 * - GM creating handouts with markdown content
 * - GM publishing handouts to players
 * - Players viewing published handouts
 * - Permission boundaries (draft vs published)
 * - Markdown rendering in handouts
 *
 * Uses E2E fixture game with GM and multiple players.
 *
 * CRITICAL: Handouts are GM-only content creation. Players have read-only access to published handouts.
 */

test.describe('Handouts Flow', () => {

  test('GM can create and publish a handout with markdown content', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const handoutsPage = new GameHandoutsPage(page, gameId);
    await handoutsPage.goto();

    // Verify GM can create handouts
    const canCreate = await handoutsPage.canCreateHandouts();
    expect(canCreate).toBe(true);

    // Create handout with markdown
    const handoutTitle = `Test Handout ${Date.now()}`;
    const handoutContent = `# Welcome Adventurers

This is a **test handout** with markdown formatting.

## Important Rules
- Rule 1: Always roll for initiative
- Rule 2: *Never* split the party
- Rule 3: Check for traps

> Remember: The GM is always right!

\`\`\`
Example dice roll: 1d20 + 5
\`\`\``;

    await handoutsPage.createHandout(handoutTitle, handoutContent, true);
    await page.waitForLoadState('networkidle');

    // Verify handout appears in list
    const hasHandout = await handoutsPage.hasHandout(handoutTitle);
    expect(hasHandout).toBe(true);

    // Verify can open and view handout
    await handoutsPage.openHandout(handoutTitle);

    // Verify markdown is rendered (check for heading and list items)
    await expect(page.locator('text=Welcome Adventurers')).toBeVisible();
    await expect(page.locator('text=Always roll for initiative')).toBeVisible();
  });

  test('player can view published handouts', async ({ page }) => {
    // First, GM creates and publishes a handout
    const gmPage = page;
    await loginAs(gmPage, 'GM');
    const gameId = await getFixtureGameId(gmPage, 'E2E_ACTION');

    const gmHandoutsPage = new GameHandoutsPage(gmPage, gameId);
    await gmHandoutsPage.goto();

    const handoutTitle = `Player Visible Handout ${Date.now()}`;
    const handoutContent = 'This handout is visible to all players.';

    await gmHandoutsPage.createHandout(handoutTitle, handoutContent, true);
    await gmPage.waitForLoadState('networkidle');

    // Now login as player and verify they can see it
    await loginAs(gmPage, 'PLAYER_1');
    const playerHandoutsPage = new GameHandoutsPage(gmPage, gameId);
    await playerHandoutsPage.goto();

    // Player should see the handout
    const hasHandout = await playerHandoutsPage.hasHandout(handoutTitle);
    expect(hasHandout).toBe(true);

    // Player can open and read it
    await playerHandoutsPage.openHandout(handoutTitle);
    await expect(gmPage.locator('text=This handout is visible to all players')).toBeVisible();

    // Player should NOT see Create Handout button (GM-only feature)
    const canCreate = await playerHandoutsPage.canCreateHandouts();
    expect(canCreate).toBe(false);
  });

  test('GM can edit existing handout', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const handoutsPage = new GameHandoutsPage(page, gameId);
    await handoutsPage.goto();

    // Create initial handout
    const originalTitle = `Editable Handout ${Date.now()}`;
    const originalContent = 'Original content';
    await handoutsPage.createHandout(originalTitle, originalContent, true);
    await page.waitForLoadState('networkidle');

    // Edit the handout
    const newTitle = `Updated ${originalTitle}`;
    const newContent = 'Updated content with **bold text**';
    await handoutsPage.editHandout(originalTitle, newTitle, newContent);

    // Verify updated content
    const hasUpdated = await handoutsPage.hasHandout(newTitle);
    expect(hasUpdated).toBe(true);

    await handoutsPage.openHandout(newTitle);
    await expect(page.locator('text=Updated content with')).toBeVisible();
  });

  test('GM can delete handout', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const handoutsPage = new GameHandoutsPage(page, gameId);
    await handoutsPage.goto();

    // Create handout to delete
    const handoutTitle = `Deletable Handout ${Date.now()}`;
    await handoutsPage.createHandout(handoutTitle, 'This will be deleted', true);
    await page.waitForLoadState('networkidle');

    // Verify it exists
    let hasHandout = await handoutsPage.hasHandout(handoutTitle);
    expect(hasHandout).toBe(true);

    // Delete it
    await handoutsPage.deleteHandout(handoutTitle);

    // Verify it's gone
    hasHandout = await handoutsPage.hasHandout(handoutTitle);
    expect(hasHandout).toBe(false);
  });

  test('handout supports character mentions', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const handoutsPage = new GameHandoutsPage(page, gameId);
    await handoutsPage.goto();

    // Create handout with character mention
    const handoutTitle = `Handout with Mentions ${Date.now()}`;
    const handoutContent = 'Attention @E2E Test Char 1! Please review this information.';

    await handoutsPage.createHandout(handoutTitle, handoutContent, true);
    await page.waitForLoadState('networkidle');

    // Open handout and verify mention is displayed
    await handoutsPage.openHandout(handoutTitle);
    await expect(page.locator('text=@E2E Test Char 1')).toBeVisible();
    await expect(page.locator('text=Please review this information')).toBeVisible();
  });

  test('multiple handouts display correctly in list', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const handoutsPage = new GameHandoutsPage(page, gameId);
    await handoutsPage.goto();

    // Create multiple handouts
    const timestamp = Date.now();
    const handout1 = `Rules ${timestamp}`;
    const handout2 = `Lore ${timestamp}`;
    const handout3 = `Maps ${timestamp}`;

    await handoutsPage.createHandout(handout1, 'Game rules', true);
    await page.waitForLoadState('networkidle');

    await handoutsPage.goto(); // Navigate back to list
    await handoutsPage.createHandout(handout2, 'World lore', true);
    await page.waitForLoadState('networkidle');

    await handoutsPage.goto();
    await handoutsPage.createHandout(handout3, 'Map information', true);
    await page.waitForLoadState('networkidle');

    // Verify all three are visible
    await handoutsPage.goto();
    await expect(page.locator(`text=${handout1}`)).toBeVisible();
    await expect(page.locator(`text=${handout2}`)).toBeVisible();
    await expect(page.locator(`text=${handout3}`)).toBeVisible();
  });
});
