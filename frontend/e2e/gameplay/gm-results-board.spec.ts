import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * GM Results Board E2E Tests
 *
 * Covers what no lower test can: the board's item store saving through the
 * real API and loading back, the board's layout in a real browser (the cause
 * arrows are measured from the page), and the sharing setting deciding what
 * another user's browser gets.
 *
 * Deliberately NOT covered here (component and handler tests already do):
 * - Each step's editing (cards, scenes, moments, results, rewards)
 * - Conflicts between two editors, and offline drafts
 * - That a viewer sees no editing control in any step
 * - Who the board endpoints refuse, role by role
 *
 * Desktop only: the board needs a screen at least 1024px wide, so nothing
 * here is tagged @mobile.
 *
 * Fixtures (34_gm_board.sql), both the Heist's board from
 * fixtures.seed_heist_board, run by TestGM with TestAudience in the audience:
 *   RESULTS_BOARD_GM (#711)     - not shared; the GM test writes here
 *   RESULTS_BOARD_SHARED (#712) - shared; read-only
 */

/** The game's action phase: the one with the board. */
async function boardPhaseId(page: Page, gameId: number): Promise<number> {
  return page.evaluate(async (gid) => {
    const res = await fetch(`/api/v1/games/${gid}/phases`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch phases: ${res.status}`);
    const phases: Array<{ id: number; phase_type: string }> = await res.json();
    const phase = phases.find((p) => p.phase_type === 'action');
    if (!phase) throw new Error('The results board fixture has no action phase');
    return phase.id;
  }, gameId);
}

test.describe('GM results board', () => {
  test('GM opens the board from the results area, and a card outcome survives a reload', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'RESULTS_BOARD_GM');

    await page.goto(`/games/${gameId}?tab=actions`);
    await page.getByTestId('open-results-board').click();
    // Read opens on the first submitter by name: Rook.
    await expect(page.getByTestId('gm-board-step-read')).toBeVisible();
    await expect(page.getByTestId('submission-text')).toContainText('sniper position');

    await page.getByTestId('tab-map').click();
    await expect(page.getByTestId('map-by-location')).toBeVisible();

    // Hovering a card draws what caused it: Vex's lock work was cut short by the vault scene.
    await page.getByTestId('map-card-card-heist-vex-locks').hover();
    await expect(page.getByTestId('map-arrow-cause')).toHaveCount(1);

    // Rook's rifle card is unresolved in the seed.
    const rifle = page.getByTestId('map-card-card-heist-rook-rifle');
    await rifle.click();
    const panel = page.getByTestId('card-panel');
    await panel.getByRole('button', { name: 'Happened', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Happened', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('gm-board-save-status')).toContainText('Saved');

    await page.reload();
    await expect(page.getByTestId('map-card-card-heist-rook-rifle')).toHaveAttribute('aria-label', /Happened/);
  });

  test('the audience follows a shared board read-only, and is told when a board is not shared', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    const sharedId = await getFixtureGameId(page, 'RESULTS_BOARD_SHARED');
    const unsharedId = await getFixtureGameId(page, 'RESULTS_BOARD_GM');

    // Shared: History offers the board, and it opens read-only.
    const sharedPhase = await boardPhaseId(page, sharedId);
    await page.goto(`/games/${sharedId}?tab=history&phase=${sharedPhase}`);
    await page.getByTestId('view-results-board').click();
    await expect(page.getByTestId('gm-board-read-only')).toBeVisible();
    await expect(page.getByTestId('submission-text')).toContainText('sniper position');
    await expect(page.getByRole('button', { name: 'Done reading → next' })).toHaveCount(0);

    // Not shared: no link in History, and the board's address says why.
    const unsharedPhase = await boardPhaseId(page, unsharedId);
    await page.goto(`/games/${unsharedId}?tab=history&phase=${unsharedPhase}`);
    await expect(page.getByText('Execute the Plan').first()).toBeVisible();
    await expect(page.getByTestId('view-results-board')).toHaveCount(0);
    await page.goto(`/games/${unsharedId}/phases/${unsharedPhase}/board`);
    await expect(page.getByTestId('gm-board-notice')).toContainText('Not shared');
  });
});
