import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { FIXTURE_GAMES } from '../fixtures/test-data-factory';

/**
 * Visual Regression Tests - Component Variations
 *
 * These tests capture screenshots of UI components in different states and variants
 * to ensure consistent styling across the application.
 *
 * SKIPPED: Visual regression tests are skipped by default to speed up test suite.
 * To run: npx playwright test e2e/visual/component-variations.spec.ts
 *
 * Running tests:
 *   npm run test:e2e -- visual/component-variations.spec.ts
 *
 * Updating baselines:
 *   npm run test:e2e -- visual/component-variations.spec.ts --update-snapshots
 */

test.describe.skip('Visual Regression - Component Variations', () => {
  test.describe('Button Variants', () => {
    test('Button variants - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'GM');

      // Navigate to a page with multiple button variants
      await page.goto('/games/create');
      await page.waitForLoadState('networkidle');

      // Capture button area
      const form = page.locator('form').first();
      await expect(form).toHaveScreenshot('buttons-light.png', {
        maxDiffPixels: 50,
      });
    });

    test('Button variants - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'GM');

      await page.goto('/games/create');
      await page.waitForLoadState('networkidle');

      const form = page.locator('form').first();
      await expect(form).toHaveScreenshot('buttons-dark.png', {
        maxDiffPixels: 50,
      });
    });

    test('Button states - hover and disabled', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Get submit button in disabled state (empty form)
      const submitButton = page.locator('[data-testid="login-submit"]');
      await expect(submitButton).toHaveScreenshot('button-disabled.png', {
        maxDiffPixels: 20,
      });

      // Fill form to enable button
      await page.fill('[data-testid="login-username"]', 'test');
      await page.fill('[data-testid="login-password"]', 'test');

      await expect(submitButton).toHaveScreenshot('button-enabled.png', {
        maxDiffPixels: 20,
      });
    });
  });

  test.describe('Card Variants', () => {
    test('Card variants - light mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      // Games page has multiple card variants
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      // Capture first game card
      const gameCard = page.locator('[data-testid="game-card"], .game-card, [class*="game"]').first();
      const cardExists = await gameCard.isVisible().catch(() => false);

      if (cardExists) {
        await expect(gameCard).toHaveScreenshot('card-default-light.png', {
          maxDiffPixels: 100,
          mask: [
            // Mask dynamic content
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/\\d+ players?/'),
          ],
        });
      }
    });

    test('Card variants - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'PLAYER_1');

      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      const gameCard = page.locator('[data-testid="game-card"], .game-card, [class*="game"]').first();
      const cardExists = await gameCard.isVisible().catch(() => false);

      if (cardExists) {
        await expect(gameCard).toHaveScreenshot('card-default-dark.png', {
          maxDiffPixels: 100,
          mask: [
            page.locator('text=/\\d+[mhd] ago/'),
            page.locator('text=/\\d+ players?/'),
          ],
        });
      }
    });
  });

  test.describe('Form Components', () => {
    test('Form inputs - empty state', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Capture registration form
      const form = page.locator('form');
      await expect(form).toHaveScreenshot('form-empty-light.png', {
        maxDiffPixels: 50,
      });
    });

    test('Form inputs - with validation errors', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Fill with invalid data to trigger errors
      await page.fill('[data-testid="register-username"]', 'a'); // Too short
      await page.fill('[data-testid="register-email"]', 'invalid-email'); // Invalid format

      // Click submit to show errors
      await page.click('[data-testid="register-submit"]');
      await page.waitForTimeout(500); // Wait for validation

      // Check if errors are shown
      const errorMessage = page.locator('[data-testid="error-message"]');
      const hasError = await errorMessage.isVisible().catch(() => false);

      if (hasError) {
        const form = page.locator('form');
        await expect(form).toHaveScreenshot('form-with-errors-light.png', {
          maxDiffPixels: 100,
        });
      }
    });

    test('Form inputs - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      const form = page.locator('form');
      await expect(form).toHaveScreenshot('form-empty-dark.png', {
        maxDiffPixels: 50,
      });
    });

    test('Text inputs with labels', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'GM');

      await page.goto('/games/create');
      await page.waitForLoadState('networkidle');

      // Capture title input with label
      const titleInput = page.locator('[data-testid="game-title"]').locator('..');
      await expect(titleInput).toHaveScreenshot('input-with-label-light.png', {
        maxDiffPixels: 30,
      });
    });

    test('Textarea component', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'GM');

      await page.goto('/games/create');
      await page.waitForLoadState('networkidle');

      // Capture description textarea
      const descriptionField = page.locator('[data-testid="game-description"]').locator('..');
      await expect(descriptionField).toHaveScreenshot('textarea-light.png', {
        maxDiffPixels: 50,
      });
    });
  });

  test.describe('Modal Components', () => {
    test('Modal - apply to game', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.RECRUITING.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      // Navigate to recruiting game
      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      // Click Apply button to open modal
      const applyButton = page.locator('button:has-text("Apply"), button:has-text("Join")');
      const buttonExists = await applyButton.isVisible().catch(() => false);

      if (buttonExists) {
        await applyButton.click();
        await page.waitForTimeout(500); // Wait for modal animation

        // Capture modal
        const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]');
        const modalVisible = await modal.isVisible().catch(() => false);

        if (modalVisible) {
          await expect(modal).toHaveScreenshot('modal-apply-game-light.png', {
            maxDiffPixels: 100,
          });
        }
      }
    });

    test('Modal - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'PLAYER_1');

      const gameTitle = FIXTURE_GAMES.RECRUITING.title;
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      await page.locator(`text=${gameTitle}`).first().click();
      await page.waitForLoadState('networkidle');

      const applyButton = page.locator('button:has-text("Apply"), button:has-text("Join")');
      const buttonExists = await applyButton.isVisible().catch(() => false);

      if (buttonExists) {
        await applyButton.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]');
        const modalVisible = await modal.isVisible().catch(() => false);

        if (modalVisible) {
          await expect(modal).toHaveScreenshot('modal-apply-game-dark.png', {
            maxDiffPixels: 100,
          });
        }
      }
    });
  });

  test.describe('Alert Components', () => {
    test('Alert variants - on error page', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });

      // Try to access a non-existent page
      await page.goto('/nonexistent-page');
      await page.waitForLoadState('networkidle');

      // Should show 404 page with alert/message
      const errorContent = page.locator('body');
      await expect(errorContent).toHaveScreenshot('alert-404-light.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('Alert on login error', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Try to login with invalid credentials
      await page.fill('[data-testid="login-username"]', 'nonexistent');
      await page.fill('[data-testid="login-password"]', 'wrongpassword');
      await page.click('[data-testid="login-submit"]');

      // Wait for error message
      await page.waitForTimeout(1000);

      // Capture page with error alert
      const loginForm = page.locator('[data-testid="login-form"]').locator('..');
      await expect(loginForm).toHaveScreenshot('alert-login-error-light.png', {
        maxDiffPixels: 100,
      });
    });
  });

  test.describe('Badge Components', () => {
    test('Badge variants - game states', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await loginAs(page, 'PLAYER_1');

      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      // Capture games list with various state badges
      const gamesList = page.locator('body');
      await expect(gamesList).toHaveScreenshot('badges-game-states-light.png', {
        fullPage: true,
        maxDiffPixels: 150,
        mask: [
          page.locator('text=/\\d+[mhd] ago/'),
          page.locator('text=/\\d+ players?/'),
        ],
      });
    });

    test('Badge variants - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await loginAs(page, 'PLAYER_1');

      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      const gamesList = page.locator('body');
      await expect(gamesList).toHaveScreenshot('badges-game-states-dark.png', {
        fullPage: true,
        maxDiffPixels: 150,
        mask: [
          page.locator('text=/\\d+[mhd] ago/'),
          page.locator('text=/\\d+ players?/'),
        ],
      });
    });
  });

  test.describe('Spinner/Loading States', () => {
    test('Loading spinner', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });

      // Navigate to a page and capture loading state
      const pagePromise = page.goto('/dashboard');

      // Try to capture loading state (this is timing-dependent)
      await page.waitForTimeout(100);

      const spinner = page.locator('[class*="spin"], [class*="loading"]');
      const spinnerVisible = await spinner.isVisible().catch(() => false);

      if (spinnerVisible) {
        await expect(spinner).toHaveScreenshot('spinner-light.png', {
          maxDiffPixels: 50,
          animations: 'disabled', // Disable animations for consistent snapshots
        });
      }

      await pagePromise;
    });
  });
});
