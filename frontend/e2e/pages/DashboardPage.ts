import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly myGamesSection: Locator;
  readonly notificationBadge: Locator;
  readonly gamesListContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.myGamesSection = page.locator('[data-testid="my-games-section"]');
    this.notificationBadge = page.locator('[data-testid="notification-badge"]');
    this.gamesListContainer = page.locator('[data-testid="games-list"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async getGameCount(): Promise<number> {
    const games = await this.page.locator('[data-testid^="game-card-"]').count();
    return games;
  }

  async navigateToGame(gameId: number) {
    await this.page.click(`[data-testid="game-card-${gameId}"]`);
    await this.page.waitForURL(`**/games/${gameId}**`);
  }

  async getGameCardByStatus(status: string): Promise<Locator> {
    return this.page.locator(`[data-testid="game-status-${status}"]`).first();
  }

  async hasUnreadNotifications(): Promise<boolean> {
    return await this.notificationBadge.isVisible();
  }
}
