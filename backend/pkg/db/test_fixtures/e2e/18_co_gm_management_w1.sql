-- E2E Test Fixture for Co-GM Management (Worker 1)
-- Creates a game with audience members for testing co-GM promotion/demotion
-- Tests: GM promotes audience → co-GM, co-GM has permissions, GM demotes co-GM → audience
--
-- Game ID: 10339 (Worker 1 offset: 339 + 10000)
-- Test Users: TestGM_1, TestAudience1_1, TestAudience2_1
--
-- IDEMPOTENT: Safe to run multiple times - deletes existing data before recreating

BEGIN;

-- Delete existing co-GM test game to prevent duplicates
DELETE FROM games WHERE id = 10339;

-- Get user IDs for TestGM_1, TestAudience1_1, TestAudience2_1
DO $$
DECLARE
  gm_id INTEGER;
  audience1_id INTEGER;
  audience2_id INTEGER;
BEGIN
  -- Get worker 1 user IDs
  SELECT id INTO gm_id FROM users WHERE username = 'TestGM_1';
  SELECT id INTO audience1_id FROM users WHERE username = 'TestAudience1_1';
  SELECT id INTO audience2_id FROM users WHERE username = 'TestAudience2_1';

  -- ============================================
  -- Game: Co-GM Management Test Game (Worker 1)
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
    10339,
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
    (10339, audience1_id, 'audience', 'active'),
    (10339, audience2_id, 'audience', 'active');

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
    10339,
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
  SELECT 10339, id, 'player', 'active' FROM users WHERE username = 'TestPlayer1_1';

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
  SELECT
    10339,
    id,
    'Test Player Character',
    'player_character',
    'approved',
    NOW() - INTERVAL '10 days',
    NOW()
  FROM users WHERE username = 'TestPlayer1_1';

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
    10339,
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
    10339,
    gp.id,
    u.id,
    c.id,
    'Test action submission for co-GM testing',
    NOW() - INTERVAL '2 days'
  FROM users u, characters c, game_phases gp
  WHERE u.username = 'TestPlayer1_1'
    AND c.game_id = 10339
    AND c.user_id = u.id
    AND c.character_type = 'player_character'
    AND gp.game_id = 10339
    AND gp.phase_number = 1
  LIMIT 1;

  RAISE NOTICE 'Co-GM Management fixture created: Game #10339 with 2 audience members, 1 player, 2 characters, 1 action';

END $$;

SELECT 'E2E Co-GM Management fixture (Worker 1) created successfully!' AS message;

COMMIT;
