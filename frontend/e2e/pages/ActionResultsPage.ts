import { Page } from '@playwright/test';
import { navigateToGameTab } from '../utils/navigation';

/**
 * Page Object for Action Results (History)
 *
 * Handles viewing action results and game history
 * Results are accessed via the game's History tab
 */
export class ActionResultsPage {
  readonly page: Page;
  readonly gameId: number;

  constructor(page: Page, gameId: number) {
    this.page = page;
    this.gameId = gameId;
  }

  /**
   * Navigate to game's history tab
   */
  async goto() {
    await this.page.goto(`/games/${this.gameId}`);
    await this.page.waitForLoadState('networkidle');

    // Navigate to History tab (handles mobile select and desktop tabs)
    await navigateToGameTab(this.page, 'History');
  }

  /**
   * Reveal a result's full text, whether or not it is collapsed.
   *
   * Results collapse only when their rendered height overflows, so whether a
   * "Show full content" toggle exists depends on how tall the content actually
   * renders — not on its character count. Short-but-published results show no
   * toggle at all and are already fully visible, so this expands when there is
   * something to expand and is a no-op otherwise.
   */
  async expandResultsIfCollapsed() {
    const toggle = this.page.getByRole('button', { name: 'Show full content' }).first();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    }
  }

  /**
   * View results for a specific phase
   *
   * @param phaseNumber - Phase number to view
   */
  async viewPhaseResults(phaseNumber: number) {
    // Look for phase selector or phase link
    const phaseSelector = this.page.locator(`button:has-text("Phase ${phaseNumber}"), a:has-text("Phase ${phaseNumber}")`);

    await phaseSelector.waitFor({ state: 'visible', timeout: 5000 });
    await phaseSelector.click();
    await this.page.waitForLoadState('networkidle');

    // Click on the Results tab (phase view shows Submissions/Results tabs)
    await this.clickResultsTab();
  }

  /**
   * Click on the Results tab within a phase view
   */
  async clickResultsTab() {
    const resultsTab = this.page.getByRole('button', { name: 'Results', exact: true });
    await resultsTab.waitFor({ state: 'visible', timeout: 5000 });
    await resultsTab.click();
    await this.page.waitForLoadState('networkidle');
  }

}
