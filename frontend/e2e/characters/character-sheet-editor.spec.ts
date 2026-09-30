import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { CharacterSheetPage } from '../pages/CharacterSheetPage';

/**
 * E2E Tests for the GM's Character Sheet editor
 *
 * The two journeys the feature exists for:
 * - Reshape a built-in tab: drop Value and Weight from Inventory, add a
 *   Durability track, and have the player see an item carrying it.
 * - Add a custom tab (Contacts) and fill it in through an action result.
 *
 * Uses the dedicated E2E_CUSTOM_SHEET fixture: a game on the default layout
 * whose one character holds an item with Value and Weight, plus an active
 * action phase with an unpublished result for that character.
 *
 * Serial: each test rewrites the game's layout, and the second publishes the
 * fixture's only unpublished result.
 */
test.describe('Character Sheet editor', () => {
  test.describe.configure({ mode: 'serial' });

  const CHARACTER = 'Custom Sheet Char';

  /** Opens the editor the way a GM would: from the game's actions menu. */
  async function openEditor(page: Page, gameId: number) {
    await new GameDetailsPage(page).goto(gameId);
    await page.getByTestId('game-actions-menu').click();
    await page.getByTestId('customize-character-sheet-button').click();
    await expect(page.getByRole('heading', { name: 'Customize character sheet' })).toBeVisible({ timeout: 10000 });
  }

  async function saveLayout(page: Page) {
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/character-sheet') && r.request().method() === 'PUT' && r.ok()),
      page.getByTestId('save-character-sheet').click(),
    ]);
    await expect(page.getByTestId('save-character-sheet')).toBeDisabled();
  }

  async function addField(page: Page, name: string, type: string, options?: string) {
    const detail = page.getByTestId('sheet-tab-detail');
    await detail.getByRole('button', { name: 'Add field' }).click();
    const form = page.getByTestId('add-sheet-field-form');
    await form.getByRole('textbox', { name: 'Field name' }).fill(name);
    await form.getByRole('combobox', { name: 'Type' }).selectOption(type);
    if (options) await form.getByRole('textbox', { name: 'Options' }).fill(options);
    await form.getByRole('button', { name: 'Add field' }).click();
    await expect(detail.getByRole('textbox', { name: 'Field name' }).last()).toHaveValue(name);
  }

  async function openOwnSheet(page: Page, gameId: number) {
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToCharacters();
    await page.getByRole('button', { name: 'Edit Sheet' }).click();
    await expect(page.getByRole('heading', { name: CHARACTER, level: 2 })).toBeVisible({ timeout: 10000 });
    return new CharacterSheetPage(page);
  }

  test('GM reshapes Inventory, and the player sees an item with the new field', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_CUSTOM_SHEET');
    await openEditor(page, gameId);

    await page.getByTestId('sheet-tab-list').getByRole('button', { name: 'Inventory', exact: true }).click();

    // The fixture's lantern has a value, so removal asks first and says it hides, not deletes.
    await page.getByRole('button', { name: 'Remove Value' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('1 character has a value in this field');
    await confirm.getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('button', { name: 'Remove Weight' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click();

    await addField(page, 'Durability', 'track');
    await saveLayout(page);

    // GM gives the character an item with a durability.
    await openOwnSheet(page, gameId);
    const sheet = new CharacterSheetPage(page);
    await sheet.goToInventoryTab();
    await page.getByTestId('add-inventory').click();
    await page.getByRole('textbox', { name: 'Name *' }).fill('Rope');
    await page.getByRole('spinbutton', { name: 'Current' }).fill('2');
    await page.getByRole('spinbutton', { name: 'Maximum' }).fill('5');
    await page.getByRole('combobox', { name: 'Display as' }).selectOption('boxes');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Rope' })).toBeVisible();
    // The sheet is a modal over the user menu that switching users needs.
    await page.getByRole('button', { name: 'Close character sheet' }).click();

    // The player sees the new field, and no longer the removed ones.
    await loginAs(page, 'PLAYER_1');
    await openOwnSheet(page, gameId);
    await sheet.goToInventoryTab();
    const inventory = page.getByTestId('inventory-section');
    await expect(inventory.getByRole('img', { name: 'Rope, Durability: 2 of 5' })).toBeVisible();
    const lantern = inventory.getByTestId('sheet-entry').filter({ has: page.getByRole('heading', { name: 'Storm Lantern' }) });
    await expect(lantern.getByText('Quantity:')).toBeVisible();
    await expect(lantern.getByText('Value:')).toHaveCount(0);
    await expect(lantern.getByText('Weight:')).toHaveCount(0);
  });

  test('GM adds a Contacts tab and fills it in through an action result', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_CUSTOM_SHEET');
    await openEditor(page, gameId);

    const tabList = page.getByTestId('sheet-tab-list');
    await tabList.getByRole('button', { name: 'Add tab' }).click();
    await page.getByRole('textbox', { name: 'New tab name' }).fill('Contacts');
    await tabList.getByRole('button', { name: 'Add tab' }).click();
    await addField(page, 'Relationship', 'select', 'Ally\nRival');
    await saveLayout(page);

    // Stage the contact on the unpublished result, then publish it.
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Contacts', exact: true }).click();
    await page.locator('[data-testid^="add-t_"]').click();
    await page.getByRole('textbox', { name: 'Name *' }).fill('Old Zadok');
    await page.getByRole('combobox', { name: 'Relationship' }).selectOption('Ally');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Old Zadok' })).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/character-updates') && r.ok(), { timeout: 5000 }),
      page.getByRole('button', { name: 'Done' }).click(),
    ]);

    await page.getByRole('button', { name: 'Publish Result' }).click();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).not.toBeVisible({ timeout: 10000 });

    // The player finds the contact on their new tab.
    await loginAs(page, 'PLAYER_1');
    const sheet = await openOwnSheet(page, gameId);
    await sheet.goToCustomTab('Contacts');
    const contact = page.getByTestId('sheet-entry').filter({ has: page.getByRole('heading', { name: 'Old Zadok' }) });
    await expect(contact).toBeVisible();
    await expect(contact.getByText('Ally', { exact: true })).toBeVisible();
  });
});
