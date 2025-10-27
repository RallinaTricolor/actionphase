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

  test('GM can create handout with markdown and players can view it', async ({ page }) => {
    // === GM creates handout with markdown ===
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const gmHandoutsPage = new GameHandoutsPage(page, gameId);
    await gmHandoutsPage.goto();

    // Verify GM can create handouts
    const canCreate = await gmHandoutsPage.canCreateHandouts();
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

    await gmHandoutsPage.createHandout(handoutTitle, handoutContent, true);
    await page.waitForLoadState('networkidle');

    // Verify handout appears in list
    let hasHandout = await gmHandoutsPage.hasHandout(handoutTitle);
    expect(hasHandout).toBe(true);

    // Verify can open and view handout
    await gmHandoutsPage.openHandout(handoutTitle);

    // Verify markdown is rendered (check for heading and list items)
    await expect(page.locator('text=Welcome Adventurers')).toBeVisible();
    await expect(page.locator('text=Always roll for initiative')).toBeVisible();

    // === Player views the same handout ===
    await loginAs(page, 'PLAYER_1');
    const playerHandoutsPage = new GameHandoutsPage(page, gameId);
    await playerHandoutsPage.goto();

    // Player should see the handout
    hasHandout = await playerHandoutsPage.hasHandout(handoutTitle);
    expect(hasHandout).toBe(true);

    // Player can open and read it
    await playerHandoutsPage.openHandout(handoutTitle);
    await expect(page.locator('text=Welcome Adventurers')).toBeVisible();

    // Player should NOT see Create Handout button (GM-only feature)
    const playerCanCreate = await playerHandoutsPage.canCreateHandouts();
    expect(playerCanCreate).toBe(false);
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

  test('players cannot see draft handouts', async ({ page }) => {
    // GM creates both a draft and a published handout
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const gmHandoutsPage = new GameHandoutsPage(page, gameId);
    await gmHandoutsPage.goto();

    const timestamp = Date.now();
    const draftTitle = `Draft Handout ${timestamp}`;
    const publishedTitle = `Published Handout ${timestamp}`;

    // Create draft handout (isPublic: false)
    await gmHandoutsPage.createHandout(draftTitle, 'This is a draft - players should NOT see this', false);
    await page.waitForLoadState('networkidle');

    // Create published handout for comparison
    await gmHandoutsPage.goto();
    await gmHandoutsPage.createHandout(publishedTitle, 'This is published - players should see this', true);
    await page.waitForLoadState('networkidle');

    // Verify GM can see both handouts
    await gmHandoutsPage.goto();
    const gmCanSeeDraft = await gmHandoutsPage.hasHandout(draftTitle);
    const gmCanSeePublished = await gmHandoutsPage.hasHandout(publishedTitle);
    expect(gmCanSeeDraft).toBe(true);
    expect(gmCanSeePublished).toBe(true);

    // Login as player and check visibility
    await loginAs(page, 'PLAYER_1');
    const playerHandoutsPage = new GameHandoutsPage(page, gameId);
    await playerHandoutsPage.goto();

    // Player should NOT see the draft handout
    const playerCanSeeDraft = await playerHandoutsPage.hasHandout(draftTitle);
    expect(playerCanSeeDraft).toBe(false);

    // Player SHOULD see the published handout
    const playerCanSeePublished = await playerHandoutsPage.hasHandout(publishedTitle);
    expect(playerCanSeePublished).toBe(true);

    // Verify player can open and read the published handout
    await playerHandoutsPage.openHandout(publishedTitle);
    await expect(page.locator('text=This is published')).toBeVisible();
  });
});
