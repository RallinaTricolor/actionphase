import { Page, expect } from '@playwright/test';
import { navigateToGameAndTab } from '../utils/navigation';
import { waitForVisible } from '../utils/waits';

/**
 * Page Object Model for History Page
 *
 * Encapsulates all history viewing interactions including:
 * - Viewing phase history list
 * - Viewing phase details
 * - Navigating through published results
 * - Checking phase statuses
 */
export class HistoryPage {
  readonly page: Page;
  readonly gameId: number;

  constructor(page: Page, gameId: number) {
    this.page = page;
    this.gameId = gameId;
  }

  /**
   * Navigate to History tab for the game
   */
  async goto() {
    await navigateToGameAndTab(this.page, this.gameId, 'History');
  }

  /**
   * Get list of all phase titles in history
   */
  async getPhaseHistory(): Promise<string[]> {
    // Wait for history list to load
    await this.page.waitForLoadState('networkidle');

    // Get all phase title headings (level 4)
    const phaseTitles = await this.page.getByRole('heading', { level: 4 }).allTextContents();
    return phaseTitles;
  }

  /**
   * Get list of phase numbers displayed
   */
  async getPhaseNumbers(): Promise<string[]> {
    await this.page.waitForLoadState('networkidle');

    // Get all phase number spans
    const phaseSpans = this.page.locator('span').filter({ hasText: /^Phase \d+$/ });
    const numbers = await phaseSpans.allTextContents();
    return numbers;
  }

  /**
   * View details of a specific phase by its title
   */
  async viewPhaseDetails(phaseTitle: string) {
    const phaseButton = this.page.getByRole('button', { name: phaseTitle });
    await phaseButton.click();
    await this.page.waitForLoadState('networkidle');

    // Wait for Back button to appear
    await waitForVisible(this.page.getByRole('button', { name: 'Back to History' }));
  }

  /**
   * Navigate back from phase details to history list
   */
  async goBackToHistory() {
    const backButton = this.page.getByRole('button', { name: 'Back to History' });
    await backButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if phase has published results
   */
  async hasPublishedResults(): Promise<boolean> {
    // Check for any content indicating published results
    const resultsHeading = this.page.getByRole('heading', { name: /Results|Outcomes|Resolution/ });
    const hasResults = await resultsHeading.count() > 0;
    return hasResults;
  }

  /**
   * Check if a phase is marked as active
   */
  async hasActivePhase(): Promise<boolean> {
    const activeText = this.page.getByText('Active', { exact: true }).locator('visible=true').first();
    return await activeText.isVisible().catch(() => false);
  }

  /**
   * Verify we're on the history page
   */
  async verifyOnPage() {
    await expect(this.page.getByRole('heading', { name: 'History' })).toBeVisible({ timeout: 10000 });
  }

  /**
   * Verify a specific phase title exists in history
   */
  async verifyPhaseExists(phaseTitle: string) {
    const heading = this.page.getByRole('heading', { name: phaseTitle, level: 4 });
    await waitForVisible(heading);
  }

  /**
   * Get phase status badge text for a specific phase
   */
  async getPhaseStatus(phaseTitle: string): Promise<string> {
    // Find the phase row and get its status badge
    // Filter to visible element (viewport-agnostic for dual-DOM pattern)
    const phaseRow = this.page.locator('div').filter({ hasText: phaseTitle }).locator('visible=true').first();
    const statusBadge = phaseRow.locator('[role="status"]').or(phaseRow.locator('span')).locator('visible=true').first();
    return await statusBadge.textContent() || '';
  }

  /**
   * Check if Common Room content is visible in phase details
   */
  async hasCommonRoomContent(): Promise<boolean> {
    try {
      // Wait for page to settle after navigation
      await this.page.waitForLoadState('networkidle');

      // Look for Common Room heading with multiple strategies
      const commonRoomHeading = this.page.getByRole('heading', { name: /Common Room/i });
      const commonRoomText = this.page.getByText('Common Room', { exact: false });

      // Try heading first
      const hasHeading = await commonRoomHeading.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasHeading) return true;

      // Try text match - filter to visible element (viewport-agnostic)
      const hasText = await commonRoomText.locator('visible=true').first().isVisible({ timeout: 3000 }).catch(() => false);
      if (hasText) return true;

      // Also check for phase type indicators that suggest common_room content
      const phaseTypeIndicator = this.page.getByText(/Discussion|Roleplay/i);
      return await phaseTypeIndicator.locator('visible=true').first().isVisible({ timeout: 3000 }).catch(() => false);
    } catch {
      return false;
    }
  }
}
