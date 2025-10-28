import { Page, expect, test } from '@playwright/test';
import { TEST_USERS, TestUser } from './test-users';

/**
 * Authentication Helper Functions for E2E Tests
 */

/**
 * Get username for parallel test execution
 * Uses worker-specific usernames to prevent race conditions between parallel workers.
 * Each worker gets dedicated users and fixture data with isolated game IDs.
 *
 * @param baseUsername - Base username (e.g., 'TestGM', 'TestPlayer1')
 * @returns Worker-specific username (e.g., 'TestGM_1' for worker 1)
 */
function getWorkerSpecificUsername(baseUsername: string): string {
  // Get Playwright worker index from environment variable
  const workerIndex = process.env.TEST_PARALLEL_INDEX
    ? parseInt(process.env.TEST_PARALLEL_INDEX, 10)
    : 0;

  // Worker 0 uses base username (no suffix), others get _N suffix
  return workerIndex === 0 ? baseUsername : `${baseUsername}_${workerIndex}`;
}

/**
 * Login as a specific test user
 * @param page - Playwright page object
 * @param userKey - Key from TEST_USERS object (e.g., 'GM', 'PLAYER_1')
 * @returns Object with user info and token
 */
export async function loginAs(page: Page, userKey: keyof typeof TEST_USERS) {
  const user = TEST_USERS[userKey];

  // Get worker-specific username and email
  const workerUsername = getWorkerSpecificUsername(user.username);
  const workerEmail = workerUsername.toLowerCase().replace('test', 'test_') + '@example.com';

  // Navigate to login page first
  await page.goto('/login');

  // Clear any existing auth state
  await page.evaluate(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  });

  // Refresh to ensure clean state
  await page.goto('/login');

  // Fill in login form with worker-specific credentials
  await page.fill('input[name="username"]', workerUsername);
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
  // Find the user dropdown container (has a button with an SVG user icon and username)
  const userDropdown = page.locator('nav .relative').last();

  // Hover over the dropdown to open it
  await userDropdown.hover();

  // Wait a moment for the dropdown animation
  await page.waitForTimeout(200);

  // Click the logout button (now visible in the dropdown)
  await page.locator('button:has-text("Logout")').click();

  // Wait for redirect to login page
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Check if user is authenticated by verifying presence of auth UI elements
 * @param page - Playwright page object
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for authenticated navbar (Dashboard or Games link)
    await page.waitForSelector('nav a[href="/dashboard"]', { timeout: 2000, state: 'attached' });
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
