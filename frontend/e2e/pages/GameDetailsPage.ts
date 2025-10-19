import { Page, Locator, expect } from '@playwright/test';
import { navigateToGame, navigateToGameTab } from '../utils/navigation';
import { waitForVisible } from '../utils/waits';
import { assertTextVisible, assertUrl } from '../utils/assertions';

/**
 * Page Object Model for Game Details Page
 *
 * Encapsulates all game details page interactions including:
 * - Navigation to tabs
 * - Game state management
 * - Application management
 * - Participant interactions
 */
export class GameDetailsPage {
  constructor(private page: Page) {}

  /**
   * Navigate to the game details page
   */
  async goto(gameId: number) {
    await navigateToGame(this.page, gameId);
  }

  /**
   * Navigate to a specific tab
   */
  async goToTab(tabName: string) {
    await navigateToGameTab(this.page, tabName);
  }

  /**
   * Get the game title heading
   */
  get gameTitle(): Locator {
    return this.page.locator('h1, h2').first();
  }

  /**
   * Get the game state badge
   */
  get stateBadge(): Locator {
    return this.page.locator('[data-testid="game-state-badge"], .badge').first();
  }

  /**
   * Get a button by its text
   */
  getButton(text: string): Locator {
    return this.page.locator(`button:has-text("${text}")`);
  }

  /**
   * Click a button and wait for the action to complete
   */
  async clickButton(text: string) {
    await this.getButton(text).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Apply to join the game
   */
  async applyToJoin() {
    await this.clickButton('Apply to Join');
    await assertTextVisible(this.page, 'Application Submitted');
  }

  /**
   * Withdraw application
   */
  async withdrawApplication() {
    await this.clickButton('Withdraw Application');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Leave the game
   */
  async leaveGame() {
    await this.clickButton('Leave Game');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Start game recruitment (GM only)
   */
  async startRecruitment() {
    await this.clickButton('Start Recruitment');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Start the game (GM only)
   */
  async startGame() {
    await this.clickButton('Start Game');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * End the game (GM only)
   */
  async endGame() {
    await this.clickButton('End Game');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to Applications tab
   */
  async goToApplications() {
    await this.goToTab('Applications');
  }

  /**
   * Navigate to Participants tab
   */
  async goToParticipants() {
    await this.goToTab('Participants');
  }

  /**
   * Navigate to Characters tab
   */
  async goToCharacters() {
    await this.goToTab('Characters');
  }

  /**
   * Navigate to Phase Management tab
   */
  async goToPhaseManagement() {
    await this.goToTab('Phase Management');
  }

  /**
   * Navigate to Actions tab (GM view)
   */
  async goToActions() {
    await this.goToTab('Actions');
  }

  /**
   * Navigate to Submit Action tab (Player view)
   */
  async goToSubmitAction() {
    await this.goToTab('Submit Action');
  }

  /**
   * Navigate to Messages tab
   */
  async goToMessages() {
    await this.goToTab('Messages');
  }

  /**
   * Navigate to Phase History tab
   */
  async goToPhaseHistory() {
    await this.goToTab('Phase History');
  }

  /**
   * Approve an application (GM only)
   * @param playerUsername - Username of the player to approve
   */
  async approveApplication(playerUsername: string) {
    await this.goToApplications();

    const applicationRow = this.page.locator(`tr:has-text("${playerUsername}")`);
    await applicationRow.locator('button:has-text("Approve")').click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Reject an application (GM only)
   * @param playerUsername - Username of the player to reject
   */
  async rejectApplication(playerUsername: string) {
    await this.goToApplications();

    const applicationRow = this.page.locator(`tr:has-text("${playerUsername}")`);
    await applicationRow.locator('button:has-text("Reject")').click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify user is on the game details page
   */
  async verifyOnPage(gameId: number) {
    await assertUrl(this.page, new RegExp(`/games/${gameId}`));
  }

  /**
   * Verify game state is displayed
   */
  async verifyGameState(state: string) {
    await assertTextVisible(this.page, state);
  }

  /**
   * Verify a specific tab is active
   */
  async verifyActiveTab(tabName: string) {
    const activeTab = this.page.locator(`button:has-text("${tabName}")[aria-selected="true"]`);
    await waitForVisible(activeTab);
  }

  /**
   * Get participant count
   */
  async getParticipantCount(): Promise<number> {
    await this.goToParticipants();
    const rows = this.page.locator('table tbody tr');
    return await rows.count();
  }

  /**
   * Verify participant exists in list
   */
  async verifyParticipantExists(username: string) {
    await this.goToParticipants();
    const row = this.page.locator(`tr:has-text("${username}")`);
    await waitForVisible(row);
  }

  /**
   * Verify application exists with specific status
   */
  async verifyApplicationStatus(username: string, status: string) {
    await this.goToApplications();
    const row = this.page.locator(`tr:has-text("${username}"):has-text("${status}")`);
    await waitForVisible(row);
  }
}
