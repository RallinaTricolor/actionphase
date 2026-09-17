import type { components } from './api.gen';

/**
 * Generated. `title` is REQUIRED but nullable, not optional: the Go field is a
 * bare `*string` with no `omitempty`, so an untitled conversation sends
 * `"title": null` rather than dropping the key. Every render site coalesces it
 * to 'Untitled Conversation', which stays correct for null as it was for
 * undefined.
 */
export type Conversation = components['schemas']['ConversationResponse'];

// The module-private ConversationParticipant that used to sit here existed
// only to type ConversationWithDetails.participants. That type is generated
// now and carries the element shape itself, leaving this with no consumers --
// so it is deleted rather than kept as a parallel definition that could drift.
// Recover it as ConversationWithDetails['participants'][number] if needed.

export interface PrivateMessage {
  id: number;
  conversation_id: number;
  sender_user_id?: number;
  sender_character_id?: number;
  content: string;
  sent_at?: string;
  created_at: string;
  sender_username: string;
  sender_character_name?: string;
  sender_avatar_url?: string | null;
  deleted_at?: string;
  is_deleted?: boolean;
  is_edited?: boolean;
  edited_at?: string;
  edit_count?: number;
}

/**
 * Generated. Note the nullable fields carry an explicit null rather than being
 * absent: `title` is null for untitled conversations, and
 * `last_read_message_id` is null until the caller has read something here.
 * `last_message` is an empty string when there are no messages yet.
 */
export type ConversationListItem = components['schemas']['ConversationListItemResponse'];

/**
 * Generated. A conversation plus its participant list.
 *
 * `participants` needed a backend `nullable:"false"` first. Its converter opens
 * `if rows == nil { return nil }` and sqlc does return nil for zero rows, so
 * the branch is reachable in principle -- but every participant insert runs in
 * the transaction that creates the conversation, so a zero-participant
 * conversation cannot be committed. See the tag's comment before relying on it.
 */
export type ConversationWithDetails = components['schemas']['ConversationDetailOutputBody'];

// Request types
//
// Generated from the OpenAPI spec (`just gen-api-types`) rather than written by
// hand, so an unknown property is a build failure instead of a 422 at runtime.

/** POST /games/{gameID}/conversations — title is required on the wire, and
 *  character_ids is nullable; at least two characters are required. */
export type CreateConversationRequest = components['schemas']['CreateConversationRequest'];

/** POST /games/{gameID}/conversations/{conversationId}/messages */
export type SendMessageRequest = components['schemas']['SendMessageRequest'];

/** POST /games/{gameID}/conversations/{conversationId}/participants */
export type AddParticipantRequest = components['schemas']['AddParticipantRequest'];

/** PATCH /games/{gameID}/conversations/{conversationId}/messages/{messageId} */
export type UpdateMessageRequest = components['schemas']['UpdateMessageRequest'];

// Audience viewing types (read-only conversation access for audience members)

/**
 * NOT generated, deliberately.
 *
 * Its schema (PrivateConversationResponse) declares four fields as Go
 * `interface{}` -- last_message_at, participant_names, participant_usernames
 * and participant_character_ids -- which huma renders as an untyped `{}` and
 * openapi-typescript emits as `unknown`. Aliasing would therefore make this
 * type strictly WORSE than the hand-written one, turning four usable fields
 * into values every call site has to cast.
 *
 * The fix is on the Go side: give those four real types. Until then this stays
 * hand-written, and the fields below are the shape the wire actually sends.
 */
export interface AudienceConversationListItem {
  conversation_id: number;
  subject?: string | null;
  conversation_type: string;
  created_at: string;
  message_count: number;
  last_message_at?: string | null;
  participant_names: string[];
  participant_usernames: string[];
  participant_character_ids?: (number | null)[];
  last_message_content?: string | null;
  last_sender_name?: string | null;
  last_sender_username?: string | null;
  last_sender_character_id?: number | null;
}

/**
 * Generated. One message in an audience-visible conversation.
 *
 * `sender_user_id` and `sender_character_id` were declared optional and are in
 * fact required-and-nullable: both are bare `*int32` with NO omitempty, so a
 * nil marshals as an explicit null rather than dropping the key. Absent and
 * null mean different things and the wire sends the latter.
 */
export type AudienceConversationMessage = components['schemas']['AudienceMessageResponse'];

/**
 * A character appearing in at least one conversation, used for the audience
 * filter controls. The UI displays `name` but filters by `id`, since character
 * names are mutable and not unique within a game.
 */
export type ConversationParticipantCharacter =
  components['schemas']['ConversationParticipantCharacter'];
