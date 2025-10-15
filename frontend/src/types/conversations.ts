export interface Conversation {
  id: number;
  game_id: number;
  title?: string;
  conversation_type: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: number;
  conversation_id: number;
  user_id: number;
  character_id?: number;
  joined_at: string;
  username: string;
  character_name?: string;
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
}

export interface ConversationListItem {
  id: number;
  game_id: number;
  title?: string;
  conversation_type: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  participant_count: number;
  participant_names?: string;
  last_message?: string;
  last_message_at?: string;
}

export interface ConversationWithDetails {
  conversation: Conversation;
  participants: ConversationParticipant[];
}

// Request types
export interface CreateConversationRequest {
  title?: string;
  character_ids: number[]; // At least 2 characters required
}

export interface SendMessageRequest {
  character_id: number;
  content: string;
}

export interface AddParticipantRequest {
  character_id: number;
}
