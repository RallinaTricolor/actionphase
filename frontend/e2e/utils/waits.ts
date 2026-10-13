import { Page, Locator, Response, expect } from '@playwright/test';
import { LONG_TIMEOUT } from '../config/test-timeouts';

/**
 * Smart Waiting Utilities for E2E Tests
 *
 * Replace brittle waitForTimeout() calls with intelligent waiting strategies.
 * These functions wait for specific conditions rather than arbitrary time periods.
 */

/**
 * Wait for an element to be visible and stable (not animating)
 * @param locator - Playwright locator
 * @param options - Wait options
 */
export async function waitForVisible(
  locator: Locator,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout ?? 5000;
  await expect(locator).toBeVisible({ timeout });
}

/**
 * Wait for text to appear on the page
 * @param page - Playwright page object
 * @param text - Text to wait for
 * @param options - Wait options
 */
export async function waitForText(
  page: Page,
  text: string,
  options: { timeout?: number; exact?: boolean } = {}
) {
  const timeout = options.timeout ?? 5000;
  const selector = options.exact
    ? `text="${text}"`
    : `text=${text}`;

  await page.waitForSelector(selector, { timeout });
}

/**
 * Wait for a network request to complete
 * @param page - Playwright page object
 * @param urlPattern - URL pattern to wait for (regex or string)
 * @param options - Wait options
 */
export async function waitForRequest(
  page: Page,
  urlPattern: string | RegExp,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout ?? 10000;

  await page.waitForRequest(
    (request) => {
      const url = request.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Wait for a network response to complete
 * @param page - Playwright page object
 * @param urlPattern - URL pattern to wait for (regex or string)
 * @param options - Wait options
 */
export async function waitForResponse(
  page: Page,
  urlPattern: string | RegExp,
  options: { timeout?: number; status?: number } = {}
) {
  const timeout = options.timeout ?? 10000;

  await page.waitForResponse(
    (response) => {
      const url = response.url();
      const matchesUrl = typeof urlPattern === 'string'
        ? url.includes(urlPattern)
        : urlPattern.test(url);

      if (options.status) {
        return matchesUrl && response.status() === options.status;
      }

      return matchesUrl;
    },
    { timeout }
  );
}

/**
 * Wait for a modal or dialog to appear
 * @param page - Playwright page object
 * @param modalTitle - Expected modal title or heading
 */
export async function waitForModal(page: Page, modalTitle?: string) {
  if (modalTitle) {
    await waitForText(page, modalTitle, { timeout: 3000 });
  } else {
    // Wait for common modal indicators
    await page.waitForSelector('[role="dialog"], .modal, [data-testid*="modal"]', { timeout: 3000 });
  }
}

/**
 * Wait until the rendered route matches the URL.
 *
 * React Router commits navigations inside a transition: while a lazy page chunk
 * loads, the URL already shows the destination but the old route stays on
 * screen. Waiting on the URL alone (or networkidle) lets a test interact with
 * that stale tree, and whatever it opened is reset when the route commits.
 * Layout publishes the committed route as `data-route`; this waits for it to
 * catch up with `location.pathname`.
 *
 * Pages rendered outside Layout (the public home page) have no `data-route`
 * and pass immediately.
 */
export async function waitForRouteCommitted(page: Page, timeout: number = LONG_TIMEOUT) {
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>('[data-route]');
    return !root || root.dataset.route === window.location.pathname;
  }, undefined, { timeout });
}

/**
 * Click a control that writes to the server and wait for the write to land.
 *
 * Use this in every page-object helper that submits something. The previous
 * idiom -- click, then waitForLoadState('networkidle') -- is not a wait for the
 * write: networkidle can resolve before the request has even started, so the
 * helper returns with the write still pending. Two things then go wrong:
 *
 *  - Assertions pass vacuously. A React-controlled <textarea> mirrors what was
 *    typed into its text content, so getByText(typedContent) matches the still-
 *    open editor, not the saved result.
 *  - A navigation that follows (switching users, page.goto) cancels the
 *    in-flight request, and the write never happens. The next user then sees
 *    the old data and the test fails far from the cause.
 *
 * Fails with the status when the server rejects the write, rather than letting
 * a later assertion time out.
 */
export async function clickAndWaitForMutation(
  page: Page,
  trigger: Locator,
  match: MutationMatch,
  timeout: number = LONG_TIMEOUT
): Promise<Response> {
  return performAndWaitForMutation(page, () => trigger.click(), match, timeout);
}

export type MutationMatch = { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: RegExp };

/**
 * clickAndWaitForMutation for writes not triggered by a click -- e.g. a form
 * submitted with requestSubmit(), or a key press. Same contract: the wait is
 * registered before the action, and a non-2xx response fails here.
 */
export async function performAndWaitForMutation(
  page: Page,
  action: () => Promise<unknown>,
  match: MutationMatch,
  timeout: number = LONG_TIMEOUT
): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === match.method && match.path.test(new URL(r.url()).pathname),
      { timeout }
    ),
    action(),
  ]);
  if (!response.ok()) {
    throw new Error(`${match.method} ${new URL(response.url()).pathname} returned ${response.status()}`);
  }
  return response;
}

