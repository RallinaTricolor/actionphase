// Message/Post types for Common Room

import type { components } from './api.gen';

/**
 * Generated.
 *
 * The edit/delete tracking fields and `character_avatar_url` are absent, never
 * null: each is an `omitempty` pointer on the Go side, so a nil value omits the
 * key rather than marshalling `null`. The hand-written `| null` was fiction.
 *
 * `comment_count` and `edit_count` are REQUIRED here, not optional -- both are
 * plain int fields with no `omitempty`, so they are always present (0 included).
 * MessageResponse even carries a Go comment saying so for comment_count.
 */
export type Message = components['schemas']['MessageResponse'];

// Request types
//
// Generated from the OpenAPI spec (`just gen-api-types`) rather than written by
// hand, so an unknown property is a build failure instead of a 422 at runtime.

/** POST /games/{gameID}/posts */
export type CreatePostRequest = components['schemas']['CreatePostRequest'];

/** POST /games/{gameID}/posts/{postId}/comments */
export type CreateCommentRequest = components['schemas']['CreateCommentRequest'];

/** PATCH /games/{gameID}/posts/{postId}/comments/{commentId} */
export type UpdateCommentRequest = components['schemas']['UpdateCommentRequest'];

export interface GetPostsParams {
  phase_id?: number;
  limit?: number;
  offset?: number;
}

/**
 * Read tracking — generated.
 *
 * `last_read_comment_id` is REQUIRED but nullable, not optional: the Go field is
 * a bare `*int32` with no `omitempty`, so the key is always present and carries
 * an explicit null when only the post itself was read. That is the opposite of
 * the request shape -- MarkPostReadRequest OMITS the key to mean the same thing.
 */
export type ReadMarker = components['schemas']['ReadMarkerResponse'];

/** Generated. `latest_comment_at` is absent rather than null -- see Message. */
export type PostUnreadInfo = components['schemas']['PostUnreadInfoResponse'];

/**
 * POST /games/{gameID}/posts/{postId}/mark-read — generated.
 *
 * The whole body is optional: marking a post read without naming a comment is
 * a valid request, and every caller here sends `{}`. Omitting
 * `last_read_comment_id` is how you mark the post itself -- the backend reads
 * absence, not an explicit null.
 */
export type MarkPostReadRequest = components['schemas']['MarkPostReadRequest'];

// Unread comment IDs for posts (new since last visit). Generated.
export type PostUnreadComments = components['schemas']['PostUnreadCommentsResponse'];

// Manually read comment IDs for a post (user-controlled, persisted). Generated.
//
// `read_comment_ids` needed a backend `nullable:"false"` first, exactly as its
// sibling PostUnreadComments did -- the two structs sit six lines apart and only
// one had been tagged. The service seeds every map entry with []int32{} and only
// appends, so the null the spec reported was unreachable.
export type ManualCommentReads = components['schemas']['ManualReadCommentIDsResponse'];

/**
 * Generated. One comment in the paginated tree view, with the depth the client
 * needs to nest it.
 *
 * Was `extends Message`, which claimed SEVEN fields this endpoint does not
 * send: comment_count, edit_count, is_draft, updated_at, deleted_at,
 * deleted_by_user_id and edited_at. The threaded list is deliberately narrower
 * than the detail response.
 *
 * ThreadedComment.tsx reads edited_at / edit_count / deleted_at, which looks
 * like a bug but is not: its `comment` prop is `Message | CommentTreeNode`, so
 * those reads serve the Message arm and are `&&`-guarded for the tree arm. They
 * were simply never reachable through a tree node, and now the type says so.
 */
export type CommentWithDepth = components['schemas']['ThreadedCommentResponse'];

/**
 * Generated. One page of the threaded comment view.
 *
 * Four counts because they answer different questions: total_top_level drives
 * the pager, returned_top_level / returned_total describe this page (which
 * holds nested replies as well as top-level comments), and has_more says
 * whether paging further is worthwhile.
 *
 * `comments` needed a backend `nullable:"false"` first -- it is make()d before
 * the loop, so the null huma inferred was unreachable.
 */
