import { Page } from '@playwright/test';
import { waitForModal } from '../utils/waits';

/**
 * Page Object for Game Settings Modal
 *
 * Handles the Edit Game modal workflow including:
 * - Opening/closing the edit modal
 * - Updating game fields (title, description, genre, max_players)
 * - Toggling settings (is_anonymous)
 * - Saving/canceling changes
 */
export class GameSettingsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Open the Edit Game modal
   */
  async openEditModal() {
    await this.page.getByRole('button', { name: 'Edit Game' }).click();
    await waitForModal(this.page, 'Edit Game');
  }

  /**
   * Update game title
   */
  async updateTitle(newTitle: string) {
    await this.page.fill('#title', newTitle);
  }

  /**
   * Update game description
   */
  async updateDescription(newDescription: string) {
    await this.page.fill('#description', newDescription);
  }

  /**
   * Update game genre
   */
  async updateGenre(newGenre: string) {
    await this.page.fill('#genre', newGenre);
  }

  /**
   * Update max players
   */
  async updateMaxPlayers(maxPlayers: number) {
    await this.page.fill('#max_players', maxPlayers.toString());
  }

  /**
   * Toggle anonymous mode
   */
  async toggleAnonymous() {
    await this.page.locator('#is_anonymous').click();
  }

  /**
   * Save changes and close modal
   */
  async saveChanges() {
    await this.page.getByRole('button', { name: 'Save Changes' }).click();
    // Wait for the modal to close before proceeding
    await this.page.getByRole('heading', { name: 'Edit Game', level: 2 }).waitFor({ state: 'hidden' });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Cancel and close modal
   */
  async cancel() {
    await this.page.getByRole('button', { name: 'Cancel' }).click();
    // Wait for the modal to close before proceeding
    await this.page.getByRole('heading', { name: 'Edit Game', level: 2 }).waitFor({ state: 'hidden' });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get current anonymous checkbox state
   */
  async isAnonymous(): Promise<boolean> {
    return await this.page.locator('#is_anonymous').isChecked();
  }

  /**
   * Get current title value from form
   */
  async getTitle(): Promise<string> {
    return await this.page.locator('#title').inputValue();
  }

  /**
   * Get current description value from form
   */
  async getDescription(): Promise<string> {
    return await this.page.locator('#description').inputValue();
  }

  /**
   * Get current genre value from form
   */
  async getGenre(): Promise<string> {
    return await this.page.locator('#genre').inputValue();
  }

  /**
   * Get current max players value from form
   */
  async getMaxPlayers(): Promise<string> {
    return await this.page.locator('#max_players').inputValue();
  }
}
