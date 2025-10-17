import { http, HttpResponse } from 'msw'

// MSW v2 - using path patterns to match requests regardless of protocol/host
// This works for both relative URLs (axios with empty baseURL) and absolute URLs
export const handlers = [
  // Auth endpoints
  http.post('/api/v1/auth/register', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.post('/api/v1/auth/login', () => {
    return HttpResponse.json({
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      Token: 'mock-jwt-token',
    })
  }),

  http.post('/api/v1/auth/logout', () => {
    return HttpResponse.json({ message: 'Logged out successfully' })
  }),

  http.get('/api/v1/auth/me', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.get('/api/v1/auth/refresh', () => {
    return HttpResponse.json({
      token: 'mock-refreshed-jwt-token',
    })
  }),

  // Games endpoints
  http.get('/api/v1/games', () => {
    return HttpResponse.json([
      {
        id: 1,
        title: 'Test Game',
        description: 'A test game',
        gm_user_id: 1,
        state: 'setup',
        max_players: 4,
        is_public: true,
        is_anonymous: false,
        game_config: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),

  http.get('/api/v1/games/:id', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      title: 'Test Game',
      description: 'A test game',
      gm_user_id: 1,
      state: 'setup',
      max_players: 4,
      is_public: true,
      is_anonymous: false,
      game_config: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.post('/api/v1/games', () => {
    return HttpResponse.json({
      id: 1,
      title: 'New Test Game',
      description: 'A newly created test game',
      gm_user_id: 1,
      state: 'setup',
      max_players: 4,
      is_public: true,
      is_anonymous: false,
      game_config: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  // Game Applications endpoints
  http.get('/api/v1/games/:id/applications', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/applications', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      user_id: 1,
      role: 'player',
      status: 'pending',
      character_info: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.patch('/api/v1/games/:gameId/applications/:applicationId', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      user_id: 1,
      role: 'player',
      status: 'approved',
      character_info: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  // Characters endpoints
  http.get('/api/v1/games/:gameId/characters', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/characters', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      user_id: 1,
      name: 'Test Character',
      character_type: 'player_character',
      character_data: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  // Phases endpoints
  http.get('/api/v1/games/:gameId/phases', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/current-phase', () => {
    return HttpResponse.json({ phase: null })
  }),

  http.get('/api/v1/games/:gameId/phases/active', () => {
    return HttpResponse.json(null, { status: 404 })
  }),

  http.post('/api/v1/games/:gameId/phases', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      phase_number: 1,
      phase_name: 'Phase 1',
      phase_type: 'action',
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.post('/api/v1/phases/:phaseId/activate', () => {
    return HttpResponse.json({ success: true })
  }),

  http.patch('/api/v1/phases/:phaseId/deadline', () => {
    return HttpResponse.json({ success: true })
  }),

  http.patch('/api/v1/phases/:phaseId', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/v1/games/:gameId/phases/:phaseId/results/unpublished-count', () => {
    return HttpResponse.json({ count: 0 })
  }),

  http.post('/api/v1/games/:gameId/phases/:phaseId/results/publish', () => {
    return HttpResponse.json({ success: true })
  }),

  // Messages endpoints
  http.get('/api/v1/games/:gameId/posts', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/posts', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      author_character_id: 1,
      parent_message_id: null,
      message_type: 'post',
      content: 'Test post',
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  // Conversations endpoints
  http.get('/api/v1/games/:gameId/conversations', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/conversations', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      conversation_type: 'direct',
      title: 'Test Conversation',
      created_by_user_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.get('/api/v1/conversations/:conversationId/messages', () => {
    return HttpResponse.json([])
  }),

  // Health check
  http.get('/ping', () => {
    return HttpResponse.json({ message: 'pong' })
  }),
]
