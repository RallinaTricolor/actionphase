import { BaseApiClient } from './client';
import type {
  BoardItemChange,
  GmItems,
  GmItemsWritten,
  GmSettings,
  GmSharing,
  SettingsItemChange,
} from '../../types/gmBoard';

const sinceParam = (since?: number) => (since && since > 0 ? `?since=${since}` : '');

/**
 * GM results board API: per-phase board items and per-game board settings.
 * Saves are batches applied all or nothing; a stale item answers 409 with
 * the server's copies (see `GmBoardConflict`).
 */
export class GmBoardApi extends BaseApiClient {
  /** A phase's board: every live item, or with `since`, what changed after it. */
  async getBoard(gameId: number, phaseId: number, since?: number) {
    return this.client.get<GmItems>(`/api/v1/games/${gameId}/phases/${phaseId}/gm-board${sinceParam(since)}`);
  }

  async applyBoardChanges(gameId: number, phaseId: number, changes: BoardItemChange[]) {
    return this.client.post<GmItemsWritten>(`/api/v1/games/${gameId}/phases/${phaseId}/gm-board/changes`, { changes });
  }

  /** The game's board settings (codex, names, template), plus sharing. */
  async getSettings(gameId: number, since?: number) {
    return this.client.get<GmSettings>(`/api/v1/games/${gameId}/gm-settings${sinceParam(since)}`);
  }

  async applySettingsChanges(gameId: number, changes: SettingsItemChange[]) {
    return this.client.post<GmItemsWritten>(`/api/v1/games/${gameId}/gm-settings/changes`, { changes });
  }

  /** Share the boards read-only, or stop. Works in any game state. */
  async setSharing(gameId: number, share: boolean) {
    return this.client.put<GmSharing>(`/api/v1/games/${gameId}/gm-settings/sharing`, { share });
  }
}
