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
}
