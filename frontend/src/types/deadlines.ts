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

/**
 * UnifiedDeadline aggregates all deadline types (arbitrary, phase, and poll) into a single view.
 * This provides a complete picture of all time-sensitive items across different deadline sources.
 */
export interface UnifiedDeadline {
  deadline_type: 'deadline' | 'phase' | 'poll'; // Source of the deadline
  source_id: number;                             // ID from the source table
  title: string;                                 // Deadline title or phase/poll question
  description: string;                           // Deadline description
  deadline?: string;                             // ISO 8601 timestamp - when the deadline expires
  game_id: number;                               // Associated game
  phase_id?: number;                             // NULL for arbitrary deadlines
  poll_id?: number;                              // NULL for non-poll deadlines
  is_system_deadline: boolean;                   // true for phase deadlines (can't be deleted by user)
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
