/**
 * Polls Types
 *
 * Common Room Polling System allows GMs and players to create polls for games.
 * Polls support optional "other" text responses. Results can show vote counts
 * or individual voters (with character names when available).
 */

/**
 * Every poll response type is generated from the OpenAPI spec.
 *
 * There used to be a single hand-written `Poll` interface standing in for three
 * different backend schemas at once, and two optional fields at the bottom were
 * what let it get away with it:
 *
 *   - `is_expired?` was never sent by ANY endpoint. PollCard computed expiry
 *     from the deadline itself (with a comment saying the backend didn't provide
 *     it) while PollsTab filtered on the field -- so `activePolls` was every
 *     poll and `expiredPolls` was permanently empty. It is now a real computed
 *     field on the backend, next to the identical one on PhaseResponse, so a
 *     second client never has to rediscover this.
 *   - `user_has_voted?` was real, but only on the LIST response. The detail
 *     endpoint called the same flag `has_voted`, which nothing ever read.
 *     The backend now uses one name everywhere.
 *
 * The three types below are no longer variants of each other in any meaningful
 * sense: PollSummary is the poll row, and the other two are that row plus
 * whatever their endpoint additionally loaded.
 */
import type { components } from './api.gen';

/**
 * The poll row itself, and the base shape of every poll response.
 *
 * Returned nested under poll results. Both other poll types are a superset of
 * this one, so it is what a function should accept when it only needs the poll's
 * own settings.
 */
export type Poll = components['schemas']['PollSummary'];

/** An entry in the poll list: the poll row plus whether the caller has voted. */
export type PollListItem = components['schemas']['PollListItem'];

/**
 * A single poll with its options loaded, from GET /polls/{id}.
 *
 * `options` is nullable, not optional: PUT /polls/{id} answers with the updated
 * poll and no options loaded, sending an explicit `"options": null`.
 */
export type PollWithOptions = components['schemas']['PollResponse'];

/**
 * Generated — returned by POST /polls/{id}/vote.
 *
 * Three corrections against the hand-written shape it replaces. Both
 * `selected_option_id` and `other_response` are REQUIRED but nullable rather
 * than optional: each is a bare `*T` with no `omitempty`, so a vote sends the
 * key it did not use as an explicit null. A vote carries exactly one of the two
 * -- the server rejects a body with neither. `updated_at` is REQUIRED, not
 * optional: it is a plain `time.Time`, always marshalled.
 */
export type PollVote = components['schemas']['PollVoteResponse'];

/**
 * Poll results, from GET /polls/{id}/results.
 *
 * The nested `option_results` / `other_responses` / `voters` shapes are reached
 * through this type rather than aliased separately, since nothing imports them
 * on their own. Note that VoterInfo carries no write-in text: per-voter
 * write-ins live in `other_responses`, not on the voter.
 */
export type PollResults = components['schemas']['PollResultsResponse'];

// Request types
//
// Generated from the OpenAPI spec (`just gen-api-types`) rather than written by
// hand, so an unknown property is a build failure instead of a 422 at runtime.
//
// Note what is NOT here: the hand-written CreatePollRequest carried
// `created_by_character_id`, which POST /games/{gameID}/polls rejects outright
// (every schema is additionalProperties:false). Nothing set it, so it never
// fired — it would have 422'd the first time someone wired up "post a poll as a
// character". It remains on the `Poll` response above, which is a real field.
/** POST /games/{gameID}/polls */
export type CreatePollRequest = components['schemas']['CreatePollRequest'];

/** PUT /polls/{pollId} */
export type UpdatePollRequest = components['schemas']['UpdatePollRequest'];

/** POST /polls/{pollId}/vote */
export type SubmitVoteRequest = components['schemas']['SubmitVoteRequest'];
