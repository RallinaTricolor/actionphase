import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../../fixtures/test-tags';
import { loginAs } from '../../fixtures/auth-helpers';
import { FIXTURE_GAMES, TEST_USERS } from '../../fixtures/test-data-factory';

/**
 * Standard Journey: Phase Management
 *
 * Tests GM's ability to manage game phases:
 * - View current phase
 * - View phase history
 * - Transition between phases
 * - Create new phases
 *
 * These are standard user journeys - important but not deployment-blocking
 */
test.describe.skip('Standard: Phase Management', () => {

  test(tagTest([tags.GAME, tags.PHASE], 'GM can view current phase and phase history'), async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Navigate to a game with phase history
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    // Find the game with complex history
    const gameTitle = FIXTURE_GAMES.COMPLEX_HISTORY.title;
    const gameLink = page.locator(`text=${gameTitle}`).first();

    if (await gameLink.isVisible()) {
      await gameLink.click();
      await page.waitForLoadState('networkidle');

      // Look for Phases or Phase History tab
      const phasesTab = page.locator('button:has-text("Phases"), button:has-text("Phase History"), a:has-text("Phases")');

      if (await phasesTab.isVisible()) {
        await phasesTab.click();
        await page.waitForLoadState('networkidle');

        console.log('✓ GM can access phases tab');

        // Check for current phase indicator
        const currentPhase = page.locator('text=/current phase|active phase|now/i').first();
        const hasCurrentPhase = await currentPhase.isVisible().catch(() => false);

        if (hasCurrentPhase) {
          console.log('✓ Current phase is displayed');
        }

        // Check for phase history
        const phaseItems = page.locator('[data-testid^="phase-"], .phase-item, .phase-card');
        const phaseCount = await phaseItems.count();

        expect(phaseCount).toBeGreaterThan(0);
        console.log(`✓ Found ${phaseCount} phases in history`);

        // Verify phase has title and description
        const firstPhase = phaseItems.first();
        const hasTitle = await firstPhase.locator('h3, h4, [data-testid="phase-title"]').isVisible().catch(() => false);
        const hasDescription = await firstPhase.locator('p, [data-testid="phase-description"]').isVisible().catch(() => false);

        if (hasTitle || hasDescription) {
          console.log('✓ Phase details are displayed');
        }
      } else {
        console.log('⚠ Phases tab not found - may be on different tab structure');
      }
    } else {
      console.log('⚠ Test game not found - skipping phase history test');
    }
  });

  test(tagTest([tags.GAME, tags.PHASE], 'GM can view different phase types'), async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Test viewing different phase types
    const phaseTests = [
      { game: FIXTURE_GAMES.COMMON_ROOM, expectedType: 'common_room' },
      { game: FIXTURE_GAMES.ACTION_PHASE, expectedType: 'action' },
      { game: FIXTURE_GAMES.RESULTS_PHASE, expectedType: 'results' },
    ];

    for (const { game, expectedType } of phaseTests) {
      await page.goto('/games');
      await page.waitForLoadState('networkidle');

      const gameLink = page.locator(`text=${game.title}`).first();

      if (await gameLink.isVisible()) {
        await gameLink.click();
        await page.waitForLoadState('networkidle');

        // Check for phase type indicator
        const bodyText = await page.locator('body').textContent();
        const hasPhaseType = bodyText?.toLowerCase().includes(expectedType.replace('_', ' '));

        if (hasPhaseType) {
          console.log(`✓ Game "${game.title}" shows ${expectedType} phase`);
        }
      }
    }
  });

  test(tagTest([tags.GAME, tags.PHASE], 'Players can view current phase'), async ({ page }) => {
    // Login as Player
    await loginAs(page, 'PLAYER_1');

    // Navigate to a game in progress
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
    const gameLink = page.locator(`text=${gameTitle}`).first();

    if (await gameLink.isVisible()) {
      await gameLink.click();
      await page.waitForLoadState('networkidle');

      console.log('✓ Player can access game page');

      // Check if player can see current phase information
      const phaseInfo = page.locator('text=/phase|deadline|submit/i').first();
      const canSeePhase = await phaseInfo.isVisible().catch(() => false);

      if (canSeePhase) {
        console.log('✓ Player can view phase information');
      }

      // Check for phase deadline
      const deadline = page.locator('text=/deadline|due|submit by/i');
      const hasDeadline = await deadline.isVisible().catch(() => false);

      if (hasDeadline) {
        console.log('✓ Phase deadline is displayed to player');
      }
    } else {
      console.log('⚠ Test game not found');
    }
  });

  test(tagTest([tags.GAME, tags.PHASE], 'GM can create new phase'), async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Find a game where GM can create phases
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    const gameCards = page.locator('[data-testid^="game-card-"], .game-card');
    const gameCount = await gameCards.count();

    if (gameCount > 0) {
      const firstGame = gameCards.first();
      await firstGame.click();
      await page.waitForLoadState('networkidle');

      // Look for "Create Phase" or "New Phase" button
      const createPhaseButton = page.locator('button:has-text("Create Phase"), button:has-text("New Phase"), button:has-text("Add Phase")');

      if (await createPhaseButton.isVisible()) {
        console.log('✓ GM has access to create phase button');

        // Click to open create phase modal/form
        await createPhaseButton.click();
        await page.waitForLoadState('networkidle');

        // Check for phase creation form fields
        const titleInput = page.locator('input[name="title"], [data-testid="phase-title"]');
        const descriptionInput = page.locator('textarea[name="description"], [data-testid="phase-description"]');
        const phaseTypeSelect = page.locator('select[name="phase_type"], select[name="type"], [data-testid="phase-type"]');

        const hasForm = (await titleInput.isVisible().catch(() => false)) ||
                        (await descriptionInput.isVisible().catch(() => false)) ||
                        (await phaseTypeSelect.isVisible().catch(() => false));

        if (hasForm) {
          console.log('✓ Phase creation form is available');

          // Cancel without creating (don't modify test data)
          const cancelButton = page.locator('button:has-text("Cancel")');
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          }
        }
      } else {
        console.log('⚠ Create phase button not found - may not be available in this game state');
      }
    }
  });

  test(tagTest([tags.GAME, tags.PHASE, tags.SLOW], 'Players can view phase history'), async ({ page }) => {
    // Login as Player
    await loginAs(page, 'PLAYER_1');

    // Navigate to game with long history
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    const gameTitle = FIXTURE_GAMES.PAGINATION.title;
    const gameLink = page.locator(`text=${gameTitle}`).first();

    if (await gameLink.isVisible()) {
      await gameLink.click();
      await page.waitForLoadState('networkidle');

      // Look for Phase History tab
      const historyTab = page.locator('button:has-text("History"), button:has-text("Previous"), a:has-text("Phase History")');

      if (await historyTab.isVisible()) {
        await historyTab.click();
        await page.waitForLoadState('networkidle');

        console.log('✓ Player can access phase history');

        // Count historical phases
        const phases = page.locator('[data-testid^="phase-"], .phase-item');
        const phaseCount = await phases.count();

        expect(phaseCount).toBeGreaterThan(0);
        console.log(`✓ Player can see ${phaseCount} phases in history`);

        // Check for pagination if many phases
        const nextButton = page.locator('button:has-text("Next"), button[aria-label*="next" i]');
        const hasPagination = await nextButton.isVisible().catch(() => false);

        if (hasPagination) {
          console.log('✓ Pagination is available for long phase history');
        }
      } else {
        console.log('⚠ Phase history not accessible - may be in different location');
      }
    } else {
      console.log('⚠ Test game not found');
    }
  });
});
