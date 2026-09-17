-- E2E Test Fixture: Favorite Comments
-- Purpose: Dedicated game for favorite-comments.spec.ts. The spec stars and
--          unstars comments, which is write traffic against the viewer's own
--          favorites -- it needs a game no other spec reads, so a starred
--          comment left behind by a failed run cannot surface elsewhere.
--          Player 1 is the one doing the starring; Player 2 wrote the comments.
--          Two comments, so the spec can prove the favorites page lists the
--          starred one and not its neighbour.
-- Game ID: 707 (offset by worker via apply_e2e_worker.sh transformation)
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DELETE FROM games WHERE id = 707;

DO $$
DECLARE
  gm_id    INTEGER;
  p1_id    INTEGER;
  p2_id    INTEGER;
  phase_id INTEGER;
  post_id  INTEGER;
  archived_phase_id INTEGER;
  archived_post_id  INTEGER;
BEGIN
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';

  INSERT INTO games (
    id, title, description, genre, gm_user_id, max_players,
    state, created_at, updated_at
  ) VALUES (
    707,
    'E2E Test: Favorite Comments',
    'Stable fixture for the private comment favorites E2E tests.',
    'Test',
    gm_id,
    5,
    'in_progress',
    NOW() - INTERVAL '7 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES
    (707, p1_id, 'player', 'active', NOW() - INTERVAL '7 days'),
    (707, p2_id, 'player', 'active', NOW() - INTERVAL '7 days');

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (707, gm_id, 'Favorites GM',        'npc',              'approved', NOW() - INTERVAL '7 days', NOW()),
    (707, p1_id, 'Favoriting Reader',   'player_character', 'approved', NOW() - INTERVAL '7 days', NOW()),
    (707, p2_id, 'Favorited Commenter', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW());

  -- An earlier, closed common_room phase. This is what the History tab shows:
  -- the spec needs a phase that is NOT the current one to prove a star still
  -- works once a discussion is archived and readOnly.
  INSERT INTO game_phases (
    game_id, phase_type, phase_number, title, description,
    start_time, deadline, is_active, is_published, created_at
  ) VALUES (
    707, 'common_room', 1, 'Archived Discussion', 'Closed common room for history-tab favorites tests.',
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '10 days',
    false, true, NOW() - INTERVAL '20 days'
  ) RETURNING id INTO archived_phase_id;

  -- GM post in the archived phase, with one comment for the spec to star.
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, visibility, mentioned_character_ids, created_at
  ) VALUES (
    707, archived_phase_id, gm_id,
    (SELECT id FROM characters WHERE game_id = 707 AND user_id = gm_id LIMIT 1),
    'Archived Favorites Post',
    'post', 'game', '{}',
    NOW() - INTERVAL '19 days'
  ) RETURNING id INTO archived_post_id;

  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, parent_id, visibility, mentioned_character_ids, created_at
  ) VALUES (
    707, archived_phase_id, p2_id,
    (SELECT id FROM characters WHERE game_id = 707 AND user_id = p2_id LIMIT 1),
    'The archived comment Player 1 will star from history',
    'comment', archived_post_id, 'game', '{}',
    NOW() - INTERVAL '18 days'
  );

  -- Active common_room phase
  INSERT INTO game_phases (
    game_id, phase_type, phase_number, title, description,
    start_time, deadline, is_active, is_published, created_at
  ) VALUES (
    707, 'common_room', 2, 'Discussion', 'Common room for favorites tests.',
    NOW() - INTERVAL '6 days', NOW() + INTERVAL '30 days',
    true, true, NOW() - INTERVAL '6 days'
  ) RETURNING id INTO phase_id;

  -- GM post
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, visibility, mentioned_character_ids, created_at
  ) VALUES (
    707, phase_id, gm_id,
    (SELECT id FROM characters WHERE game_id = 707 AND user_id = gm_id LIMIT 1),
    'Favorites Test Post',
    'post', 'game', '{}',
    NOW() - INTERVAL '5 days'
  ) RETURNING id INTO post_id;

  -- The comment the spec stars. Distinctive wording so the favorites page
  -- assertion cannot pass on some other game's text.
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, parent_id, visibility, mentioned_character_ids, created_at
  ) VALUES (
    707, phase_id, p2_id,
    (SELECT id FROM characters WHERE game_id = 707 AND user_id = p2_id LIMIT 1),
    'The comment Player 1 will star',
    'comment', post_id, 'game', '{}',
    NOW() - INTERVAL '4 days'
  );

  -- A second, unstarred comment. Its absence from /favorites is what proves
  -- the page lists starred comments rather than every comment in the game.
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, parent_id, visibility, mentioned_character_ids, created_at
  ) VALUES (
    707, phase_id, p2_id,
    (SELECT id FROM characters WHERE game_id = 707 AND user_id = p2_id LIMIT 1),
    'The comment Player 1 will leave alone',
    'comment', post_id, 'game', '{}',
    NOW() - INTERVAL '3 days'
  );

  RAISE NOTICE 'Favorite Comments fixture created: Game #707';
END $$;

SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

COMMIT;
