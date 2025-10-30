-- E2E Test Fixture: Deep Linking in Common Room
-- Purpose: Pre-create deeply nested comments to test comment deep linking functionality
-- Game: #701 - E2E Deep Linking Test
-- Created: For testing comment scrolling, highlighting, and deep linking regression prevention

BEGIN;

-- Clean up any existing test data for this fixture
DELETE FROM games WHERE id = 701;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  gm_char_id INTEGER;
  p1_char_id INTEGER;
  p2_char_id INTEGER;
  phase_id INTEGER;
  post_id INTEGER;
  comment1_id INTEGER;
  comment2_id INTEGER;
  comment3_id INTEGER;
  comment4_id INTEGER;
  comment5_id INTEGER;
  comment6_id INTEGER;
  comment7_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';

  -- Create game
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    701,
    'E2E Deep Linking Test',
    'Test comment deep linking, scrolling, and duplicate ID prevention.',
    'Test',
    gm_id,
    5,
    'in_progress',
    true,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  );

  -- Add participants
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (701, p1_id, 'player', 'active', NOW() - INTERVAL '2 days'),
    (701, p2_id, 'player', 'active', NOW() - INTERVAL '2 days');

  -- Create active Discussion phase
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    701,
    'common_room',
    1,
    'Deep Linking Test Phase',
    'Active discussion phase for deep linking E2E tests',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '7 days',
    true,
    true,
    NOW() - INTERVAL '1 day'
  ) RETURNING id INTO phase_id;

  -- Create GM character (NPC)
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    701,
    NULL,  -- NPCs have no owner
    'Game Master',
    'npc',
    'approved',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ) RETURNING id INTO gm_char_id;

  -- Create Player 1 character
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    701,
    p1_id,
    'Test Player One',
    'player_character',
    'approved',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ) RETURNING id INTO p1_char_id;

  -- Create Player 2 character
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (
    701,
    p2_id,
    'Test Player Two',
    'player_character',
    'approved',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ) RETURNING id INTO p2_char_id;

  -- Create a GM post with deeply nested comments
  INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    content,
    message_type,
    created_at,
    edited_at
  ) VALUES (
    701,
    phase_id,
    gm_id,
    gm_char_id,
    '# Deep Linking Test Post

This post has deeply nested comments (7 levels) to test deep linking functionality.

**Test scenarios:**
- Scroll to visible comments (depth 1-5)
- Open ThreadViewModal for invisible comments (depth 6+)
- Verify no duplicate comment IDs in DOM
- Verify highlight ring appears and disappears',
    'post',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ) RETURNING id INTO post_id;

  -- Level 1: First comment
  INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    parent_id,
    content,
    message_type,
    created_at,
    edited_at
  ) VALUES (
    701,
    phase_id,
    p1_id,
    p1_char_id,
    post_id,
    'Level 1 comment - This is the first level of nesting.',
    'comment',
    NOW() - INTERVAL '23 hours',
    NOW() - INTERVAL '23 hours'
  ) RETURNING id INTO comment1_id;

  -- Level 2: Reply to comment1
  INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    parent_id,
    content,
    message_type,
    created_at,
    edited_at
  ) VALUES (
    701,
    phase_id,
    p2_id,
    p2_char_id,
    comment1_id,
    'Level 2 comment - This is the second level of nesting.',
    'comment',
    NOW() - INTERVAL '22 hours',
    NOW() - INTERVAL '22 hours'
  ) RETURNING id INTO comment2_id;

  -- Level 3: Reply to comment2
  INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    parent_id,
    content,
    message_type,
    created_at,
    edited_at
  ) VALUES (
    701,
    phase_id,
    p1_id,
    p1_char_id,
    comment2_id,
    'Level 3 comment - This is the third level of nesting.',
    'comment',
    NOW() - INTERVAL '21 hours',
    NOW() - INTERVAL '21 hours'
  ) RETURNING id INTO comment3_id;

  -- Level 4: Reply to comment3
  INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    parent_id,
    content,
    message_type,
    created_at,
    edited_at
  ) VALUES (
    701,
    phase_id,
    p2_id,
    p2_char_id,
    comment3_id,
    'Level 4 comment - This is the fourth level of nesting.',
    'comment',
    NOW() - INTERVAL '20 hours',
    NOW() - INTERVAL '20 hours'
  ) RETURNING id INTO comment4_id;

  -- Level 5: Reply to comment4 (last visible level in main view)
  INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    parent_id,
    content,
    message_type,
    created_at,
    edited_at
  ) VALUES (
    701,
    phase_id,
    p1_id,
    p1_char_id,
    comment4_id,
    'Level 5 comment - This is the fifth level of nesting (max visible depth).',
    'comment',
    NOW() - INTERVAL '19 hours',
    NOW() - INTERVAL '19 hours'
  ) RETURNING id INTO comment5_id;

  -- Level 6: Reply to comment5 (requires ThreadViewModal)
  INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    parent_id,
    content,
    message_type,
    created_at,
    edited_at
  ) VALUES (
    701,
    phase_id,
    p2_id,
    p2_char_id,
    comment5_id,
    'Level 6 comment - This exceeds max depth and should only appear in ThreadViewModal.',
    'comment',
    NOW() - INTERVAL '18 hours',
    NOW() - INTERVAL '18 hours'
  ) RETURNING id INTO comment6_id;

  -- Level 7: Reply to comment6 (also requires ThreadViewModal)
  INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    parent_id,
    content,
    message_type,
    created_at,
    edited_at
  ) VALUES (
    701,
    phase_id,
    p1_id,
    p1_char_id,
    comment6_id,
    'Level 7 comment - This is even deeper and should only appear in ThreadViewModal.',
    'comment',
    NOW() - INTERVAL '17 hours',
    NOW() - INTERVAL '17 hours'
  ) RETURNING id INTO comment7_id;

  RAISE NOTICE 'Deep Linking fixture created: Game #701 with post ID % and 7 nested comments', post_id;
END $$;

-- Reset the games sequence to prevent duplicate key errors
SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

-- Verify fixture
DO $$
BEGIN
  RAISE NOTICE 'Deep Linking Testing fixture created successfully!';
END $$;

COMMIT;
