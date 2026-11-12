import { expect, type Locator, type Page } from '@playwright/test';
import { API, performAndWaitForMutation } from '../utils/waits';

export type BoardStep = 'read' | 'map' | 'scenes' | 'write';

/** Poll interval of an open board (hooks/useGmBoard.ts), plus a margin. */
const POLL_MS = 15_000 + 500;

/**
 * The GM results board (`/games/:gameId/phases/:phaseId/board`).
 *
 * Edits save in debounced batches about a second after the last change, so
 * a write is awaited with `saving()`, which waits for the batch's response
 * rather than for the "Saved" badge (the badge already says Saved before
 * the first edit).
 */
export class GmBoardPage {
  constructor(
    readonly page: Page,
    readonly gameId: number,
    readonly phaseId: number,
  ) {}

  url(params: Record<string, string | number> = {}) {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return `/games/${this.gameId}/phases/${this.phaseId}/board${query ? `?${query}` : ''}`;
  }

  /** Opens the board (optionally at a step, a reader or a scene) and waits for it to load. */
  async open(params: { step?: BoardStep; who?: number; scene?: string } = {}) {
    const { step, ...rest } = params;
    await this.page.goto(this.url({ ...(step && step !== 'read' ? { step } : {}), ...rest }));
    await this.waitForLoaded(step ?? 'read');
  }

  async waitForLoaded(step: BoardStep) {
    await expect(this.page.getByTestId('gm-board')).toBeVisible();
    await expect(this.page.getByTestId(`gm-board-step-${step}`)).toBeVisible();
  }

  async goToStep(step: BoardStep) {
    await this.page.getByTestId(`tab-${step}`).click();
    await this.waitForLoaded(step);
  }

  /** Runs an edit and waits for the board batch it causes to save (2xx). */
  saving(edit: () => Promise<unknown>) {
    return performAndWaitForMutation(this.page, edit, API.saveBoard);
  }

  /**
   * Fast-forwards the page past the next poll. Needs `page.clock.install()`
   * before the board was opened; real time keeps running otherwise, so the
   * debounced saves still fire on their own.
   */
  async nextPoll() {
    const poll = this.page.waitForResponse(
      (r) => r.request().method() === 'GET' && /\/gm-board\?since=\d+$/.test(r.url()),
    );
    await this.page.clock.runFor(POLL_MS);
    await poll;
  }

  get saveStatus(): Locator {
    return this.page.getByTestId('gm-board-save-status');
  }

  // ── Write ────────────────────────────────────────────────────────────
  /** Opens a tab of Write's result column (Result, Rewards, Checks); the others stay mounted but hidden. */
  async resultTab(name: 'Result' | 'Rewards' | 'Checks') {
    const tab = this.page.getByRole('group', { name: 'Result pane' }).getByRole('button', { name: new RegExp(`^${name}`) });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
  }

  // ── Map ──────────────────────────────────────────────────────────────
  mapCard(cardId: string): Locator {
    return this.page.getByTestId(`map-card-${cardId}`);
  }

  /**
   * Drags a Map card into a cell. Playwright's drag can't scroll mid-drag
   * (the drop is lost or the drag hangs), and its own scroll-into-view only
   * places the card, so the target can end up past the grid's right edge or
   * below a 720px window. So both are placed first: the grid scrolls
   * sideways to centre the target column (the source is a neighbouring
   * column), then the page scrolls to put the higher of the two just below
   * the site's sticky nav (4rem), leaving the rest of the window for the other.
   */
  async dragCard(cardId: string, to: Locator) {
    const card = this.mapCard(cardId);
    await to.evaluate((el) => el.scrollIntoView({ block: 'nearest', inline: 'center' }));
    const [from, target] = [await card.boundingBox(), await to.boundingBox()];
    if (!from || !target) throw new Error(`dragCard: ${cardId} or its target cell has no box`);
    await this.page.evaluate((dy) => window.scrollBy(0, dy), Math.min(from.y, target.y) - 80);
    await card.dragTo(to);
  }

  cell(locationId: string, slotId: string): Locator {
    return this.page.getByTestId(`cell-${locationId}-${slotId}`);
  }

  get cardPanel(): Locator {
    return this.page.getByTestId('card-panel');
  }

  /** Opens a card on the Map in the side panel. */
  async openCard(cardId: string) {
    await this.mapCard(cardId).click();
    await expect(this.cardPanel).toBeVisible();
  }

  /** A card's main text box in the open panel ("What happens" for a GM card). */
  get cardText(): Locator {
    return this.cardPanel.getByRole('textbox', { name: /What happens|From the submission/ });
  }

  /** The "someone else changed what you were editing" notice. */
  get conflictNotice(): Locator {
    return this.page.getByRole('alert').filter({ hasText: 'Someone else changed what you were editing' });
  }
}
