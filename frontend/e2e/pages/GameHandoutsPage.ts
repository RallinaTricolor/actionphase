import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Game Handouts
 *
 * Handles viewing and managing handouts within a game
 * Handouts are typically accessed via the game's Handouts tab
 */
export class GameHandoutsPage {
  readonly page: Page;
  readonly gameId: number;

  // Locators
  readonly createHandoutButton: Locator;
  readonly handoutsList: Locator;

  constructor(page: Page, gameId: number) {
    this.page = page;
    this.gameId = gameId;

    // Define locators
    this.createHandoutButton = page.locator('button:has-text("Create Handout"), button:has-text("New Handout")');
    this.handoutsList = page.locator('[data-testid="handouts-list"]');
  }

  /**
   * Navigate to game's handouts tab
   */
  async goto() {
    await this.page.goto(`/games/${this.gameId}`);
    await this.page.waitForLoadState('networkidle');

    // Click on Handouts tab
    const handoutsTab = this.page.locator('button:has-text("Handouts"), a:has-text("Handouts")');
    if (await handoutsTab.isVisible()) {
      await handoutsTab.click();
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Create a new handout
   *
   * @param title - Handout title
   * @param content - Handout content (markdown supported)
   * @param isPublic - Whether handout is visible to all players
   */
  async createHandout(title: string, content: string, isPublic: boolean = true) {
    await this.createHandoutButton.click();

    // Fill handout form
    await this.page.locator('input[name="title"], [data-testid="handout-title"]').fill(title);
    await this.page.locator('textarea[name="content"], [data-testid="handout-content"]').fill(content);

    // Set visibility
    if (isPublic) {
      const publicRadio = this.page.locator('input[type="radio"][value="public"], input[type="checkbox"][name="is_public"]');
      if (await publicRadio.isVisible()) {
        await publicRadio.click();
      }
    }

    // Submit
    const submitButton = this.page.locator('button:has-text("Create"), button:has-text("Save")');
    await submitButton.click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get list of handout titles
   */
  async getHandoutTitles(): Promise<string[]> {
    const handoutCards = await this.page.locator('[data-testid^="handout-"], .handout-card').all();
    const titles: string[] = [];

    for (const card of handoutCards) {
      const titleElement = card.locator('h3, h4, [data-testid="handout-title"]').first();
      const title = await titleElement.textContent();
      if (title) {
        titles.push(title.trim());
      }
    }

    return titles;
  }

  /**
   * Open a handout by title
   *
   * @param title - Handout title to open
   */
  async openHandout(title: string) {
    const handout = this.page.locator(`[data-testid="handout-${title}"], .handout-card:has-text("${title}")`).first();
    await handout.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Edit a handout
   *
   * @param currentTitle - Current handout title
   * @param newTitle - New title (or same to keep)
   * @param newContent - New content
   */
  async editHandout(currentTitle: string, newTitle: string, newContent: string) {
    await this.openHandout(currentTitle);

    const editButton = this.page.locator('button:has-text("Edit")');
    await editButton.click();

    await this.page.locator('input[name="title"], [data-testid="handout-title"]').fill(newTitle);
    await this.page.locator('textarea[name="content"], [data-testid="handout-content"]').fill(newContent);

    const saveButton = this.page.locator('button:has-text("Save")');
    await saveButton.click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Delete a handout
   *
   * @param title - Handout title to delete
   */
  async deleteHandout(title: string) {
    await this.openHandout(title);

    const deleteButton = this.page.locator('button:has-text("Delete")');
    await deleteButton.click();

    // Confirm deletion
    const confirmButton = this.page.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
    await confirmButton.click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if handout exists by title
   *
   * @param title - Handout title to check
   */
  async hasHandout(title: string): Promise<boolean> {
    const handout = this.page.locator(`:text("${title}")`);
    return await handout.isVisible().catch(() => false);
  }

  /**
   * Get handout content
   *
   * @param title - Handout title
   */
  async getHandoutContent(title: string): Promise<string> {
    await this.openHandout(title);

    const contentElement = this.page.locator('[data-testid="handout-content"], .handout-content').first();
    return await contentElement.textContent() || '';
  }

  /**
   * Check if current user can create handouts (GM only)
   */
  async canCreateHandouts(): Promise<boolean> {
    return await this.createHandoutButton.isVisible().catch(() => false);
  }
}
