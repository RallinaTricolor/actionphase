/**
 * Typed factories for API response shapes.
 *
 * Every factory returns the FULL generated type, so a field added to the
 * backend breaks this file -- one place -- instead of the dozens of test files
 * that build mocks by hand. Call sites pass only the fields the test is
 * actually about:
 *
 *     const comment = makeMessage({ content: 'hello', reply_count: 2 });
 *
 * Factories are typed against the aliases in `src/types/*.ts`, which already
 * point at the generated schemas. Do not import `components['schemas'][...]`
 * here when an alias exists -- that would add a second path to the same type.
 *
 * A mock is a claim about the wire. If the compiler says a field is missing,
 * add it with a value the server would really send; do not paper over it with
 * a cast. See .claude/planning/TYPECHECK_FRONTEND_TESTS.md
 */

import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from '@tanstack/react-query';
import { AxiosHeaders } from 'axios';
import type { AxiosResponse } from 'axios';
import { vi } from 'vitest';

import type { useAuth } from '../contexts/AuthContext';
import type { User } from '../types/auth';
import type { Character } from '../types/characters';
import type {
  DashboardDeadline,
  DashboardGameCard,
} from '../types/dashboard';
import type {
  Conversation,
  ConversationWithDetails,
} from '../types/conversations';
import type { EnrichedGameListItem } from '../types/games';
import type { CommentWithDepth, Message } from '../types/messages';
import type { GamePhase } from '../types/phases';

/**
 * One participant row. `src/types/conversations.ts` deliberately stopped
 * exporting a name for this -- the generated detail body carries the element
 * shape -- so it is recovered here rather than re-declared.
 */
type ConversationParticipant = ConversationWithDetails['participants'][number];

/**
 * A Message -- the detail shape returned by the post and comment endpoints.
 *
 * `comment_count`, `edit_count` and `is_draft` are required and were the single
 * biggest source of stale mocks: all three are plain non-`omitempty` Go fields,
 * so the wire always carries them (0 and false included).
 *
 * Note this is NOT the threaded-comment shape -- see makeCommentWithDepth.
 */
export function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    game_id: 1,
    author_id: 100,
    author_username: 'testuser',
    character_id: 1,
    character_name: 'Test Character',
    content: 'Test message content',
    message_type: 'comment',
    thread_depth: 0,
    comment_count: 0,
    edit_count: 0,
    is_draft: false,
    is_edited: false,
    is_deleted: false,
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T10:30:00Z',
    ...overrides,
  };
}

/**
 * One comment from the paginated threaded view.
 *
 * Deliberately narrower than Message: this endpoint does not send
 * comment_count, edit_count, is_draft, updated_at, deleted_at,
 * deleted_by_user_id or edited_at. It adds `depth` (nesting position in this
 * page's tree) alongside `thread_depth`, and `character_avatar_url` /
 * `mentioned_character_ids` are required-and-nullable rather than optional.
 */
export function makeCommentWithDepth(
  overrides: Partial<CommentWithDepth> = {},
): CommentWithDepth {
  return {
    id: 1,
    game_id: 1,
    author_id: 100,
    author_username: 'testuser',
    character_id: 1,
    character_name: 'Test Character',
    character_avatar_url: null,
    content: 'Test comment content',
    message_type: 'comment',
    depth: 0,
    thread_depth: 0,
    reply_count: 0,
    mentioned_character_ids: null,
    is_edited: false,
    is_deleted: false,
    created_at: '2025-01-15T10:30:00Z',
    ...overrides,
  };
}

/**
 * A Character.
 *
 * `status` is `'pending' | 'approved'` -- the approval state. It is NOT
 * liveness: that is the separate required `is_active` boolean. Mocks written
 * before the generated types commonly passed `status: 'active'`, which was
 * never a value the backend could send.
 *
 * The identity fields (`user_id`, `username`, `assigned_user_id`,
 * `assigned_username`, `character_type`) are dropped together for a regular
 * player in an anonymous game. To model that case, omit them as a unit.
 */
