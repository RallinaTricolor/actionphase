import type { components } from './api.gen';

/**
 * A game as every read endpoint returns it — generated.
 *
 * ONE type, not three. `Game`, `GameWithDetails` and `GameListItem` used to be
 * separate hand-written interfaces, but nothing about a game is
 * role-conditional the way a character's fields are: the differences between
 * them were only which JOINs each backend query happened to do, and the two
 * read endpoints had identical auth. `GET /games/{id}` now answers with the
 * joined shape too, so there is one thing to describe.
 *
 * `character_sheet` is sparse per-game overrides — absent for almost every
 * game, meaning "use the defaults" (which live in `useSheetLabels` and nowhere
 * else), never "this game has no tab labels".
 *
 * `community_id`/`community_name`/`community_slug` are absent for games
 * predating communities (req 5). Absent means "legacy game", never
 * "community 0": surfaces render nothing rather than a placeholder, and bans
 * never apply to these.
 */
export type GameWithDetails = components['schemas']['GameWithDetailsResponse'];

/**
 * @deprecated Use `GameWithDetails`. Kept as an alias so the many existing
 * references keep compiling; they describe the same wire shape.
 */
export type Game = GameWithDetails;

/**
 * What create and update answer with — generated.
 *
 * Narrower than `GameWithDetails` for a real reason, not an accidental one:
 * a write has only the row it just wrote, so it cannot supply `gm_username`,
 * `current_players` or the community join without a second query. Refetch if
 * you need those — nothing currently does.
 */
export type GameWritten = components['schemas']['GameResponse'];

/**
 * Generated. One entry of GET /games/{id}/participants.
 *
 * The endpoint built a `map[string]any` until 2026-09-16, so there was no schema
 * and this shape was hand-maintained against it. Two fields were declared
 * optional that the server always sends: `avatar_url` (explicit null, never an
 * absent key -- the client reads it directly to decide whether to render an
 * avatar) and `is_former_player`. The three PeopleView filters that read the
 * latter truthily are unaffected by the narrowing.
 *
 * `email` is deliberately absent: this list withholds it for privacy, which is
 * why it is a different shape from the single-participant write response.
 *
 * In an anonymous game a viewer who may not see former-player status gets those
 * participants reported as ordinary players -- `role` spoofed to "player",
 * `is_former_player` cleared -- so neither field can be trusted to reveal that
 * status to an unprivileged viewer. That is the point.
 */
export type GameParticipant = components['schemas']['ParticipantListItemResponse'];

/**
 * Generated. GET /games/{id}/audience.
 *
 * Its members are a strict SUBSET of GameParticipant: no `avatar_url` and no
 * `is_former_player`. The api-client used to annotate this route with
 * GameParticipant[], promising two fields it never sends.
 */
export type AudienceMembersResponse = components['schemas']['ListAudienceMembersResponse'];

/**
 * A game's lifecycle state.
 *
 * DERIVED, not hand-written. The members come from core.ValidGameStates in Go,
 * through the OpenAPI spec, to here -- so this union cannot drift from the
 * backend the way a maintained copy could.
 *
 * Read off UpdateGameStateBody rather than a response schema because that
 * endpoint is the one place the full set is accepted as INPUT: a response can
 * only ever report a state, while this is the contract for setting one.
 *
 * Huma inlines scalar enums rather than emitting a $ref, so there is no
 * components['schemas']['GameState'] to alias -- indexing a schema property is
 * how a named union is recovered. Same technique as GamePhase['phase_type'].
 */
export type GameState = components['schemas']['UpdateGameStateBody']['state'];

// ParticipantRole / ParticipantStatus were declared here by hand purely to type
// GameParticipant's two fields. That type is generated now and carries the
// unions itself (from enum tags on the Go struct), leaving these with no
// consumers at all -- so they are deleted rather than re-exported as indexed
// aliases, which would only be dead code knip would flag. Recover either union
// as GameParticipant['role'] / ['status'] if one is ever needed.

/**
 * POST /games — generated.
 *
 * `community_id` is required: every new game belongs to a community.
 * Deliberately OPTIONAL on update below -- reassignment is a separate,
 * differently-authorized operation (setup-only for the GM), not a field on an
 * ordinary profile edit.
 *
 * `character_sheet` carries only the labels the GM actually overrode. Empty
 * strings must be omitted rather than sent as "": the backend rejects
 * whitespace-only labels, and a blank box means "use the default", not "name
 * this tab nothing".
 */
export type CreateGameRequest = components['schemas']['CreateGameBody'];

/**
 * PUT /games/{id} — generated.
 *
 * Was `Omit<CreateGameRequest, 'community_id'>` plus a re-widened
 * `community_id?`. The spec declares the body in full, so the derivation is
 * unnecessary: community_id is preserve-on-absent here (omitting it leaves the
 * game's community alone rather than clearing it), and the server only honours
 * it while the game is in setup.
 */
