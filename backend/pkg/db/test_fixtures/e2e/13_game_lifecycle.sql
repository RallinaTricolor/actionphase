-- E2E Test Fixture for Game Lifecycle Management
-- Creates multiple games in different states for testing state transitions
-- Tests: GM manages game states (recruitment → in_progress → paused → completed/cancelled)
--
-- IDEMPOTENT: Safe to run multiple times - deletes existing data before recreating

BEGIN;

-- Delete existing game lifecycle test games to prevent duplicates
DELETE FROM games WHERE title LIKE 'E2E Test: Game Lifecycle%';

DO $$
DECLARE
  gm_id INTEGER;
  player1_id INTEGER;
  game1_id INTEGER;  -- Ready to start (recruitment → in_progress)
  game2_id INTEGER;  -- Active game (in_progress → paused)
  game3_id INTEGER;  -- Paused game (paused → in_progress)
  game4_id INTEGER;  -- Active game (in_progress → completed)
  game5_id INTEGER;  -- Active game (in_progress → cancelled)
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO player1_id FROM users WHERE email = 'test_player1@example.com';

  -- ============================================
  -- Game 1: Ready to start (character_creation → in_progress)
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
    'E2E Test: Game Lifecycle - Start',
    'Game in character_creation state ready to start.',
    'Fantasy',
    gm_id,
    5,
    'character_creation',
    true,
    NOW() - INTERVAL '7 days',
    NOW()
  ) RETURNING id INTO game1_id;

  -- Add approved player so game can start
  INSERT INTO game_participants (game_id, user_id, role)
  VALUES (game1_id, player1_id, 'player');

  -- ============================================
  -- Game 2: Active game (in_progress → paused)
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
    'E2E Test: Game Lifecycle - Pause',
    'Active game that can be paused.',
    'Sci-Fi',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '30 days',
    NOW()
  ) RETURNING id INTO game2_id;

  INSERT INTO game_participants (game_id, user_id, role)
  VALUES (game2_id, player1_id, 'player');

  -- ============================================
  -- Game 3: Paused game (paused → in_progress)
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
    'E2E Test: Game Lifecycle - Resume',
    'Paused game that can be resumed.',
    'Horror',
    gm_id,
    5,
    'paused',
    true,
    NOW() - INTERVAL '45 days',
    NOW()
  ) RETURNING id INTO game3_id;

  INSERT INTO game_participants (game_id, user_id, role)
  VALUES (game3_id, player1_id, 'player');

  -- ============================================
  -- Game 4: Active game (in_progress → completed)
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
    'E2E Test: Game Lifecycle - Complete',
    'Active game ready to be completed.',
    'Fantasy',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '90 days',
    NOW()
  ) RETURNING id INTO game4_id;

  INSERT INTO game_participants (game_id, user_id, role)
  VALUES (game4_id, player1_id, 'player');

  -- ============================================
  -- Game 5: Recruitment game (recruitment → cancelled)
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
    'E2E Test: Game Lifecycle - Cancel',
    'Recruitment game that can be cancelled.',
    'Mystery',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '14 days',
    NOW()
  ) RETURNING id INTO game5_id;

  INSERT INTO game_participants (game_id, user_id, role)
  VALUES (game5_id, player1_id, 'player');

  RAISE NOTICE 'Game Lifecycle fixtures created: Games % % % % %', game1_id, game2_id, game3_id, game4_id, game5_id;

END $$;

COMMIT;

-- Success message
SELECT 'E2E Game Lifecycle Management fixture created successfully!' as message;
