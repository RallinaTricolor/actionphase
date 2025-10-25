import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Admin Dashboard
 *
 * Handles admin operations like user management, banning, and admin role assignment
 */
export class AdminDashboardPage {
  readonly page: Page;

  // Tab locators
  readonly modeTab: Locator;
  readonly adminsTab: Locator;
  readonly bannedTab: Locator;
  readonly lookupTab: Locator;

  // Lookup form
  readonly lookupUsernameInput: Locator;
  readonly lookupButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Define tab locators
    this.modeTab = page.locator('button:has-text("Mode")');
    this.adminsTab = page.locator('button:has-text("Admins")');
    this.bannedTab = page.locator('button:has-text("Banned Users")');
    this.lookupTab = page.locator('button:has-text("User Lookup")');

    // Lookup form
    this.lookupUsernameInput = page.locator('input[placeholder*="username" i]');
    this.lookupButton = page.locator('button:has-text("Lookup User")');
  }

  /**
   * Navigate to admin page
   */
  async goto() {
    await this.page.goto('/admin');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Switch to a specific tab
   *
   * @param tab - Tab to switch to
   */
  async switchToTab(tab: 'mode' | 'admins' | 'banned' | 'lookup') {
    const tabLocator = tab === 'mode'
      ? this.modeTab
      : tab === 'admins'
      ? this.adminsTab
      : tab === 'banned'
      ? this.bannedTab
      : this.lookupTab;

    await tabLocator.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Look up a user by username
   *
   * @param username - Username to search for
   */
  async lookupUser(username: string) {
    await this.switchToTab('lookup');
    await this.lookupUsernameInput.fill(username);
    await this.lookupButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get list of admin usernames
   */
  async getAdminUsernames(): Promise<string[]> {
    await this.switchToTab('admins');

    const adminItems = await this.page.locator('[data-testid^="admin-item-"]').all();
    const usernames: string[] = [];

    for (const item of adminItems) {
      const text = await item.textContent();
      if (text) {
        // Extract username from the text (format varies)
        const usernameMatch = text.match(/(\w+)/);
        if (usernameMatch) {
          usernames.push(usernameMatch[1]);
        }
      }
    }

    return usernames;
  }

  /**
   * Get list of banned usernames
   */
  async getBannedUsernames(): Promise<string[]> {
    await this.switchToTab('banned');

    const bannedItems = await this.page.locator('[data-testid^="banned-user-"]').all();
    const usernames: string[] = [];

    for (const item of bannedItems) {
      const text = await item.textContent();
      if (text) {
        const usernameMatch = text.match(/(\w+)/);
        if (usernameMatch) {
          usernames.push(usernameMatch[1]);
        }
      }
    }

    return usernames;
  }

  /**
   * Ban a user by username
   *
   * @param username - Username of user to ban
   */
  async banUser(username: string) {
    await this.lookupUser(username);

    const banButton = this.page.locator('button:has-text("Ban User")');
    await banButton.click();

    // Wait for confirmation or success
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Unban a user
   *
   * @param username - Username of user to unban
   */
  async unbanUser(username: string) {
    await this.switchToTab('banned');

    const unbanButton = this.page.locator(`button:has-text("Unban"):near(:text("${username}"))`).first();
    await unbanButton.click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Grant admin privileges to a user
   *
   * @param username - Username of user to make admin
   */
  async grantAdmin(username: string) {
    await this.lookupUser(username);

    const grantButton = this.page.locator('button:has-text("Grant Admin")');
    await grantButton.click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Revoke admin privileges from a user
   *
   * @param username - Username of admin to revoke
   */
  async revokeAdmin(username: string) {
    await this.switchToTab('admins');

    const revokeButton = this.page.locator(`button:has-text("Revoke"):near(:text("${username}"))`).first();
    await revokeButton.click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify admin page loaded
   */
  async isLoaded(): Promise<boolean> {
    const heading = this.page.locator('h1:has-text("Admin")');
    return await heading.isVisible();
  }

  /**
   * Check if user has admin access to this page
   */
  async hasAdminAccess(): Promise<boolean> {
    const errorMessage = this.page.locator('text=/access denied|unauthorized/i');
    const hasError = await errorMessage.isVisible().catch(() => false);
    return !hasError;
  }
}
