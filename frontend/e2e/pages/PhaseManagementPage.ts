import { Page, Locator } from '@playwright/test';
import { navigateToGameAndTab } from '../utils/navigation';
import { waitForVisible, waitForModal } from '../utils/waits';
import { assertTextVisible } from '../utils/assertions';

/**
 * Page Object Model for Phase Management
 *
 * Encapsulates all phase management interactions including:
 * - Creating phases
 * - Activating phases
 * - Updating phase deadlines
 * - Publishing results
 */
export class PhaseManagementPage {
  constructor(private page: Page) {}

  /**
   * Navigate to the Phases tab
   */
  async goto(gameId: number) {
    await navigateToGameAndTab(this.page, gameId, 'Phases');
  }

  /**
   * Get the Phase Management heading
   */
  get heading(): Locator {
    return this.page.locator('h2:has-text("Phase Management")');
  }

  /**
   * Get the Create Phase button
   */
  get createPhaseButton(): Locator {
    return this.page.locator('button:has-text("New Phase")');
  }

  /**
   * Get phase type select dropdown
   */
  get phaseTypeSelect(): Locator {
    return this.page.locator('select#phase-type');
  }

  /**
   * Get phase title input
   */
  get phaseTitleInput(): Locator {
    return this.page.locator('input#phase-title');
  }

  /**
   * Get phase description textarea
   */
  get phaseDescriptionTextarea(): Locator {
    return this.page.locator('textarea#phase-description');
  }

  /**
   * Get phase deadline input
   */
  get phaseDeadlineInput(): Locator {
    return this.page.locator('input#phase-deadline');
  }

  /**
   * Get the submit button in the modal
   */
  get submitButton(): Locator {
    return this.page.locator('button:has-text("Create"), button[type="submit"]');
  }

  /**
   * Open the Create Phase modal
   */
  async openCreatePhaseModal() {
    await this.createPhaseButton.click();
    await waitForModal(this.page, 'Create Phase');
  }

  /**
   * Create a new phase
   * @param options - Phase creation options
   */
  async createPhase(options: {
    type: 'common_room' | 'action' | 'results';
    title: string;
    description?: string;
    deadline?: Date;
  }) {
    await this.openCreatePhaseModal();

    // Select phase type
    await this.phaseTypeSelect.selectOption(options.type);

    // Fill in phase details
    await this.phaseTitleInput.fill(options.title);

    if (options.description) {
      await this.phaseDescriptionTextarea.fill(options.description);
    }

    if (options.deadline) {
      // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
      const formatted = options.deadline.toISOString().slice(0, 16);
      await this.phaseDeadlineInput.fill(formatted);
    }

    // Submit form
    await this.submitButton.click();

    // Wait for phase to appear
    await this.page.waitForLoadState('networkidle');
    await assertTextVisible(this.page, options.title);
  }

  /**
   * Find a phase card by title
   * @param title - Phase title
   */
  getPhaseCard(title: string): Locator {
    return this.page.locator(`div:has-text("${title}")`).first();
  }

  /**
   * Activate a phase
   * @param phaseTitle - Title of the phase to activate
   * @param publishResults - Whether to publish unpublished results first
   */
  async activatePhase(phaseTitle: string, publishResults = false) {
    const phaseCard = this.getPhaseCard(phaseTitle);
    await phaseCard.locator('button:has-text("Activate")').first().click();

    // Wait for confirmation dialog button to appear
    if (publishResults) {
      // Wait for and click "Publish & Activate" button
      await this.page.waitForSelector('button:has-text("Publish & Activate")', { timeout: 5000 });
      await this.page.click('button:has-text("Publish & Activate")');
    } else {
      // Wait for and click "Activate Phase" button in the confirmation dialog
      await this.page.waitForSelector('button:has-text("Activate Phase")', { timeout: 5000 });
      await this.page.click('button:has-text("Activate Phase")');
    }

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Update phase deadline
   * @param phaseTitle - Title of the phase to update
   * @param newDeadline - New deadline date
   */
  async updateDeadline(phaseTitle: string, newDeadline: Date) {
    const phaseCard = this.getPhaseCard(phaseTitle);

    // Find deadline input in the phase card
    const deadlineInput = phaseCard.locator('input[type="datetime-local"]');

    // Format date for datetime-local input
    const formatted = newDeadline.toISOString().slice(0, 16);
    await deadlineInput.fill(formatted);

    // Click save/update button
    await phaseCard.locator('button:has-text("Save"), button:has-text("Update")').click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Edit a phase
   * @param phaseTitle - Title of the phase to edit
   * @param updates - Fields to update
   */
  async editPhase(
    phaseTitle: string,
    updates: {
      title?: string;
      description?: string;
      deadline?: Date;
    }
  ) {
    const phaseCard = this.getPhaseCard(phaseTitle);
    await phaseCard.locator('button:has-text("Edit")').click();

    await waitForModal(this.page, 'Edit Phase');

    if (updates.title) {
      await this.phaseTitleInput.fill(updates.title);
    }

    if (updates.description) {
      await this.phaseDescriptionTextarea.fill(updates.description);
    }

    if (updates.deadline) {
      const formatted = updates.deadline.toISOString().slice(0, 16);
      await this.phaseDeadlineInput.fill(formatted);
    }

    await this.submitButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get count of phases
   */
  async getPhaseCount(): Promise<number> {
    const phases = this.page.locator('[data-testid="phase-card"], .phase-card');
    return await phases.count();
  }

  /**
   * Verify phase exists
   * @param phaseTitle - Phase title to verify
   */
  async verifyPhaseExists(phaseTitle: string) {
    await assertTextVisible(this.page, phaseTitle);
  }

  /**
   * Verify phase is active
   * @param phaseTitle - Phase title to verify
   */
  async verifyPhaseActive(phaseTitle: string) {
    const phaseCard = this.getPhaseCard(phaseTitle);
    const activeBadge = phaseCard.locator('text=Active, text=Current').first();
    await waitForVisible(activeBadge);
  }

  /**
   * Get unpublished results count
   */
  async getUnpublishedResultsCount(): Promise<number> {
    const countElement = this.page.locator('text=/\\d+ unpublished results/i');
    const text = await countElement.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Publish all phase results
   */
  async publishAllResults() {
    await this.page.click('button:has-text("Publish All Results")');
    await this.page.waitForLoadState('networkidle');
  }
}
