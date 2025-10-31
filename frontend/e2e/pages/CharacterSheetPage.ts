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

  // ========== Character Sheet Modal Module Navigation ==========
  // Methods for navigating within the character sheet modal
  // (Bio/Background, Abilities & Skills, Inventory modules)

  /**
   * Navigate to Bio/Background module
   */
  async goToBioModule() {
    await this.page.getByRole('button', { name: 'Bio/Background' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to Abilities & Skills module
   */
  async goToAbilitiesModule() {
    await this.page.getByRole('button', { name: 'Abilities & Skills' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to Inventory module
   */
  async goToInventoryModule() {
    await this.page.getByRole('button', { name: 'Inventory' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to Abilities tab (within Abilities & Skills module)
   * @param count - Expected count to display (e.g., "Abilities (2)")
   */
  async goToAbilitiesTab(count?: number) {
    const buttonName = count !== undefined ? `Abilities (${count})` : /Abilities \(\d+\)/;
    await this.page.getByRole('button', { name: buttonName }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Navigate to Skills tab (within Abilities & Skills module)
   * @param count - Expected count to display (e.g., "Skills (2)")
   */
  async goToSkillsTab(count?: number) {
    const buttonName = count !== undefined ? `Skills (${count})` : /Skills \(\d+\)/;
    await this.page.getByRole('button', { name: buttonName }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to Items tab (within Inventory module - default tab)
   */
  async goToItemsTab() {
    // Items tab is usually the default, but click if needed
    const itemsTab = this.page.getByRole('button', { name: /Items/ });
    if (await itemsTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await itemsTab.click();
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Navigate to Currency tab (within Inventory module)
   * @param count - Expected count to display (e.g., "Currency (2)")
   */
  async goToCurrencyTab(count?: number) {
    const buttonName = count !== undefined ? `Currency (${count})` : /Currency \(\d+\)/;
    await this.page.getByRole('button', { name: buttonName }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Add a new ability (requires "Add Ability" button to be visible)
   * @param name - Ability name
   * @param description - Ability description
   */
  async addAbility(name: string, description: string) {
    await this.page.getByRole('button', { name: 'Add Ability' }).click();
    await this.page.waitForTimeout(500);

    // Fill in ability form
    await this.page.fill('input[placeholder*="ability name" i]', name);
    await this.page.fill('textarea[placeholder*="description" i], textarea[placeholder*="Describe" i]', description);

    // Save the ability
    // Filter to visible element (viewport-agnostic for dual-DOM pattern)
    const saveButton = this.page.getByRole('button', { name: /Save|Add/ }).locator('visible=true').first();
    await saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if "Add Ability" button is visible (GM/owner permission check)
   */
  async canAddAbility(): Promise<boolean> {
    try {
      await this.page.getByRole('button', { name: 'Add Ability' }).waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if "Add Skill" button is visible (GM/owner permission check)
   */
  async canAddSkill(): Promise<boolean> {
    try {
      await this.page.getByRole('button', { name: 'Add Skill' }).waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if "Add Item" button is visible (GM/owner permission check)
   */
  async canAddItem(): Promise<boolean> {
    try {
      await this.page.getByRole('button', { name: 'Add Item' }).waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if "Add Currency" button is visible (GM/owner permission check)
   */
  async canAddCurrency(): Promise<boolean> {
    try {
      await this.page.getByRole('button', { name: 'Add Currency' }).waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a specific module button is visible
   * Used to verify permission boundaries (e.g., players shouldn't see Inventory)
   */
  async isModuleVisible(moduleName: 'Bio/Background' | 'Abilities & Skills' | 'Inventory'): Promise<boolean> {
    try {
      await this.page.getByRole('button', { name: moduleName }).waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}
