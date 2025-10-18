-- Create Common Room Test Game
-- This fixture creates a dedicated game for testing Common Room functionality
-- Game will have ID 164 and an active common_room phase

BEGIN;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  game_id INTEGER := 164;
  phase_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';

  -- ============================================
  -- GAME #164: Common Room E2E Test Game
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    game_id,
    'E2E Common Room Test Game',
    'A test game specifically for E2E Common Room testing with active common_room phase.',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  );

  -- Add participants (GM + 2 players)
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_id, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (game_id, p2_id, 'player', 'active', NOW() - INTERVAL '4 days');

  -- Create Active Common Room Phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    game_id,
    'common_room',
    1,
    'Discussion and Planning',
    'An active common room phase for testing post creation and commenting.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    false,
    NOW() - INTERVAL '1 hour'
  ) RETURNING id INTO phase_id;

  -- ============================================
  -- CHARACTERS for Game #164
  -- ============================================

  -- GM Character (needed for creating posts)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_id, gm_id, 'GM Test Character', 'npc_gm', 'approved', NOW() - INTERVAL '4 days', NOW());

  -- Player Characters
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_id, p1_id, 'Test Player 1 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (game_id, p2_id, 'Test Player 2 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW());

  RAISE NOTICE 'Created Game #164: E2E Common Room Test Game with active common_room phase';

END $$;

COMMIT;
