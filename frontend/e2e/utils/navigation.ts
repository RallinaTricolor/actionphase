import { Page, expect } from '@playwright/test';

/**
 * Navigation Utilities for E2E Tests
 *
 * Centralized navigation functions to reduce repetition and improve reliability.
 * These functions replace direct page.goto + waitForTimeout patterns.
 */

/**
 * Navigate to a game details page with proper loading
 * @param page - Playwright page object
 * @param gameId - Game ID to navigate to
 */
export async function navigateToGame(page: Page, gameId: number) {
  await page.goto(`/games/${gameId}`);
  await page.waitForLoadState('networkidle');
  // Wait for game title to be visible (ensures page is loaded)
  await page.waitForSelector('h1, h2', { timeout: 5000 });
}

/**
 * Navigate to a tab on the game details page
 * @param page - Playwright page object
 * @param tabName - Name of the tab to navigate to
 */
export async function navigateToGameTab(page: Page, tabName: string) {
  // Click the tab button
  await page.click(`button:has-text("${tabName}")`);

  // Wait for network activity to settle (important for tabs that load data)
  await page.waitForLoadState('networkidle');

  // Wait for tab content to be visible
  // Different tabs have different indicators
  const tabIndicators: Record<string, string> = {
    'Common Room': 'h2:has-text("Common Room")',
    'Phases': 'h2:has-text("Phase Management")',
    'Applications': 'h2:has-text("Applications"), h3:has-text("Applications")',
    'Participants': 'h2:has-text("Participants"), h3:has-text("Participants")',
    'People': 'h2:has-text("Characters"), h3:has-text("Characters")',
    'Characters': 'h2:has-text("Characters")',
    'Actions': 'h2:has-text("Actions")',
    // Submit Action tab has variable content, so we just wait for networkidle
    'Messages': 'h2:has-text("Messages")',
    'History': 'h2:has-text("Phase History")',
  };

  const indicator = tabIndicators[tabName];
  if (indicator) {
    await page.waitForSelector(indicator, { timeout: 5000 });
  }
}

/**
 * Navigate to game and switch to specific tab
 * @param page - Playwright page object
 * @param gameId - Game ID to navigate to
 * @param tabName - Name of the tab to navigate to
 */
export async function navigateToGameAndTab(page: Page, gameId: number, tabName: string) {
  await navigateToGame(page, gameId);
  await navigateToGameTab(page, tabName);
}

/**
 * Navigate to dashboard
 * @param page - Playwright page object
 */
export async function navigateToDashboard(page: Page) {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('h1, h2', { timeout: 5000 });
}

/**
 * Navigate to games list
 * @param page - Playwright page object
 */
export async function navigateToGamesList(page: Page) {
  await page.goto('/games');
  await page.waitForLoadState('networkidle');
}

/**
 * Reload the current page and wait for it to be ready
 * @param page - Playwright page object
 */
export async function reloadPage(page: Page) {
  await page.reload();
  await page.waitForLoadState('networkidle');
}
