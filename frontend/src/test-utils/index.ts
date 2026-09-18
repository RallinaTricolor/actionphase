/**
 * Test utilities barrel.
 *
 * ⚠️ Importing anything from this file loads EVERY module below, because ESM has
 * no tree-shaking at test runtime -- Vite transforms and executes the whole
 * graph regardless of what you destructure. `./render` alone pulls in six
 * context providers, and `./utilityDrawer` pulls in the entire UI library.
 *
 * Measured (2026-09-18), cost of a single import in an otherwise empty test file:
 *
 *   test-utils/factories   42ms      <- direct
 *   test-utils/index      1.36s      <- this barrel
 *
 * So a test that wants one `makeCharacter` pays ~1.3s for providers it never
 * renders. Across 18 such files that was 2.8s of wall clock and 13.5s of
 * cumulative import work.
 *
 * Import the specific module instead:
 *
 *   import { makeCharacter } from '../test-utils/factories'
 *   import { renderWithProviders } from '../test-utils/render'
 *   import { stubIntersectionObserver } from '../test-utils/mockIntersectionObserver'
 *   import { stubRenderedHeight } from '../test-utils/renderedHeight'
 *   import { UtilityDrawerHarness } from '../test-utils/utilityDrawer'
 *
 * Factories are deliberately NOT re-exported here: they are the cheap, most-used
 * half, and re-exporting them is what dragged the expensive half into files that
 * only wanted a fixture. Everything below already costs what it costs.
 */
export * from './render'
export * from './mockIntersectionObserver'
export * from './utilityDrawer'
