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

// Manually read comment IDs for a post (user-controlled, persisted)
export interface ManualCommentReads {
  post_id: number;
  read_comment_ids: number[];
}

// Paginated comments with threads (includes depth for tree building)
export interface CommentWithDepth extends Message {
  depth: number; // Nesting depth (0 = top-level, 1+ = nested replies)
}

export interface PaginatedCommentsResponse {
  comments: CommentWithDepth[];
  total_top_level: number;      // Total top-level comments
  returned_top_level: number;   // Top-level comments in this response
  returned_total: number;       // Total comments including nested
  has_more: boolean;            // More pages available?
  limit: number;
  offset: number;
}

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

export interface FavoriteCommentsResponse {
  favorites: FavoriteComment[];
  // Cursor-paginated, not {limit, offset, total}: unfavoriting removes a row
  // from the middle of the ordered set, which shifts every later offset
  // boundary and skips a favorite. No total -- nothing renders one.
  pagination: {
    limit: number;
    // Opaque -- hand it back verbatim. Null on the last page.
    next_cursor: string | null;
  };
}

export type FavoriteCommentIDsResponse =
  components['schemas']['FavoriteCommentIDsResponse'];

// A post or comment by a specific character (for Character Page)
export interface CharacterMessage {
  id: number;
  game_id: number;
  parent_id?: number | null;
  author_id: number;
  character_id: number;
  content: string;
  message_type: 'post' | 'comment';
  created_at: string;
  edited_at?: string | null;
  edit_count: number;
  deleted_at?: string | null;
  is_deleted: boolean;
  author_username: string;
  character_name?: string | null;
  character_avatar_url?: string | null;

  // Parent context (only set for comments)
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

export interface CharacterMessagesResponse {
  messages: CharacterMessage[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}
