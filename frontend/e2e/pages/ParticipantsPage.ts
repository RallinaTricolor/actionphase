import { Page } from '@playwright/test';
import { navigateToGameTab } from '../utils/navigation';

/**
 * Page Object for Participants/People View
 *
 * Manages the participants/people tab in games, including:
 * - Viewing participant lists
 * - Filtering by role (player, GM, audience)
 * - Searching participants
 * - Checking participant permissions
 */
export class ParticipantsPage {
  readonly page: Page;
  readonly gameId: number;

  constructor(page: Page, gameId: number) {
    this.page = page;
    this.gameId = gameId;
  }

  /**
   * Navigate to participants/people tab
   */
  async goto() {
    await this.page.goto(`/games/${this.gameId}/participants`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get list of all participants
   */
  async getParticipantsList(): Promise<string[]> {
    const participants = await this.page.getByTestId('participant-card').all();
    const names: string[] = [];

    for (const participant of participants) {
      const nameText = await participant.textContent();
      if (nameText) {
        names.push(nameText.trim());
      }
    }

    return names;
  }

  /**
   * Get participants by role
   * @param role - 'player' | 'gm' | 'audience'
   */
  async getParticipantsByRole(role: string): Promise<string[]> {
    const roleCards = await this.page.locator(`[data-testid="participant-card"][data-role="${role}"]`).all();
    const names: string[] = [];

    for (const card of roleCards) {
      const nameText = await card.textContent();
      if (nameText) {
        names.push(nameText.trim());
      }
    }

    return names;
  }

  /**
   * Get participant count
   */
  async getParticipantsCount(): Promise<number> {
    const participants = await this.page.getByTestId('participant-card').all();
    return participants.length;
  }

  /**
   * Check if specific participant is visible
   * @param username - Username to check
   */
  async hasParticipant(username: string): Promise<boolean> {
    try {
      await this.page.getByText(username, { exact: true }).waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get participant role badge
   * @param username - Username to check
   */
  async getParticipantRole(username: string): Promise<string> {
    // Find the participant card containing the username
    const participantCard = this.page.locator('[data-testid="participant-card"]').filter({ hasText: username });

    // Get the role badge within that card
    const roleBadge = participantCard.getByTestId('participant-role-badge');
    const roleText = await roleBadge.textContent();

    return roleText?.trim() || '';
  }

  /**
   * Filter participants by search
   * @param searchTerm - Term to search for
   */
  async searchParticipants(searchTerm: string) {
    const searchInput = this.page.getByPlaceholder(/search.*participant/i);
    await searchInput.fill(searchTerm);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if user can manage participants (GM only)
   */
  async canManageParticipants(): Promise<boolean> {
    try {
      const manageButton = this.page.getByRole('button', { name: /manage.*participant/i });
      await manageButton.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Navigate to participants tab from game details
   */
  async goToParticipantsTab() {
    // Try "Participants" first (recruitment state), fall back to "People" (in_progress)
    const mobileSelect = this.page.locator('select#tab-select');
    const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);
    const hasParticipants = isMobile
      ? await mobileSelect.locator('option', { hasText: 'Participants' }).count() > 0
      : await this.page.getByTestId('tab-participants').isVisible({ timeout: 2000 }).catch(() => false);
    await navigateToGameTab(this.page, hasParticipants ? 'Participants' : 'People');
  }
}
