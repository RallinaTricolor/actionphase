import { Page, Locator, expect } from '@playwright/test';
import { navigateToGame, navigateToGameTab } from '../utils/navigation';
import { clickAndWaitForMutation, performAndWaitForMutation, API } from '../utils/waits';
import { assertUrl } from '../utils/assertions';
import { isMobileViewport } from '../utils/viewport';

/**
 * Page Object Model for Game Details Page
 *
 * Encapsulates all game details page interactions including:
 * - Navigation to tabs
 * - Game state management
 * - Application management
 * - Participant interactions
 */
export class GameDetailsPage {
  constructor(private page: Page) {}

  /**
   * Navigate to the game details page
   */
  async goto(gameId: number) {
    await navigateToGame(this.page, gameId);
  }

  /**
   * Navigate to a specific tab
   */
  async goToTab(tabName: string) {
    await navigateToGameTab(this.page, tabName);
  }

  /**
   * Get a button by its text (viewport-agnostic)
   */
  getButton(text: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(text, 'i') }).locator('visible=true').first();
  }

  /**
   * Click a button and wait for the action to complete
   */
  async clickButton(text: string) {
    await this.getButton(text).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click a menu item from the game actions dropdown
   */
  async clickMenuButton(text: string) {
    // Ensure the kebab button is interactive before clicking
    const kebab = this.page.getByTestId('game-actions-menu');
    await kebab.waitFor({ state: 'visible', timeout: 10000 });
    await kebab.click();
    // Wait for the specific menu item to appear (dropdown is conditionally rendered).
    // Use getByRole scoped inside the kebab container to avoid matching other page buttons.
    const menuButton = this.page.getByRole('button', { name: text }).locator('visible=true').first();
    await expect(menuButton).toBeVisible({ timeout: 5000 });
    await menuButton.click();
  }

  /**
   * A game-actions menu item that changes the game's state immediately (no
   * confirmation), waiting for the change to be saved.
   */
  private async changeStateFromMenu(text: string) {
    await performAndWaitForMutation(this.page, () => this.clickMenuButton(text), API.updateGameState);
  }

  /**
   * Withdraw application
   */
  async withdrawApplication() {
    await this.clickButton('Withdraw Application');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Start game recruitment (GM only)
   */
  async startRecruitment() {
    await this.changeStateFromMenu('Start Recruitment');
  }

  /**
   * Start the game (GM only)
   */
  async startGame() {
    await this.changeStateFromMenu('Start Game');
  }

  /**
   * Pause the game (GM only)
   * Handles confirmation modal
   */
  async pauseGame() {
    // Click pause button from kebab menu
    await this.clickMenuButton('Pause Game');

    // Wait for confirm button to be visible before clicking
    const confirmButton = this.page.getByTestId('pause-game-confirm-button');
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    await clickAndWaitForMutation(this.page, confirmButton, API.updateGameState);
    // Wait for the modal to close — confirms the API call completed
    await confirmButton.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Resume the game (GM only)
   */
  async resumeGame() {
    await this.changeStateFromMenu('Resume Game');
  }

  /**
   * Complete the game (GM only)
   * Handles confirmation modal with text input
   */
  async completeGame() {
    // Click complete button from kebab menu
    await this.clickMenuButton('Complete Game');

    // Wait for confirmation input to be visible before typing
    const confirmInput = this.page.getByPlaceholder('completed');
    await confirmInput.waitFor({ state: 'visible', timeout: 5000 });
    await confirmInput.fill('completed');

    // Click confirm button in modal using testid (avoids ambiguity with initial button)
    const confirmButton = this.page.getByTestId('complete-game-confirm-button');
    await clickAndWaitForMutation(this.page, confirmButton, API.updateGameState);
    // Wait for the modal to close — confirms the API call completed and onClose() was called
    await confirmInput.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Move the game to epilogue (GM only)
   * Handles confirmation modal with text input
   */
  async moveToEpilogue() {
    await this.clickMenuButton('Move to Epilogue');

    // Epilogue is a one-way door (it discloses the whole archive), so the
    // dialog requires the word typed out, same as Complete Game.
    const confirmInput = this.page.getByPlaceholder('epilogue');
    await confirmInput.waitFor({ state: 'visible', timeout: 5000 });
    await confirmInput.fill('epilogue');

    const confirmButton = this.page.getByTestId('epilogue-game-confirm-button');
    await clickAndWaitForMutation(this.page, confirmButton, API.updateGameState);
    // Wait for the modal to close — confirms the API call completed
    await confirmInput.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Cancel the game (GM only)
   * Handles confirmation modal
   */
  async cancelGame() {
    // Click cancel button from kebab menu
    await this.clickMenuButton('Cancel Game');

    // Wait for confirm button to be visible before clicking
    const confirmButton = this.page.getByTestId('cancel-game-confirm-button');
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    await clickAndWaitForMutation(this.page, confirmButton, API.updateGameState);
    // Wait for the modal to close — confirms the API call completed
    await confirmButton.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Delete the game (GM only)
   * Handles confirmation modal
   * Only available for cancelled games
   */
  async deleteGame() {
    // Open the kebab menu and click the Delete Game item using its stable testid
    const kebab = this.page.getByTestId('game-actions-menu');
    await kebab.waitFor({ state: 'visible', timeout: 10000 });
    await kebab.click();

    const deleteMenuItem = this.page.getByTestId('delete-game-button');
    await expect(deleteMenuItem).toBeVisible({ timeout: 5000 });
    await deleteMenuItem.click();

    // Wait for confirm button to be visible before clicking
    const confirmButton = this.page.getByTestId('delete-game-confirm-button');
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    await clickAndWaitForMutation(this.page, confirmButton, API.deleteGame);
  }

  /**
   * Navigate to Applications tab
   */
  async goToApplications() {
    await this.goToTab('Applications');
  }

  /**
   * Navigate to Characters section
   * Handles both game states:
   * - character_creation: Direct "Characters" tab
   * - in_progress: "People" tab with "Characters" sub-navigation
   * Also handles mobile (select dropdown) vs desktop (role="tab") navigation.
   */
  async goToCharacters() {
    const mobileSelect = this.page.locator('select#tab-select');
    const isMobile = isMobileViewport(this.page);

    if (isMobile) {
      // Check if "Characters" option exists in the select
      const charactersOption = mobileSelect.locator('option', { hasText: 'Characters' });
      const hasDirectOption = await charactersOption.count() > 0;

      if (hasDirectOption) {
        const optionValue = await charactersOption.first().getAttribute('value');
        await mobileSelect.selectOption(optionValue!);
        await this.page.waitForLoadState('networkidle');
      } else {
        // Navigate via People tab (in_progress state)
        await this.goToTab('People');
        await this.page.getByRole('button', { name: 'Characters' }).click();
        await this.page.waitForLoadState('networkidle');
      }
    } else {
      // Desktop: check for direct Characters tab
      const directTab = this.page.getByRole('tab', { name: 'Characters' });
      const hasDirectTab = await directTab.count() > 0;

      if (hasDirectTab) {
        await directTab.click();
        await this.page.waitForLoadState('networkidle');
      } else {
        // Navigate via People tab (in_progress state)
        await this.goToTab('People');
        await this.page.getByRole('button', { name: 'Characters' }).click();
        await this.page.waitForLoadState('networkidle');
      }
    }
  }

  /**
   * Navigate to Actions tab (GM view)
   */
  async goToActions() {
    await this.goToTab('Actions');
  }

  /**
   * Navigate to Audience tab
   */
  async goToAudience() {
    await this.goToTab('Audience');
  }

  /**
   * Approve an application (GM only)
   * @param playerUsername - Username of the player to approve
   */
  async approveApplication(playerUsername: string) {
    await this.goToApplications();

    const applicationRow = this.page.getByRole('row').filter({ hasText: playerUsername });
    await applicationRow.getByRole('button', { name: 'Approve' }).click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify user is on the game details page
   */
  async verifyOnPage(gameId: number) {
    await assertUrl(this.page, new RegExp(`/games/${gameId}`));
  }

}
