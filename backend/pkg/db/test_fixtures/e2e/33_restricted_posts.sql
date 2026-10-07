-- E2E Test Fixture: Restricted Common Room Posts
-- Purpose: Two games for restricted-posts.spec.ts, one per test, so the test
--          that writes can't disturb the one that only reads.
--
--   708  E2E Test: Restricted Posts - GM          (WRITES)
--        Empty active common room. The GM creates a restricted post through
--        the form and changes its viewers through the modal.
--
--   709  E2E Test: Restricted Posts - Visibility  (READ-ONLY)
--        One public post, and one post restricted to Player 1 with a comment
--        by Player 1 under it. Player 1 must see both; Player 2 must see only
--        the public one, and a deep link to the hidden comment must land on
--        the "couldn't be found" notice.
--
-- Both games: TestGM runs them; Player 1 ("Ivy Insider") and Player 2
-- ("Oscar Outsider") are active players.
-- Game IDs: 708, 709 (offset by worker via apply_e2e_worker.sh transformation)
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DELETE FROM games WHERE id IN (708, 709);

DO $$
DECLARE
  -- Held in game_*_id variables so apply_e2e_worker.sh offsets them per worker.
  game_gm_id         INTEGER := 708;
  game_visibility_id INTEGER := 709;
  gm_id    INTEGER;
  p1_id    INTEGER;
  p2_id    INTEGER;
  phase_id INTEGER;
  post_id  INTEGER;
  game_rec RECORD;
BEGIN
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';

  -- The two games share a cast and an active common room phase.
  FOR game_rec IN
    SELECT * FROM (VALUES
      (game_gm_id,         'E2E Test: Restricted Posts - GM'),
      (game_visibility_id, 'E2E Test: Restricted Posts - Visibility')
    ) AS g(id, title)
  LOOP
    INSERT INTO games (
      id, title, description, genre, gm_user_id, max_players,
      state, created_at, updated_at
    ) VALUES (
      game_rec.id,
      game_rec.title,
      'Stable fixture for the restricted Common Room post E2E tests.',
      'Test',
      gm_id,
      5,
      'in_progress',
      NOW() - INTERVAL '7 days',
      NOW()
    );

    INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
    VALUES
      (game_rec.id, p1_id, 'player', 'active', NOW() - INTERVAL '7 days'),
      (game_rec.id, p2_id, 'player', 'active', NOW() - INTERVAL '7 days');

    INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
    VALUES
      (game_rec.id, gm_id, 'Restricted Posts GM', 'npc',              'approved', NOW() - INTERVAL '7 days', NOW()),
      (game_rec.id, p1_id, 'Ivy Insider',         'player_character', 'approved', NOW() - INTERVAL '7 days', NOW()),
      (game_rec.id, p2_id, 'Oscar Outsider',      'player_character', 'approved', NOW() - INTERVAL '7 days', NOW());

    INSERT INTO game_phases (
      game_id, phase_type, phase_number, title, description,
      start_time, deadline, is_active, is_published, created_at
    ) VALUES (
      game_rec.id, 'common_room', 1, 'Discussion', 'Common room for restricted post tests.',
      NOW() - INTERVAL '6 days', NOW() + INTERVAL '30 days',
      true, false, NOW() - INTERVAL '6 days'
    );
  END LOOP;

  SELECT id INTO phase_id FROM game_phases WHERE game_id = game_visibility_id AND is_active;

  -- 709: a public post, so Player 2's room is not empty and the spec can
  -- tell "the room loaded without the restricted post" from "nothing loaded".
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, visibility, mentioned_character_ids, created_at
  ) VALUES (
    game_visibility_id, phase_id, gm_id,
    (SELECT id FROM characters WHERE game_id = game_visibility_id AND user_id = gm_id LIMIT 1),
    'A post for everyone',
    'post', 'game', '{}',
    NOW() - INTERVAL '5 days'
  );

  -- 709: the restricted post, its allowlist, and Player 1's comment.
  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, visibility, mentioned_character_ids, is_restricted, created_at
  ) VALUES (
    game_visibility_id, phase_id, gm_id,
    (SELECT id FROM characters WHERE game_id = game_visibility_id AND user_id = gm_id LIMIT 1),
    'A post for Ivy only',
    'post', 'game', '{}', true,
    NOW() - INTERVAL '4 days'
  ) RETURNING id INTO post_id;

  INSERT INTO common_room_post_viewers (post_id, user_id) VALUES (post_id, p1_id);

  INSERT INTO messages (
    game_id, phase_id, author_id, character_id,
    content, message_type, parent_id, visibility, mentioned_character_ids, created_at
  ) VALUES (
    game_visibility_id, phase_id, p1_id,
    (SELECT id FROM characters WHERE game_id = game_visibility_id AND user_id = p1_id LIMIT 1),
    'Ivy replies where Oscar cannot see',
    'comment', post_id, 'game', '{}',
    NOW() - INTERVAL '3 days'
  );

  RAISE NOTICE 'Restricted Posts fixtures created: Games #708, #709';
END $$;

SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

COMMIT;
