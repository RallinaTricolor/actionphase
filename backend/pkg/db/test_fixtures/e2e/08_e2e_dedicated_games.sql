-- Dedicated E2E Test Games
-- These games are specifically for tests that modify state (complete, cancel, etc.)
-- They should be reset between test runs
--
-- IDEMPOTENT: Safe to run multiple times - deletes existing E2E games before recreating

BEGIN;

-- Delete existing E2E dedicated games to prevent duplicates
DELETE FROM games WHERE title IN (
  'E2E Test: Game to Complete',
  'E2E Test: Game to Cancel',
  'E2E Test: Game to Pause',
  'E2E Test: Action Submission',
  'E2E Test: Private Messages'
);

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  p4_id INTEGER;
  game_complete_id INTEGER;
  game_cancel_id INTEGER;
  game_pause_id INTEGER;
  game_action_id INTEGER;
  game_messages_id INTEGER;
  phase_id INTEGER;
  char1_id INTEGER;
  char2_id INTEGER;
  char3_id INTEGER;
  char4_id INTEGER;
  char5_id INTEGER;
  char6_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO p4_id FROM users WHERE email = 'test_player4@example.com';

  -- ============================================
  -- E2E Game: For Completion Testing
  -- ============================================
  INSERT INTO games (title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    'E2E Test: Game to Complete',
    'This game is dedicated for completion testing in E2E tests.',
    'Test',
    gm_id,
    4,
    'in_progress',
    true,
    NOW() - INTERVAL '5 days',
    NOW()
  ) RETURNING id INTO game_complete_id;

  -- Add participants
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_complete_id, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
    (game_complete_id, p2_id, 'player', 'active', NOW() - INTERVAL '4 days');

  -- Add active phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    game_complete_id,
    'action',
    1,
    'Final Phase',
    'This is the final phase before completion',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true,
    false,
    NOW() - INTERVAL '1 hour'
  );

  -- ============================================
  -- E2E Game: For Cancellation Testing
  -- ============================================
  INSERT INTO games (title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    'E2E Test: Game to Cancel',
    'This game is dedicated for cancellation testing in E2E tests.',
    'Test',
    gm_id,
    4,
    'recruitment',
    true,
    NOW() - INTERVAL '2 days',
    NOW()
  ) RETURNING id INTO game_cancel_id;

  -- Add some pending applications
  INSERT INTO game_applications (game_id, user_id, role, status, applied_at)
  VALUES
    (game_cancel_id, p1_id, 'player', 'pending', NOW() - INTERVAL '1 day'),
    (game_cancel_id, p2_id, 'player', 'pending', NOW() - INTERVAL '1 day');

  -- ============================================
  -- E2E Game: For Pause/Resume Testing
  -- ============================================
  INSERT INTO games (title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    'E2E Test: Game to Pause',
    'This game is dedicated for pause/resume testing in E2E tests.',
    'Test',
    gm_id,
    4,
    'in_progress',
    true,
    NOW() - INTERVAL '10 days',
    NOW()
  ) RETURNING id INTO game_pause_id;

  -- Add participants
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_pause_id, p1_id, 'player', 'active', NOW() - INTERVAL '9 days'),
    (game_pause_id, p2_id, 'player', 'active', NOW() - INTERVAL '9 days'),
    (game_pause_id, p3_id, 'player', 'active', NOW() - INTERVAL '9 days');

  -- Add active phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    game_pause_id,
    'common_room',
    1,
    'Planning Phase',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '22 hours',
    true,
    false,
    NOW() - INTERVAL '2 hours'
  );

  -- ============================================
  -- E2E Game: For Action Submission Testing
  -- ============================================
  INSERT INTO games (title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    'E2E Test: Action Submission',
    'This game is dedicated for action submission testing in E2E tests.',
    'Test',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '8 days',
    NOW()
  ) RETURNING id INTO game_action_id;

  -- Add participants
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_action_id, p1_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (game_action_id, p2_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (game_action_id, p3_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (game_action_id, p4_id, 'player', 'active', NOW() - INTERVAL '7 days');

  -- Add characters for action submission
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_action_id, p1_id, 'E2E Test Char 1', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW()) RETURNING id INTO char1_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_action_id, p2_id, 'E2E Test Char 2', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW()) RETURNING id INTO char2_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_action_id, p3_id, 'E2E Test Char 3', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW()) RETURNING id INTO char3_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_action_id, p4_id, 'E2E Test Char 4', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW()) RETURNING id INTO char4_id;

  -- Add previous common room phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, start_time, end_time, deadline, is_active, is_published, created_at)
  VALUES (
    game_action_id,
    'common_room',
    1,
    'Discussion Phase',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days',
    false,
    false,
    NOW() - INTERVAL '3 days'
  );

  -- Add active action phase for submissions
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    game_action_id,
    'action',
    2,
    'Action Phase',
    'Submit your actions for this phase',
    NOW() - INTERVAL '3 hours',
    NOW() + INTERVAL '21 hours',
    true,
    false,
    NOW() - INTERVAL '3 hours'
  ) RETURNING id INTO phase_id;

  -- Add an existing action for Player 1 (to test viewing existing actions)
  INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at, updated_at)
  VALUES (
    game_action_id,
    p1_id,
    phase_id,
    char1_id,
    'This is my existing action for testing purposes. I will do something interesting.',
    false,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
  );

  -- Add a draft action for Player 4 (to test editing drafts)
  INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at, updated_at)
  VALUES (
    game_action_id,
    p4_id,
    phase_id,
    char4_id,
    'This is a draft action that needs to be completed.',
    true,
    NULL,
    NOW() - INTERVAL '30 minutes'
  );

  -- ============================================
  -- E2E Game: For Private Messages Testing
  -- ============================================
  INSERT INTO games (title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    'E2E Test: Private Messages',
    'This game is dedicated for private messages testing in E2E tests.',
    'Test',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '8 days',
    NOW()
  ) RETURNING id INTO game_messages_id;

  -- Add participants
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (game_messages_id, p1_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (game_messages_id, p2_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (game_messages_id, p3_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (game_messages_id, p4_id, 'player', 'active', NOW() - INTERVAL '7 days');

  -- Add characters for messaging
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_messages_id, p1_id, 'E2E Test Char 1', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW()) RETURNING id INTO char5_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game_messages_id, p2_id, 'E2E Test Char 2', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW()) RETURNING id INTO char6_id;

  -- Add active action phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    game_messages_id,
    'action',
    1,
    'Current Phase',
    'Active phase for testing private messages',
    NOW() - INTERVAL '3 hours',
    NOW() + INTERVAL '21 hours',
    true,
    false,
    NOW() - INTERVAL '3 hours'
  );

END $$;

COMMIT;
