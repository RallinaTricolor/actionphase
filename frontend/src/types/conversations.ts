import type { components } from './api.gen';

/**
 * Generated. `title` is REQUIRED but nullable, not optional: the Go field is a
 * bare `*string` with no `omitempty`, so an untitled conversation sends
 * `"title": null` rather than dropping the key. Every render site coalesces it
 * to 'Untitled Conversation', which stays correct for null as it was for
 * undefined.
 */
export type Conversation = components['schemas']['ConversationResponse'];

interface ConversationParticipant {
  id: number;
  conversation_id: number;
  user_id: number;
  character_id?: number;
  joined_at: string;
  username: string;
  character_name?: string;
  character_avatar_url?: string | null;
}

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

export interface ConversationWithDetails {
  conversation: Conversation;
  participants: ConversationParticipant[];
}

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

export interface AudienceConversationMessage {
  id: number;
  conversation_id: number;
  sender_user_id?: number;
  sender_character_id?: number;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  sender_username: string;
  sender_character_name?: string | null;
}

/**
 * A character appearing in at least one conversation, used for the audience
 * filter controls. The UI displays `name` but filters by `id`, since character
 * names are mutable and not unique within a game.
 */
export type ConversationParticipantCharacter =
  components['schemas']['ConversationParticipantCharacter'];