/**
 * Endpoint matchers for writes the page objects wait on. Kept in one place so a
 * route change is a one-line fix. Paths are matched against the URL pathname.
 */
export const API = {
  createPost: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/posts$/ },
  createComment: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/posts\/\d+\/comments$/ },
  editComment: { method: 'PATCH', path: /^\/api\/v1\/games\/\d+\/posts\/\d+\/comments\/\d+$/ },
  createConversation: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/conversations$/ },
  sendMessage: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/conversations\/\d+\/messages$/ },
  editMessage: { method: 'PATCH', path: /^\/api\/v1\/games\/\d+\/conversations\/\d+\/messages\/\d+$/ },
  createPhase: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/phases$/ },
  activatePhase: { method: 'POST', path: /^\/api\/v1\/phases\/\d+\/activate$/ },
  deletePhase: { method: 'DELETE', path: /^\/api\/v1\/phases\/\d+$/ },
  createDraftPost: { method: 'POST', path: /^\/api\/v1\/phases\/\d+\/draft-post$/ },
  updateDraftPost: { method: 'PUT', path: /^\/api\/v1\/phases\/\d+\/draft-post$/ },
  createHandout: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/handouts$/ },
  updateHandout: { method: 'PUT', path: /^\/api\/v1\/games\/\d+\/handouts\/\d+$/ },
  deleteHandout: { method: 'DELETE', path: /^\/api\/v1\/games\/\d+\/handouts\/\d+$/ },
  createPoll: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/polls$/ },
  vote: { method: 'POST', path: /^\/api\/v1\/polls\/\d+\/vote$/ },
  createCharacter: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/characters$/ },
  approveCharacter: { method: 'POST', path: /^\/api\/v1\/characters\/\d+\/approve$/ },
  renameCharacter: { method: 'PUT', path: /^\/api\/v1\/characters\/\d+\/rename$/ },
  setCharacterData: { method: 'POST', path: /^\/api\/v1\/characters\/\d+\/data$/ },
  applyToGame: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/apply$/ },
  withdrawApplication: { method: 'DELETE', path: /^\/api\/v1\/games\/\d+\/application$/ },
  reviewApplication: { method: 'PUT', path: /^\/api\/v1\/games\/\d+\/applications\/\d+\/review$/ },
  updateGameState: { method: 'PUT', path: /^\/api\/v1\/games\/\d+\/state$/ },
  deleteGame: { method: 'DELETE', path: /^\/api\/v1\/games\/\d+$/ },
  addModerator: { method: 'POST', path: /^\/api\/v1\/communities\/[^/]+\/moderators$/ },
  removeModerator: { method: 'DELETE', path: /^\/api\/v1\/communities\/[^/]+\/moderators\/\d+$/ },
  banFromCommunity: { method: 'POST', path: /^\/api\/v1\/communities\/[^/]+\/bans$/ },
  unbanFromCommunity: { method: 'DELETE', path: /^\/api\/v1\/communities\/[^/]+\/bans\/\d+$/ },
  createDocument: { method: 'POST', path: /^\/api\/v1\/communities\/[^/]+\/documents$/ },
  updateDocument: { method: 'PATCH', path: /^\/api\/v1\/communities\/[^/]+\/documents\/\d+$/ },
  updateCommunity: { method: 'PATCH', path: /^\/api\/v1\/communities\/[^/]+$/ },
  adminCreateCommunity: { method: 'POST', path: /^\/api\/v1\/admin\/communities$/ },
  promoteToCoGm: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/participants\/\d+\/promote-to-co-gm$/ },
  demoteFromCoGm: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/participants\/\d+\/demote-from-co-gm$/ },
  moveToAudience: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/participants\/\d+\/to-audience$/ },
  toggleCommentRead: { method: 'POST', path: /^\/api\/v1\/games\/\d+\/posts\/\d+\/comments\/\d+\/toggle-read$/ },
  favoriteComment: { method: 'PUT', path: /^\/api\/v1\/comments\/\d+\/favorite$/ },
  markAllNotificationsRead: { method: 'PUT', path: /^\/api\/v1\/notifications\/mark-all-read$/ },
} satisfies Record<string, MutationMatch>;
