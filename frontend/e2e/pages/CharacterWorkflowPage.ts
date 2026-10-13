import { Page, Locator } from '@playwright/test';
import { navigateToGameTab } from '../utils/navigation';
import { isMobileViewport } from '../utils/viewport';
import { clickAndWaitForMutation, API } from '../utils/waits';

/**
 * Page Object for Character Workflow
 *
 * Handles creating, viewing, and managing characters within a game
 * Characters are accessed via the game's Characters or People tab
 */
export class CharacterWorkflowPage {
  readonly page: Page;
  readonly gameId: number;

  // Locators
  readonly charactersList: Locator;
  readonly createCharacterButton: Locator;

  constructor(page: Page, gameId: number) {
    this.page = page;
    this.gameId = gameId;

    // Define locators using data-testid
    this.charactersList = page.getByTestId('characters-list');
    this.createCharacterButton = page.getByTestId('create-character-button');
  }

  /**
   * Navigate to game's characters tab
   */
  async goto() {
    await this.page.goto(`/games/${this.gameId}`);

    // Try "People" tab first (character_creation and in_progress states).
    // Fall back to standalone "Characters" tab (legacy/other states).
    //
    // Wait for the tab control to render BEFORE asking which tabs exist. This
    // used instant isVisible() checks: on a page still loading they reported
    // "no People tab", the fallback tab didn't exist either, that error was
    // swallowed, and the test went on without ever opening the character list.
    const tabControl = isMobileViewport(this.page)
      ? this.page.locator('select#tab-select').first()
      : this.page.getByRole('tab').locator('visible=true').first();
    await tabControl.waitFor({ state: 'visible', timeout: 15000 });

    const hasPeopleTab = isMobileViewport(this.page)
      ? await this.page.locator('select#tab-select').first().locator('option', { hasText: 'People' }).count() > 0
      : await this.page.getByTestId('tab-people').count() > 0;

    if (!hasPeopleTab) {
      // Standalone Characters tab (legacy/other states). Throws if absent.
      await navigateToGameTab(this.page, 'Characters');
      return;
    }

    await navigateToGameTab(this.page, 'People');
    // People has a Characters sub-tab in some states and opens straight onto
    // the list in others. Wait for whichever renders, then select the sub-tab
    // only if it is there.
    const charactersSubTab = this.page.getByRole('button', { name: 'Characters', exact: false }).locator('visible=true').first();
    await charactersSubTab.or(this.charactersList).first().waitFor({ state: 'visible', timeout: 10000 });
    if (await charactersSubTab.isVisible()) {
      await charactersSubTab.click();
    }
  }

