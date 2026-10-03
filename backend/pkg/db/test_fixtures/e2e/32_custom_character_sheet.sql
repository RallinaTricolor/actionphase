-- E2E Test Fixture for the GM's Character Sheet editor
-- A game on the default sheet layout, for a GM to customise through the editor:
-- drop Inventory fields, add a Durability track, add a Contacts tab, then fill
-- it in through an action result.
--
-- Game IDs: 343 (offset by worker: Worker 1 = 10343, Worker 2 = 20343, etc.)
--
-- Dedicated game: the spec rewrites the game's layout, which would change what
-- every other sheet spec sees.
--
-- The character's inventory row is written as the write path writes it
-- (field_type 'json', is_public false, entries with ids), and carries Value and
-- Weight so removing those fields visibly hides stored data.
--
-- IDEMPOTENT: Safe to run multiple times - deletes existing data before recreating

BEGIN;

-- Deleting the game cascades to its characters, phases, actions and results.
DELETE FROM games WHERE id = 343;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  game_id INTEGER := 343;
  char_id INTEGER;
  phase_id INTEGER;
  action_id INTEGER;
BEGIN
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';

  -- character_sheet is left to its default: the spec customises it.
  INSERT INTO games (id, title, description, genre, gm_user_id, max_players, state, created_at, updated_at)
  VALUES (
    game_id,
    'E2E Test: Custom Character Sheet',
    'This game tests the GM customising the character sheet layout',
    'Test',
    gm_id,
    2,
    'in_progress',
    NOW() - INTERVAL '7 days',
    NOW()
  );

  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (game_id, p1_id, 'player', 'active', NOW() - INTERVAL '6 days');

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES (game_id, p1_id, 'Custom Sheet Char', 'player_character', 'approved', NOW() - INTERVAL '6 days', NOW())
  RETURNING id INTO char_id;

  INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, is_public, created_at, updated_at)
  VALUES
    (char_id, 'inventory', 'items',
     '[{"id":"item-1","name":"Storm Lantern","quantity":1,"category":"Gear","value":40,"weight":3,"description":"Burns for a night on a full reservoir."}]',
     'json', false, NOW(), NOW());

  -- An active action phase whose result the GM has not published yet, so the
  -- spec can stage a sheet update on it and publish.
  INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, deadline, is_active, is_published, created_at)
  VALUES (
    game_id, 'action', 1, 'Asking Around', 'Who in town will talk to you?',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', true, false, NOW() - INTERVAL '3 days'
  ) RETURNING id INTO phase_id;

  INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, submitted_at, updated_at)
  VALUES (
    game_id, p1_id, phase_id, char_id,
    'I buy the old man at the harbour a drink and ask about the refinery.',
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
  ) RETURNING id INTO action_id;

  INSERT INTO action_results (game_id, user_id, phase_id, character_id, action_submission_id, content, gm_user_id, is_published, sent_at, released_at, created_at, updated_at)
  VALUES (
    game_id, p1_id, phase_id, char_id, action_id,
    'Old Zadok talks, once the whisky has done its work.',
    gm_id, false, NULL, NULL, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'
  );
END $$;

-- Keep new game creations clear of the hardcoded fixture IDs.
SELECT setval('games_id_seq', (SELECT MAX(id) FROM games) + 1);

COMMIT;

SELECT 'E2E Custom Character Sheet fixture created successfully!' as message;
