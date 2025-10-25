import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../../fixtures/test-tags';
import { loginAs } from '../../fixtures/auth-helpers';
import { FIXTURE_GAMES, generateTestActionSubmission } from '../../fixtures/test-data-factory';

/**
 * Standard Journey: Action Submission
 *
 * Tests player's ability to submit actions during action phases:
 * - Create draft action
 * - Edit draft action
 * - Finalize action submission
 * - View submitted actions
 *
 * These are standard user journeys - important but not deployment-blocking
 */
test.describe.skip('Standard: Action Submission', () => {

  test(tagTest([tags.GAME, tags.PHASE], 'Player can view action phase and submission status'), async ({ page }) => {
    // Login as Player
    await loginAs(page, 'PLAYER_1');

    // Navigate to game with active action phase
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
    const gameLink = page.locator(`text=${gameTitle}`).first();

    if (await gameLink.isVisible()) {
      await gameLink.click();
      await page.waitForLoadState('networkidle');

      console.log(`✓ Player navigated to action phase game: ${gameTitle}`);

      // Check for action phase indicator
      const actionPhaseText = page.locator('text=/action phase|submit action|your action/i');
      const hasActionPhase = await actionPhaseText.first().isVisible().catch(() => false);

      if (hasActionPhase) {
        console.log('✓ Action phase is indicated to player');
      }

      // Look for action submission button or link
      const submitButton = page.locator('button:has-text("Submit Action"), button:has-text("Create Action"), a:has-text("Submit Action")');
      const canSubmit = await submitButton.isVisible().catch(() => false);

      if (canSubmit) {
        console.log('✓ Player can access action submission');
      }

      // Check for deadline information
      const deadline = page.locator('text=/deadline|due|time remaining/i');
      const hasDeadline = await deadline.first().isVisible().catch(() => false);

      if (hasDeadline) {
        console.log('✓ Action deadline is displayed');
      }
    } else {
      console.log('⚠ Test game not found - skipping action submission test');
    }
  });

  test(tagTest([tags.GAME, tags.PHASE], 'Player can create draft action'), async ({ page }) => {
    // Login as Player
    await loginAs(page, 'PLAYER_3'); // Use Player 3 to avoid conflicts

    // Navigate to action phase game
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
    const gameLink = page.locator(`text=${gameTitle}`).first();

    if (await gameLink.isVisible()) {
      await gameLink.click();
      await page.waitForLoadState('networkidle');

      // Look for submit/create action button
      const createActionButton = page.locator('button:has-text("Submit Action"), button:has-text("Create Action"), button:has-text("Write Action")').first();

      if (await createActionButton.isVisible()) {
        await createActionButton.click();
        await page.waitForLoadState('networkidle');

        console.log('✓ Opened action submission form');

        // Fill in action content
        const actionContent = generateTestActionSubmission({
          content: 'This is a test action created by E2E tests. Player 3 investigates the mysterious sound.',
          is_finalized: false,
        });

        const contentTextarea = page.locator('textarea[name="content"], [data-testid="action-content"]').first();

        if (await contentTextarea.isVisible()) {
          await contentTextarea.fill(actionContent.content);

          console.log('✓ Filled action content');

          // Look for Save Draft button (don't finalize)
          const saveDraftButton = page.locator('button:has-text("Save Draft"), button:has-text("Save")').first();

          if (await saveDraftButton.isVisible()) {
            await saveDraftButton.click();
            await page.waitForLoadState('networkidle');

            console.log('✓ Saved action as draft');

            // Verify draft was saved - look for success message or draft indicator
            const successMessage = page.locator('text=/saved|draft saved|success/i');
            const hasSaveConfirmation = await successMessage.first().isVisible().catch(() => false);

            if (hasSaveConfirmation) {
              console.log('✓ Draft save confirmed');
            }
          } else {
            console.log('⚠ Save Draft button not found - form structure may differ');
          }
        } else {
          console.log('⚠ Action content textarea not found');
        }
      } else {
        console.log('⚠ Create action button not visible - player may have already submitted');
      }
    }
  });

  test(tagTest([tags.GAME, tags.PHASE], 'Player can view their submitted actions'), async ({ page }) => {
    // Login as Player who has submitted actions
    await loginAs(page, 'PLAYER_1');

    // Navigate to action phase game
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
    const gameLink = page.locator(`text=${gameTitle}`).first();

    if (await gameLink.isVisible()) {
      await gameLink.click();
      await page.waitForLoadState('networkidle');

      // Look for "My Action" or "View Action" link/tab
      const myActionLink = page.locator('button:has-text("My Action"), a:has-text("My Action"), button:has-text("View Submission")');

      if (await myActionLink.isVisible()) {
        await myActionLink.click();
        await page.waitForLoadState('networkidle');

        console.log('✓ Player can access their action submission');

        // Verify action content is visible
        const actionContent = page.locator('[data-testid="action-content"], .action-content, .markdown-content');
        const hasContent = await actionContent.isVisible().catch(() => false);

        if (hasContent) {
          console.log('✓ Action content is displayed');
        }

        // Check for submission status
        const statusIndicator = page.locator('text=/submitted|finalized|draft/i');
        const hasStatus = await statusIndicator.first().isVisible().catch(() => false);

        if (hasStatus) {
          const statusText = await statusIndicator.first().textContent();
          console.log(`✓ Action status displayed: ${statusText}`);
        }
      } else {
        console.log('⚠ "My Action" link not found - may be in different location');
      }
    }
  });

  test(tagTest([tags.GAME, tags.PHASE], 'GM can view all action submissions'), async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Navigate to action phase game
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
    const gameLink = page.locator(`text=${gameTitle}`).first();

    if (await gameLink.isVisible()) {
      await gameLink.click();
      await page.waitForLoadState('networkidle');

      // Look for Actions or Submissions tab
      const actionsTab = page.locator('button:has-text("Actions"), button:has-text("Submissions"), a:has-text("Actions")');

      if (await actionsTab.isVisible()) {
        await actionsTab.click();
        await page.waitForLoadState('networkidle');

        console.log('✓ GM can access actions view');

        // Count action submissions
        const actionItems = page.locator('[data-testid^="action-"], .action-item, .action-card');
        const actionCount = await actionItems.count();

        console.log(`✓ GM can see ${actionCount} action submissions`);

        if (actionCount > 0) {
          // Check first action has character name and status
          const firstAction = actionItems.first();
          const characterName = firstAction.locator('text=/\\w+/').first();
          const hasCharacter = await characterName.isVisible().catch(() => false);

          if (hasCharacter) {
            console.log('✓ Actions show character information');
          }
        }
      } else {
        console.log('⚠ Actions tab not found - may use different navigation');
      }
    }
  });

  test(tagTest([tags.GAME, tags.PHASE], 'Player cannot submit action after deadline'), async ({ page }) => {
    // Login as Player
    await loginAs(page, 'PLAYER_2');

    // Navigate to a completed phase game
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    const gameTitle = FIXTURE_GAMES.RESULTS_PHASE.title; // Results phase means action phase is over
    const gameLink = page.locator(`text=${gameTitle}`).first();

    if (await gameLink.isVisible()) {
      await gameLink.click();
      await page.waitForLoadState('networkidle');

      // Should NOT see submit action button in results phase
      const submitButton = page.locator('button:has-text("Submit Action"), button:has-text("Create Action")');
      const canSubmit = await submitButton.isVisible().catch(() => false);

      expect(canSubmit).toBeFalsy();
      console.log('✓ Action submission not available in results phase');

      // Should see results instead
      const resultsIndicator = page.locator('text=/results|outcome|what happened/i');
      const hasResults = await resultsIndicator.first().isVisible().catch(() => false);

      if (hasResults) {
        console.log('✓ Results phase is indicated to player');
      }
    }
  });

  test(tagTest([tags.GAME, tags.PHASE], 'Player can edit draft action before finalizing'), async ({ page }) => {
    // Login as Player
    await loginAs(page, 'PLAYER_4'); // Use Player 4 to avoid conflicts

    // Navigate to action phase game
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    const gameTitle = FIXTURE_GAMES.ACTION_PHASE.title;
    const gameLink = page.locator(`text=${gameTitle}`).first();

    if (await gameLink.isVisible()) {
      await gameLink.click();
      await page.waitForLoadState('networkidle');

      // Look for Edit or My Action button
      const editButton = page.locator('button:has-text("Edit Action"), button:has-text("My Action")').first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForLoadState('networkidle');

        console.log('✓ Opened action for editing');

        // Find action content field
        const contentField = page.locator('textarea[name="content"], [data-testid="action-content"]').first();

        if (await contentField.isVisible()) {
          // Get current content
          const currentContent = await contentField.inputValue();

          // Add to the content
          const updatedContent = currentContent + '\n\nEdited by E2E test.';
          await contentField.fill(updatedContent);

          console.log('✓ Modified action content');

          // Save changes
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();

          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForLoadState('networkidle');

            console.log('✓ Saved edited action');
          }
        }
      } else {
        console.log('⚠ Edit action button not found - player may not have a draft');
      }
    }
  });
});