export type UpdateGameRequest = components['schemas']['UpdateGameBody'];

/**
 * POST /games/{gameID}/apply — generated from the OpenAPI spec
 * (`just gen-api-types`), so an unknown property is a build failure rather than
 * a 422 at runtime.
 */
export type ApplyToGameRequest = components['schemas']['ApplyToGameBody'];

/**
 * Generated. One entry of the GM's application list.
 *
 * `username` was optional and is always sent. The four genuinely optional
 * fields stay optional, and their absence is meaningful: an unreviewed
 * application omits `reviewed_at` and `reviewed_by_user_id` entirely rather
 * than sending null, so absence is how you tell pending from reviewed.
 *
 * `email` is withheld here even though the GM is the only caller.
 */
export type GameApplication = components['schemas']['ApplicationListItemResponse'];


/** Generated. One line of a game's log. */
export type GameLog = components['schemas']['GameLogEntryResponse'];

/**
 * Arguments to the loot-table mutation hooks -- NOT wire types.
 *
 * `id` is a PATH parameter, and the API client strips it before sending: the
 * body that actually goes over the wire is UpdateLootTableBody ({name, items}).
 * These were named `...Request` and sat beside the generated request types,
 * which read as though they described a payload. They describe a function
 * argument, so they are named for that.
 */
export interface CreateLootTableArgs {
  name: string;
  items: LootTableContent[] | undefined;
}

export interface UpdateLootTableArgs {
  id: number;
  name: string;
}

export interface UpdateLootTableContentsArgs {
  id: number;
  items: LootTableContent[];
}

/**
 * Generated. A loot table.
 *
 * The list and create endpoints now share one Go struct, so the two can no
 * longer disagree about what a loot table is -- the backend previously kept
 * them in sync by hand, with a comment asking the next editor to remember.
 *
 * `updated_at` is bumped when the table is renamed; it equals created_at until
 * then.
 */
export type LootTable = components['schemas']['GameLootTableResponse'];

/**
 * Generated. One item in a loot table, as the list returns it.
 *
 * Narrower than the single-item write response, which also carries
 * `loot_table_id`. `data` is a plain string: the handler flattens a NULL column
 * to "".
 */
export type LootTableContent = components['schemas']['LootTableContentResponse'];

/**
 * Generated. The applicant list shown during recruitment.
 *
 * Username and role only -- no status, message, email or review information,
 * because this endpoint is readable by anyone. It is a deliberately separate
 * shape from GameApplication rather than a filtered view of it.
 */
export type PublicGameApplicant = components['schemas']['PublicApplicantResponse'];

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/** PUT /games/{gameID}/applications/{applicationId} — generated, as above. */
export type ReviewApplicationRequest = components['schemas']['ReviewApplicationBody'];

/**
 * PUT /games/{gameID}/state — generated. `state` carries the enum, so an
 * invalid state is a build failure rather than a 422.
 */
export type UpdateGameStateRequest = components['schemas']['UpdateGameStateBody'];

/**
 * What PUT /games/{gameID}/state answers with — generated.
 *
 * Deliberately NOT `Game`. The endpoint sends id, title, description,
 * gm_user_id, state and the timestamps, and nothing else. It used to declare
 * the full GameResponse, so the four settings booleans
 * (`is_anonymous`, `auto_accept_audience`, `allow_group_conversations`,
 * `portrait_avatars`) read as `false` on every response regardless of what the
 * game had stored — a lie the generated types spread to every consumer.
 *
 * Refetch the game if you need its settings. Pinned on the Go side by
 * TestUpdateGameStateResponseMatchesWhatItSends.
 */
export type GameStateChangedResponse =
  components['schemas']['GameStateChangedResponse'];

