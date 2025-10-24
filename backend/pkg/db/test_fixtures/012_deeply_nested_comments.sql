-- Test fixture: Deeply nested comments for testing depth limiting
-- Game: Shadows Over Innsmouth (ID: 2869)
-- Creates a conversation thread that goes 8 levels deep

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  target_game_id INTEGER;
  target_phase_id INTEGER;
  gm_char_id INTEGER;
  p1_char_id INTEGER;
  p2_char_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';

  -- Get game and phase IDs
  SELECT id INTO target_game_id FROM games WHERE title = 'Shadows Over Innsmouth';
  SELECT id INTO target_phase_id FROM game_phases WHERE game_id = target_game_id AND is_active = true LIMIT 1;

  -- Get character IDs
  SELECT id INTO gm_char_id FROM characters WHERE game_id = target_game_id AND user_id = gm_id AND character_type = 'npc' LIMIT 1;
  SELECT id INTO p1_char_id FROM characters WHERE game_id = target_game_id AND user_id = p1_id LIMIT 1;
  SELECT id INTO p2_char_id FROM characters WHERE game_id = target_game_id AND user_id = p2_id LIMIT 1;

-- Post: "Deep Discussion Thread" by GM
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9000,
    target_game_id,
    target_phase_id,
    gm_id,
    gm_char_id,
    '# Deep Discussion Thread

This is a test post designed to demonstrate deeply nested comment threading. The conversation below goes 8 levels deep to test the depth limiting functionality.

**Question**: What do you all think about the mysterious happenings in Innsmouth?',
    'post',
    NULL,
    'game',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
);

-- Level 1: First comment by Player1
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9001,
    target_game_id,
    target_phase_id,
    p1_id,
    p1_char_id,
    'The fishing boats have been acting strange - coming back with empty nets, or not coming back at all.',
    'comment',
    9000,
    'game',
    NOW() - INTERVAL '1 hour 55 minutes',
    NOW() - INTERVAL '1 hour 55 minutes'
);

-- Level 2: Reply to Level 1
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9002,
    target_game_id,
    target_phase_id,
    p2_id,
    p2_char_id,
    'But what if there''s more to it? The townspeople seem... different. Maybe there''s a deeper reason they''re avoiding us.',
    'comment',
    9001,
    'game',
    NOW() - INTERVAL '1 hour 50 minutes',
    NOW() - INTERVAL '1 hour 50 minutes'
);

-- Level 3: Reply to Level 2
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9003,
    target_game_id,
    target_phase_id,
    p1_id,
    p1_char_id,
    'That''s a good point. What if they''re actually protecting something? Maybe the strange fish smell is just a cover.',
    'comment',
    9002,
    'game',
    NOW() - INTERVAL '1 hour 45 minutes',
    NOW() - INTERVAL '1 hour 45 minutes'
);

-- Level 4: Reply to Level 3
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9004,
    target_game_id,
    target_phase_id,
    gm_id,
    gm_char_id,
    '*Interesting theory!* 🤔

What makes you think they might be protecting something?',
    'comment',
    9003,
    'game',
    NOW() - INTERVAL '1 hour 40 minutes',
    NOW() - INTERVAL '1 hour 40 minutes'
);

-- Level 5: Reply to Level 4 (Max depth reached - Continue button should appear here)
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9005,
    target_game_id,
    target_phase_id,
    p1_id,
    p1_char_id,
    'Well, cults are known for their secrecy. If I were hiding something from outsiders, I''d use misdirection to lure investigators away from what I truly value.

**This is depth 5** - the "Continue thread" button should appear after this comment in the main view.',
    'comment',
    9004,
    'game',
    NOW() - INTERVAL '1 hour 35 minutes',
    NOW() - INTERVAL '1 hour 35 minutes'
);

-- Level 6: Reply to Level 5 (Should only appear in thread view)
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9006,
    target_game_id,
    target_phase_id,
    p2_id,
    p2_char_id,
    '**This is depth 6** - You should only see this in the thread view, not in the main common room.

Perhaps we should investigate what they consider truly valuable?',
    'comment',
    9005,
    'game',
    NOW() - INTERVAL '1 hour 30 minutes',
    NOW() - INTERVAL '1 hour 30 minutes'
);

-- Level 7: Reply to Level 6
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9007,
    target_game_id,
    target_phase_id,
    gm_id,
    gm_char_id,
    '**Depth 7** - Still in thread view only.

*The fog rolls in from the harbor, thick and unnatural. You hear strange chanting in the distance...*',
    'comment',
    9006,
    'game',
    NOW() - INTERVAL '1 hour 25 minutes',
    NOW() - INTERVAL '1 hour 25 minutes'
);

-- Level 8: Reply to Level 7 (Deepest level)
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9008,
    target_game_id,
    target_phase_id,
    p1_id,
    p1_char_id,
    '**Depth 8** - The deepest level of this test thread!

I roll for perception to examine the harbor for any hidden passages or clues. 🎲',
    'comment',
    9007,
    'game',
    NOW() - INTERVAL '1 hour 20 minutes',
    NOW() - INTERVAL '1 hour 20 minutes'
);

-- Note: reply_count and comment_count are computed in queries, not stored in DB
-- The database will calculate these automatically when querying

-- Add a parallel branch at level 5 to test multiple threads at max depth
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9010,
    target_game_id,
    target_phase_id,
    p2_id,
    p2_char_id,
    'Wait - I just thought of something else! What if there are more of them than we thought?

**This is a separate branch** at depth 5, also triggering the "Continue thread" button.',
    'comment',
    9004, -- Reply to Level 4, creating a second branch
    'game',
    NOW() - INTERVAL '1 hour 15 minutes',
    NOW() - INTERVAL '1 hour 15 minutes'
);

-- Add reply to the parallel branch (depth 6)
INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
VALUES (
    9011,
    target_game_id,
    target_phase_id,
    p1_id,
    p1_char_id,
    '**Branch 2, Depth 6** - More cultists?! That would complicate things significantly.',
    'comment',
    9010,
    'game',
    NOW() - INTERVAL '1 hour 10 minutes',
    NOW() - INTERVAL '1 hour 10 minutes'
);

END $$;

-- Note: reply counts are computed automatically in queries
