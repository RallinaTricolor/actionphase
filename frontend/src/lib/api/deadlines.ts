import { BaseApiClient } from './client';
import type {
  Deadline,
  DeadlineWithGame,
  CreateDeadlineRequest,
  UpdateDeadlineRequest
} from '../../types/deadlines';

/**
 * Deadlines API client
 * Handles deadline management for games
 */
export class DeadlinesApi extends BaseApiClient {
  /**
   * Create a new deadline for a game
   * @param gameId - Game ID
   * @param data - Deadline data
   */
  async createDeadline(gameId: number, data: CreateDeadlineRequest) {
    return this.client.post<Deadline>(`/api/v1/games/${gameId}/deadlines`, data);
  }

  /**
   * Get all deadlines for a game
   * @param gameId - Game ID
   * @param includeExpired - Whether to include expired deadlines (default: false)
   */
  async getGameDeadlines(gameId: number, includeExpired: boolean = false) {
    const params = includeExpired ? '?includeExpired=true' : '';
    return this.client.get<Deadline[]>(`/api/v1/games/${gameId}/deadlines${params}`);
  }

  /**
   * Update a deadline
   * @param deadlineId - Deadline ID
   * @param data - Updated deadline data
   */
  async updateDeadline(deadlineId: number, data: UpdateDeadlineRequest) {
    return this.client.patch<Deadline>(`/api/v1/deadlines/${deadlineId}`, data);
  }

  /**
   * Delete a deadline
   * @param deadlineId - Deadline ID
   */
  async deleteDeadline(deadlineId: number) {
    return this.client.delete(`/api/v1/deadlines/${deadlineId}`);
  }

  /**
   * Get upcoming deadlines across all user's games
   * @param limit - Maximum number of deadlines to return (default: 10)
   */
  async getUpcomingDeadlines(limit: number = 10) {
    return this.client.get<DeadlineWithGame[]>(`/api/v1/deadlines/upcoming?limit=${limit}`);
  }
}
