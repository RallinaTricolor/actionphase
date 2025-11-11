import { BaseApiClient } from './client';
import type {
  Poll,
  PollWithOptions,
  PollResults,
  CreatePollRequest,
  UpdatePollRequest,
  SubmitVoteRequest,
  PollVote
} from '../../types/polls';

/**
 * Polls API client
 * Handles poll management for games
 */
export class PollsApi extends BaseApiClient {
  /**
   * Create a new poll for a game (GM only)
   * @param gameId - Game ID
   * @param data - Poll data including options
   */
  async createPoll(gameId: number, data: CreatePollRequest) {
    return this.client.post<PollWithOptions>(`/api/v1/games/${gameId}/polls`, data);
  }

  /**
   * Get all polls for a game
   * @param gameId - Game ID
   * @param includeExpired - Whether to include expired polls (default: false)
   */
  async getGamePolls(gameId: number, includeExpired: boolean = false) {
    const params = includeExpired ? '?include_expired=true' : '';
    return this.client.get<Poll[]>(`/api/v1/games/${gameId}/polls${params}`);
  }

  /**
   * Get all polls for a specific phase
   * @param gameId - Game ID
   * @param phaseId - Phase ID
   */
  async getPollsByPhase(gameId: number, phaseId: number) {
    return this.client.get<Poll[]>(`/api/v1/games/${gameId}/phases/${phaseId}/polls`);
  }

  /**
   * Get a specific poll with its options
   * @param pollId - Poll ID
   */
  async getPoll(pollId: number) {
    return this.client.get<PollWithOptions>(`/api/v1/polls/${pollId}`);
  }

  /**
   * Get poll results
   * @param pollId - Poll ID
   */
  async getPollResults(pollId: number) {
    return this.client.get<PollResults>(`/api/v1/polls/${pollId}/results`);
  }

  /**
   * Submit or update a vote for a poll
   * @param pollId - Poll ID
   * @param data - Vote data (option selection or other response)
   */
  async submitVote(pollId: number, data: SubmitVoteRequest) {
    return this.client.post<PollVote>(`/api/v1/polls/${pollId}/vote`, data);
  }

  /**
   * Update a poll (GM only)
   * @param pollId - Poll ID
   * @param data - Updated poll data
   */
  async updatePoll(pollId: number, data: UpdatePollRequest) {
    return this.client.put<Poll>(`/api/v1/polls/${pollId}`, data);
  }

  /**
   * Delete a poll (GM only)
   * @param pollId - Poll ID
   */
  async deletePoll(pollId: number) {
    return this.client.delete(`/api/v1/polls/${pollId}`);
  }
}
