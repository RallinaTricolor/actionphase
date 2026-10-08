import { Page, Locator } from '@playwright/test';
import { LONG_TIMEOUT } from '../config/test-timeouts';
import { waitForRouteCommitted } from '../utils/waits';

/**
 * Page Object for User Login
 *
 * Handles user authentication and login flows
 */
export class LoginPage {
  readonly page: Page;

  // Locators
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Define locators
    this.usernameInput = page.locator('[data-testid="login-username"]');
    this.passwordInput = page.locator('[data-testid="login-password"]');
    this.loginButton = page.locator('[data-testid="login-submit"]');
  }

  /**
   * Navigate to login page
   */
  async goto() {
    // Navigate with retry logic to handle race conditions during user switching
    let retries = 3;
    while (retries > 0) {
      try {
        await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isNavigationError = message.includes('interrupted by another navigation') ||
                                 message.includes('ERR_ABORTED');
        if (isNavigationError && retries > 1) {
          // Wait a bit and retry
          await this.page.waitForTimeout(300);
          retries--;
        } else {
          throw error;
        }
      }
    }
    // Wait for the login form to be visible and network to settle
    // (ensures any in-flight auth requests from prior tests have completed)
    //
    // LONG_TIMEOUT, not the 5s default. Login is the first thing all ~51 specs
    // do, so this wait competes with five other workers cold-loading the Vite
    // dev server at once. A budget that only suits a quiet machine turns dev
    // server contention into "login timed out" failures scattered across
    // unrelated specs -- the symptom points at whatever the spec was testing
    // rather than at the shared bottleneck it actually hit.
    await this.usernameInput.waitFor({ state: 'visible', timeout: LONG_TIMEOUT });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Login with credentials
   *
   * @param username - Username
   * @param password - Password
   * @param expectSuccess - Whether login should succeed (default: true)
   * @returns Promise that resolves when login completes
   */
  async login(username: string, password: string, expectSuccess: boolean = true) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();

    if (expectSuccess) {
      // Wait to land ANYWHERE but /login -- not specifically on /dashboard.
      //
      // /dashboard is only the FALLBACK destination. LoginPage.tsx redirects to
      // `location.state.from.pathname` when it is set, which ProtectedRoute
      // sets whenever it bounces an unauthenticated user off a protected URL.
      // React Router keeps that state in SPA history across a page.goto('/login'),
      // so a spec that deep-links to a protected route and then logs in as
      // someone else legitimately lands back on THAT route instead.
      //
      // Waiting for '/dashboard' therefore timed out on a login that had in fact
      // succeeded -- and it read as a slow dev server, because the URL bar was
      // the only place the difference showed. Leaving /login is the real
      // success signal; where we land afterwards is the app's business.
      //
      // LONG_TIMEOUT, not the 10s default: the POST and the subsequent
      // /auth/me still queue behind other workers on a busy run.
      await this.page.waitForURL((url) => !url.pathname.startsWith('/login'), {
        timeout: LONG_TIMEOUT,
      });
      // The URL changes before the UI does: React Router commits the new route
      // in a transition, holding the old one on screen while the lazy page
      // chunk loads. Anything opened in that window (e.g. the user menu) is
      // reset when the route commits. Wait for Layout to render the URL's route.
      await waitForRouteCommitted(this.page);
      await this.page.waitForLoadState('networkidle');
    }
  }

}
