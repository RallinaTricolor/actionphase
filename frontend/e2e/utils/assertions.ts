import { Page, Locator, expect } from '@playwright/test';

/**
 * Common Assertion Utilities for E2E Tests
 *
 * Reusable assertion patterns to reduce test code duplication.
 */

/**
 * Assert that text is visible on the page
 * @param page - Playwright page object
 * @param text - Text to check for
 * @param options - Assertion options
 */
export async function assertTextVisible(
  page: Page,
  text: string,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout ?? 5000;
  await expect(page.locator(`text=${text}`).first()).toBeVisible({ timeout });
}

/**
 * Assert that text is NOT visible on the page
 * @param page - Playwright page object
 * @param text - Text to check for
 * @param options - Assertion options
 */
export async function assertTextNotVisible(
  page: Page,
  text: string,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout ?? 5000;
  await expect(page.locator(`text=${text}`).first()).toBeHidden({ timeout });
}

/**
 * Assert that an element exists on the page
 * @param locator - Playwright locator
 * @param options - Assertion options
 */
export async function assertElementExists(
  locator: Locator,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout ?? 5000;
  await expect(locator).toBeVisible({ timeout });
}

/**
 * Assert that an element has specific text content
 * @param locator - Playwright locator
 * @param text - Expected text
 * @param options - Assertion options
 */
export async function assertElementText(
  locator: Locator,
  text: string,
  options: { timeout?: number; exact?: boolean } = {}
) {
  const timeout = options.timeout ?? 5000;

  if (options.exact) {
    await expect(locator).toHaveText(text, { timeout });
  } else {
    await expect(locator).toContainText(text, { timeout });
  }
}

/**
 * Assert that an element has a specific attribute value
 * @param locator - Playwright locator
 * @param attribute - Attribute name
 * @param value - Expected attribute value
 */
export async function assertAttribute(
  locator: Locator,
  attribute: string,
  value: string | RegExp
) {
  await expect(locator).toHaveAttribute(attribute, value);
}

/**
 * Assert that a button is enabled
 * @param page - Playwright page object
 * @param buttonText - Button text
 */
export async function assertButtonEnabled(page: Page, buttonText: string) {
  const button = page.locator(`button:has-text("${buttonText}")`);
  await expect(button).toBeEnabled();
}

/**
 * Assert that a button is disabled
 * @param page - Playwright page object
 * @param buttonText - Button text
 */
export async function assertButtonDisabled(page: Page, buttonText: string) {
  const button = page.locator(`button:has-text("${buttonText}")`);
  await expect(button).toBeDisabled();
}

/**
 * Assert that a form field has a specific value
 * @param page - Playwright page object
 * @param fieldName - Field name attribute
 * @param expectedValue - Expected field value
 */
export async function assertFieldValue(
  page: Page,
  fieldName: string,
  expectedValue: string
) {
  const field = page.locator(`input[name="${fieldName}"], textarea[name="${fieldName}"]`);
  await expect(field).toHaveValue(expectedValue);
}

/**
 * Assert that the current URL matches a pattern
 * @param page - Playwright page object
 * @param pattern - URL pattern (string or regex)
 */
export async function assertUrl(page: Page, pattern: string | RegExp) {
  await expect(page).toHaveURL(pattern);
}

/**
 * Assert that a specific number of elements exist
 * @param locator - Playwright locator
 * @param count - Expected count
 */
export async function assertElementCount(locator: Locator, count: number) {
  await expect(locator).toHaveCount(count);
}

/**
 * Assert that a modal/dialog is visible
 * @param page - Playwright page object
 * @param modalTitle - Optional modal title to check
 */
export async function assertModalVisible(page: Page, modalTitle?: string) {
  if (modalTitle) {
    await assertTextVisible(page, modalTitle);
  } else {
    const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]');
    await expect(modal).toBeVisible();
  }
}

/**
 * Assert that a toast/notification appears with specific text
 * @param page - Playwright page object
 * @param text - Expected notification text
 */
export async function assertNotification(page: Page, text: string) {
  const notification = page.locator('[role="alert"], .toast, .notification').filter({ hasText: text });
  await expect(notification.first()).toBeVisible({ timeout: 5000 });
}

/**
 * Assert that user is on the correct game page
 * @param page - Playwright page object
 * @param gameId - Expected game ID
 */
export async function assertOnGamePage(page: Page, gameId: number) {
  await assertUrl(page, new RegExp(`/games/${gameId}`));
}

/**
 * Assert that a table row contains specific text
 * @param page - Playwright page object
 * @param rowText - Text that should be in the row
 */
export async function assertTableRowExists(page: Page, rowText: string) {
  const row = page.locator(`tr:has-text("${rowText}")`);
  await expect(row).toBeVisible();
}

/**
 * Assert element has specific CSS class
 * @param locator - Playwright locator
 * @param className - Expected class name
 */
export async function assertHasClass(locator: Locator, className: string) {
  await expect(locator).toHaveClass(new RegExp(className));
}

/**
 * Assert element is checked (for checkboxes/radio buttons)
 * @param locator - Playwright locator
 */
export async function assertChecked(locator: Locator) {
  await expect(locator).toBeChecked();
}

/**
 * Assert element is not checked
 * @param locator - Playwright locator
 */
export async function assertNotChecked(locator: Locator) {
  await expect(locator).not.toBeChecked();
}
