import { Page, Locator } from '@playwright/test';

/**
 * Page Object for User Settings
 *
 * Handles user preferences, theme selection, and account settings
 */
export class UserSettingsPage {
  readonly page: Page;

  // Locators
  readonly lightThemeRadio: Locator;
  readonly darkThemeRadio: Locator;
  readonly systemThemeRadio: Locator;

  constructor(page: Page) {
    this.page = page;

    // Define locators
    this.lightThemeRadio = page.locator('input[type="radio"][value="light"]');
    this.darkThemeRadio = page.locator('input[type="radio"][value="dark"]');
    this.systemThemeRadio = page.locator('input[type="radio"][value="system"]');
  }

  /**
   * Navigate to settings page
   */
  async goto() {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Select theme
   *
   * @param theme - Theme to select ('light' | 'dark' | 'system')
   */
  async selectTheme(theme: 'light' | 'dark' | 'system') {
    const themeRadio = theme === 'light'
      ? this.lightThemeRadio
      : theme === 'dark'
      ? this.darkThemeRadio
      : this.systemThemeRadio;

    await themeRadio.click();

    // Wait for theme to apply
    await this.page.waitForTimeout(500);
  }

  /**
   * Get currently selected theme
   */
  async getSelectedTheme(): Promise<'light' | 'dark' | 'system' | null> {
    if (await this.lightThemeRadio.isChecked()) return 'light';
    if (await this.darkThemeRadio.isChecked()) return 'dark';
    if (await this.systemThemeRadio.isChecked()) return 'system';
    return null;
  }

  /**
   * Verify settings page loaded
   */
  async isLoaded(): Promise<boolean> {
    const heading = this.page.locator('h1:has-text("Settings")');
    return await heading.isVisible();
  }

  /**
   * Check if dark mode is currently active
   */
  async isDarkModeActive(): Promise<boolean> {
    const html = this.page.locator('html');
    const classes = await html.getAttribute('class') || '';
    return classes.includes('dark');
  }
}
