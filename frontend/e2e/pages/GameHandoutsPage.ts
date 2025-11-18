import { Page } from '@playwright/test';

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
    await handoutsTab.waitFor({ state: 'visible', timeout: 5000 });
    await handoutsTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a new handout
   *
   * @param title - Handout title
   * @param content - Handout content (markdown supported)
   * @param isPublic - Whether handout is visible to all players (published vs draft)
   */
  async createHandout(title: string, content: string, isPublic: boolean = true) {
    await this.createHandoutButton.click();

    // Wait for modal to appear
    await this.page.waitForSelector('text=Create New Handout', { timeout: 5000 });

    // Fill handout form using accessible labels
    await this.page.getByLabel('Title').fill(title);
    await this.page.getByLabel('Content').fill(content);

    // Set status (published or draft)
    const status = isPublic ? 'published' : 'draft';
    await this.page.getByLabel('Status').selectOption(status);

    // Submit - scope to form to avoid ambiguity with the "Create Handout" button that opens the modal
    const submitButton = this.page.locator('form').getByRole('button', { name: 'Create Handout' });
    await submitButton.click();

    // Wait for modal to close and content to load
    await this.page.waitForSelector('text=Create New Handout', { state: 'hidden', timeout: 5000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get list of handout titles
   */
  async getHandoutTitles(): Promise<string[]> {
    const handoutCards = await this.page.locator('[data-testid^="handout-"], .handout-card').all();
    const titles: string[] = [];

    for (const card of handoutCards) {
      // Filter to visible element (viewport-agnostic for dual-DOM pattern)
      const titleElement = card.locator('h3, h4, [data-testid="handout-title"]').locator('visible=true').first();
      const title = await titleElement.textContent();
      if (title) {
        titles.push(title.trim());
      }
    }

    return titles;
  }

  /**
   * Open a handout by title (clicks the "View" button)
   *
   * @param title - Handout title to open
   */
  async openHandout(title: string) {
    // Find the card containing this title and click its View button
    const heading = this.page.getByRole('heading', { name: title, level: 3 });
    await heading.waitFor({ state: 'visible', timeout: 5000 });

    // Find the handout card containing this heading
    const card = this.page.getByTestId('handout-card').filter({ has: heading });
    const viewButton = card.getByRole('button', { name: 'View' });
    await viewButton.click();
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
    // Find the card containing this title and click its Edit button
    const heading = this.page.getByRole('heading', { name: currentTitle, level: 3 });
    await heading.waitFor({ state: 'visible', timeout: 5000 });

    // Find the handout card containing this heading
    const card = this.page.getByTestId('handout-card').filter({ has: heading });
    const editButton = card.getByRole('button', { name: 'Edit' });
    await editButton.click();

    // Wait for edit modal
    await this.page.waitForSelector('text=Edit Handout', { timeout: 5000 });

    // Fill form using accessible labels
    await this.page.getByLabel('Title').fill(newTitle);
    await this.page.getByLabel('Content').fill(newContent);

    const saveButton = this.page.locator('form').getByRole('button', { name: /Save|Update/ });
    await saveButton.click();

    // Wait for modal to close
    await this.page.waitForSelector('text=Edit Handout', { state: 'hidden', timeout: 5000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Delete a handout
   *
   * @param title - Handout title to delete
   */
  async deleteHandout(title: string) {
    // Find the card containing this title and click its Delete button
    const heading = this.page.getByRole('heading', { name: title, level: 3 });
    await heading.waitFor({ state: 'visible', timeout: 5000 });

    // Find the handout card containing this heading
    const card = this.page.getByTestId('handout-card').filter({ has: heading });
    const deleteButton = card.getByRole('button', { name: 'Delete' });

    // Set up dialog handler BEFORE clicking Delete (HandoutCard uses window.confirm)
    // Use once() to handle only this specific dialog
    this.page.once('dialog', dialog => {
      // eslint-disable-next-line no-console
      console.log('Dialog message:', dialog.message());
      dialog.accept();
    });

    await deleteButton.click();

    // Wait for the deletion to complete
    await this.page.waitForLoadState('networkidle');

    // Give a bit more time for the UI to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if handout exists by title
   *
   * @param title - Handout title to check
   */
  async hasHandout(title: string): Promise<boolean> {
    try {
      // Look specifically for a level 3 heading with this title
      const heading = this.page.getByRole('heading', { name: title, level: 3 });
      await heading.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get handout content
   *
   * @param title - Handout title
   */
  async getHandoutContent(title: string): Promise<string> {
    await this.openHandout(title);

    // Filter to visible element (viewport-agnostic for dual-DOM pattern)
    const contentElement = this.page.locator('[data-testid="handout-content"], .handout-content').locator('visible=true').first();
    return await contentElement.textContent() || '';
  }

  /**
   * Check if current user can create handouts (GM only)
   */
  async canCreateHandouts(): Promise<boolean> {
    try {
      await this.createHandoutButton.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}