export function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 1,
    game_id: 1,
    user_id: 100,
    username: 'testuser',
    name: 'Test Character',
    character_type: 'player_character',
    status: 'approved',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * A User.
 *
 * `email` is required on this type and `created_at` / `updated_at` are not
 * fields at all -- several mocks supplied the latter pair, which the wire never
 * carries for a user. The optional flags (`is_admin`, `is_banned`,
 * `pending_approval`) default to absent rather than false: that is what the
 * server sends for an ordinary account.
 */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    ...overrides,
  };
}

/**
 * The full value `useAuth()` returns, for `vi.mocked(useAuth).mockReturnValue`.
 *
 * Every field is required, so this must be complete. Mocks previously cast
 * themselves with `as Partial<ReturnType<typeof useAuth>>`, which made each
 * field optional and so widened `currentUser` to include `undefined` -- a state
 * production cannot reach, because AuthContext resolves it through
 * `currentUser || null`. That cast also concealed a genuinely missing
 * `clearError`.
 *
 * The default is a logged-out, settled state: no user, not authenticated,
 * nothing in flight. Pass `currentUser` and `isAuthenticated` together -- a
 * user with `isAuthenticated: false` is not a state the provider produces.
 */
export function makeAuthContext(
  overrides: Partial<ReturnType<typeof useAuth>> = {},
): ReturnType<typeof useAuth> {
  return {
    currentUser: null,
    isAuthenticated: false,
    isLoading: false,
    isCheckingAuth: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    error: null,
    ...overrides,
  };
}

/**
 * One row of a conversation's participant list.
 *
 * There is deliberately no `email` field. Participant mocks written before the
 * generated types often carried one; the backend withholds it from this shape
 * on purpose, so a test that needs an email is asserting against a payload the
 * server does not send. Do not add it back.
 *
 * `character_id` and `character_name` are required-and-nullable: they are null
 * for a participant taking part as a user rather than through a character.
 * `last_read_at` is required -- a participant row is created with the join
 * timestamp already in it, never absent.
 */
export function makeConversationParticipant(
  overrides: Partial<ConversationParticipant> = {},
): ConversationParticipant {
  return {
    id: 1,
    conversation_id: 1,
    user_id: 100,
    username: 'testuser',
    character_id: 1,
    character_name: 'Test Character',
    joined_at: '2025-01-15T10:00:00Z',
    last_read_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

/**
 * A Conversation -- the bare record, without its participants.
 *
 * `title` is required-and-nullable (null for an untitled conversation) and
 * `created_by_user_id` / `updated_at` are required. Mocks commonly omitted all
 * three.
 */
export function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 1,
    game_id: 1,
    title: 'Test Conversation',
    conversation_type: 'direct',
    created_by_user_id: 100,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

/**
 * A conversation plus its participants, as the detail endpoint returns it.
 *
 * `participants` defaults to a single participant rather than `[]`: an empty
 * array widens to `never[]` at a mock's call site, which is what made every
 * later push into it fail to typecheck. A zero-participant conversation also
 * cannot be committed -- see the note on ConversationWithDetails.
 */
export function makeConversationWithDetails(
  overrides: Partial<ConversationWithDetails> = {},
): ConversationWithDetails {
  return {
    conversation: makeConversation(),
    participants: [makeConversationParticipant()],
    ...overrides,
  };
}

/**
 * A complete AxiosResponse wrapping `data`, for mocking an api-client method.
 *
 * Tests previously cast a bare `{ data }` with
 * `as Partial<AxiosResponse<T>>`, which does not typecheck against
 * `mockResolvedValue` (it wants the whole response) and, worse, made `data`
 * itself optional -- so a wrong or missing payload inside it went unreported.
 *
 * The envelope fields are what axios fills in for a plain 200: the api client
 * reads only `data`, so they exist to make the type whole rather than to be
 * asserted on. Pass `status` when a test turns on it.
 */
export function makeAxiosResponse<T>(
  data: T,
  overrides: Partial<AxiosResponse<T>> = {},
): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
    ...overrides,
  };
}

/**
 * A partial React Query result, for mocking a hook that wraps useQuery.
 *
 * This is the one place the typecheck plan sanctions `as unknown as` -- a real
 * UseQueryResult has ~25 fields (status flags, refetch, fetchStatus, dataUpdatedAt,
 * promise, ...) and a component reads three or four of them. Building all of them
 * would assert nothing and break on every React Query upgrade, so the cast is
 * confined here instead of being repeated at each call site.
 *
 * It is NOT a licence to skip fields on a *wire* shape: pass a complete payload
 * as `data`, built with the factories above. The escape covers the query
 * envelope only.
 */
