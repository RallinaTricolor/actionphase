/**
 * Unified API Client
 *
 * Provides a single apiClient instance with all API endpoints organized by domain.
 *
 * Usage:
 *   import { apiClient } from '@/lib/api';
 *
 *   // Auth
 *   apiClient.auth.login({ username, password });
 *
 *   // Games
 *   apiClient.games.getGame(id);
 *
 *   // Characters
 *   apiClient.characters.createCharacter(gameId, data);
 *
 *   // Phases
 *   apiClient.phases.createPhase(gameId, data);
 *   apiClient.phases.submitAction(gameId, data);
 *
 *   // Messages
 *   apiClient.messages.createPost(gameId, data);
 *
 *   // Conversations
 *   apiClient.conversations.createConversation(gameId, data);
 *
 *   // Notifications
 *   apiClient.notifications.getNotifications();
 *
 *   // Utility methods
 *   apiClient.setAuthToken(token);
 *   apiClient.getAuthToken();
 *   apiClient.removeAuthToken();
 *   apiClient.ping();
 */

import { BaseApiClient } from './client';
import { AuthApi } from './auth';
import { GamesApi } from './games';
import { CharactersApi } from './characters';
import { PhasesApi } from './phases';
import { MessagesApi } from './messages';
import { ConversationsApi } from './conversations';
import { NotificationsApi } from './notifications';
import { AdminApi } from './admin';
import { HandoutsApi } from './handouts';

class ApiClient extends BaseApiClient {
  public auth: AuthApi;
  public games: GamesApi;
  public characters: CharactersApi;
  public phases: PhasesApi;
  public messages: MessagesApi;
  public conversations: ConversationsApi;
  public notifications: NotificationsApi;
  public admin: AdminApi;
  public handouts: HandoutsApi;

  constructor() {
    super();

    // Initialize domain-specific APIs
    this.auth = new AuthApi();
    this.games = new GamesApi();
    this.characters = new CharactersApi();
    this.phases = new PhasesApi();
    this.messages = new MessagesApi();
    this.conversations = new ConversationsApi();
    this.notifications = new NotificationsApi();
    this.admin = new AdminApi();
    this.handouts = new HandoutsApi();
  }
}

export const apiClient = new ApiClient();
export { BaseApiClient } from './client';
