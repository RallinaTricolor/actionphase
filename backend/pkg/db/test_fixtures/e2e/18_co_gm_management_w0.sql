-- E2E Test Fixture for Co-GM Management
-- Creates a game with audience members for testing co-GM promotion/demotion
-- Tests: GM promotes audience → co-GM, co-GM has permissions, GM demotes co-GM → audience
--
-- Game ID: 339 (offset by worker: Worker 1 = 1339, Worker 2 = 2339, etc.)
--
-- IDEMPOTENT: Safe to run multiple times - deletes existing data before recreating

BEGIN;

-- Delete existing co-GM test game to prevent duplicates
-- Worker-specific game deletion happens in DO block after calculating game_id

DO $$
DECLARE
  gm_id INTEGER;
  audience1_id INTEGER;
  audience2_id INTEGER;
  game_id INTEGER;
  worker_idx INTEGER;
BEGIN
  -- Get worker index (0 if not set)
  worker_idx := COALESCE(current_setting('custom.worker_index', true), '0')::INTEGER;

  -- Use worker-aware helper function to get user IDs from common fixtures

  -- Calculate worker-specific game ID
  game_id := worker_game_id(339, worker_idx);  gm_id := get_worker_user_id('TestGM', worker_idx);
  audience1_id := get_worker_user_id('TestAudience1', worker_idx);
  audience2_id := get_worker_user_id('TestAudience2', worker_idx);

  -- ============================================
  -- Game: Co-GM Management Test Game
  -- State: in_progress (so GM sees all tabs)
  -- ============================================
  INSERT INTO games (
    id,
    title,
    description,
    genre,
    gm_user_id,
    max_players,
    state,
    is_public,
    created_at,
    updated_at
  )
  VALUES (
    game_id,
    'E2E Test: Co-GM Management',
    'Game for testing co-GM promotion and demotion.',
    'Fantasy',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '14 days',
    NOW()
  );

  -- Add audience members (candidates for co-GM promotion)
  INSERT INTO game_participants (game_id, user_id, role, status)
  VALUES
    (game_id, audience1_id, 'audience', 'active'),
    (game_id, audience2_id, 'audience', 'active');

  -- Create a phase so the game has content (makes the People tab accessible)
  INSERT INTO game_phases (
    game_id,
    phase_number,
    phase_type,
    title,
    description,
    start_time,
    end_time,
    is_active,
    is_published
  )
  VALUES (
    game_id,
    1,
    'action',
    'Test Phase 1',
    'A test phase for co-GM management testing',
    NOW() - INTERVAL '7 days',
    NOW() + INTERVAL '7 days',
    true,
    true
  );

  -- Add a player participant for messaging/action testing
  INSERT INTO game_participants (game_id, user_id, role, status)
  VALUES (game_id, get_worker_user_id('TestPlayer1', worker_idx), 'player', 'active');

  -- Create player character (for messaging targets)
  INSERT INTO characters (
    game_id,
    user_id,
    name,
    character_type,
    status,
    created_at,
    updated_at
  )
  VALUES (
    game_id,
    get_worker_user_id('TestPlayer1', worker_idx),
    'Test Player Character',
    'player_character',
    'approved',
    NOW() - INTERVAL '10 days',
    NOW()
  );

  -- Create an NPC for the GM (will be accessible to co-GM for messaging)
  INSERT INTO characters (
    game_id,
    user_id,
    name,
    character_type,
    status,
    created_at,
    updated_at
  )
  VALUES (
    game_id,
    gm_id,
    'GM Test NPC',
    'npc',
    'approved',
    NOW() - INTERVAL '10 days',
    NOW()
  );

  -- Add an action submission so there's data for Action Results
  INSERT INTO action_submissions (
    game_id,
    phase_id,
    user_id,
    character_id,
    content,
    submitted_at
  )
  SELECT
    c.game_id,
    gp.id,
    get_worker_user_id('TestPlayer1', worker_idx),
    c.id,
    'Test action submission for co-GM testing',
    NOW() - INTERVAL '2 days'
  FROM characters c
  JOIN game_phases gp ON c.game_id = gp.game_id
  WHERE c.game_id = (SELECT worker_game_id(339, worker_idx))
    AND c.user_id = get_worker_user_id('TestPlayer1', worker_idx)
    AND c.character_type = 'player_character'
    AND gp.phase_number = 1
  LIMIT 1;

  RAISE NOTICE 'Co-GM Management fixture created: Game #% with 2 audience members, 1 player, 2 characters, 1 action', game_id;

END $$;

SELECT 'E2E Co-GM Management fixture created successfully!' AS message;

COMMIT;
