import { Page, Locator } from '@playwright/test';
import { clickAndWaitForMutation } from '../utils/waits';

/**
 * Page Object for Action Submission
 *
 * Handles submitting and managing player actions during action phases
 * Actions are accessed via the game's Actions tab during in-progress games
 */
export class ActionSubmissionPage {
  readonly page: Page;
  readonly gameId: number;
  readonly phaseId?: number;

  // Locators
  readonly actionSubmissionForm: Locator;
  readonly actionTextarea: Locator;
  readonly submitActionButton: Locator;
  readonly editActionButton: Locator;
  readonly currentActionDisplay: Locator;
  readonly actionContent: Locator;

  constructor(page: Page, gameId: number, phaseId?: number) {
    this.page = page;
    this.gameId = gameId;
    this.phaseId = phaseId;

    // Define locators using data-testid
    this.actionSubmissionForm = page.getByTestId('action-submission-form');
    this.actionTextarea = page.getByTestId('action-textarea');
    this.submitActionButton = page.getByTestId('submit-action-button');
    this.editActionButton = page.getByTestId('edit-action-button');
    this.currentActionDisplay = page.getByTestId('current-action-display');
    this.actionContent = page.getByTestId('action-content');
  }

  /**
   * Navigate to game's actions tab
   *
   * Navigates directly via URL param to avoid matching the dynamic tab label
   * ('Submit Action' vs 'Action Submitted ✓' vs 'Actions' for GM).
   */
  async goto() {
    await this.page.goto(`/games/${this.gameId}?tab=actions`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Submit a new action
   *
   * @param content - Action content
   * @param characterId - Optional character ID to act as
   */
  async submitAction(content: string, characterId?: number) {
    // Wait for form to be visible
    await this.actionSubmissionForm.waitFor({ state: 'visible', timeout: 5000 });

    // Select character if specified and multiple characters available
    if (characterId) {
      const characterSelect = this.page.getByTestId('character-select');
      const isSelectVisible = await characterSelect.isVisible().catch(() => false);

      if (isSelectVisible) {
        await characterSelect.selectOption(characterId.toString());
      }
    }

    // Fill action content
    await this.actionTextarea.fill(content);

    await this.submitAndWaitForSavedAction();
  }

  /**
   * Edit existing action
   *
   * @param newContent - New action content
   */
  async editAction(newContent: string) {
    // Click edit button to expand form
    await this.editActionButton.waitFor({ state: 'visible', timeout: 3000 });
    await this.editActionButton.click();

    // Wait for form to appear
    await this.actionSubmissionForm.waitFor({ state: 'visible', timeout: 3000 });

    // Update content
    await this.actionTextarea.clear();
    await this.actionTextarea.fill(newContent);

    await this.submitAndWaitForSavedAction();
  }

  /**
   * Click submit and wait until the saved action is what the page shows.
   *
   * Three waits, all registered before the click: the POST, then the refetch of
   * the player's actions that the mutation triggers, then the display. Waiting
   * on the display alone is not enough when editing -- it is already visible
   * with the OLD content, so it would resolve before the refetch lands.
   */
  private async submitAndWaitForSavedAction() {
    const refetched = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        /\/api\/v1\/games\/\d+\/actions\/mine$/.test(new URL(response.url()).pathname),
      { timeout: 10000 }
    );
    await clickAndWaitForMutation(this.page, this.submitActionButton, {
      method: 'POST',
      path: /^\/api\/v1\/games\/\d+\/actions$/,
    });
    await refetched;
    await this.currentActionDisplay.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Check if user has submitted an action for current phase
   */
  async hasSubmittedAction(): Promise<boolean> {
    try {
      await this.currentActionDisplay.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if user can edit their action
   */
  async canEditAction(): Promise<boolean> {
    try {
      await this.editActionButton.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

}
