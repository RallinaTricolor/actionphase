import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Game Applications
 *
 * Handles viewing and managing game applications during recruitment phase
 * Applications are accessed via the game's Applications tab
 */
export class GameApplicationsPage {
  readonly page: Page;
  readonly gameId: number;

  // Locators
  readonly applicationsList: Locator;
  readonly applicationsPendingSection: Locator;
  readonly applicationsReviewedSection: Locator;
  readonly applyButton: Locator;

  constructor(page: Page, gameId: number) {
    this.page = page;
    this.gameId = gameId;

    // Define locators using data-testid
    this.applicationsList = page.getByTestId('applications-list');
    this.applicationsPendingSection = page.getByTestId('applications-pending-section');
    this.applicationsReviewedSection = page.getByTestId('applications-reviewed-section');
    this.applyButton = page.getByTestId(`apply-button-${gameId}`);
  }

  /**
   * Navigate to game's applications tab
   */
  async goto() {
    await this.page.goto(`/games/${this.gameId}`);
    await this.page.waitForLoadState('networkidle');

    // Click on Applications tab using data-testid
    const applicationsTab = this.page.getByTestId('tab-applications');
    await applicationsTab.waitFor({ state: 'visible', timeout: 5000 });
    await applicationsTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Submit an application to join the game
   *
   * @param message - Application message
   * @param role - Role to apply for ('player' or 'audience')
   */
  async submitApplication(message: string, role: 'player' | 'audience' = 'player') {
    await this.applyButton.click();

    // Wait for modal to appear by looking for the form
    const applicationForm = this.page.getByTestId('application-form');
    await applicationForm.waitFor({ state: 'visible', timeout: 5000 });

    // Select role if different from default
    if (role !== 'player') {
      const roleSelect = this.page.getByTestId('application-role-select');
      await roleSelect.selectOption(role);
    }

    // Fill application message
    const messageTextarea = this.page.getByTestId('application-message');
    await messageTextarea.fill(message);

    // Submit application
    const submitButton = this.page.getByTestId('submit-application');
    await submitButton.click();

    // Wait for modal to close by checking that the form is hidden
    await applicationForm.waitFor({ state: 'hidden', timeout: 5000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Withdraw a pending application
   */
  async withdrawApplication() {
    const withdrawButton = this.page.getByTestId('withdraw-application-button');
    await withdrawButton.waitFor({ state: 'visible', timeout: 5000 });
    await withdrawButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get list of pending application usernames
   */
  async getPendingApplications(): Promise<string[]> {
    // Wait for pending section to be visible
    await this.applicationsPendingSection.waitFor({ state: 'visible', timeout: 5000 });

    const applicationCards = await this.applicationsPendingSection
      .getByTestId('application-card')
      .all();

    const usernames: string[] = [];
    for (const card of applicationCards) {
      // Find username within the card - it's typically in a heading or strong text
      // Filter to visible element (viewport-agnostic for dual-DOM pattern)
      const usernameElement = card.locator('h3, h4, strong').locator('visible=true').first();
      const username = await usernameElement.textContent();
      if (username) {
        usernames.push(username.trim());
      }
    }

    return usernames;
  }

  /**
   * Approve a specific application by username
   *
   * @param username - Username of applicant to approve
   */
  async approveApplication(username: string) {
    // Find the application card containing this username
    const card = await this.findApplicationCard(username);

    // Click the approve button within the card
    const approveButton = card.getByTestId('approve-application-button');
    await approveButton.waitFor({ state: 'visible', timeout: 3000 });
    await approveButton.click();
    await this.page.waitForLoadState('networkidle');

    // Give UI time to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Reject a specific application by username
   *
   * @param username - Username of applicant to reject
   */
  async rejectApplication(username: string) {
    // Find the application card containing this username
    const card = await this.findApplicationCard(username);

    // Click the reject button within the card
    const rejectButton = card.getByTestId('reject-application-button');
    await rejectButton.waitFor({ state: 'visible', timeout: 3000 });
    await rejectButton.click();
    await this.page.waitForLoadState('networkidle');

    // Give UI time to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Get the status of a specific application
   *
   * @param username - Username to check
   * @returns 'pending' | 'approved' | 'rejected' | null
   */
  async getApplicationStatus(username: string): Promise<string | null> {
    try {
      const card = await this.findApplicationCard(username);
      const statusBadge = card.getByTestId('application-status-badge');
      const statusText = await statusBadge.textContent();
      return statusText?.trim().toLowerCase() || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if Apply button is visible (user can apply)
   */
  async hasApplyButton(): Promise<boolean> {
    try {
      await this.applyButton.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if application exists for a specific user
   *
   * @param username - Username to check
   */
  async hasApplication(username: string): Promise<boolean> {
    try {
      await this.findApplicationCard(username);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get count of pending applications
   */
  async getPendingApplicationsCount(): Promise<number> {
    try {
      await this.applicationsPendingSection.waitFor({ state: 'visible', timeout: 3000 });
      const cards = await this.applicationsPendingSection
        .getByTestId('application-card')
        .all();
      return cards.length;
    } catch {
      return 0;
    }
  }

  /**
   * Get count of reviewed applications
   */
  async getReviewedApplicationsCount(): Promise<number> {
    try {
      await this.applicationsReviewedSection.waitFor({ state: 'visible', timeout: 3000 });
      const cards = await this.applicationsReviewedSection
        .getByTestId('application-card')
        .all();
      return cards.length;
    } catch {
      return 0;
    }
  }

  /**
   * Helper: Find an application card by username
   * @private
   */
  private async findApplicationCard(username: string): Promise<Locator> {
    // Get all application cards
    const allCards = await this.applicationsList
      .getByTestId('application-card')
      .all();

    // Find the card containing the username
    for (const card of allCards) {
      const text = await card.textContent();
      if (text?.includes(username)) {
        return card;
      }
    }

    throw new Error(`Application card for user "${username}" not found`);
  }
}
