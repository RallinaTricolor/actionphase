-- E2E Test Fixture: GM Results Board
-- Purpose: Two copies of the Heist's results board for gm-results-board.spec.ts,
--          one shared with the audience and one not.
--
--   711  E2E Test: Results Board - GM      (WRITES; NOT SHARED)
--        The GM opens the board from the results area and sets a card's
--        outcome on the Map. TestAudience is in the audience, but the board
--        isn't shared, so History offers no link and the page says so.
--
--   712  E2E Test: Results Board - Shared  (READ-ONLY; SHARED)
--        share_gm_board is on: TestAudience follows the board read-only
--        from the History tab.
--
-- Both games: TestGM runs them. Players 1-4 play the Heist's crew (Shade,
-- Rook, Vex, Silk) and Inspector Dalton is an NPC, with the Heist's
-- submissions in the active action phase ("Execute the Plan"), so
-- fixtures.seed_heist_board (common/02_gm_board_seed.sql) can fill the
-- board. The submissions match the demo Heist's (demo/05_actions.sql)
-- because the seeded cards quote them. Hand-written demo content; never
-- player content.
-- Game IDs: 711, 712 (offset by worker via apply_e2e_worker.sh transformation)
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DELETE FROM games WHERE id IN (711, 712);

DO $$
DECLARE
  -- Held in game_*_id variables so apply_e2e_worker.sh offsets them per worker.
  game_board_gm_id     INTEGER := 711;
  game_board_shared_id INTEGER := 712;
  gm_id       INTEGER;
  p1_id       INTEGER;
  p2_id       INTEGER;
  p3_id       INTEGER;
  p4_id       INTEGER;
  audience_id INTEGER;
  phase_id    INTEGER;
  game_rec    RECORD;
BEGIN
  SELECT id INTO gm_id       FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id       FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id       FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id       FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO p4_id       FROM users WHERE email = 'test_player4@example.com';
  SELECT id INTO audience_id FROM users WHERE email = 'test_audience@example.com';

  FOR game_rec IN
    SELECT * FROM (VALUES
      (game_board_gm_id,     'E2E Test: Results Board - GM',     false),
      (game_board_shared_id, 'E2E Test: Results Board - Shared', true)
    ) AS g(id, title, shared)
  LOOP
    INSERT INTO games (
      id, title, description, genre, gm_user_id, max_players,
      state, share_gm_board, created_at, updated_at
    ) VALUES (
      game_rec.id,
      game_rec.title,
      'Stable fixture for the results board E2E tests.',
      'Test',
      gm_id,
      5,
      'in_progress',
      game_rec.shared,
      NOW() - INTERVAL '10 days',
      NOW()
    );

    INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
    VALUES
      (game_rec.id, p1_id,       'player',   'active', NOW() - INTERVAL '9 days'),
      (game_rec.id, p2_id,       'player',   'active', NOW() - INTERVAL '9 days'),
      (game_rec.id, p3_id,       'player',   'active', NOW() - INTERVAL '9 days'),
      (game_rec.id, p4_id,       'player',   'active', NOW() - INTERVAL '9 days'),
      (game_rec.id, audience_id, 'audience', 'active', NOW() - INTERVAL '8 days');

    INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
    VALUES
      (game_rec.id, p1_id, 'Shade (Whisper)',  'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()),
      (game_rec.id, p2_id, 'Rook (Hound)',     'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()),
      (game_rec.id, p3_id, 'Vex (Leech)',      'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()),
      (game_rec.id, p4_id, 'Silk (Spider)',    'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()),
      (game_rec.id, NULL,  'Inspector Dalton', 'npc',              'approved', NOW() - INTERVAL '8 days', NOW());

    INSERT INTO game_phases (
      game_id, phase_type, phase_number, title, description,
      start_time, end_time, deadline, is_active, is_published, activated_at, created_at
    ) VALUES (
      game_rec.id, 'common_room', 1, 'Casing the Bank', 'Plan the job.',
      NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
      false, false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
    );

    INSERT INTO game_phases (
      game_id, phase_type, phase_number, title, description,
      start_time, deadline, is_active, is_published, activated_at, created_at
    ) VALUES (
      game_rec.id, 'action', 2, 'Execute the Plan', 'Each of you says what you do during the job.',
      NOW() - INTERVAL '2 days', NOW() + INTERVAL '30 days',
      true, false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
    ) RETURNING id INTO phase_id;

    INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, submitted_at, updated_at)
    SELECT game_rec.id, c.user_id, phase_id, c.id, s.content, NOW() - s.ago, NOW() - s.ago
    FROM (VALUES
      ('Shade (Whisper)', INTERVAL '2 hours',
       E'Using my supernatural senses, I''ll scan the vault room for any lingering spirits or magical wards before the team enters. If I detect anything, I''ll attempt to commune with or dispel it using my Compel ability.\n\nI''ll position myself near the entrance as a lookout while maintaining focus on the ethereal plane. If guards approach, I''ll create a minor distraction using ghost sounds.'),
      ('Rook (Hound)', INTERVAL '3 hours',
       E'I''ll take up a sniper position on the rooftop across from the bank''s rear entrance. Using my spyglass and Sharpshooter ability, I''ll keep watch on all approaches and provide cover fire if needed.\n\nMy hunting rifle is loaded with tranquilizer darts as the first option, but I have live rounds ready if things go badly. I''ll signal the team via our pre-arranged mirror flashes if I spot any patrols.'),
      ('Vex (Leech)', INTERVAL '1 hour',
       E'I''ll use my alchemical knowledge to create smoke bombs and a custom acid mixture that can dissolve the vault''s lock mechanism without triggering the alarm system.\n\nOnce inside, I''ll handle the mechanical aspects - disabling pressure plates, bypassing the combination lock using my precision tools, and neutralizing any gas traps. I''ve studied the bank''s blueprints extensively and know which ducts to avoid.'),
      ('Silk (Spider)', INTERVAL '90 minutes',
       E'I''ll walk in through the front doors as Lady Ashworth, a wealthy widow opening a deposit account, and ask to speak with the manager in person. While he''s busy with me, I''ll lift the vault key from his waistcoat.\n\nIf Inspector Dalton is in the lobby, I''ll keep him talking about his late wife''s estate until Vex gives the signal. Once the vault is open, I''ll leave the way I came in and wait with the carriage in the alley.')
    ) AS s(name, ago, content)
    JOIN characters c ON c.game_id = game_rec.id AND c.name = s.name;

    PERFORM fixtures.seed_heist_board(game_rec.id, phase_id);
  END LOOP;
END $$;

COMMIT;
