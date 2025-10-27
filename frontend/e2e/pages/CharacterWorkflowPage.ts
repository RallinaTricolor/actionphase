import { Page, Locator } from '@playwright/test';

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

    // Try People tab first (in-progress games), fall back to Characters tab
    const peopleTab = this.page.getByTestId('tab-people');
    const charactersTab = this.page.getByTestId('tab-characters');

    try {
      await peopleTab.waitFor({ state: 'visible', timeout: 2000 });
      await peopleTab.click();
    } catch {
      await charactersTab.waitFor({ state: 'visible', timeout: 5000 });
      await charactersTab.click();
    }

    await this.page.waitForLoadState('networkidle');
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
    const editButton = card.getByTestId('edit-character-button');
    await editButton.waitFor({ state: 'visible', timeout: 3000 });
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
    const approveButton = card.getByTestId('approve-character-button');
    await approveButton.waitFor({ state: 'visible', timeout: 3000 });
    await approveButton.click();
    await this.page.waitForLoadState('networkidle');

    // Give UI time to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Reject a character (GM only)
   *
   * @param characterName - Name of character to reject
   */
  async rejectCharacter(characterName: string) {
    const card = await this.findCharacterCard(characterName);

    // Click the reject button
    const rejectButton = card.getByTestId('reject-character-button');
    await rejectButton.waitFor({ state: 'visible', timeout: 3000 });
    await rejectButton.click();
    await this.page.waitForLoadState('networkidle');

    // Give UI time to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Get the status of a specific character
   *
   * @param characterName - Character name to check
   * @returns 'pending' | 'approved' | 'rejected' | 'active' | 'dead' | null
   */
  async getCharacterStatus(characterName: string): Promise<string | null> {
    try {
      const card = await this.findCharacterCard(characterName);
      const statusBadge = card.getByTestId('character-status-badge');
      const statusText = await statusBadge.textContent();
      return statusText?.trim().toLowerCase() || null;
    } catch {
      return null;
    }
  }

  /**
   * Get list of all character names
   */
  async getCharactersList(): Promise<string[]> {
    // Wait for characters list to be visible
    await this.charactersList.waitFor({ state: 'visible', timeout: 5000 });

    const characterCards = await this.charactersList
      .getByTestId('character-card')
      .all();

    const names: string[] = [];
    for (const card of characterCards) {
      const nameElement = card.getByTestId('character-name');
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
  async hasCharacter(characterName: string): Promise<boolean> {
    try {
      await this.findCharacterCard(characterName);
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
    // Get all character cards
    const allCards = await this.charactersList
      .getByTestId('character-card')
      .all();

    // Find the card containing the character name
    for (const card of allCards) {
      const nameElement = card.getByTestId('character-name');
      const name = await nameElement.textContent();
      if (name?.trim() === characterName) {
        return card;
      }
    }

    throw new Error(`Character card for "${characterName}" not found`);
  }
}
