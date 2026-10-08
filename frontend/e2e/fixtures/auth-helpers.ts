import { Page, expect } from '@playwright/test';
import { TEST_USERS } from './test-users';
import { LoginPage } from '../pages/LoginPage';
import { waitForRouteCommitted } from '../utils/waits';
import { isMobileViewport } from '../utils/viewport';

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
 * Log in as a test user for test SETUP, and land on the dashboard.
 *
 * Authenticates through the API, not the login form: the form is a feature
 * with its own specs (auth/login.spec.ts, the smoke suite, via loginViaUI).
 * As setup it cost a full /login load, form input, and an SPA hop to the
 * dashboard -- per user, ~35 specs switch users -- which pushed multi-user
 * journeys past their time budget under parallel load.
 *
 * page.request shares the page's cookie jar, so the login response's jwt
 * cookie authenticates the page. Switching users clears the previous session
 * first; the full navigation to /dashboard then discards the previous user's
 * in-memory app state (React Query cache).
 *
 * @param page - Playwright page object
 * @param userKey - Key from TEST_USERS object (e.g., 'GM', 'PLAYER_1')
 * @returns Object with user info and token
 */
export async function loginAs(page: Page, userKey: keyof typeof TEST_USERS) {
  const user = TEST_USERS[userKey];
  const workerUsername = getWorkerSpecificUsername(user.username);

  await clearSession(page);

  const response = await page.request.post('/api/v1/auth/login', {
    data: { username: workerUsername, password: user.password },
  });
  if (!response.ok()) {
    throw new Error(`API login as ${workerUsername} failed: ${response.status()} ${await response.text()}`);
  }

  await page.goto('/dashboard');
  await waitForRouteCommitted(page);
  // ProtectedRoute bounces an unauthenticated load to /login; fail here, by
  // name, rather than in whatever the test does next.
  await expect(page).toHaveURL(/\/dashboard$/);

  return { user, token: null };
}

/**
 * Log in as a test user through the login form.
 *
 * For specs that test logging in. Everything else should use loginAs().
 */
export async function loginViaUI(page: Page, userKey: keyof typeof TEST_USERS) {
  const user = TEST_USERS[userKey];
  const workerUsername = getWorkerSpecificUsername(user.username);

  // Switching users drops the previous session directly; logout through the
  // user menu is tested on its own via logout().
  await clearSession(page);

  const loginPage = new LoginPage(page);
  // Full navigation to /login: discards the previous user's in-memory app
  // state (React Query cache) along with the session cleared above.
  await loginPage.goto();
  await loginPage.login(workerUsername, user.password);

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
 * Drop the current session without touching the UI.
 *
 * Mirrors what logging out does to the browser: the backend's logout only
 * clears the `jwt` cookie, and the app also keeps the token in localStorage
 * (`auth_token`), which the API client sends as a Bearer header. Clearing the
 * cookie alone would leave the next page load authenticated via that header.
 *
 * localStorage is per-origin, so it can only be cleared from a page on the app
 * origin; a page that has never left about:blank holds no token to clear.
 */
export async function clearSession(page: Page) {
  await page.context().clearCookies({ name: 'jwt' });
  if (page.url().startsWith('http')) {
    await page.evaluate(() => localStorage.removeItem('auth_token'));
  }
}

/**
 * Logout the current user through the UI.
 *
 * Only for specs that test logout itself. To switch users, call loginAs(),
 * which drops the session without the UI.
 *
 * Handles both mobile (hamburger menu) and desktop (hover user menu) navigation.
 * @param page - Playwright page object
 */
export async function logout(page: Page) {
  // Detect viewport: mobile shows hamburger (md:hidden), desktop shows user-menu-trigger (hidden md:block)
  const hamburger = page.locator('button[aria-label="Menu"]');
  const isMobile = isMobileViewport(page);

  const logoutButton = page.locator('button:has-text("Logout")').locator('visible=true').first();

  if (isMobile) {
    // Mobile: click hamburger to open the mobile drawer
    await hamburger.click();
    await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
  } else {
    // Desktop: open the user menu by clicking its button.
    //
    // The menu also opens on hover, but hover is a poor fit for a test helper:
    // it depends on where the pointer already is (re-hovering without leaving
    // is a no-op, so a retry can't recover), and under parallel load the first
    // hover can land before React has attached onMouseEnter. Clicking is a
    // discrete, retriable action with no such dependency.
    const userMenuTrigger = page.getByTestId('user-menu-trigger');
    const userMenuButton = userMenuTrigger.locator('button').first();
    await expect(userMenuButton).toBeVisible({ timeout: 10000 });

    await expect(async () => {
      await userMenuButton.click();
      await logoutButton.waitFor({ state: 'visible', timeout: 2000 });
    }).toPass({ timeout: 20000, intervals: [500] });
  }

  // Use Promise.all to handle the logout click and response concurrently
  // This ensures we catch the response even if navigation happens immediately.
  //
  // Both carry explicit timeouts. Without them, a menu that closes before the
  // click lands leaves click() waiting for the rest of the test budget, and the
  // failure is reported against waitForResponse instead of the missing button.
  await Promise.all([
    page.waitForResponse(
      response => response.url().includes('/api/v1/auth/logout') && response.status() === 200,
      { timeout: 10000 }
    ),
    logoutButton.click({ timeout: 5000 }),
  ]);

  // Wait for redirect to login page
  await page.waitForURL('/login', { timeout: 5000 });

  // Clear the JWT cookie for clean state
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
