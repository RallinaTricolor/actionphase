import { Page, expect } from '@playwright/test';
import { TEST_USERS, TestUser } from './test-users';

/**
 * Authentication Helper Functions for E2E Tests
 */

/**
 * Login as a specific test user
 * @param page - Playwright page object
 * @param userKey - Key from TEST_USERS object (e.g., 'GM', 'PLAYER_1')
 * @returns Object with user info and token
 */
export async function loginAs(page: Page, userKey: keyof typeof TEST_USERS) {
  const user = TEST_USERS[userKey];

  await page.goto('/login');

  // Fill in login form
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="password"]', user.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard (successful login)
  await page.waitForURL('/dashboard', { timeout: 10000 });

  // Extract token from localStorage for API calls if needed
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));

  return { user, token };
}

/**
 * Login with custom credentials (for testing error cases)
 * @param page - Playwright page object
 * @param username - Custom username
 * @param password - Custom password
 * @param expectSuccess - Whether login should succeed (default: true)
 */
export async function login(
  page: Page,
  username: string,
  password: string,
  expectSuccess: boolean = true
) {
  await page.goto('/login');

  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  if (expectSuccess) {
    await page.waitForURL('/dashboard', { timeout: 10000 });
  }
}

/**
 * Logout the current user
 * @param page - Playwright page object
 */
export async function logout(page: Page) {
  // Click logout button (directly visible in nav bar)
  await page.click('button:has-text("Logout")');

  // Wait for redirect to login page
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Check if user is authenticated by verifying presence of auth UI elements
 * @param page - Playwright page object
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for logout button presence (visible when authenticated)
    await page.waitForSelector('button:has-text("Logout")', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current user's token from localStorage
 * @param page - Playwright page object
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => localStorage.getItem('auth_token'));
}

/**
 * Clear authentication state (logout without UI interaction)
 * @param page - Playwright page object
 */
export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('auth_token');
  });
}
