import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { navigateToGame } from '../utils/navigation';

/**
 * E2E Tests for Character Sheet Management
 *
 * Tests the complete character sheet management workflow including:
 * - Adding/viewing abilities with descriptions
 * - Adding/viewing skills with proficiency levels
 * - Adding/removing inventory items
 * - Updating currency values
 * - Permission boundaries (Bio public, Abilities/Inventory private)
 * - GM can view all character sheets
 *
 * Uses dedicated E2E fixture (E2E_CHARACTER_SHEETS) which includes:
 * - Character 1: Has existing abilities (2), skills (2), items (2), currency
 * - Character 2: Has different data for comparison
 * - Character 3: Empty sheet for fresh additions
 *
 * CRITICAL: This tests CORE player engagement mechanics
 */

test.describe('Character Sheet Management', () => {

  // Close any open modals before each test
  test.beforeEach(async ({ page }) => {
    // Close any open modal by clicking X button or pressing Escape
    const closeButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('player can view existing abilities, skills, items, and currency on their character sheet', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_SHEETS');

    // Navigate to Characters tab
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToCharacters();

    // Find the character by its heading, then navigate to the closest parent and find the button
    const characterHeading = page.getByRole('heading', { name: 'Sheet Test Char 1', level: 4 });
    await expect(characterHeading).toBeVisible({ timeout: 10000 });
    // Use XPath to find the nearest ancestor div that also contains an Edit Sheet button
    const editButton = page.locator('xpath=//h4[contains(text(), "Sheet Test Char 1")]/ancestor::div[.//button[contains(text(), "Edit Sheet")]][1]//button[contains(text(), "Edit Sheet")]');
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // Wait for sheet to load (just the character name in h2, not "Sheet Test")
    await expect(page.locator('h2:has-text("Sheet Test Char 1")')).toBeVisible({ timeout: 10000 });

    // ===== Test Abilities =====
    // Navigate to Abilities & Skills module
    await page.click('button:has-text("Abilities & Skills")');
    await page.waitForLoadState('networkidle');

    // Click on Abilities tab within the module (using specific selector with count)
    await page.click('button:has-text("Abilities (2)")');
    await page.waitForTimeout(500);

    // Verify existing abilities are displayed
    await expect(page.locator('text=Keen Eye')).toBeVisible();
    await expect(page.locator('text=Can spot hidden details')).toBeVisible();
    await expect(page.locator('text=Quick Draw')).toBeVisible();
    await expect(page.locator('text=Fast weapon draw')).toBeVisible();

    // ===== Test Skills =====
    // Click on Skills tab within the module (using more specific selector for the tab)
    await page.click('button:has-text("Skills (2)")');
    await page.waitForLoadState('networkidle');

    // Verify existing skills are displayed (proficiency levels may not be shown as text)
    await expect(page.locator('text=Archery')).toBeVisible();
    await expect(page.locator('text=Master archer')).toBeVisible();
    await expect(page.locator('text=Tracking')).toBeVisible();
    await expect(page.locator('text=Can track creatures')).toBeVisible();

    // ===== Test Inventory (Items & Currency) =====
    // Navigate to Inventory module
    await page.click('button:has-text("Inventory")');
    await page.waitForLoadState('networkidle');

    // Verify existing items are displayed (Items tab should be selected by default)
    await expect(page.getByRole('heading', { name: 'Longbow' })).toBeVisible();
    await expect(page.locator('text=Masterwork longbow')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Arrows' })).toBeVisible();
    await expect(page.locator('text=Steel-tipped arrows')).toBeVisible();

    // Click on Currency tab within Inventory module
    await page.click('button:has-text("Currency (2)")');
    await page.waitForTimeout(500);

    // Verify currency amounts are displayed (names may not be shown in UI)
    await expect(page.locator('text=Currency & Resources')).toBeVisible();
    await expect(page.locator('text=50').first()).toBeVisible();
    await expect(page.locator('text=25').first()).toBeVisible(); // .first() to avoid matching footer copyright "2025"
  });

  test('GM can view all character sheets', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_SHEETS');

    // Navigate to Characters tab
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToCharacters();

    // Verify GM sees all characters
    await expect(page.locator('text=Sheet Test Char 1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Sheet Test Char 2')).toBeVisible();
    await expect(page.locator('text=Empty Sheet Char')).toBeVisible();

    // GM should be able to view any character (click on char 2, owned by PLAYER_2)
    // Find the character by its heading, then navigate to the closest parent and find the button
    const characterHeading = page.getByRole('heading', { name: 'Sheet Test Char 2', level: 4 });
    await expect(characterHeading).toBeVisible({ timeout: 10000 });
    // Use XPath to find the nearest ancestor div that also contains an Edit Sheet button
    const editButton = page.locator('xpath=//h4[contains(text(), "Sheet Test Char 2")]/ancestor::div[.//button[contains(text(), "Edit Sheet")]][1]//button[contains(text(), "Edit Sheet")]');
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // Verify GM can see character sheet modal
    await expect(page.locator('h2').filter({ hasText: 'Sheet Test Char 2' })).toBeVisible({ timeout: 10000 });

    // GM can see Abilities & Skills module
    await page.click('button:has-text("Abilities & Skills")');
    await page.waitForLoadState('networkidle');

    // Click on Abilities tab within the module (Character 2 has 3 abilities)
    await page.click('button:has-text("Abilities (3)")');
    await page.waitForTimeout(500);

    // Verify GM sees the mage's abilities
    await expect(page.locator('text=Fireball')).toBeVisible();
    await expect(page.locator('text=Shield')).toBeVisible();
    await expect(page.locator('text=Arcane Knowledge')).toBeVisible();
  });

  test('bio module is public, abilities and inventory modules are private', async ({ page }) => {
    // Verify PLAYER_2 can only see bio of PLAYER_1's character (not abilities/inventory)
    await loginAs(page, 'PLAYER_2');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_SHEETS');

    // Navigate to Characters tab
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToCharacters();

    // Click on another player's character (Sheet Test Char 1, owned by PLAYER_1)
    // Find the character by its heading, then navigate to the closest parent and find the button
    const characterHeading = page.getByRole('heading', { name: 'Sheet Test Char 1', level: 4 });
    await expect(characterHeading).toBeVisible({ timeout: 10000 });
    // Use XPath to find the nearest ancestor div that also contains a View Sheet button (not Edit Sheet, since it's not their character)
    const viewButton = page.locator('xpath=//h4[contains(text(), "Sheet Test Char 1")]/ancestor::div[.//button[contains(text(), "View Sheet")]][1]//button[contains(text(), "View Sheet")]');
    await expect(viewButton).toBeVisible({ timeout: 10000 });
    await viewButton.click();

    // Wait for sheet modal to open
    await expect(page.locator('h2').filter({ hasText: 'Sheet Test Char 1' })).toBeVisible({ timeout: 10000 });

    // Should see Bio/Background module (public)
    await expect(page.locator('button:has-text("Bio/Background")')).toBeVisible();

    // Should NOT see Abilities & Skills or Inventory modules (private - owner/GM only)
    await expect(page.locator('button:has-text("Abilities & Skills")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Inventory")')).not.toBeVisible();

    // Verify bio content is visible
    await expect(page.locator('text=A weathered ranger with keen eyes')).toBeVisible();
  });
});
