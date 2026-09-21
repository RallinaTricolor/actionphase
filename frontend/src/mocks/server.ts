import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { UserProfileResponse } from '../types/user-profiles';

// Mock data
const mockUserProfile: UserProfileResponse = {
  user: {
    id: 1,
    username: 'testuser',
    display_name: 'Test User',
    bio: 'This is a test bio',
    avatar_url: 'http://localhost:3000/uploads/avatars/users/1/test.jpg',
    created_at: '2024-01-01T00:00:00Z',
    timezone: 'America/New_York',
    is_admin: false,
  },
  games: [
    {
      game_id: 1,
      title: 'Test Game 1',
      gm_username: 'gm1',
      state: 'recruitment',
      user_role: 'player',
      is_anonymous: false,
      start_date: null,
      end_date: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      characters: [
        {
          id: 101,
          name: 'Test Character',
          avatar_url: null,
          character_type: 'warrior',
        },
      ],
    },
    {
      game_id: 2,
      title: 'Test Game 2',
      gm_username: 'gm2',
      state: 'in_progress',
      user_role: 'gm',
      is_anonymous: false,
      start_date: null,
      end_date: null,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      characters: [],
    },
  ],
  metadata: {
    page: 1,
    page_size: 12,
    total_count: 2,
    total_pages: 1,
    has_next_page: false,
    has_previous_page: false,
  },
};

