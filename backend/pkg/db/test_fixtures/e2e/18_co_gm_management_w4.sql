-- E2E Test Fixture for Co-GM Management (Worker 4)
-- Game ID: 40339 (Worker 4 offset: 339 + 40000)
-- Test Users: TestGM_4, TestAudience1_4, TestAudience2_4

BEGIN;
DELETE FROM games WHERE id = 40339;

DO $$
DECLARE
  gm_id INTEGER;
  audience1_id INTEGER;
  audience2_id INTEGER;
BEGIN
  SELECT id INTO gm_id FROM users WHERE username = 'TestGM_4';
  SELECT id INTO audience1_id FROM users WHERE username = 'TestAudience1_4';
  SELECT id INTO audience2_id FROM users WHERE username = 'TestAudience2_4';

  INSERT INTO games (
    id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at
  ) VALUES (
    40339, 'E2E Test: Co-GM Management', 'Game for testing co-GM promotion and demotion.',
    'Fantasy', gm_id, 5, 'in_progress', true, NOW() - INTERVAL '14 days', NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status)
  VALUES (40339, audience1_id, 'audience', 'active'), (40339, audience2_id, 'audience', 'active');

  INSERT INTO game_phases (
    game_id, phase_number, phase_type, title, description, start_time, end_time, is_active, is_published
  ) VALUES (
    40339, 1, 'action', 'Test Phase 1', 'A test phase for co-GM management testing',
    NOW() - INTERVAL '7 days', NOW() + INTERVAL '7 days', true, true
  );

  -- Add a player participant for messaging/action testing
  INSERT INTO game_participants (game_id, user_id, role, status)
  SELECT 40339, id, 'player', 'active' FROM users WHERE username = 'TestPlayer1_4';

  -- Create player character (for messaging targets)
  INSERT INTO characters (
    game_id, user_id, name, character_type, status, created_at, updated_at
  )
  SELECT
    40339, id, 'Test Player Character', 'player_character', 'approved',
    NOW() - INTERVAL '10 days', NOW()
  FROM users WHERE username = 'TestPlayer1_4';

  -- Create an NPC for the GM (will be accessible to co-GM for messaging)
  INSERT INTO characters (
    game_id, user_id, name, character_type, status, created_at, updated_at
  )
  VALUES (
    40339, gm_id, 'GM Test NPC', 'npc', 'approved',
    NOW() - INTERVAL '10 days', NOW()
  );

  -- Add an action submission so there's data for Action Results
  INSERT INTO action_submissions (
    game_id, phase_id, user_id, character_id, content, submitted_at
  )
  SELECT
    40339, gp.id, u.id, c.id, 'Test action submission for co-GM testing',
    NOW() - INTERVAL '2 days'
  FROM users u, characters c, game_phases gp
  WHERE u.username = 'TestPlayer1_4'
    AND c.game_id = 40339
    AND c.user_id = u.id
    AND c.character_type = 'player_character'
    AND gp.game_id = 40339
    AND gp.phase_number = 1
  LIMIT 1;

  RAISE NOTICE 'Co-GM Management fixture created: Game #40339 with 2 audience members, 1 player, 2 characters, 1 action';
END $$;

SELECT 'E2E Co-GM Management fixture (Worker 4) created successfully!' AS message;
COMMIT;
