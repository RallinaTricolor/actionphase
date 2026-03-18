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

  test('GM can add an ability draft update and it persists', async ({ page }) => {
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

    // Wait for form to appear
    await expect(page.getByPlaceholder('e.g., Fireball, Sneak Attack')).toBeVisible({ timeout: 5000 });

    // Fill in ability with a unique name to avoid collisions between test runs
    const abilityName = `Persist Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
    await page.getByPlaceholder('Describe this ability...').fill('You can see in darkness within 60 feet');

    // Add the ability
    await page.getByTestId('add-abilities-button').click();

    // Should see draft in list immediately
    await expect(page.getByTestId('draft-field-name').filter({ hasText: abilityName })).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('draft-field-name').filter({ hasText: abilityName }).locator('..').getByText('DRAFT')).toBeVisible();

    // Close and reopen the modal to verify the draft persisted (not just in-memory)
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });

    // Draft should still be present after closing and reopening
    await expect(page.getByTestId('draft-field-name').filter({ hasText: abilityName })).toBeVisible({ timeout: 5000 });
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
    await expect(page.getByTestId('draft-field-name').filter({ hasText: uniqueAbilityName })).toBeVisible({ timeout: 5000 });

    // Find the specific draft card by its name and click its Remove button
    const draftCard = page.locator('[data-testid^="draft-item-"]').filter({ hasText: uniqueAbilityName });
    await draftCard.getByTestId('draft-remove-button').click();

    await expect(page.getByTestId('draft-field-name').filter({ hasText: uniqueAbilityName })).not.toBeVisible();
  });

  test('GM sees draft count badge on Update Character Sheet button', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Open modal and add exactly one draft
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '+ Add Ability' }).click();
    const abilityName = `Badge Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
    await page.getByPlaceholder('Describe this ability...').fill('Description');
    await page.getByTestId('add-abilities-button').click();
    await expect(page.getByTestId('draft-field-name').filter({ hasText: abilityName })).toBeVisible({ timeout: 5000 });

    // Note the current draft count shown in the modal header badge, then close
    const modalBadge = page.getByRole('heading', { name: 'Update Character Sheet' }).locator('..').getByText(/\d+ pending change/);
    const badgeText = await modalBadge.textContent();
    const totalDrafts = parseInt(badgeText?.match(/(\d+)/)?.[1] ?? '1', 10);

    await page.getByRole('button', { name: 'Close' }).click();

    // Button should show badge with the total draft count
    const updateButton = page.getByRole('button', { name: 'Update Character Sheet' });
    await expect(updateButton.getByText(String(totalDrafts))).toBeVisible({ timeout: 5000 });
  });

  test('publish confirmation dialog shows pending character updates', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Add a character update with a unique name
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '+ Add Ability' }).click();
    const abilityName = `Publish Dialog Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
    await page.getByPlaceholder('Describe this ability...').fill('This will be published');
    await page.getByTestId('add-abilities-button').click();
    await expect(page.getByTestId('draft-field-name').filter({ hasText: abilityName })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Close' }).click();

    // Open publish dialog
    await page.getByRole('button', { name: 'Publish Result' }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).toBeVisible({ timeout: 5000 });

    // Should show warning about publishing character updates (count >= 1)
    await expect(page.getByText(/This will also publish \d+ character sheet update/)).toBeVisible();

    // The specific ability we just added should be listed
    await expect(page.getByText(abilityName)).toBeVisible();
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
    await expect(page.getByTestId('draft-field-name').filter({ hasText: 'Final Ability' })).toBeVisible({ timeout: 5000 });
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
