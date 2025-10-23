import { BaseApiClient } from './client';
import type {
  Conversation,
  ConversationListItem,
  ConversationWithDetails,
  PrivateMessage,
  CreateConversationRequest,
  SendMessageRequest,
  AddParticipantRequest
} from '../../types/conversations';

/**
 * Conversations API client
 * Handles private messaging between characters
 */
export class ConversationsApi extends BaseApiClient {
  async createConversation(gameId: number, data: CreateConversationRequest) {
    return this.client.post<Conversation>(`/api/v1/games/${gameId}/conversations`, data);
  }

  async getUserConversations(gameId: number) {
    return this.client.get<{ conversations: ConversationListItem[] }>(`/api/v1/games/${gameId}/conversations`);
  }

  async getConversation(gameId: number, conversationId: number) {
    return this.client.get<ConversationWithDetails>(`/api/v1/games/${gameId}/conversations/${conversationId}`);
  }

  async getConversationMessages(gameId: number, conversationId: number) {
    return this.client.get<{ messages: PrivateMessage[] }>(`/api/v1/games/${gameId}/conversations/${conversationId}/messages`);
  }

  async sendMessage(gameId: number, conversationId: number, data: SendMessageRequest) {
    return this.client.post<PrivateMessage>(`/api/v1/games/${gameId}/conversations/${conversationId}/messages`, data);
  }

  async markConversationAsRead(gameId: number, conversationId: number) {
    return this.client.post<{ success: boolean }>(`/api/v1/games/${gameId}/conversations/${conversationId}/read`);
  }

  async addParticipant(gameId: number, conversationId: number, data: AddParticipantRequest) {
    return this.client.post<{ success: boolean }>(`/api/v1/games/${gameId}/conversations/${conversationId}/participants`, data);
  }
}
