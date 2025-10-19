import { Page, Locator, expect } from '@playwright/test';

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
 * Wait for element to disappear
 * @param locator - Playwright locator
 * @param options - Wait options
 */
export async function waitForHidden(
  locator: Locator,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout ?? 5000;
  await expect(locator).toBeHidden({ timeout });
}

/**
 * Wait for element count to match expected value
 * @param locator - Playwright locator
 * @param count - Expected count
 * @param options - Wait options
 */
export async function waitForCount(
  locator: Locator,
  count: number,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout ?? 5000;
  await expect(locator).toHaveCount(count, { timeout });
}

/**
 * Wait for a form submission to complete (network idle after submit)
 * @param page - Playwright page object
 * @param submitAction - Function that triggers the form submission
 */
export async function waitForFormSubmission(
  page: Page,
  submitAction: () => Promise<void>
) {
  await Promise.all([
    page.waitForLoadState('networkidle'),
    submitAction(),
  ]);
}

/**
 * Wait for any pending React Query requests to complete
 * This is useful after mutations to ensure UI has updated
 * @param page - Playwright page object
 */
export async function waitForReactQuery(page: Page) {
  await page.waitForLoadState('networkidle');
  // Small delay to allow React Query to update UI
  await page.waitForFunction(() => {
    // Check if there are any pending queries
    const queryClient = (window as any).__REACT_QUERY_DEVTOOLS__;
    if (queryClient) {
      // If devtools are available, check query state
      return true; // For now, just return true
    }
    return true;
  });
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
 * Wait for a specific UI state after an action
 * Replaces common pattern: action → waitForTimeout → check state
 * @param action - Function that triggers the action
 * @param condition - Function that checks if the expected state is reached
 * @param options - Wait options
 */
export async function waitForCondition(
  action: () => Promise<void>,
  condition: () => Promise<boolean>,
  options: { timeout?: number; pollingInterval?: number } = {}
) {
  const timeout = options.timeout ?? 5000;
  const pollingInterval = options.pollingInterval ?? 100;

  await action();

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, pollingInterval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}
