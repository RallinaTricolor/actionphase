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

  // ========== Character Rename Methods ==========

  /**
   * Click the rename button to enter rename mode
   */
  async startRename() {
    const renameButton = this.page.locator('button[title="Rename character"]');
    await renameButton.click();
    await this.page.waitForTimeout(300); // Wait for edit UI to appear
  }

  /**
   * Get the rename input field
   */
  getRenameInput(): Locator {
    return this.page.getByRole('textbox');
  }

  /**
   * Check if rename button is visible
   */
  async canRename(): Promise<boolean> {
    const renameButton = this.page.locator('button[title="Rename character"]');
    return await renameButton.isVisible();
  }

  /**
   * Rename character and save
   * @param newName - New character name
   */
  async renameCharacter(newName: string) {
    await this.startRename();
    const nameInput = this.getRenameInput();
    await nameInput.clear();
    await nameInput.fill(newName);

    const saveButton = this.page.getByRole('button', { name: 'Save' });
    await saveButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Start rename and then cancel
   * @param tempName - Temporary name to type before canceling
   */
  async startAndCancelRename(tempName?: string) {
    await this.startRename();

    if (tempName) {
      const nameInput = this.getRenameInput();
      await nameInput.clear();
      await nameInput.fill(tempName);
    }

    const cancelButton = this.page.getByRole('button', { name: 'Cancel' });
    await cancelButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if save button is enabled during rename
   */
  async isSaveButtonEnabled(): Promise<boolean> {
    const saveButton = this.page.getByRole('button', { name: 'Save' });
    return await saveButton.isEnabled();
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
   * Get the character sheet module select dropdown (mobile).
   * Scoped via data-testid="character-sheet-module-tabs" to distinguish it from
   * the game-level tab select when both are present on the same page.
   */
  private get moduleSelect() {
    return this.page.getByTestId('character-sheet-module-tabs').locator('select#tab-select');
  }

  /**
   * Navigate to Bio/Background module
   * Works with both mobile dropdown and desktop tabs
   */
  async goToBioModule() {
    const isMobile = await this.waitForModuleTabsReady();
    if (isMobile) {
      await this.moduleSelect.scrollIntoViewIfNeeded();
      await this.moduleSelect.selectOption('bio');
    } else {
      await this.page.getByRole('tab', { name: 'Public Profile' }).click();
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to Abilities & Skills module
   * Works with both mobile dropdown and desktop tabs
   */
  async goToAbilitiesModule() {
    const isMobile = await this.waitForModuleTabsReady();
    if (isMobile) {
      await this.moduleSelect.scrollIntoViewIfNeeded();
      await this.moduleSelect.selectOption('abilities');
    } else {
      await this.page.getByRole('tab', { name: 'Abilities & Skills' }).click();
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to Inventory module
   * Works with both mobile dropdown and desktop tabs
   */
  async goToInventoryModule() {
    const isMobile = await this.waitForModuleTabsReady();
    if (isMobile) {
      await this.moduleSelect.scrollIntoViewIfNeeded();
      await this.moduleSelect.selectOption('inventory');
    } else {
      await this.page.getByRole('tab', { name: 'Inventory' }).click();
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for the character sheet module tabs container to appear in the DOM,
   * then return whether we're on a mobile viewport (select visible vs tabs visible).
   */
  private async waitForModuleTabsReady(): Promise<boolean> {
    await this.page.getByTestId('character-sheet-module-tabs').waitFor({ state: 'attached', timeout: 5000 });
    // The select is inside md:hidden — only visible on mobile viewports
    return await this.moduleSelect.isVisible({ timeout: 2000 }).catch(() => false);
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

    // Fill in ability form - use label-based selectors for reliability
    await this.page.getByRole('textbox', { name: 'Ability Name *' }).fill(name);
    await this.page.getByRole('textbox', { name: 'Description' }).fill(description);

    // Save the ability
    const saveButton = this.page.getByRole('button', { name: 'Add Ability' }).nth(1); // Second "Add Ability" button is the submit button
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
   * Works with both mobile dropdown and desktop tabs
   */
  async isModuleVisible(moduleName: 'Public Profile' | 'Private Notes' | 'Abilities & Skills' | 'Inventory'): Promise<boolean> {
    // Map display name to module ID
    const moduleIdMap: Record<string, string> = {
      'Public Profile': 'bio',
      'Private Notes': 'notes',
      'Abilities & Skills': 'abilities',
      'Inventory': 'inventory'
    };
    const moduleId = moduleIdMap[moduleName];

    // Check mobile dropdown (scoped to character sheet module tabs to avoid matching game-level select)
    // Use isVisible() not count() — the select exists in DOM on desktop too but is hidden via md:hidden
    const mobileSelect = this.moduleSelect;
    if (await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check if the option exists in the dropdown
      const option = mobileSelect.locator(`option[value="${moduleId}"]`);
      return await option.count() > 0;
    }

    // Check desktop tabs
    try {
      await this.page.getByRole('tab', { name: moduleName }).waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}
