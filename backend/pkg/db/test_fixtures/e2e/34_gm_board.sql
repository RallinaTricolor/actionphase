-- E2E Test Fixture: GM Results Board
-- Purpose: Copies of the Heist's results board for the specs in
--          frontend/e2e/gm-board/, one game per area so each spec's writes
--          stay out of the others' way.
--
--   711  Results Board - GM       Shell and Map (WRITES own items; not shared)
--   712  Results Board - Shared   Shared with the audience (READ-ONLY)
--   713  Results Board - Read     Read step (WRITES own cards, codex entries)
--   714  Results Board - Scenes   Scenes step (WRITES own scenes)
--   715  Results Board - Write    Write step (WRITES own results)
--   716  Results Board - Rewards  Rewards (WRITES lines, blocks, sheet drafts)
--   717  Results Board - Publish  Publishes results it wrote (IRREVERSIBLE)
--   718  Results Board - Co-GM    TestPlayer5 is co-GM; two editors at once
--   719  Results Board - Sharing  The GM turns sharing off and on
--   720  Results Board - Archive  Completed and shared: a public archive
--   721  Results Board - Empty    Action phase with submissions, no board and
--                                 no codex (the first-run guide)
--
-- Every game: TestGM runs it. Players 1-4 play the Heist's crew (Shade,
-- Rook, Vex, Silk), each with a character sheet (the rewards write to it),
-- and Inspector Dalton is an NPC. TestAudience is in the audience. Phase 2,
-- "Execute the Plan", is the action phase with the Heist's submissions, and
-- (except 721) fixtures.seed_heist_board (common/02_gm_board_seed.sql) fills
-- its board. The submissions match the demo Heist's (demo/05_actions.sql)
-- because the seeded cards quote them. Hand-written demo content; never
-- player content.
--
-- Tests that write make their own items (named with a per-run tag) or set
-- the seeded items they touch through the board's save endpoint first, so a
-- retry starts from the same state.
-- Game IDs: 711-721 (offset by worker via apply_e2e_worker.sh transformation)
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DELETE FROM games WHERE id IN (711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721);

DO $$
DECLARE
  -- Held in game_*_id variables so apply_e2e_worker.sh offsets them per worker.
  game_board_gm_id      INTEGER := 711;
  game_board_shared_id  INTEGER := 712;
  game_board_read_id    INTEGER := 713;
  game_board_scenes_id  INTEGER := 714;
  game_board_write_id   INTEGER := 715;
  game_board_rewards_id INTEGER := 716;
  game_board_publish_id INTEGER := 717;
  game_board_cogm_id    INTEGER := 718;
  game_board_sharing_id INTEGER := 719;
  game_board_archive_id INTEGER := 720;
  game_board_empty_id   INTEGER := 721;
  gm_id       INTEGER;
  p1_id       INTEGER;
  p2_id       INTEGER;
  p3_id       INTEGER;
  p4_id       INTEGER;
  p5_id       INTEGER;
  audience_id INTEGER;
  phase_id    INTEGER;
  running     BOOLEAN;
  game_rec    RECORD;
