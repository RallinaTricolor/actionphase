import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Notifications interactions
 *
 * Handles viewing, managing, and interacting with notifications
 */
export class NotificationsPage {
  readonly page: Page;

  // Locators
  readonly pageTitle: Locator;
  readonly markAllAsReadButton: Locator;
  readonly notificationItems: Locator;
  readonly notificationBell: Locator;
  readonly notificationDropdown: Locator;
  readonly backToDashboardButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Define locators
    this.pageTitle = page.locator('h1:has-text("Notifications")');
    this.markAllAsReadButton = page.locator('button:has-text("Mark all")');
    this.notificationItems = page.locator('[data-testid="notification-item"], .notification-item, [class*="notification"]');
    this.notificationBell = page.locator('[data-testid="notification-bell"], button:has([class*="bell"])');
    this.notificationDropdown = page.locator('[data-testid="notification-dropdown"]');
    this.backToDashboardButton = page.locator('button:has-text("Back to Dashboard")');
    this.emptyState = page.locator('text=/No notifications/i');
  }

  /**
   * Navigate to notifications page
   */
  async goto(): Promise<void> {
    await this.page.goto('/notifications');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for notifications to load
   */
  async waitForNotificationsToLoad(): Promise<void> {
    // Wait for either notifications or empty state
    await Promise.race([
      this.notificationItems.first().waitFor({ state: 'visible', timeout: 5000 }),
      this.emptyState.waitFor({ state: 'visible', timeout: 5000 })
    ]).catch(() => {
      // Timeout is OK
    });
  }

  /**
   * Get all notifications
   */
  async getNotifications(): Promise<string[]> {
    await this.waitForNotificationsToLoad();

    // Check if empty state is shown
    const isEmpty = await this.isNotificationListEmpty();
    if (isEmpty) {
      return [];
    }

    const notifications = await this.notificationItems.all();
    return Promise.all(notifications.map(n => n.textContent())).then(texts =>
      texts.filter((t): t is string => t !== null && t.trim() !== '')
    );
  }

  /**
   * Get notification count
   */
  async getNotificationCount(): Promise<number> {
    await this.waitForNotificationsToLoad();

    const isEmpty = await this.isNotificationListEmpty();
    if (isEmpty) {
      return 0;
    }

    return await this.notificationItems.count();
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    await this.waitForNotificationsToLoad();

    const unreadItems = this.page.locator('[data-testid="notification-item"]').filter({ has: this.page.locator('[class*="unread"]') });
    return await unreadItems.count();
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    const isVisible = await this.markAllAsReadButton.isVisible().catch(() => false);
    if (isVisible) {
      await this.markAllAsReadButton.click();
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Mark a specific notification as read by index
   */
  async markAsRead(index: number): Promise<void> {
    const notification = this.notificationItems.nth(index);
    await notification.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click on a notification to navigate
   */
  async clickNotification(index: number): Promise<void> {
    const notification = this.notificationItems.nth(index);
    await notification.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clear all notifications (if button exists)
   */
  async clearAll(): Promise<void> {
    const clearButton = this.page.locator('button:has-text("Clear all")');
    const isVisible = await clearButton.isVisible().catch(() => false);
    if (isVisible) {
      await clearButton.click();
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Check if notification list is empty
   */
  async isNotificationListEmpty(): Promise<boolean> {
    return await this.emptyState.isVisible().catch(() => false);
  }

  /**
   * Open notification dropdown (from bell icon)
   */
  async openNotificationDropdown(): Promise<void> {
    await this.notificationBell.click();
    await this.notificationDropdown.waitFor({ state: 'visible', timeout: 3000 });
  }

  /**
   * Close notification dropdown
   */
  async closeNotificationDropdown(): Promise<void> {
    // Click outside the dropdown
    await this.page.click('body', { position: { x: 0, y: 0 } });
    await this.notificationDropdown.waitFor({ state: 'hidden', timeout: 3000 });
  }

  /**
   * Get unread count from bell icon badge
   */
  async getUnreadCountFromBell(): Promise<number> {
    const badge = this.page.locator('[data-testid="notification-bell"]').locator('[class*="badge"], span').filter({ hasText: /^\d+$/ });

    const isVisible = await badge.isVisible().catch(() => false);
    if (!isVisible) {
      return 0;
    }

    const text = await badge.textContent();
    return text ? parseInt(text, 10) : 0;
  }

  /**
   * Check if there are unread notifications (badge visible on bell)
   */
  async hasUnreadNotifications(): Promise<boolean> {
    const badge = this.page.locator('[data-testid="notification-bell"]').locator('[class*="badge"], span').filter({ hasText: /\d+/ });
    return await badge.isVisible().catch(() => false);
  }

  /**
   * Get notification type (e.g., "New Message", "Phase Update")
   */
  async getNotificationType(index: number): Promise<string> {
    const notification = this.notificationItems.nth(index);
    const typeElement = notification.locator('[data-testid="notification-type"], .notification-type, strong').first();
    return await typeElement.textContent() || '';
  }

  /**
   * Check if notification is marked as read
   */
  async isNotificationRead(index: number): Promise<boolean> {
    const notification = this.notificationItems.nth(index);

    // Check if notification has "unread" indicator
    const unreadIndicator = notification.locator('[class*="unread"], [data-unread="true"]');
    const hasUnread = await unreadIndicator.isVisible().catch(() => false);

    return !hasUnread;
  }

  /**
   * Navigate back to dashboard
   */
  async backToDashboard(): Promise<void> {
    const isVisible = await this.backToDashboardButton.isVisible().catch(() => false);
    if (isVisible) {
      await this.backToDashboardButton.click();
      await this.page.waitForURL('/dashboard', { timeout: 5000 });
    } else {
      // Fallback: navigate directly
      await this.page.goto('/dashboard');
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get notification message preview
   */
  async getNotificationMessage(index: number): Promise<string> {
    const notification = this.notificationItems.nth(index);
    const message = notification.locator('p, .message, [class*="text"]').first();
    return await message.textContent() || '';
  }

  /**
   * Filter notifications by type (visual check in UI)
   */
  async filterByType(type: string): Promise<void> {
    const filterButton = this.page.locator(`button:has-text("${type}")`);
    const isVisible = await filterButton.isVisible().catch(() => false);
    if (isVisible) {
      await filterButton.click();
      await this.page.waitForLoadState('networkidle');
    }
  }
}
