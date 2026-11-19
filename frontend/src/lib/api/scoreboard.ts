import { BaseApiClient } from './client';
import type {
  Scoreboard,
  ScoreboardConfig,
  ScoreboardEntryNames,
} from '../../types/scoreboard';

/**
 * Scoreboard API client.
 *
 * The server decides what each viewer gets: hidden columns and the numbers
 * behind range labels never reach a player, so nothing here filters.
 */
export class ScoreboardApi extends BaseApiClient {
  /** The board for the caller. 404 when the game has none this caller may see. */
  async getScoreboard(gameId: number) {
    return this.client.get<Scoreboard>(`/api/v1/games/${gameId}/scoreboard`);
  }

  /** The stored setup, for the GM's editor. */
  async getConfig(gameId: number) {
    return this.client.get<ScoreboardConfig>(`/api/v1/games/${gameId}/scoreboard/config`);
  }

  /** Replaces the whole setup and returns it as stored. */
  async updateConfig(gameId: number, config: ScoreboardConfig) {
    return this.client.put<ScoreboardConfig>(`/api/v1/games/${gameId}/scoreboard/config`, config);
  }

  /** The board players would get from this setup. Stores nothing. */
  async previewScoreboard(gameId: number, config: ScoreboardConfig) {
    return this.client.post<Scoreboard>(`/api/v1/games/${gameId}/scoreboard/preview`, config);
  }

  /** Entry names in use on each numeric tab, for the editor's column picker. */
  async getEntryNames(gameId: number) {
    return this.client.get<ScoreboardEntryNames>(`/api/v1/games/${gameId}/scoreboard/entry-names`);
  }
}
