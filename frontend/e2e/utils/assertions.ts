import { Page, expect } from '@playwright/test';

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
  // Filter to visible element (viewport-agnostic for dual-DOM pattern)
  await expect(page.locator(`text=${text}`).locator('visible=true').first()).toBeVisible({ timeout });
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
 * Assert the page cannot be scrolled sideways.
 *
 * Mobile overflow usually looks fine -- the overflowing element is often a
 * button just past the right edge, or an invisible tooltip panel that still
 * takes up layout space -- so a screenshot will not catch it. The only reliable
 * signal is the document being wider than the viewport.
 *
 * On failure, the message names the innermost elements that stick out past the
 * viewport (ignoring anything inside a scroll or clip container, which cannot
 * widen the page), so the offending component is identifiable from CI output.
 */
export async function assertNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth <= viewportWidth) return { viewportWidth, scrollWidth, offenders: [] };

    const insideClippingAncestor = (element: Element) => {
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowX !== 'visible') return true;
      }
      return false;
    };
    const overflowing = [...document.body.querySelectorAll('*')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.right > viewportWidth + 1 && !insideClippingAncestor(element);
    });
    const offenders = overflowing
      .filter((element) => !overflowing.some((other) => other !== element && element.contains(other)))
      .slice(0, 5)
      .map((element) => {
        const testId = element.closest('[data-testid]')?.getAttribute('data-testid');
        const text = (element as HTMLElement).innerText?.trim().slice(0, 40) ?? '';
        return `<${element.tagName.toLowerCase()}> near [data-testid=${testId}] "${text}" right=${Math.round(element.getBoundingClientRect().right)}`;
      });
    return { viewportWidth, scrollWidth, offenders };
  });

  expect(
    result.scrollWidth,
    `Page scrolls horizontally (${result.scrollWidth}px wide in a ${result.viewportWidth}px viewport). Overflowing:\n  ${result.offenders.join('\n  ')}`
  ).toBeLessThanOrEqual(result.viewportWidth);
}
