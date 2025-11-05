import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';

/**
 * E2E Tests for Draft Character Updates Feature
 *
 * Tests the complete workflow for GMs creating and managing character sheet updates
 * when writing action results, focusing on:
 * - Opening Update Character Sheet modal
 * - Creating draft updates (abilities as primary example)
 * - Publishing results with character updates
 * - Confirmation dialog showing pending updates
 *
 * Uses dedicated E2E fixture (E2E_GM_EDITING_RESULTS) which includes:
 * - Game with active action phase
 * - Unpublished result for Player 3 (GM can add character updates)
 *
 * CRITICAL: This tests CORE GM workflow - managing character progression via results
 */

test.describe.configure({ mode: 'serial' });

test.describe('Draft Character Updates - Core Workflow', () => {

  test('GM can open Update Character Sheet modal and see all tabs', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Click "Update Character Sheet" button
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();

    // Modal should open with all tabs
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Abilities' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skills' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inventory' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Currency' })).toBeVisible();

    // Close button should work
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).not.toBeVisible();
  });

  test('GM can add an ability draft update', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Open modal
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });

    // Click "+ Add Ability" to show form
    await page.getByRole('button', { name: '+ Add Ability' }).click();

    // Fill in ability
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill('Dark Vision');
    await page.getByPlaceholder('Describe this ability...').fill('You can see in darkness within 60 feet');

    // Add the ability
    await page.getByTestId('add-abilities-button').click();

    // Should see draft in list
    await expect(page.getByText('Dark Vision')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('DRAFT', { exact: true }).first()).toBeVisible();
  });

  test('GM can remove a draft update', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Open modal and add ability with unique name
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '+ Add Ability' }).click();

    const uniqueAbilityName = `Remove Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(uniqueAbilityName);
    await page.getByPlaceholder('Describe this ability...').fill('Test removal');
    await page.getByTestId('add-abilities-button').click();
    await expect(page.getByText(uniqueAbilityName)).toBeVisible({ timeout: 5000 });

    // Remove the draft - wait for it to appear, then find and click the associated Remove button
    // Use a more specific selector: find the exact text, go up to parent, then find Remove button
    await page.waitForTimeout(500); // Brief wait to ensure DOM is stable

    // Get all draft items and find the one with our unique name
    const draftItems = await page.locator('[class*="flex"][class*="justify-between"]').filter({ hasText: uniqueAbilityName }).all();
    if (draftItems.length > 0) {
      await draftItems[0].getByRole('button', { name: 'Remove' }).click();
    } else {
      // Fallback: just click the last Remove button added
      const removeButtons = await page.getByRole('button', { name: 'Remove' }).all();
      await removeButtons[removeButtons.length - 1].click();
    }

    await expect(page.getByText(uniqueAbilityName)).not.toBeVisible();
  });

  test('GM sees draft count badge on Update Character Sheet button', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Open modal and add a draft
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '+ Add Ability' }).click();
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill('New Ability');
    await page.getByPlaceholder('Describe this ability...').fill('Description');
    await page.getByTestId('add-abilities-button').click();
    await expect(page.locator('text=New Ability').locator('visible=true')).toBeVisible({ timeout: 5000 });

    // Close modal
    await page.getByRole('button', { name: 'Close' }).click();

    // Button should show badge with count
    // In serial mode, "Dark Vision" from previous test is still present, so count = 2
    const updateButton = page.getByRole('button', { name: 'Update Character Sheet' });
    await expect(updateButton.locator('text=2')).toBeVisible({ timeout: 5000 });
  });

  test('publish confirmation dialog shows pending character updates', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Add a character update
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '+ Add Ability' }).click();
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill('Published Ability');
    await page.getByPlaceholder('Describe this ability...').fill('This will be published');
    await page.getByTestId('add-abilities-button').click();
    await expect(page.locator('text=Published Ability').locator('visible=true')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Close' }).click();

    // Open publish dialog
    await page.getByRole('button', { name: 'Publish Result' }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).toBeVisible({ timeout: 5000 });

    // Should show warning about publishing character updates
    // In serial mode: "Dark Vision" + "New Ability" + "Published Ability" = 3 updates
    await expect(page.getByText('This will also publish 3 character sheet updates')).toBeVisible();
    await expect(page.getByText('Published Ability')).toBeVisible();
  });

  test('GM can successfully publish result with character updates', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Add a character update
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '+ Add Ability' }).click();
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill('Final Ability');
    await page.getByPlaceholder('Describe this ability...').fill('Final test');
    await page.getByTestId('add-abilities-button').click();
    await expect(page.locator('text=Final Ability').locator('visible=true')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Close' }).click();

    // Publish the result
    await page.getByRole('button', { name: 'Publish Result' }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();

    // Wait for dialog to close (indicates publish completed)
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).not.toBeVisible({ timeout: 10000 });

    // Result should move to Published Results section (this is the actual success indicator)
    await expect(page.getByRole('heading', { name: 'Published Results' })).toBeVisible({ timeout: 10000 });

    // Verify unpublished count is now 0
    await expect(page.getByText('0 Unpublished')).toBeVisible({ timeout: 5000 });
  });
});
