/**
 * Deadlines Types
 *
 * Deadlines are GM-created time-based goals for games (e.g., action submission deadlines).
 * Only GMs can create/update/delete deadlines. All game participants can view deadlines.
 */

import type { components } from './api.gen';

/** Generated. An exact match for the hand-written type it replaces. */
export type Deadline = components['schemas']['DeadlineResponse'];

/**
 * A deadline together with the game it belongs to, as returned by the
 * cross-game upcoming list. Generated: the backend already declares this as its
 * own schema, so the `extends Deadline` that mirrored it by hand is redundant.
 */
export type DeadlineWithGame = components['schemas']['DeadlineWithGameResponse'];

/**
 * UnifiedDeadline aggregates all deadline types (arbitrary, phase, and poll) into a single view.
 * This provides a complete picture of all time-sensitive items across different deadline sources.
 */
export type UnifiedDeadline = components['schemas']['UnifiedDeadlineResponse'];

// Request types
//
// Generated from the OpenAPI spec (`just gen-api-types`) rather than written by
// hand, so an unknown property is a build failure instead of a 422 at runtime.
// Schema names come from the Go structs and do not always match the frontend's
// names — both endpoints below share DeadlineBody — so alias here and leave
// call sites importing the names they already use.
/** POST /games/{gameID}/deadlines */
export type CreateDeadlineRequest = components['schemas']['DeadlineBody'];

/** PATCH /deadlines/{deadlineId} — same body as create, not UpdateDeadlineBody
 *  (which belongs to PUT /phases/{id}/deadline; see types/phases.ts). */
export type UpdateDeadlineRequest = components['schemas']['DeadlineBody'];
