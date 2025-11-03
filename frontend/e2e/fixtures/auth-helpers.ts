import { Page, expect, test } from '@playwright/test';
import { TEST_USERS, TestUser } from './test-users';
import { LoginPage } from '../pages/LoginPage';

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

  // Check if already logged in by checking for JWT cookie - if so, logout first
  const isLoggedIn = await isAuthenticated(page);
  if (isLoggedIn) {
    await logout(page);
    // After logout, we're already on /login page, so no need to navigate again
  }

  // Use LoginPage POM for login
  const loginPage = new LoginPage(page);

  // Always navigate to login page to ensure clean state
  // Even if we're already at /login (e.g., after logout), this ensures
  // the auth state has stabilized and network is idle before attempting login
  await loginPage.goto();

  await loginPage.login(workerUsername, user.password);

  // Authentication is now handled via HTTP-only cookies
  // No need to extract token from localStorage
  return { user, token: null };
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
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(username, password, expectSuccess);
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

  // Use Promise.all to handle the logout click and response concurrently
  // This ensures we catch the response even if navigation happens immediately
  await Promise.all([
    // Wait for the logout API call
    page.waitForResponse(
      response => response.url().includes('/api/v1/auth/logout') && response.status() === 200
    ),
    // Click the logout button (triggers the API call and navigation)
    page.locator('button:has-text("Logout")').click()
  ]);

  // Wait for redirect to login page
  await page.waitForURL('/login', { timeout: 5000 });

  // The backend logout endpoint has now cleared the JWT cookie
  // For good measure in Playwright tests, also manually clear the JWT cookie
  // to ensure a clean state for the next login
  const cookies = await page.context().cookies();
  const jwtCookie = cookies.find(cookie => cookie.name === 'jwt');
  if (jwtCookie) {
    await page.context().clearCookies({ name: 'jwt' });
  }
}

/**
 * Check if user is authenticated by verifying presence of JWT cookie
 * @param page - Playwright page object
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Check for the JWT cookie (HTTP-only cookie named 'jwt')
  const cookies = await page.context().cookies();
  const jwtCookie = cookies.find(cookie => cookie.name === 'jwt');

  // User is authenticated if JWT cookie exists and is not expired
  if (jwtCookie) {
    // Check if cookie is expired (expires is in seconds since epoch)
    const now = Date.now() / 1000; // Convert to seconds
    if (jwtCookie.expires === -1 || jwtCookie.expires > now) {
      return true;
    }
  }

  return false;
}

/**
 * Get the current user's token from localStorage
 * @deprecated Authentication now uses HTTP-only cookies. This function always returns null.
 * @param page - Playwright page object
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  // Authentication is now cookie-based, no token in localStorage
  return null;
}

/**
 * Clear authentication state (logout without UI interaction)
 * @deprecated Use the logout() function instead. HTTP-only cookies cannot be cleared from JavaScript.
 * @param page - Playwright page object
 */
export async function clearAuth(page: Page) {
  // HTTP-only cookies cannot be cleared from JavaScript
  // Use the logout() function instead for proper logout
  // This function is kept for backwards compatibility but does nothing
}
