/**
 * Handouts Types
 *
 * Handouts are GM-created reference materials (rules, world info) that exist across all game phases.
 * Only GMs can create/update/delete handouts. Players can view published handouts.
 */

export interface Handout {
  id: number;
  game_id: number;
  title: string;
  content: string; // Markdown content
  status: 'draft' | 'published';
  created_at?: string;
  updated_at?: string;
}

/**
 * A handout together with the game it belongs to, as returned by the cross-game
 * list. Used by the global Utility Drawer, where there is no game in scope to
 * resolve the title from.
 */
export interface HandoutWithGame extends Handout {
  game_title: string;
}

export interface HandoutComment {
  id: number;
  handout_id: number;
  user_id: number;
  parent_comment_id?: number | null;
  content: string;
  edit_count: number;
  created_at?: string;
  updated_at?: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  deleted_by_user_id?: number | null;
}

// Request types
//
// Generated from the OpenAPI spec (`just gen-api-types`) rather than written by
// hand, so an unknown property is a build failure instead of a 422 at runtime.
import type { components } from './api.gen';

/** POST /games/{gameID}/handouts */
export type CreateHandoutRequest = components['schemas']['CreateHandoutRequest'];

/** PUT /games/{gameID}/handouts/{handoutId} */
export type UpdateHandoutRequest = components['schemas']['UpdateHandoutRequest'];

/** POST /handouts/{handoutId}/comments */
export type CreateHandoutCommentRequest = components['schemas']['CreateHandoutCommentRequest'];

/** PUT /handouts/{handoutId}/comments/{commentId} */
export type UpdateHandoutCommentRequest = components['schemas']['UpdateHandoutCommentRequest'];
