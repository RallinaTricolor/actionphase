import { Page, Locator } from '@playwright/test';
import { navigateToGameTab } from '../utils/navigation';
import { clickAndWaitForMutation, API } from '../utils/waits';

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

  constructor(page: Page, gameId: number) {
    this.page = page;
    this.gameId = gameId;

    // Define locators
    this.createHandoutButton = page.locator('button:has-text("Create Handout"), button:has-text("New Handout")');
  }

  /**
   * Navigate to game's handouts tab
   */
  async goto() {
    await this.page.goto(`/games/${this.gameId}`);
    await this.page.waitForLoadState('networkidle');

    // Navigate to Handouts tab (handles mobile select and desktop tabs)
    await navigateToGameTab(this.page, 'Handouts');
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

    // Fill handout form
    await this.page.getByLabel('Title').fill(title);
    await this.page.getByTestId('handout-content-input').fill(content);

    // Set status (published or draft)
    const status = isPublic ? 'published' : 'draft';
    await this.page.getByLabel('Status').selectOption(status);

    // Submit - scope to form to avoid ambiguity with the "Create Handout" button that opens the modal
    const submitButton = this.page.locator('form').getByRole('button', { name: 'Create Handout' });
    await clickAndWaitForMutation(this.page, submitButton, API.createHandout);

    // Wait for modal to close
    await this.page.waitForSelector('text=Create New Handout', { state: 'hidden', timeout: 5000 });
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
    const viewLink = card.getByRole('link', { name: 'View' });
    await viewLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get the deep-link URL for a handout by reading the href from its View link.
   *
   * @param title - Handout title
   * @returns Full URL including the ?tab=handouts&handout=<id> params
   */
  async getHandoutDeepLink(title: string): Promise<string> {
    const heading = this.page.getByRole('heading', { name: title, level: 3 });
    await heading.waitFor({ state: 'visible', timeout: 5000 });

    const card = this.page.getByTestId('handout-card').filter({ has: heading });
    const viewLink = card.getByRole('link', { name: 'View' });
    const href = await viewLink.getAttribute('href');
    if (!href) throw new Error(`Could not get href for handout: ${title}`);

    // href is relative (e.g. "?tab=handouts&handout=42"), make it absolute
    const url = new URL(href, this.page.url());
    return url.toString();
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

    // Fill form
    await this.page.getByLabel('Title').fill(newTitle);
    await this.page.getByTestId('handout-content-input').fill(newContent);

    const saveButton = this.page.locator('form').getByRole('button', { name: /Save|Update/ });
    await clickAndWaitForMutation(this.page, saveButton, API.updateHandout);

    // Wait for modal to close
    await this.page.waitForSelector('text=Edit Handout', { state: 'hidden', timeout: 5000 });
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

    await clickAndWaitForMutation(this.page, deleteButton, API.deleteHandout);
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
