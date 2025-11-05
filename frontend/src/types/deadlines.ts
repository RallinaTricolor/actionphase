/**
 * Deadlines Types
 *
 * Deadlines are GM-created time-based goals for games (e.g., action submission deadlines).
 * Only GMs can create/update/delete deadlines. All game participants can view deadlines.
 */

export interface Deadline {
  id: number;
  game_id: number;
  title: string;
  description?: string;
  deadline?: string; // ISO 8601 timestamp
  created_at?: string;
  updated_at?: string;
}

export interface DeadlineWithGame extends Deadline {
  game_title: string;
}

// Request types
export interface CreateDeadlineRequest {
  title: string;
  description: string;
  deadline: string; // ISO 8601 timestamp
}

export interface UpdateDeadlineRequest {
  title: string;
  description: string;
  deadline: string; // ISO 8601 timestamp
}