BEGIN
  SELECT id INTO gm_id       FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id       FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id       FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id       FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO p4_id       FROM users WHERE email = 'test_player4@example.com';
  SELECT id INTO p5_id       FROM users WHERE email = 'test_player5@example.com';
  SELECT id INTO audience_id FROM users WHERE email = 'test_audience@example.com';

  FOR game_rec IN
    SELECT * FROM (VALUES
      (game_board_gm_id,      'E2E Test: Results Board - GM',      false, 'in_progress', true,  false),
      (game_board_shared_id,  'E2E Test: Results Board - Shared',  true,  'in_progress', true,  false),
      (game_board_read_id,    'E2E Test: Results Board - Read',    false, 'in_progress', true,  false),
      (game_board_scenes_id,  'E2E Test: Results Board - Scenes',  false, 'in_progress', true,  false),
      (game_board_write_id,   'E2E Test: Results Board - Write',   false, 'in_progress', true,  false),
      (game_board_rewards_id, 'E2E Test: Results Board - Rewards', false, 'in_progress', true,  false),
      (game_board_publish_id, 'E2E Test: Results Board - Publish', false, 'in_progress', true,  false),
      (game_board_cogm_id,    'E2E Test: Results Board - Co-GM',   false, 'in_progress', true,  true),
      (game_board_sharing_id, 'E2E Test: Results Board - Sharing', true,  'in_progress', true,  false),
      (game_board_archive_id, 'E2E Test: Results Board - Archive', true,  'completed',   true,  false),
      (game_board_empty_id,   'E2E Test: Results Board - Empty',   false, 'in_progress', false, false)
    ) AS g(id, title, shared, state, seeded, co_gm)
  LOOP
    running := game_rec.state = 'in_progress';

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
      game_rec.state,
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

    IF game_rec.co_gm THEN
      INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
      VALUES (game_rec.id, p5_id, 'co_gm', 'active', NOW() - INTERVAL '8 days');
    END IF;

    INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
    VALUES
      (game_rec.id, p1_id, 'Shade (Whisper)',  'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()),
      (game_rec.id, p2_id, 'Rook (Hound)',     'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()),
      (game_rec.id, p3_id, 'Vex (Leech)',      'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()),
      (game_rec.id, p4_id, 'Silk (Spider)',    'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()),
      (game_rec.id, NULL,  'Inspector Dalton', 'npc',              'approved', NOW() - INTERVAL '8 days', NOW());

    -- Sheets, in the shapes the app writes now (one JSON-array row per stat
    -- module; a Numbers amount is a track value {value, max?, display?}, not
    -- the legacy flat amount that demo/04_characters.sql still uses). The seed's
    -- rewards add to Numbers/Coin and Stress, set Skills, and add Inventory.
    INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, is_public, created_at, updated_at)
    SELECT c.id, s.module_type, s.field_name, s.field_value, s.field_type, s.module_type = 'bio', NOW(), NOW()
    FROM (VALUES
      ('Shade (Whisper)', 'numbers',   'numbers', '[{"id":"5e1a0c2d-1b3f-4a51-9c01-0a1b2c3d4e01","name":"Coin","amount":{"value":6}},{"id":"5e1a0c2d-1b3f-4a51-9c01-0a1b2c3d4e02","name":"Stress","amount":{"value":4,"max":9,"display":"boxes"}}]', 'json'),
      ('Shade (Whisper)', 'skills',    'skills',  '[{"id":"5e1a0c2d-1b3f-4a51-9c01-0a1b2c3d4e03","name":"Compel","rank":"2","description":"Force a ghost or spirit to obey.","category":"Arcane"}]', 'json'),
      ('Shade (Whisper)', 'inventory', 'items',   '[{"id":"5e1a0c2d-1b3f-4a51-9c01-0a1b2c3d4e04","name":"Spirit Bottle","description":"Holds a captured ghost.","quantity":1,"category":"Arcane"}]', 'json'),
      ('Rook (Hound)',    'numbers',   'numbers', '[{"id":"5e1a0c2d-1b3f-4a51-9c02-0a1b2c3d4e01","name":"Coin","amount":{"value":3}},{"id":"5e1a0c2d-1b3f-4a51-9c02-0a1b2c3d4e02","name":"Stress","amount":{"value":2,"max":9,"display":"boxes"}}]', 'json'),
      ('Rook (Hound)',    'skills',    'skills',  '[{"id":"5e1a0c2d-1b3f-4a51-9c02-0a1b2c3d4e03","name":"Sharpshooter","rank":"3","description":"Push yourself to make a long-range shot.","category":"Combat"}]', 'json'),
      ('Rook (Hound)',    'inventory', 'items',   '[{"id":"5e1a0c2d-1b3f-4a51-9c02-0a1b2c3d4e04","name":"Hunting Rifle","description":"Scoped, well maintained.","quantity":1,"category":"Weapon"}]', 'json'),
      ('Vex (Leech)',     'numbers',   'numbers', '[{"id":"5e1a0c2d-1b3f-4a51-9c03-0a1b2c3d4e01","name":"Coin","amount":{"value":2}},{"id":"5e1a0c2d-1b3f-4a51-9c03-0a1b2c3d4e02","name":"Stress","amount":{"value":5,"max":9,"display":"boxes"}}]', 'json'),
      ('Vex (Leech)',     'skills',    'skills',  '[{"id":"5e1a0c2d-1b3f-4a51-9c03-0a1b2c3d4e03","name":"Tinker","rank":"2","description":"Build, fix and take apart.","category":"Craft"}]', 'json'),
      ('Vex (Leech)',     'inventory', 'items',   '[{"id":"5e1a0c2d-1b3f-4a51-9c03-0a1b2c3d4e04","name":"Precision Tools","description":"Picks, files and a jeweller''s loupe.","quantity":1,"category":"Tools"}]', 'json'),
      ('Silk (Spider)',   'numbers',   'numbers', '[{"id":"5e1a0c2d-1b3f-4a51-9c04-0a1b2c3d4e01","name":"Coin","amount":{"value":4}},{"id":"5e1a0c2d-1b3f-4a51-9c04-0a1b2c3d4e02","name":"Stress","amount":{"value":1,"max":9,"display":"boxes"}}]', 'json'),
      ('Silk (Spider)',   'skills',    'skills',  '[{"id":"5e1a0c2d-1b3f-4a51-9c04-0a1b2c3d4e03","name":"Consort","rank":"3","description":"Talk your way in anywhere.","category":"Social"}]', 'json'),
      ('Silk (Spider)',   'inventory', 'items',   '[{"id":"5e1a0c2d-1b3f-4a51-9c04-0a1b2c3d4e04","name":"Widow''s Veil","description":"Lady Ashworth''s, and nobody looks twice.","quantity":1,"category":"Disguise"}]', 'json')
    ) AS s(name, module_type, field_name, field_value, field_type)
    JOIN characters c ON c.game_id = game_rec.id AND c.name = s.name;

    INSERT INTO game_phases (
      game_id, phase_type, phase_number, title, description,
      start_time, end_time, deadline, is_active, is_published, activated_at, created_at
    ) VALUES (
      game_rec.id, 'common_room', 1, 'Casing the Bank', 'Plan the job.',
      NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
      false, false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
    );

    -- Active while the game runs; in the archive it's a finished phase.
    INSERT INTO game_phases (
      game_id, phase_type, phase_number, title, description,
      start_time, end_time, deadline, is_active, is_published, activated_at, created_at
    ) VALUES (
      game_rec.id, 'action', 2, 'Execute the Plan', 'Each of you says what you do during the job.',
      NOW() - INTERVAL '2 days',
      CASE WHEN running THEN NULL ELSE NOW() - INTERVAL '1 day' END,
      CASE WHEN running THEN NOW() + INTERVAL '30 days' ELSE NOW() - INTERVAL '1 day' END,
      running, false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
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

    IF game_rec.seeded THEN
      PERFORM fixtures.seed_heist_board(game_rec.id, phase_id);
    END IF;
  END LOOP;
END $$;

COMMIT;