// Request handlers
const handlers = [
  // Auth endpoints
  http.get('/api/v1/auth/me', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      display_name: 'Test User',
      avatar_url: 'http://localhost:3000/uploads/avatars/users/1/test.jpg',
      created_at: '2024-01-01T00:00:00Z',
      timezone: 'America/New_York',
      is_admin: false,
    });
  }),

  http.post('/api/v1/auth/refresh', () => {
    return HttpResponse.json(
      { Token: 'mock-jwt-token' },
      { status: 200 }
    );
  }),

  http.get('/api/v1/auth/refresh', () => {
    return HttpResponse.json(
      { Token: 'mock-jwt-token' },
      { status: 200 }
    );
  }),

  // User profile endpoints
  http.get('/api/v1/users/username/:username/profile', () => {
    return HttpResponse.json(mockUserProfile);
  }),

  http.get('/api/v1/users/:id/profile', () => {
    return HttpResponse.json(mockUserProfile);
  }),

  http.patch('/api/v1/users/me/profile', async ({ request }) => {
    const updates = await request.json() as Partial<UserProfileResponse['user']>;
    return HttpResponse.json({
      ...mockUserProfile,
      user: { ...mockUserProfile.user, ...updates },
    });
  }),

  // Game-related endpoints (fallback handlers to prevent 404s)
  http.get('/api/v1/games/:gameId/details', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.gameId),
      title: 'Test Game',
      description: 'A test game',
      gm_user_id: 1,
      gm_username: 'testgm',
      state: 'setup',
      max_players: 4,
      is_anonymous: false,
      auto_accept_audience: false,
      game_config: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }),

  http.get('/api/v1/games/:gameId/participants', () => {
    return HttpResponse.json([
      {
        id: 1,
        user_id: 1,
        username: 'testuser',
        role: 'player',
        status: 'active',
      },
    ]);
  }),

  http.get('/api/v1/games/:gameId/polls', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/phases', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/results', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/results/mine', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/results/:resultId/character-updates', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/results/:resultId/character-updates/count', () => {
    return HttpResponse.json({ count: 0 });
  }),

  http.get('/api/v1/games/:gameId/characters', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/characters/mine', () => {
    return HttpResponse.json([]);
  }),

  // Stub handlers for background requests made incidentally during component tests.
  // A test that needs a specific response overrides any of these with server.use(),
  // which takes precedence over these base handlers.
  http.get('/api/v1/auth/preferences', () => {
    return HttpResponse.json({ preferences: {} });
  }),

  http.get('/api/v1/games/:gameId/manual-read-comment-ids', () => {
    return HttpResponse.json([]);
  }),

  // PostCard reads this to fill in star state.
  http.get('/api/v1/games/:gameId/favorite-comment-ids', () => {
    return HttpResponse.json({ favorite_comment_ids: [] });
  }),

  http.get('/api/v1/characters/:id/stats', () => {
    return HttpResponse.json({ stats: {} });
  }),

  http.get('/api/v1/games/:gameId/posts/:postId/comments-with-threads', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/conversations', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/characters/controllable', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/characters/stats', () => {
    return HttpResponse.json({});
  }),

  http.get('/api/v1/characters/:characterId/data', () => {
    return HttpResponse.json([]);
  }),

  // Sheet rows for every character in a game, keyed by character id as a
  // string (characters.ts getGameCharacterData). {} is a valid empty response.
  http.get('/api/v1/games/:gameId/characters/data', () => {
    return HttpResponse.json({});
  }),

  // ReadMarkerResponse. Callers here post {} — only the post is marked read —
  // so last_read_comment_id is null.
  http.post('/api/v1/games/:gameId/posts/:postId/mark-read', ({ params }) => {
    return HttpResponse.json({
      id: 1,
      user_id: 1,
      game_id: Number(params.gameId),
      post_id: Number(params.postId),
      last_read_comment_id: null,
      last_read_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });
  }),

  // UnreadCountResponse
  http.get('/api/v1/notifications/unread-count', () => {
    return HttpResponse.json({ unread_count: 0 });
  }),

  // NotificationListResponse
  http.get('/api/v1/notifications', () => {
    return HttpResponse.json({
      data: [],
      pagination: { limit: 20, offset: 0, total: 0 },
    });
  }),

  // --- Tail background routes. All return the empty shape their API client
  // declares, so a component renders its "nothing here" branch rather than its
  // error branch. A test that needs content overrides with server.use().

  // PollListItem[] (polls.ts:42)
  http.get('/api/v1/games/:gameId/phases/:phaseId/polls', () => {
    return HttpResponse.json([]);
  }),

  // PublicGameApplicant[] (games.ts:145)
  http.get('/api/v1/games/:gameId/applicants', () => {
    return HttpResponse.json([]);
  }),

  // GameApplication[] (games.ts:129)
  http.get('/api/v1/games/:gameId/applications', () => {
    return HttpResponse.json([]);
  }),

  // { phase: GamePhase | null } (phases.ts:28)
  http.get('/api/v1/games/:gameId/current-phase', () => {
    return HttpResponse.json({ phase: null });
  }),

  // PostUnreadComments[] (messages.ts:112)
  http.get('/api/v1/games/:gameId/unread-comment-ids', () => {
    return HttpResponse.json([]);
  }),

  // ActionWithDetails[] (phases.ts:57)
  http.get('/api/v1/games/:gameId/actions/mine', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/v1/games/:gameId/actions', () => {
    return HttpResponse.json([]);
  }),

  // Handout[] (handouts.ts:27)
  http.get('/api/v1/games/:gameId/handouts', () => {
    return HttpResponse.json([]);
  }),

  // HandoutComment[] (handouts.ts:62)
  http.get('/api/v1/games/:gameId/handouts/:handoutId/comments', () => {
    return HttpResponse.json([]);
  }),

  // Message[] (messages.ts:53)
  http.get('/api/v1/games/:gameId/posts/:postId/comments', () => {
    return HttpResponse.json([]);
  }),

  // MessageThreadContextResponse (messages.ts:95). An empty chain with
  // has_full_thread true is the "nothing above this message" answer.
  http.get('/api/v1/games/:gameId/messages/:messageId/thread-context', ({ params }) => {
    return HttpResponse.json({
      chain: [],
      has_full_thread: true,
      root_post_id: Number(params.messageId),
    });
  }),

  // { messages: PrivateMessage[] } (conversations.ts:45)
  http.get('/api/v1/games/:gameId/conversations/:conversationId/messages', () => {
    return HttpResponse.json({ messages: [] });
  }),

  // { messages: AudienceConversationMessage[] } (games.ts:224)
  http.get('/api/v1/games/:gameId/private-messages/conversations/:conversationId', () => {
    return HttpResponse.json({ messages: [] });
  }),

  // UnifiedDeadline[] (deadlines.ts:32)
  http.get('/api/v1/games/:gameId/deadlines', () => {
    return HttpResponse.json([]);
  }),

  // { count: number } (phases.ts:127)
  http.get('/api/v1/games/:gameId/phases/:phaseId/results/unpublished-count', () => {
    return HttpResponse.json({ count: 0 });
  }),

  // GameApplication (games.ts:133). 404 is the real answer when the user has
  // not applied, which is what these tests' users have done.
  http.get('/api/v1/games/:gameId/application/mine', () => {
    return new HttpResponse(null, { status: 404 });
  }),

  // DashboardData, prefetched by AuthContext on login.
  http.get('/api/v1/dashboard', () => {
    return HttpResponse.json({
      user_id: 1,
      has_games: false,
      player_games: [],
      gm_games: [],
      audience_games: [],
      mixed_role_games: [],
      recent_messages: [],
      upcoming_deadlines: [],
      unread_notifications: 0,
      notifications_by_type: {},
    });
  }),

  // Notification mutations. mark-read/mark-unread return the updated
  // NotificationResponse (notifications.ts:35,39) — not 204, which would hand
  // callers undefined where they expect a notification.
  http.put('/api/v1/notifications/:id/mark-read', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      user_id: 1,
      type: 'private_message',
      title: 'Test Notification',
      is_read: true,
      read_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
    });
  }),

  http.put('/api/v1/notifications/:id/mark-unread', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      user_id: 1,
      type: 'private_message',
      title: 'Test Notification',
      is_read: false,
      created_at: '2024-01-01T00:00:00Z',
    });
  }),

  http.delete('/api/v1/notifications/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Every new game requires a community (req 5), so the create form fetches
  // this list. One entry, so the form preselects it and tests that only care
  // about other fields do not have to pick one.
  http.get('/api/v1/communities', () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Test Community',
        slug: 'test-community',
        description: null,
        banner_url: null,
        owner_user_id: 1,
        owner_username: 'testuser',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]);
  }),

];

// Setup server with handlers
export const server = setupServer(...handlers);
