-- E2E Test Fixture for Game Application Workflow
-- Creates multiple isolated games for testing different application scenarios
-- Tests: Player applies → GM receives notification → GM reviews → GM approves/rejects
--
-- IDEMPOTENT: Safe to run multiple times - deletes existing data before recreating

BEGIN;

-- Delete existing game application test games to prevent duplicates
DELETE FROM games WHERE title LIKE 'E2E Test: Game Application%';

DO $$
DECLARE
  gm_id INTEGER;
  player1_id INTEGER;
  player2_id INTEGER;
  player3_id INTEGER;
  player4_id INTEGER;
  game1_id INTEGER;
  game2_id INTEGER;
  game3_id INTEGER;
  game4_id INTEGER;
  game5_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO player1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO player2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO player3_id FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO player4_id FROM users WHERE email = 'test_player4@example.com';

  -- ============================================
  -- Game 1: For testing player submission (fresh, no applications)
  -- ============================================
  INSERT INTO games (
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
    'E2E Test: Game Application - Submit',
    'Fresh recruitment game for testing player application submission.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  ) RETURNING id INTO game1_id;

  -- ============================================
  -- Game 2: For testing GM viewing applications (with pending application)
  -- ============================================
  INSERT INTO games (
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
    'E2E Test: Game Application - View',
    'Game with pending application for testing GM application review.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  ) RETURNING id INTO game2_id;

  -- Add pending application from PLAYER_4
  INSERT INTO game_applications (game_id, user_id, role, message, status, applied_at)
  VALUES (
    game2_id,
    player4_id,
    'player',
    'I would like to join this fantasy adventure!',
    'pending',
    NOW() - INTERVAL '1 hour'
  );

  -- ============================================
  -- Game 3: For testing GM approving application
  -- ============================================
  INSERT INTO games (
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
    'E2E Test: Game Application - Approve',
    'Game with pending application for testing GM approval.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  ) RETURNING id INTO game3_id;

  -- Add pending application from PLAYER_3
  INSERT INTO game_applications (game_id, user_id, role, message, status, applied_at)
  VALUES (
    game3_id,
    player3_id,
    'player',
    'Excited to join this epic quest!',
    'pending',
    NOW() - INTERVAL '1 hour'
  );

  -- ============================================
  -- Game 4: For testing GM rejecting application
  -- ============================================
  INSERT INTO games (
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
    'E2E Test: Game Application - Reject',
    'Game with pending application for testing GM rejection.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  ) RETURNING id INTO game4_id;

  -- Add pending application from PLAYER_1
  INSERT INTO game_applications (game_id, user_id, role, message, status, applied_at)
  VALUES (
    game4_id,
    player1_id,
    'player',
    'I want to join this game!',
    'pending',
    NOW() - INTERVAL '1 hour'
  );

  -- ============================================
  -- Game 5: For testing duplicate application prevention
  -- ============================================
  INSERT INTO games (
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
    'E2E Test: Game Application - Duplicate',
    'Game with existing application for testing duplicate prevention.',
    'Fantasy',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  ) RETURNING id INTO game5_id;

  -- Add existing application from PLAYER_2
  INSERT INTO game_applications (game_id, user_id, role, message, status, applied_at)
  VALUES (
    game5_id,
    player2_id,
    'player',
    'First application attempt',
    'pending',
    NOW() - INTERVAL '2 hours'
  );

  RAISE NOTICE 'Game Application Workflow fixtures created: Games % % % % %', game1_id, game2_id, game3_id, game4_id, game5_id;

END $$;

COMMIT;

-- Success message
SELECT 'E2E Game Application Workflow fixture created successfully!' as message;
