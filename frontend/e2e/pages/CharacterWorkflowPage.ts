import { Page, Locator } from '@playwright/test';
import { navigateToGameTab } from '../utils/navigation';

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
    await this.page.waitForLoadState('networkidle');

    // Try "People" tab first (character_creation and in_progress states).
    // Fall back to standalone "Characters" tab (legacy/other states).
    // navigateToGameTab handles mobile select vs desktop tab automatically.
    const mobileSelect = this.page.locator('select#tab-select');
    const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);

    const hasPeopleTab = isMobile
      ? await mobileSelect.locator('option', { hasText: 'People' }).count() > 0
      : await this.page.getByTestId('tab-people').isVisible({ timeout: 2000 }).catch(() => false);

    if (hasPeopleTab) {
      await navigateToGameTab(this.page, 'People');
      // Within People tab, click on the "Characters" sub-tab
      const charactersSubTab = this.page.getByRole('button', { name: 'Characters', exact: false });
      try {
        await charactersSubTab.waitFor({ state: 'visible', timeout: 2000 });
        await charactersSubTab.click();
        await this.page.waitForLoadState('networkidle');
      } catch {
        // Characters sub-tab not found - might already be on it or in a different state
      }
    } else {
      // Fallback: standalone Characters tab (legacy/other states)
      try {
        await navigateToGameTab(this.page, 'Characters');
      } catch {
        // Neither tab found - let the test fail with a descriptive error
      }
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
    await submitButton.click();

    // Wait for modal to close by checking that the form is hidden
    await characterForm.waitFor({ state: 'hidden', timeout: 5000 });
    await this.page.waitForLoadState('networkidle');
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
    await approveButton.click();
    await this.page.waitForLoadState('networkidle');

    // Give UI time to update
    await this.page.waitForTimeout(500);
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
    // Try to find within characters-list container first (character_creation state)
    // Fall back to searching entire page (in_progress state)
    let characterCards: Locator[];

    try {
      await this.charactersList.waitFor({ state: 'visible', timeout: 2000 });
      characterCards = await this.charactersList
        .getByTestId('character-card')
        .all();
    } catch {
      // characters-list not found, search entire page (in_progress games)
      characterCards = await this.page
        .getByTestId('character-card')
        .all();
    }

    const names: string[] = [];
    for (const card of characterCards) {
      // Get only visible h4 - works for both mobile and desktop viewports
      const nameElement = card.locator('h4').locator('visible=true').first();
      const name = await nameElement.textContent();
      if (name) {
        names.push(name.trim());
      }
    }

    return names;
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
   * Get count of characters with a specific status
   *
   * @param status - Status to count ('pending', 'approved', 'rejected', etc.)
   */
  async getCharactersCountByStatus(status: string): Promise<number> {
    const allCharacters = await this.getCharactersList();
    let count = 0;

    for (const characterName of allCharacters) {
      const charStatus = await this.getCharacterStatus(characterName);
      if (charStatus === status.toLowerCase()) {
        count++;
      }
    }

    return count;
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
    // Try to find within characters-list container first (character_creation state)
    // Fall back to searching entire page (in_progress state)
    let allCards: Locator[];

    try {
      await this.charactersList.waitFor({ state: 'visible', timeout: 2000 });
      allCards = await this.charactersList
        .getByTestId('character-card')
        .all();
    } catch {
      // characters-list not found, search entire page (in_progress games)
      allCards = await this.page
        .getByTestId('character-card')
        .all();
    }

    // Find the card containing the character name
    for (const card of allCards) {
      // Get only visible h4 - works for both mobile and desktop viewports
      const nameElement = card.locator('h4').locator('visible=true').first();
      const name = await nameElement.textContent();
      if (name?.trim() === characterName) {
        return card;
      }
    }

    throw new Error(`Character card for "${characterName}" not found`);
  }
}
