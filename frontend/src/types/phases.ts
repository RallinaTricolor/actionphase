import type { components } from './api.gen';

/**
 * Generated. A phase as returned by every phase endpoint.
 *
 * Two fields the hand-written predecessor got wrong, both in the direction that
 * suppresses the error rather than causing one:
 *
 * `start_time` was declared required. It means "auto-activate at", not "when
 * this phase began", and migration 20260401152638 dropped its NOT NULL and
 * cleared it on inactive phases — so a GM who creates a phase without
 * scheduling it gets a row with no start_time. `CurrentPhaseDisplay` rendered
 * `new Date(phase.start_time)` on it unguarded and printed "Invalid Date" in
 * two places; the `deadline` field beside it was guarded, so the pattern was
 * understood and this one was missed because the type promised it was safe.
 *
 * `is_expired` was declared optional and is in fact always sent (a plain `bool`
 * on the Go side). That is the poll `is_expired` bug inverted — there an absent
 * field was typed present, here a present field was typed absent, and both let
 * a `filter`/guard silently do nothing.
 */
export type GamePhase = components['schemas']['PhaseResponse'];

// Request types
//
// Generated from the OpenAPI spec (`just gen-api-types`) rather than written by
// hand, so an unknown property is a build failure instead of a 422 at runtime.
//
// Note what is NOT here: the hand-written UpdatePhaseRequest carried
// `end_time`, which PUT /phases/{id} rejects outright (every schema is
// additionalProperties:false). EditPhaseModal happened to build its payload
// from only the four permitted fields, so it never fired — it would have 422'd
// the moment anyone added an end-time control. Create still accepts end_time;
// update genuinely does not.
/** POST /games/{gameID}/phases */
export type CreatePhaseRequest = components['schemas']['CreatePhaseBody'];

/** PUT /phases/{id} */
export type UpdatePhaseRequest = components['schemas']['UpdatePhaseBody'];

/** PUT /phases/{id}/deadline — distinct from PATCH /deadlines/{deadlineId},
 *  which takes the wider DeadlineBody (see types/deadlines.ts). */
export type UpdateDeadlineRequest = components['schemas']['UpdateDeadlineBody'];

/**
 * Generated. A bare action submission, without the joined phase/author columns
 * that ActionWithDetails carries.
 */
export type ActionSubmission = components['schemas']['ActionResponse'];

/** POST /games/{gameID}/actions */
export type ActionSubmissionRequest = components['schemas']['SubmitActionBody'];

/**
 * Generated. An action with the joined phase and author columns.
 *
 * `phase_title` is gone: no Go struct has ever carried it, so
 * `action.phase_title || action.phase_type.replace(...)` in ActionsList always
 * took the right-hand branch. The dead left side is removed with it.
 *
 * `username` is required here, not optional as the hand-written type claimed —
 * it is a plain `string` on the wire. The `||` chains that coalesce it stay
 * valid; they just cannot fire any more.
 */
export type ActionWithDetails = components['schemas']['ActionWithDetailsResponse'];

/**
 * Generated. An action result with its joined phase, author and staging columns.
 *
 * `sent_at` is now optional, matching `*time.Time` with omitempty on the Go
 * side. Every read site already guarded it (`result.sent_at && ...`), so this
 * only makes the type agree with code that was already correct.
 *
 * The staged-reveal fields keep their meaning: `released_at` absent is how you
 * tell a locked part from a released one (NOT an empty content string -- a
 * player's response carries locked parts with content blanked server-side), and
 * `unlocks_at` is present only for the next part due out, since later parts have
 * no knowable unlock time until their predecessor releases.
 */
export type ActionResult = components['schemas']['ActionResultWithDetailsResponse'];

// One part of a staged result chain as the GM composes it. The head must carry
// delay_minutes: 0 — its delay is meaningless because it releases on publish,
// and the API rejects a head with a non-zero delay rather than ignoring it.
export interface StagedResultPart {
  content: string;
  delay_minutes: number;
}

export type DraftCharacterUpdate = components['schemas']['DraftCharacterUpdateResponse'];

/** POST /games/{gameID}/results/{resultId}/character-updates */
export type CreateDraftCharacterUpdateRequest = components['schemas']['CreateDraftUpdateBody'];

/** PUT /games/{gameID}/results/{resultId}/character-updates/{draftId} */
export type UpdateDraftCharacterUpdateRequest = components['schemas']['UpdateDraftUpdateBody'];

// Phase display helpers
export const PHASE_TYPE_LABELS: Record<GamePhase['phase_type'], string> = {
  common_room: 'Common Room',
  action: 'Action Phase',
  interlude: 'Interlude'
};

export const PHASE_TYPE_DESCRIPTIONS: Record<GamePhase['phase_type'], string> = {
  common_room: 'Open discussion and roleplay between characters. The GM creates a public post and players can comment and send private messages.',
  action: 'Players submit private actions to the GM for resolution. No public roleplay or private messaging.',
  interlude: 'Private messaging only. No public post or action submissions.'
};

const PHASE_TYPE_COLORS: Record<GamePhase['phase_type'], string> = {
  common_room: 'bg-semantic-success-subtle text-content-primary border-semantic-success',
  action: 'bg-interactive-primary-subtle text-content-primary border-interactive-primary',
  interlude: 'bg-semantic-warning-subtle text-content-primary border-semantic-warning'
};

// Action phase states
export const getActionPhaseLabel = (phase: GamePhase): string => {
  if (phase.phase_type !== 'action') return PHASE_TYPE_LABELS[phase.phase_type];
  return phase.is_published ? 'Results Published' : 'Action Phase';
};

export const getActionPhaseDescription = (phase: GamePhase): string => {
  if (phase.phase_type !== 'action') return PHASE_TYPE_DESCRIPTIONS[phase.phase_type];
  return phase.is_published
    ? 'GM has published the results and consequences of player actions'
    : 'Submit private actions to the GM';
};

export const getActionPhaseColor = (phase: GamePhase): string => {
  if (phase.phase_type !== 'action') return PHASE_TYPE_COLORS[phase.phase_type];
  return phase.is_published
    ? 'bg-semantic-info-subtle text-content-primary border-semantic-info'
    : 'bg-interactive-primary-subtle text-content-primary border-interactive-primary';
};