export type PaginatedCommentsResponse = components['schemas']['PaginatedCommentsResponse'];

// Deep-link thread context (for jumping to a nested comment).
// Returned by GET /games/{id}/messages/{messageId}/thread-context.
//
// Generated. `chain` is non-nullable: it is built with
// make([]*MessageResponse, len(...)) and carries the target comment plus up to
// max_parents nearest ancestors, ordered parent-to-child.
export type MessageThreadContext = components['schemas']['MessageThreadContextResponse'];

// Comment with parent context (for "New Comments" view)
export interface CommentWithParent {
  // Comment data
  id: number;
  game_id: number;
  parent_id?: number | null;
  post_id?: number | null;
  author_id: number;
  character_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  edited_at?: string | null;
  edit_count: number;
  deleted_at?: string | null;
  is_deleted: boolean;
  author_username: string;
  character_name?: string | null;
  character_avatar_url?: string | null;

  // Parent context (nested object from backend)
  parent?: {
    content?: string | null;
    created_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean | null;
    message_type?: string | null;
    author_username?: string | null;
    character_name?: string | null;
    character_avatar_url?: string | null;
  } | null;

  // Parent context (flattened fields)
  parent_content?: string | null;
  parent_created_at?: string | null;
  parent_deleted_at?: string | null;
  parent_is_deleted?: boolean | null;
  parent_message_type?: string | null;
  parent_author_username?: string | null;
  parent_character_name?: string | null;
  parent_character_avatar_url?: string | null;
}

// Pagination response for recent comments
export interface RecentCommentsResponse {
  comments: CommentWithParent[];
  total: number;
  limit: number;
  offset: number;
}

// A comment the user has privately starred, from the cross-game /favorites list.
//
// Deliberately NOT `extends CommentWithParent`. The favorites endpoint is its
// own response type on the backend (see FavoriteCommentResponse) and sends
// neither `updated_at` nor the flattened `parent_*` fields, so extending would
// promise fields that never arrive. It carries the two things a card needs to
// stand on its own outside its game: the game's title, and when it was starred.
export interface FavoriteComment {
  id: number;
  game_id: number;
  game_title: string;
  parent_id?: number | null;
  post_id?: number | null;
  author_id: number;
  character_id: number;
  content: string;
  created_at: string;
  edited_at?: string | null;
  edit_count: number;
  deleted_at?: string | null;
  is_deleted: boolean;
  author_username: string;
  character_name?: string | null;
  character_avatar_url?: string | null;
  favorited_at: string;

  // Present only when the comment has a parent to show.
  parent?: {
    content?: string | null;
    created_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean | null;
    message_type?: string | null;
    author_username?: string | null;
    character_name?: string | null;
    character_avatar_url?: string | null;
  } | null;
}

/**
 * Generated. One page of the cross-game favorites list.
 *
 * Cursor-paginated, not {limit, offset, total}: unfavoriting removes a row from
 * the middle of the ordered set, which shifts every later offset boundary and
 * skips a favorite. There is no total -- nothing renders one.
 */
export type FavoriteCommentsResponse = components['schemas']['FavoriteCommentsResponse'];

export type FavoriteCommentIDsResponse =
  components['schemas']['FavoriteCommentIDsResponse'];

// A post or comment by a specific character (for Character Page)
/**
 * Generated. A post or comment attributed to a character, for the character
 * page feed.
 *
 * `message_type` keeps its `'post' | 'comment'` union because the Go field is
 * now enum-tagged: the query filters on visibility='game', so the ENUM's third
 * member (private_message) cannot reach this endpoint. Untagged it rendered as
 * bare `string`, and aliasing would have widened it.
 *
 * The many `?: T | null` fields collapse to required-and-nullable. Every one is
 * a bare pointer without omitempty on the Go side, so the key is always present
 * and carries an explicit null -- "absent" was never a state the wire produced.
 */
export type CharacterMessage = components['schemas']['CharacterMessageResponse'];

/** Generated. One page of a character's posts and comments. */
export type CharacterMessagesResponse = components['schemas']['CharacterMessagesResponse'];