  /**
   * Create a new character
   *
   * @param name - Character name
   * @param characterType - Type of character ('player_character' or 'npc')
   */
  async createCharacter(name: string, characterType: 'player_character' | 'npc' = 'player_character') {
    await this.createCharacterButton.click();

    // Wait for modal to appear by checking for the form
    const characterForm = this.page.getByTestId('character-form');
    await characterForm.waitFor({ state: 'visible', timeout: 5000 });

    // Fill character name
    const nameInput = this.page.getByTestId('character-name-input');
    await nameInput.fill(name);

    // Select character type if available (GM only sees this option)
    const typeSelect = this.page.getByLabel('Character Type');
    const isTypeSelectVisible = await typeSelect.isVisible().catch(() => false);

    if (isTypeSelectVisible && characterType !== 'player_character') {
      await typeSelect.selectOption(characterType);
    }

    // Submit character
    const submitButton = this.page.getByTestId('character-submit-button');
    await clickAndWaitForMutation(this.page, submitButton, API.createCharacter);

    // Wait for modal to close by checking that the form is hidden
    await characterForm.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Open character sheet for editing/viewing
   *
   * @param characterName - Name of character to open
   */
  async editCharacter(characterName: string) {
    const card = await this.findCharacterCard(characterName);

    // Click the "Edit Sheet" or "View Sheet" button
    // Filter to only visible elements - works for both mobile and desktop viewports
    const editButton = card.getByTestId('edit-character-button').locator('visible=true').first();
    await editButton.click();

    // Wait for character sheet modal to appear
    await this.page.waitForTimeout(500);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Approve a character (GM only)
   *
   * @param characterName - Name of character to approve
   */
  async approveCharacter(characterName: string) {
    const card = await this.findCharacterCard(characterName);

    // Click the approve button
    // Filter to only visible elements - works for both mobile and desktop viewports
    const approveButton = card.getByTestId('approve-character-button').locator('visible=true').first();
    await clickAndWaitForMutation(this.page, approveButton, API.approveCharacter);
  }

  /**
   * Get the status of a specific character
   *
   * @param characterName - Character name to check
   * @returns 'pending' | 'approved' | 'rejected' | 'active' | 'dead' | null
   *
   * Note: Approved characters don't display a status badge, so if no badge is found
   * we assume the character is approved (since that's the only hidden status).
   */
  async getCharacterStatus(characterName: string): Promise<string | null> {
    try {
      const card = await this.findCharacterCard(characterName);
      // Get only visible status badge - works for both mobile and desktop viewports
      const statusBadge = card.getByTestId('character-status-badge').locator('visible=true').first();

      // Check if status badge exists
      try {
        await statusBadge.waitFor({ state: 'visible', timeout: 1000 });
        const statusText = await statusBadge.textContent();
        return statusText?.trim().toLowerCase() || null;
      } catch {
        // No status badge found - this means the character is approved
        // (approved is the only status we hide the badge for)
        return 'approved';
      }
    } catch {
      return null;
    }
  }

  /**
   * Get list of all character names
   */
  async getCharactersList(): Promise<string[]> {
    const cards = await this.loadedCharacterCards();
    // One visible <h4> per card (cards render desktop and mobile copies).
    const names = await cards.locator('h4').locator('visible=true').allTextContents();
    return names.map((name) => name.trim()).filter(Boolean);
  }

  /**
   * Check if character exists by name
   *
   * @param characterName - Character name to check
   */
  async hasCharacter(characterName: string, timeout = 10000): Promise<boolean> {
    try {
      // Use a retrying locator rather than a one-shot .all() snapshot so we wait
      // for React Query to re-render the list after a create/update.
      const card = this.page.getByTestId('character-card').filter({ hasText: characterName });
      await card.first().waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Create Character button is visible (user can create characters)
   */
  async canCreateCharacter(): Promise<boolean> {
    try {
      await this.createCharacterButton.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Open character sheet (alias for editCharacter for semantic clarity)
   *
   * @param characterName - Name of character to view
   */
  async openCharacterSheet(characterName: string) {
    await this.editCharacter(characterName);
  }

  /**
   * Helper: Find a character card by name
   * @private
   */
  private async findCharacterCard(characterName: string): Promise<Locator> {
    const cards = await this.loadedCharacterCards();
    const card = cards
      .filter({ has: this.page.getByRole('heading', { level: 4, name: characterName, exact: true }) })
      .first();
    await card.waitFor({ state: 'visible', timeout: 10000 });
    return card;
  }

  /**
   * Character cards, once the list has actually loaded.
   *
   * These helpers used to take an instant .all() snapshot: on a list still
   * loading that returned no cards (so a present character read as missing),
   * and textContent() on a card that re-rendered waited out the whole test.
   *
   * character_creation games render cards inside characters-list, which only
   * mounts after the characters have loaded; in_progress games render cards
   * without that container.
   */
  private async loadedCharacterCards(): Promise<Locator> {
    const anyCard = this.page.getByTestId('character-card').locator('visible=true').first();
    await this.charactersList.or(anyCard).first().waitFor({ state: 'visible', timeout: 10000 });
    return (await this.charactersList.isVisible())
      ? this.charactersList.getByTestId('character-card')
      : this.page.getByTestId('character-card');
  }
}
