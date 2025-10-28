-- E2E Test Fixture for Complete Phase Lifecycle
-- Creates a fresh game ready to test the complete phase lifecycle workflow
-- for testing GM creating phases, players submitting actions, GM creating results
--
-- Game IDs: 327 (offset by worker: Worker 1 = 1327, Worker 2 = 2327, etc.)
--
-- IDEMPOTENT: Safe to run multiple times - deletes existing data before recreating

BEGIN;

-- Delete existing lifecycle test game to prevent duplicates
DELETE FROM games WHERE id = 327;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  game_id INTEGER := 327;
  initial_phase_id INTEGER;
  char1_id INTEGER;
  char2_id INTEGER;
  char3_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';

  -- ============================================
  -- E2E Game: For Phase Lifecycle Testing
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    game_id,
    'E2E Test: Phase Lifecycle',
    'This game tests the complete phase lifecycle: common room -> action phase -> results -> new common room',
    'Test',
    gm_id,
    3,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  );

  -- Add participants
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_id, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (game_id, p2_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (game_id, p3_id, 'player', 'active', NOW() - INTERVAL '4 days');

  -- Add characters for all players
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_id, p1_id, 'Lifecycle Char 1', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW())
  RETURNING id INTO char1_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_id, p2_id, 'Lifecycle Char 2', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW())
  RETURNING id INTO char2_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_id, p3_id, 'Lifecycle Char 3', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW())
  RETURNING id INTO char3_id;

  -- Add initial common room phase (ACTIVE - this is where the test starts)
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    game_id,
    'common_room',
    1,
    'Initial Common Room',
    'Players gather and prepare for their first action',
    NOW() - INTERVAL '3 days',
    NOW() + INTERVAL '1 day',
    true,
    false,
    NOW() - INTERVAL '3 days'
  ) RETURNING id INTO initial_phase_id;

END $$;

-- Reset the games sequence to prevent duplicate key errors
-- This ensures new game creations don't collide with hardcoded fixture IDs
SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

COMMIT;

-- Success message
SELECT 'E2E Phase Lifecycle fixture created successfully!' as message;
