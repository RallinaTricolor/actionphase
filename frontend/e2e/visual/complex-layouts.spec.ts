import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { FIXTURE_GAMES } from '../fixtures/test-data-factory';

/**
 * Visual Regression Tests - Complex Layouts
 *
 * These tests capture screenshots of complete page layouts with multiple sections,
 * tabs, and complex UI components to detect unintended visual changes.
 *
 * SKIPPED: Visual regression tests are skipped by default to speed up test suite.
 * To run: npx playwright test e2e/visual/complex-layouts.spec.ts
 *
 * Running tests:
 *   npm run test:e2e -- visual/complex-layouts.spec.ts
 *
 * Updating baselines:
 *   npm run test:e2e -- visual/complex-layouts.spec.ts --update-snapshots
 */

test.describe.skip('Visual Regression - Complex Layouts', () => {
  test.describe('Game Page - All Tabs', () => {
    test('Game page - Overview tab - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      // Navigate to game
      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Wait for dynamic content

      // Ensure we're on Overview tab
      const overviewTab = page.locator('[data-testid="tab-overview"], button:has-text("Overview"), a:has-text("Overview")').first();
      const tabExists = await overviewTab.isVisible().catch(() => false);
      if (tabExists) {
        await overviewTab.click();
        await page.waitForTimeout(500);
      }

      await expect(page).toHaveScreenshot('game-overview-light.png', {
        fullPage: true,
        maxDiffPixels: 200,
        mask: [
          page.locator('text=/\\d+[mhd] ago/'),
          page.locator('text=/just now/'),
        ],
      });
    });

    test('Game page - Overview tab - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const overviewTab = page.locator('[data-testid="tab-overview"], button:has-text("Overview"), a:has-text("Overview")').first();
      const tabExists = await overviewTab.isVisible().catch(() => false);
      if (tabExists) {
        await overviewTab.click();
        await page.waitForTimeout(500);
      }

      await expect(page).toHaveScreenshot('game-overview-dark.png', {
        fullPage: true,
        maxDiffPixels: 200,
        mask: [
          page.locator('text=/\\d+[mhd] ago/'),
          page.locator('text=/just now/'),
        ],
      });
    });

    test('Game page - Characters tab - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      // Click Characters tab
      const charactersTab = page.locator('[data-testid="tab-characters"], button:has-text("Characters"), a:has-text("Characters")').first();
      const tabExists = await charactersTab.isVisible().catch(() => false);
      if (tabExists) {
        await charactersTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('game-characters-tab-light.png', {
          fullPage: true,
          maxDiffPixels: 200,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
          ],
        });
      }
    });

    test('Game page - Characters tab - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const charactersTab = page.locator('[data-testid="tab-characters"], button:has-text("Characters"), a:has-text("Characters")').first();
      const tabExists = await charactersTab.isVisible().catch(() => false);
      if (tabExists) {
        await charactersTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('game-characters-tab-dark.png', {
          fullPage: true,
          maxDiffPixels: 200,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
          ],
        });
      }
    });

    test('Game page - Posts tab - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      // Click Posts/Timeline tab
      const postsTab = page.locator('[data-testid="tab-posts"], [data-testid="tab-timeline"], button:has-text("Posts"), button:has-text("Timeline"), a:has-text("Posts"), a:has-text("Timeline")').first();
      const tabExists = await postsTab.isVisible().catch(() => false);
      if (tabExists) {
        await postsTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('game-posts-tab-light.png', {
          fullPage: true,
          maxDiffPixels: 250,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/just now/'),
          ],
        });
      }
    });

    test('Game page - Posts tab - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const postsTab = page.locator('[data-testid="tab-posts"], [data-testid="tab-timeline"], button:has-text("Posts"), button:has-text("Timeline"), a:has-text("Posts"), a:has-text("Timeline")').first();
      const tabExists = await postsTab.isVisible().catch(() => false);
      if (tabExists) {
        await postsTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('game-posts-tab-dark.png', {
          fullPage: true,
          maxDiffPixels: 250,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/just now/'),
          ],
        });
      }
    });
  });

  test.describe('Character Sheet - Complete View', () => {
    test('Character sheet - full view - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      // Navigate to game
      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      // Try to access character sheet
      // Look for character name or "View Character" button
      const characterLink = page.locator('[data-testid="character-link"], [data-testid="view-character"], a:has-text("View Character")').first();
      const linkExists = await characterLink.isVisible().catch(() => false);

      if (linkExists) {
        await characterLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('character-sheet-full-light.png', {
          fullPage: true,
          maxDiffPixels: 200,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
          ],
        });
      }
    });

    test('Character sheet - full view - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const characterLink = page.locator('[data-testid="character-link"], [data-testid="view-character"], a:has-text("View Character")').first();
      const linkExists = await characterLink.isVisible().catch(() => false);

      if (linkExists) {
        await characterLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('character-sheet-full-dark.png', {
          fullPage: true,
          maxDiffPixels: 200,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
          ],
        });
      }
    });

    test('Character sheet - abilities section - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const characterLink = page.locator('[data-testid="character-link"], [data-testid="view-character"], a:has-text("View Character")').first();
      const linkExists = await characterLink.isVisible().catch(() => false);

      if (linkExists) {
        await characterLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Capture abilities section if it exists
        const abilitiesSection = page.locator('[data-testid="abilities-section"], [data-testid="character-abilities"], section:has-text("Abilities")').first();
        const sectionExists = await abilitiesSection.isVisible().catch(() => false);

        if (sectionExists) {
          await expect(abilitiesSection).toHaveScreenshot('character-abilities-light.png', {
            maxDiffPixels: 100,
          });
        }
      }
    });

    test('Character sheet - inventory section - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const characterLink = page.locator('[data-testid="character-link"], [data-testid="view-character"], a:has-text("View Character")').first();
      const linkExists = await characterLink.isVisible().catch(() => false);

      if (linkExists) {
        await characterLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Capture inventory section if it exists
        const inventorySection = page.locator('[data-testid="inventory-section"], [data-testid="character-inventory"], section:has-text("Inventory")').first();
        const sectionExists = await inventorySection.isVisible().catch(() => false);

        if (sectionExists) {
          await expect(inventorySection).toHaveScreenshot('character-inventory-light.png', {
            maxDiffPixels: 100,
          });
        }
      }
    });
  });

  test.describe('History - Timeline View', () => {
    test('History - full timeline - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      // Use game with complex history
      const gameTitle = FIXTURE_GAMES.COMPLEX_HISTORY.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      // Navigate to History tab
      const historyTab = page.locator('[data-testid="tab-history"], [data-testid="tab-phases"], button:has-text("History"), button:has-text("Phases"), a:has-text("History"), a:has-text("Phases")').first();
      const tabExists = await historyTab.isVisible().catch(() => false);

      if (tabExists) {
        await historyTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('phase-history-timeline-light.png', {
          fullPage: true,
          maxDiffPixels: 250,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/just now/'),
            // Mask specific dates
            page.locator('text=/\\d{4}-\\d{2}-\\d{2}/'),
          ],
        });
      }
    });

    test('Phase history - full timeline - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.COMPLEX_HISTORY.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const historyTab = page.locator('[data-testid="tab-history"], [data-testid="tab-phases"], button:has-text("History"), button:has-text("Phases"), a:has-text("History"), a:has-text("Phases")').first();
      const tabExists = await historyTab.isVisible().catch(() => false);

      if (tabExists) {
        await historyTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('phase-history-timeline-dark.png', {
          fullPage: true,
          maxDiffPixels: 250,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/just now/'),
            page.locator('text=/\\d{4}-\\d{2}-\\d{2}/'),
          ],
        });
      }
    });

    test('Phase history - with pagination - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      // Use game with many phases (requires pagination)
      const gameTitle = FIXTURE_GAMES.PAGINATION.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const historyTab = page.locator('[data-testid="tab-history"], [data-testid="tab-phases"], button:has-text("History"), button:has-text("Phases"), a:has-text("History"), a:has-text("Phases")').first();
      const tabExists = await historyTab.isVisible().catch(() => false);

      if (tabExists) {
        await historyTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Check for pagination controls
        const paginationExists = await page.locator('[data-testid="pagination"], nav[aria-label="Pagination"], button:has-text("Next"), button:has-text("Previous")').first().isVisible().catch(() => false);

        if (paginationExists) {
          await expect(page).toHaveScreenshot('phase-history-pagination-light.png', {
            fullPage: true,
            maxDiffPixels: 250,
            mask: [
              page.locator('text=/\\d+[mhd] ago/'),
              page.locator('text=/just now/'),
              page.locator('text=/\\d{4}-\\d{2}-\\d{2}/'),
            ],
          });
        }
      }
    });
  });

  test.describe('Admin Dashboard - User Management', () => {
    test('Admin dashboard - users list - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'GM'); // GM might have admin access

      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Check if admin page exists and is accessible
      const adminContent = page.locator('h1:has-text("Admin"), h1:has-text("Dashboard"), [data-testid="admin-dashboard"]');
      const hasAccess = await adminContent.isVisible().catch(() => false);

      if (hasAccess) {
        await expect(page).toHaveScreenshot('admin-dashboard-light.png', {
          fullPage: true,
          maxDiffPixels: 200,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/just now/'),
            // Mask email addresses if present
            page.locator('text=/@/'),
          ],
        });
      }
    });

    test('Admin dashboard - users list - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'GM');

      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const adminContent = page.locator('h1:has-text("Admin"), h1:has-text("Dashboard"), [data-testid="admin-dashboard"]');
      const hasAccess = await adminContent.isVisible().catch(() => false);

      if (hasAccess) {
        await expect(page).toHaveScreenshot('admin-dashboard-dark.png', {
          fullPage: true,
          maxDiffPixels: 200,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/just now/'),
            page.locator('text=/@/'),
          ],
        });
      }
    });

    test('Admin dashboard - games management - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'GM');

      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Navigate to games management tab if it exists
      const gamesTab = page.locator('[data-testid="admin-games-tab"], button:has-text("Games"), a:has-text("Games")').first();
      const tabExists = await gamesTab.isVisible().catch(() => false);

      if (tabExists) {
        await gamesTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('admin-games-management-light.png', {
          fullPage: true,
          maxDiffPixels: 200,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/just now/'),
          ],
        });
      }
    });
  });

  test.describe('Conversations - Thread View', () => {
    test('Conversations - thread list - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      // Navigate to Conversations/Messages tab
      const conversationsTab = page.locator('[data-testid="tab-conversations"], [data-testid="tab-messages"], button:has-text("Conversations"), button:has-text("Messages"), a:has-text("Conversations"), a:has-text("Messages")').first();
      const tabExists = await conversationsTab.isVisible().catch(() => false);

      if (tabExists) {
        await conversationsTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('conversations-list-light.png', {
          fullPage: true,
          maxDiffPixels: 200,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/just now/'),
          ],
        });
      }
    });

    test('Conversations - thread list - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const conversationsTab = page.locator('[data-testid="tab-conversations"], [data-testid="tab-messages"], button:has-text("Conversations"), button:has-text("Messages"), a:has-text("Conversations"), a:has-text("Messages")').first();
      const tabExists = await conversationsTab.isVisible().catch(() => false);

      if (tabExists) {
        await conversationsTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('conversations-list-dark.png', {
          fullPage: true,
          maxDiffPixels: 200,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/just now/'),
          ],
        });
      }
    });

    test('Conversations - single thread with messages - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const conversationsTab = page.locator('[data-testid="tab-conversations"], [data-testid="tab-messages"], button:has-text("Conversations"), button:has-text("Messages"), a:has-text("Conversations"), a:has-text("Messages")').first();
      const tabExists = await conversationsTab.isVisible().catch(() => false);

      if (tabExists) {
        await conversationsTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Click first conversation thread
        const firstThread = page.locator('[data-testid="conversation-item"], [data-testid="message-thread"]').first();
        const threadExists = await firstThread.isVisible().catch(() => false);

        if (threadExists) {
          await firstThread.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);

          await expect(page).toHaveScreenshot('conversation-thread-light.png', {
            fullPage: true,
            maxDiffPixels: 200,
            mask: [
              page.locator('text=/\\d+[mhd] ago/'),
              page.locator('text=/just now/'),
            ],
          });
        }
      }
    });
  });
});
