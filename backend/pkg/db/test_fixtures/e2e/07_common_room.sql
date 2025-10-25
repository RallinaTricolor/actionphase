-- Create Common Room Test Games (Isolated for Parallel E2E Testing)
-- This fixture creates 4 dedicated games for testing Common Room functionality
-- Each game has an active common_room phase and identical structure
-- Games are ISOLATED to prevent test interference when running in parallel
--
-- Game #164: For common-room.spec.ts tests
-- Game #165: For character-mentions.spec.ts tests
-- Game #166: For notification-flow.spec.ts tests
-- Game #167: For character-avatar.spec.ts and misc tests

BEGIN;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  p4_id INTEGER;
  p5_id INTEGER;
  phase_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO p4_id FROM users WHERE email = 'test_player4@example.com';
  SELECT id INTO p5_id FROM users WHERE email = 'test_player5@example.com';

  -- ============================================
  -- GAME #164: Common Room Posts (common-room.spec.ts)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    164,
    'E2E Common Room - Posts',
    'Isolated game for common-room.spec.ts E2E tests (post creation and commenting).',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (164, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (164, p2_id, 'player', 'active', NOW() - INTERVAL '4 days');

  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    164,
    'common_room',
    1,
    'Discussion and Planning',
    'Active common room phase for testing post creation.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    true,
    NOW() - INTERVAL '1 hour'
  );

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (164, gm_id, 'GM Test Character', 'npc', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (164, p1_id, 'Test Player 1 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (164, p2_id, 'Test Player 2 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW());

  RAISE NOTICE 'Created Game #164: E2E Common Room - Posts';

  -- ============================================
  -- GAME #165: Common Room Mentions (character-mentions.spec.ts)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    165,
    'E2E Common Room - Mentions',
    'Isolated game for character-mentions.spec.ts E2E tests (character mention functionality).',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (165, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (165, p2_id, 'player', 'active', NOW() - INTERVAL '4 days');

  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    165,
    'common_room',
    1,
    'Discussion and Planning',
    'Active common room phase for testing character mentions.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    true,
    NOW() - INTERVAL '1 hour'
  );

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (165, gm_id, 'GM Test Character', 'npc', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (165, p1_id, 'Test Player 1 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (165, p2_id, 'Test Player 2 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW());

  RAISE NOTICE 'Created Game #165: E2E Common Room - Mentions';

  -- ============================================
  -- GAME #166: Common Room Notifications (notification-flow.spec.ts)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    166,
    'E2E Common Room - Notifications',
    'Isolated game for notification-flow.spec.ts E2E tests (notification functionality).',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (166, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (166, p2_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (166, p3_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (166, p4_id, 'player', 'active', NOW() - INTERVAL '4 days');

  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    166,
    'common_room',
    1,
    'Discussion and Planning',
    'Active common room phase for testing notifications.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    true,
    NOW() - INTERVAL '1 hour'
  );

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (166, gm_id, 'GM Test Character', 'npc', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (166, p1_id, 'Test Player 1 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (166, p2_id, 'Test Player 2 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (166, p3_id, 'Test Player 3 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (166, p4_id, 'Test Player 4 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW());

  RAISE NOTICE 'Created Game #166: E2E Common Room - Notifications';

  -- ============================================
  -- GAME #167: Common Room Misc (character-avatar.spec.ts and other tests)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    167,
    'E2E Common Room - Misc',
    'Isolated game for character-avatar.spec.ts and other miscellaneous E2E tests.',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (167, p5_id, 'player', 'active', NOW() - INTERVAL '4 days');

  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    167,
    'common_room',
    1,
    'Discussion and Planning',
    'Active common room phase for miscellaneous tests.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    true,
    NOW() - INTERVAL '1 hour'
  );

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (167, gm_id, 'GM Test Character', 'npc', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (167, p5_id, 'Test Player 5 Character', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW());

  RAISE NOTICE 'Created Game #167: E2E Common Room - Misc';

  -- ============================================
  -- GAME #168: Character Avatars (character-avatar.spec.ts)
  -- ============================================
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    168,
    'E2E Character Avatars',
    'Dedicated game for character-avatar.spec.ts E2E tests (avatar upload, delete, permissions).',
    'Test Framework',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (168, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (168, p2_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (168, p3_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (168, p4_id, 'player', 'active', NOW() - INTERVAL '4 days');

  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    168,
    'common_room',
    1,
    'Discussion and Planning',
    'Active common room phase for character avatar testing.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    true,
    NOW() - INTERVAL '1 hour'
  );

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (168, gm_id, 'GM Test Character', 'npc', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (168, p1_id, 'E2E Test Char 1', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (168, p2_id, 'E2E Test Char 2', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (168, p3_id, 'E2E Test Char 3', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW()),
    (168, p4_id, 'E2E Test Char 4', 'player_character', 'approved', NOW() - INTERVAL '4 days', NOW());

  RAISE NOTICE 'Created Game #168: E2E Character Avatars';

  -- ============================================
  -- Summary
  -- ============================================
  RAISE NOTICE 'Created 5 isolated Common Room test games (164-168) for parallel E2E testing';

END $$;

COMMIT;
