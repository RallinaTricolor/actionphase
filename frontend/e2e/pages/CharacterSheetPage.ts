import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Character Sheet interactions
 *
 * Handles character viewing, editing, and management operations
 */
export class CharacterSheetPage {
  readonly page: Page;

  // Locators
  readonly characterName: Locator;
  readonly characterType: Locator;
  readonly characterDescription: Locator;
  readonly editButton: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;
  readonly avatarUploadButton: Locator;
  readonly abilitiesSection: Locator;
  readonly inventorySection: Locator;
  readonly skillsSection: Locator;

  constructor(page: Page) {
    this.page = page;

    // Define locators
    this.characterName = page.locator('[data-testid="character-name"]');
    this.characterType = page.locator('[data-testid="character-type"]');
    this.characterDescription = page.locator('[data-testid="character-description"]');
    this.editButton = page.locator('[data-testid="edit-character"]');
    this.saveButton = page.locator('[data-testid="save-character"]');
    this.cancelButton = page.locator('[data-testid="cancel-edit"]');
    this.deleteButton = page.locator('[data-testid="delete-character"]');
    this.avatarUploadButton = page.locator('input[type="file"]');
    this.abilitiesSection = page.locator('[data-testid="abilities-section"]');
    this.inventorySection = page.locator('[data-testid="inventory-section"]');
    this.skillsSection = page.locator('[data-testid="skills-section"]');
  }

  /**
   * Navigate to a specific character sheet
   */
  async goto(gameId: number, characterId: number) {
    await this.page.goto(`/games/${gameId}/characters/${characterId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get character name text
   */
  async getCharacterName(): Promise<string> {
    return await this.characterName.textContent() || '';
  }

  /**
   * Edit a character field
   */
  async editField(field: string, value: string) {
    await this.editButton.click();
    await this.page.waitForLoadState('networkidle');

    await this.page.fill(`[data-testid="input-${field}"]`, value);
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Upload character avatar
   */
  async uploadAvatar(filePath: string) {
    await this.avatarUploadButton.setInputFiles(filePath);
    await this.page.waitForSelector('[data-testid="avatar-preview"]', { timeout: 5000 });
  }

  /**
   * Delete the character (with confirmation)
   */
  async deleteCharacter() {
    await this.deleteButton.click();

    // Handle confirmation dialog
    await this.page.click('[data-testid="confirm-delete"]');
    await this.page.waitForURL('**/games/*', { timeout: 5000 });
  }

  /**
   * Check if character is editable by current user
   */
  async canEdit(): Promise<boolean> {
    return await this.editButton.isVisible();
  }

  /**
   * Get all abilities
   */
  async getAbilities(): Promise<string[]> {
    const abilities = await this.abilitiesSection.locator('[data-testid="ability-item"]').all();
    return Promise.all(abilities.map(a => a.textContent())).then(texts =>
      texts.filter((t): t is string => t !== null)
    );
  }

  /**
   * Get all inventory items
   */
  async getInventoryItems(): Promise<string[]> {
    const items = await this.inventorySection.locator('[data-testid="inventory-item"]').all();
    return Promise.all(items.map(i => i.textContent())).then(texts =>
      texts.filter((t): t is string => t !== null)
    );
  }
}