export function makeQueryResult<T>(
  partial: Partial<UseQueryResult<T, Error>>,
): UseQueryResult<T, Error> {
  return partial as unknown as UseQueryResult<T, Error>;
}

/**
 * A partial React Query infinite-query result. Same rationale and same
 * restriction as makeQueryResult: the envelope may be partial, the `data`
 * inside it may not.
 *
 * The type parameter is the PAGE type, not the shape of `data`: an infinite
 * query's `data` is `InfiniteData<TPage>`, i.e. `{ pages, pageParams }`. Casts
 * that named the flat page-content type instead were describing a shape React
 * Query never produces.
 */
export function makeInfiniteQueryResult<TPage>(
  partial: Partial<UseInfiniteQueryResult<InfiniteData<TPage>, Error>>,
): UseInfiniteQueryResult<InfiniteData<TPage>, Error> {
  return partial as unknown as UseInfiniteQueryResult<InfiniteData<TPage>, Error>;
}

/**
 * A dashboard game card.
 *
 * The six optional fields (`current_phase_*`, `description`, `genre`) are
 * omitempty pointers on the Go side, so they are ABSENT rather than null when
 * unset -- see the note on DashboardGameCard in src/types/dashboard.ts.
 */
export function makeDashboardGameCard(
  overrides: Partial<DashboardGameCard> = {},
): DashboardGameCard {
  return {
    game_id: 1,
    title: 'Test Game',
    state: 'in_progress',
    user_role: 'player',
    gm_user_id: 2,
    gm_username: 'testgm',
    has_pending_action: false,
    is_urgent: false,
    deadline_status: 'normal',
    pending_applications: 0,
    unread_comments: 0,
    unvoted_polls: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * An upcoming dashboard deadline.
 *
 * `deadline_type`, `source_id` and `has_pending_submission` are required: a
 * deadline row always says what kind it is and what it points at. Mocks that
 * omitted them were describing a payload the aggregator cannot produce.
 */
export function makeDashboardDeadline(
  overrides: Partial<DashboardDeadline> = {},
): DashboardDeadline {
  return {
    phase_id: 1,
    game_id: 1,
    game_title: 'Test Game',
    phase_type: 'action',
    phase_title: 'Phase 1',
    phase_number: 1,
    title: 'Test Deadline',
    deadline_type: 'phase',
    source_id: 1,
    end_time: '2025-02-01T00:00:00Z',
    hours_remaining: 24,
    has_pending_submission: false,
    ...overrides,
  };
}

/**
 * A game as the browse/listing endpoint returns it.
 *
 * The optional fields (`banner_url`, `current_phase_*`, `end_date`, `genre`,
 * `max_players`, `recruitment_deadline`, `start_date`) are omitempty on the Go
 * side, so they are ABSENT rather than null when unset.
 *
 * Note `description` is required and non-omitempty -- it is '' for a game with
 * no description, never missing -- while `max_players` is genuinely optional.
 */
export function makeGameListItem(
  overrides: Partial<EnrichedGameListItem> = {},
): EnrichedGameListItem {
  return {
    id: 1,
    title: 'Test Game',
    description: 'A game for testing',
    state: 'recruitment',
    gm_user_id: 2,
    gm_username: 'testgm',
    current_players: 1,
    is_anonymous: false,
    auto_accept_audience: false,
    allow_group_conversations: true,
    portrait_avatars: false,
    has_recent_activity: false,
    deadline_urgency: 'normal',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * A game phase.
 *
 * `is_active` is the liveness flag; `is_expired` and `is_published` are equally
 * required. There is no `is_current` field -- mocks that set one were inventing
 * it, and consumers that need "the current phase" compare `phase_number` or
 * read `is_active`.
 *
 * `is_published` means "the GM has published this phase's action results", NOT
 * phase visibility, and is always false for common_room and interlude phases.
 */
export function makeGamePhase(overrides: Partial<GamePhase> = {}): GamePhase {
  return {
    id: 1,
    game_id: 1,
    phase_number: 1,
    phase_type: 'action',
    is_active: true,
    is_expired: false,
    is_published: false,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}
