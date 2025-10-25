import { Page, Locator } from '@playwright/test';

/**
 * Page Object for User Registration
 *
 * Handles new user signup and registration flows
 */
export class RegistrationPage {
  readonly page: Page;

  // Locators
  readonly emailInput: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly registerButton: Locator;
  readonly loginLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Define locators
    this.emailInput = page.locator('[data-testid="register-email"]');
    this.usernameInput = page.locator('[data-testid="register-username"]');
    this.passwordInput = page.locator('[data-testid="register-password"]');
    this.registerButton = page.locator('[data-testid="register-submit"]');
    this.loginLink = page.locator('button:has-text("Already have an account? Sign in")');
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  /**
   * Navigate to registration page
   */
  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');

    // Click "Sign up" button to show registration form
    const signUpButton = this.page.locator('button:has-text("Don\'t have an account? Sign up")');
    const isVisible = await signUpButton.isVisible().catch(() => false);
    if (isVisible) {
      await signUpButton.click();
      await this.page.waitForTimeout(500); // Wait for form to toggle
    }
  }

  /**
   * Register a new user
   *
   * @param email - User email address
   * @param username - Username
   * @param password - Password
   * @returns Promise that resolves when registration completes
   */
  async register(email: string, username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    await this.registerButton.click();

    // Wait for either redirect to dashboard or error
    await Promise.race([
      this.page.waitForURL('/dashboard', { timeout: 5000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 5000 })
    ]).catch(() => {
      // Either outcome is acceptable for this method
    });
  }

  /**
   * Attempt registration with invalid data (for testing validation)
   */
  async registerInvalid(email: string, username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    await this.registerButton.click();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  /**
   * Check if register button is disabled
   */
  async isRegisterButtonDisabled(): Promise<boolean> {
    return await this.registerButton.isDisabled();
  }

  /**
   * Navigate to login page
   */
  async goToLogin() {
    await this.loginLink.click();
    await this.page.waitForURL('/login');
  }

  /**
   * Fill registration form but don't submit
   */
  async fillForm(email: string, username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  /**
   * Check if specific field has validation error
   */
  async hasFieldError(field: 'email' | 'username' | 'password' | 'confirm'): Promise<boolean> {
    const fieldLocator = this.page.locator(`[data-testid="register-${field}"]`);
    const hasAriaInvalid = await fieldLocator.getAttribute('aria-invalid');
    return hasAriaInvalid === 'true';
  }
}
