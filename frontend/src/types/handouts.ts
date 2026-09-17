/**
 * Handouts Types
 *
 * Handouts are GM-created reference materials (rules, world info) that exist across all game phases.
 * Only GMs can create/update/delete handouts. Players can view published handouts.
 */

import type { components } from './api.gen';

/**
 * Generated. An exact match for the hand-written type it replaces, including
 * `created_at` / `updated_at` staying optional -- both are `omitempty` pointers
 * on the Go side, so an unset value omits the key.
 */
export type Handout = components['schemas']['HandoutResponse'];

/**
 * A handout together with the game it belongs to, as returned by the cross-game
 * list. Used by the global Utility Drawer, where there is no game in scope to
 * resolve the title from.
 *
 * Generated: the backend declares this as its own schema, so the
 * `extends Handout` that mirrored it by hand is redundant.
 */
export type HandoutWithGame = components['schemas']['HandoutWithGameResponse'];

/**
 * Generated. The nullable-looking fields are absent, never null: every one is an
 * `omitempty` pointer on the Go side, so a nil value omits the key rather than
 * marshalling `null`. The hand-written `| null` was fiction the wire never sent.
 */
export type HandoutComment = components['schemas']['HandoutCommentResponse'];

// Request types
//
// Generated from the OpenAPI spec (`just gen-api-types`) rather than written by
// hand, so an unknown property is a build failure instead of a 422 at runtime.

/** POST /games/{gameID}/handouts */
export type CreateHandoutRequest = components['schemas']['CreateHandoutRequest'];

/** PUT /games/{gameID}/handouts/{handoutId} */
export type UpdateHandoutRequest = components['schemas']['UpdateHandoutRequest'];

/** POST /handouts/{handoutId}/comments */
export type CreateHandoutCommentRequest = components['schemas']['CreateHandoutCommentRequest'];

/** PUT /handouts/{handoutId}/comments/{commentId} */
export type UpdateHandoutCommentRequest = components['schemas']['UpdateHandoutCommentRequest'];
