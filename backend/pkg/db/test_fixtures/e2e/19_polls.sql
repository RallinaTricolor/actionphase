-- Create Polls Test Game (Isolated for E2E Testing)
-- This fixture creates a dedicated game for testing the Common Room Polling System
-- Game is ISOLATED to prevent test interference when running in parallel
--
-- Game #169: For polls-flow.spec.ts tests

BEGIN;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  phase_id INTEGER;
  c1_id INTEGER;
  c2_id INTEGER;
  c3_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';

  -- ============================================
  -- GAME #169: Common Room Polls (polls-flow.spec.ts)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    169,
    'E2E Common Room - Polls',
    'Isolated game for polls-flow.spec.ts E2E tests (polling system functionality).',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  );

  -- Add game participants
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (169, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (169, p2_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (169, p3_id, 'player', 'active', NOW() - INTERVAL '4 days');

  -- Create active common_room phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    169,
    'common_room',
    1,
    'Planning Session',
    'Active common room phase for testing the polling system.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    true,
    NOW() - INTERVAL '1 hour'
  )
  RETURNING id INTO phase_id;

  -- Create characters for participants
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (169, gm_id, 'GM Narrator', 'npc', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (169, p1_id, 'Polls Test Char 1', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (169, p2_id, 'Polls Test Char 2', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (169, p3_id, 'Polls Test Char 3', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW());

  RAISE NOTICE 'Created Game #169: E2E Common Room - Polls (Phase ID: %)', phase_id;

END $$;

COMMIT;