export const GAME_STATE_LABELS: Record<GameState, string> = {
  setup: 'Setup',
  recruitment: 'Recruiting Players',
  character_creation: 'Character Creation',
  in_progress: 'In Progress',
  paused: 'Paused',
  epilogue: 'Epilogue',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const GAME_STATE_COLORS: Record<GameState, string> = {
  setup: 'surface-raised text-content-secondary',
  recruitment: 'bg-semantic-success-subtle text-content-primary',
  character_creation: 'bg-semantic-info-subtle text-content-primary',
  in_progress: 'bg-semantic-warning-subtle text-content-primary',
  // Paused is distinct from in_progress: same "live game" family, but muted,
  // because a paused game needs nothing from you.
  paused: 'surface-raised text-content-secondary',
  // Epilogue is still a live game people can post in, so it keeps an active
  // colour rather than the muted archive treatment. Warning family to match
  // in_progress (it is live play); the label text carries the distinction.
  epilogue: 'bg-semantic-warning-subtle text-content-primary',
  // Completed stays quiet so an archive never reads as a call to action.
  completed: 'surface-raised text-content-secondary',
  // Cancelled keeps danger styling: this badge is also the headline status on
  // GameHeader, where "this game was cancelled" is information the reader needs.
  cancelled: 'bg-semantic-danger-subtle text-content-primary'
};

/**
 * Card border/tint per game state, used by the games list to make a game's
 * state legible at a glance.
 *
 * The scale is deliberately one of *urgency*, not just identity: states that
 * warrant a click get a saturated border plus a tint, and terminal states
 * (completed/cancelled) are deliberately muted so an archive never competes
 * for attention with a live game. "You are in this game" is conveyed by the
 * relationship badge instead — see USER_RELATIONSHIP_LABELS.
 */
export const GAME_STATE_CARD_STYLES: Record<GameState, string> = {
  // Actionable: you can apply right now.
  recruitment: 'border-semantic-success bg-semantic-success-subtle',
  // Live play — likely wants your attention.
  in_progress: 'border-semantic-warning bg-semantic-warning-subtle',
  // Active, but still spinning up.
  character_creation: 'border-semantic-info bg-semantic-info-subtle',
  // On hold: visible, but no tint since there is nothing to do.
  paused: 'border-theme-strong',
  // Not yet open to anyone but the GM.
  setup: 'border-theme-subtle',
  // Winding down but still writable. Shares the warning family with in_progress
  // because it IS live play, but drops the tint to sit one step down the urgency
  // scale: more than paused, less than an active game. Deliberately not the info
  // family — that belongs to character_creation, and at a glance across a list
  // two blue cards read as the same state.
  epilogue: 'border-semantic-warning',
  // Terminal states are muted on purpose: readable, never a CTA.
  completed: 'border-theme-subtle',
  cancelled: 'border-theme-subtle'
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending: 'bg-semantic-warning-subtle text-content-primary',
  approved: 'bg-semantic-success-subtle text-content-primary',
  rejected: 'bg-semantic-danger-subtle text-content-primary',
  withdrawn: 'surface-raised text-content-secondary'
};

// Enhanced game listing types

/**
 * One row of the games listing — generated.
 *
 * The one game shape that genuinely differs rather than differing by accident:
 * `user_relationship` is viewer-dependent, and the phase and activity columns
 * are aggregates only the listing query computes. A single-game read cannot
 * answer them, so this is not `GameWithDetails` with extras.
 */
export type EnrichedGameListItem = components['schemas']['EnrichedGameListItemResponse'];

/**
 * The viewer's relationship to a game — DERIVED from the spec, not maintained.
 *
 * `participant` means specifically a *player*: co-GMs and audience members get
 * their own values so the games-list badge can name the role accurately.
 *
 * There is no `'none'` member. The listing query emits it, but the backend's
 * `interfaceToStringPtr` maps both `''` and `'none'` to nil, so it never
 * reaches the wire — absent IS "none". The hand-written union used to include
 * it, which forced dead `none: ''` entries in both maps below.
 */
export type UserRelationship = NonNullable<EnrichedGameListItem['user_relationship']>;

export type GameListingResponse = components['schemas']['GameListingResponse'];

export type ParticipationFilter = 'my_games' | 'applied' | 'not_joined';
export type SortBy = 'recent_activity' | 'created' | 'start_date' | 'alphabetical';

export interface GameListingFilters {
  search?: string;
  states?: GameState[];
  participation?: ParticipationFilter;
  has_open_spots?: boolean;
  /** Only games in this community. Omitted means every community. */
  community_id?: number;
  sort_by?: SortBy;
  page?: number;
  page_size?: number;
}


export const USER_RELATIONSHIP_LABELS: Record<UserRelationship, string> = {
  gm: 'GM',
  co_gm: 'Co-GM',
  participant: 'Player',
  audience: 'Audience',
  applied: 'Applied'
};

/**
 * Badge styling per relationship. Outlined on a solid background so the badge
 * stays legible over the state tint the card carries (GAME_STATE_CARD_STYLES).
 *
 * Roles that confer authority (GM, Co-GM) read as primary; roles that are
 * simply "you are in this game" read as info; a pending application reads as
 * warning because it is the only one awaiting someone else's decision.
 */
export const USER_RELATIONSHIP_BADGE_STYLES: Record<UserRelationship, string> = {
  gm: 'border-interactive-primary text-interactive-primary',
  co_gm: 'border-interactive-primary text-interactive-primary',
  participant: 'border-semantic-info text-semantic-info',
  audience: 'border-semantic-info text-semantic-info',
  applied: 'border-semantic-warning text-semantic-warning'
};

export const SORT_BY_LABELS: Record<SortBy, string> = {
  recent_activity: 'Recent Activity',
  created: 'Recently Created',
  start_date: 'Starting Soon',
  alphabetical: 'Alphabetical'
};
