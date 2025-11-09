import { Page, Locator } from '@playwright/test';

export class GamesListPage {
  readonly page: Page;
  readonly gamesListContainer: Locator;
  readonly searchInput: Locator;
  readonly filterDropdown: Locator;

  constructor(page: Page) {
    this.page = page;
    this.gamesListContainer = page.locator('[data-testid="games-list"]');
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.filterDropdown = page.locator('[data-testid="filter-dropdown"]');
  }

  async goto() {
    await this.page.goto('/games');
    await this.page.waitForLoadState('networkidle');
  }

  async getGameCard(gameId: number): Promise<Locator> {
    return this.page.locator(`[data-testid="game-card-${gameId}"]`);
  }

  async getGamesByStatus(status: string): Promise<Locator> {
    return this.page.locator(`[data-testid="game-status-${status}"]`);
  }

  async clickApplyButton(gameId: number) {
    await this.page.click(`[data-testid="apply-button-${gameId}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  async getVisibleGameCount(): Promise<number> {
    return await this.page.locator('[data-testid^="game-card-"]').count();
  }

  async searchGames(searchTerm: string) {
    await this.searchInput.fill(searchTerm);
    await this.page.waitForLoadState('networkidle');
  }

  async filterByStatus(status: string) {
    await this.filterDropdown.selectOption(status);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a new game via the modal form
   * @param gameData - Game details (title, description, genre, maxPlayers, isAnonymous, autoAcceptAudience)
   * @returns The new game ID extracted from the URL after creation
   */
  async createGame(gameData: {
    title: string;
    description: string;
    genre?: string;
    maxPlayers?: number;
    isAnonymous?: boolean;
    autoAcceptAudience?: boolean;
  }): Promise<number> {
    // Open the create game modal
    await this.page.getByRole('button', { name: 'Create Game' }).click();

    // Wait for modal form to be ready
    await this.page.waitForSelector('#title', { timeout: 5000 });

    // Fill in game details
    await this.page.fill('#title', gameData.title);
    await this.page.fill('#description', gameData.description);

    if (gameData.genre) {
      await this.page.fill('#genre', gameData.genre);
    }

    if (gameData.maxPlayers) {
      await this.page.fill('#max_players', gameData.maxPlayers.toString());
    }

    // Toggle checkbox settings if specified
    if (gameData.isAnonymous !== undefined) {
      const isChecked = await this.page.locator('#is_anonymous').isChecked();
      if (isChecked !== gameData.isAnonymous) {
        await this.page.locator('#is_anonymous').click();
      }
    }

    if (gameData.autoAcceptAudience !== undefined) {
      const isChecked = await this.page.locator('#auto_accept_audience').isChecked();
      if (isChecked !== gameData.autoAcceptAudience) {
        await this.page.locator('#auto_accept_audience').click();
      }
    }

    // Submit the form by clicking the submit button
    const navigationPromise = this.page.waitForURL(/\/games\/\d+/, { timeout: 10000 });
    await this.page.getByTestId('create-game-submit').click();
    await navigationPromise;
    await this.page.waitForLoadState('networkidle');

    // Extract and return the game ID from the URL
    const gameUrl = this.page.url();
    const gameId = parseInt(gameUrl.match(/\/games\/(\d+)/)?.[1] || '0');

    return gameId;
  }
}
