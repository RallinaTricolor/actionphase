/**
 * Centralized timeout configuration for E2E tests
 *
 * These constants provide consistent timeout values across all E2E tests
 * and make it easy to adjust timeouts based on environment or test requirements.
 */

/**
 * Default timeout for most UI interactions (5 seconds)
 * Use for: Button clicks, form submissions, basic element visibility
 */
export const DEFAULT_TIMEOUT = 5000;

/**
 * Medium timeout for moderate operations (10 seconds)
 * Use for: Page navigation, data fetching, modal appearances
 */
export const MEDIUM_TIMEOUT = 10000;

/**
 * Long timeout for heavy operations (15 seconds)
 * Use for: File uploads, complex API calls, batch operations
 */
export const LONG_TIMEOUT = 15000;

/**
 * Extra long timeout for very slow operations (30 seconds)
 * Use for: Large file processing, extensive data loading
 */
export const EXTRA_LONG_TIMEOUT = 30000;

/**
 * Short timeout for quick checks (2 seconds)
 * Use for: Element should NOT be visible, quick state checks
 */
export const SHORT_TIMEOUT = 2000;
