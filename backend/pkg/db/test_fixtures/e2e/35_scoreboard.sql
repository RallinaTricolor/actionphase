-- E2E Test Fixture: Scoreboard
-- Purpose: One game per acceptance example in scoreboard.spec.ts. All
--          READ-ONLY: no spec writes to them, so tests and retries can run in
--          any order.
--
--   722  E2E Test: Scoreboard - Public    Board A: public, Score shown, Score high to low
--   723  E2E Test: Scoreboard - Ranked    Board B: public, Score HIDDEN, Score high to low then name
--   724  E2E Test: Scoreboard - Private   Board C: GM and audience only, Score + HP
--   725  E2E Test: Scoreboard - Epilogue  Board C's setup, Score hidden, seeded in epilogue
--                                         (seeded rather than moved there by the
--                                         spec, so a retry finds the same state)
--   726  E2E Test: Scoreboard - Ranges    public, HP shown as ranges
--   727  E2E Test: Scoreboard - Top       board A, but players see only the top 2. The
--                                         cut falls inside the Briar/Corin tie
--
-- Same cast in every game (TestGM runs them all):
--   Ash     TestPlayer1  Score 12   HP 11/12
--   Briar   TestPlayer2  score 7    HP 6/12   (older flat Numbers shape, lower-case name)
--   Corin   TestPlayer3  Score 7    HP 3/10   (ties Briar; name breaks the tie)
--   Dell    TestPlayer4  no Score   HP 0/12   (blank, sorts last)
--   Ember   TestPlayer5  Score 99   pending   (not on the board)
--   Banker  NPC          Score 50             (not on the board)
-- So every board lists Ash, Briar, Corin, Dell, and a score board orders them
-- exactly that way. TestAudience is the audience in 724.
--
-- Configs are written the way the API stores them: no "display" for a plain
-- value, no "hidden": false, and no "visibility" for GM and audience only.
-- Numbers rows are is_public = false, as the sheet editor writes them.
--
-- Game IDs: 722-727 (offset by worker via apply_e2e_worker.sh transformation)
-- IDEMPOTENT: Safe to run multiple times

BEGIN;

DELETE FROM games WHERE id IN (722, 723, 724, 725, 726, 727);

DO $$
DECLARE
  -- Held in game_*_id variables so apply_e2e_worker.sh offsets them per worker.
  game_public_id   INTEGER := 722;
  game_ranked_id   INTEGER := 723;
  game_private_id  INTEGER := 724;
  game_epilogue_id INTEGER := 725;
  game_ranges_id   INTEGER := 726;
  game_top_id      INTEGER := 727;
  gm_id   INTEGER;
  p1_id   INTEGER;
  p2_id   INTEGER;
  p3_id   INTEGER;
  p4_id   INTEGER;
  p5_id   INTEGER;
  aud_id  INTEGER;
  ash_id  INTEGER;
  briar_id INTEGER;
  corin_id INTEGER;
  dell_id  INTEGER;
  ember_id INTEGER;
  banker_id INTEGER;
  game_rec RECORD;
BEGIN
  SELECT id INTO gm_id  FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id  FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id  FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id  FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO p4_id  FROM users WHERE email = 'test_player4@example.com';
  SELECT id INTO p5_id  FROM users WHERE email = 'test_player5@example.com';
  SELECT id INTO aud_id FROM users WHERE email = 'test_audience@example.com';

  FOR game_rec IN
    SELECT * FROM (VALUES
      (game_public_id, 'E2E Test: Scoreboard - Public', 'in_progress',
       '{"visibility": "public", "columns": [{"id": "c_score1", "label": "Score", "tab_key": "numbers", "entry": "Score", "field_key": "amount"}], "sort": [{"key": "c_score1", "direction": "desc"}]}'),
      (game_ranked_id, 'E2E Test: Scoreboard - Ranked', 'in_progress',
       '{"visibility": "public", "columns": [{"id": "c_score1", "label": "Score", "tab_key": "numbers", "entry": "Score", "field_key": "amount", "hidden": true}], "sort": [{"key": "c_score1", "direction": "desc"}, {"key": "name", "direction": "asc"}]}'),
      (game_private_id, 'E2E Test: Scoreboard - Private', 'in_progress',
       '{"columns": [{"id": "c_score1", "label": "Score", "tab_key": "numbers", "entry": "Score", "field_key": "amount"}, {"id": "c_hpval1", "label": "HP", "tab_key": "numbers", "entry": "HP", "field_key": "amount", "display": "value_max"}]}'),
      (game_epilogue_id, 'E2E Test: Scoreboard - Epilogue', 'epilogue',
       '{"columns": [{"id": "c_score1", "label": "Score", "tab_key": "numbers", "entry": "Score", "field_key": "amount", "hidden": true}, {"id": "c_hpval1", "label": "HP", "tab_key": "numbers", "entry": "HP", "field_key": "amount", "display": "value_max"}]}'),
      (game_ranges_id, 'E2E Test: Scoreboard - Ranges', 'in_progress',
       '{"visibility": "public", "columns": [{"id": "c_hpband", "label": "HP", "tab_key": "numbers", "entry": "HP", "field_key": "amount", "display": "bands", "bands": [{"label": "Healthy", "min": 10}, {"label": "Bloodied", "min": 5, "min_strict": true, "max": 10, "max_strict": true}, {"label": "Critical", "min": 0, "min_strict": true, "max": 5}], "fallback_label": "Down"}]}'),
      (game_top_id, 'E2E Test: Scoreboard - Top', 'in_progress',
       '{"visibility": "public", "columns": [{"id": "c_score1", "label": "Score", "tab_key": "numbers", "entry": "Score", "field_key": "amount"}], "sort": [{"key": "c_score1", "direction": "desc"}], "top_count": 2}')
    ) AS g(id, title, state, scoreboard)
  LOOP
    INSERT INTO games (
      id, title, description, genre, gm_user_id, max_players,
      state, scoreboard_enabled, scoreboard, created_at, updated_at
    ) VALUES (
      game_rec.id,
      game_rec.title,
      'Stable fixture for the scoreboard E2E tests.',
      'Test',
      gm_id,
      6,
      game_rec.state,
      true,
      game_rec.scoreboard::jsonb,
      NOW() - INTERVAL '7 days',
      NOW()
    );

    INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
    VALUES
      (game_rec.id, p1_id, 'player', 'active', NOW() - INTERVAL '7 days'),
      (game_rec.id, p2_id, 'player', 'active', NOW() - INTERVAL '7 days'),
      (game_rec.id, p3_id, 'player', 'active', NOW() - INTERVAL '7 days'),
      (game_rec.id, p4_id, 'player', 'active', NOW() - INTERVAL '7 days'),
      (game_rec.id, p5_id, 'player', 'active', NOW() - INTERVAL '7 days');

    INSERT INTO game_phases (
      game_id, phase_type, phase_number, title, description,
      start_time, deadline, is_active, is_published, activated_at, created_at
    ) VALUES (
      game_rec.id, 'common_room', 1, 'Discussion', 'Common room for the scoreboard tests.',
      NOW() - INTERVAL '6 days', NOW() + INTERVAL '30 days',
      true, false, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'
    );

    INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
    VALUES (game_rec.id, p1_id, 'Ash', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
    RETURNING id INTO ash_id;
    INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
    VALUES (game_rec.id, p2_id, 'Briar', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
    RETURNING id INTO briar_id;
    INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
    VALUES (game_rec.id, p3_id, 'Corin', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
    RETURNING id INTO corin_id;
    INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
    VALUES (game_rec.id, p4_id, 'Dell', 'player_character', 'approved', NOW() - INTERVAL '7 days', NOW())
    RETURNING id INTO dell_id;
    INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
    VALUES (game_rec.id, p5_id, 'Ember', 'player_character', 'pending', NOW() - INTERVAL '7 days', NOW())
    RETURNING id INTO ember_id;
    INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
    VALUES (game_rec.id, NULL, 'Banker', 'npc', 'approved', NOW() - INTERVAL '7 days', NOW())
    RETURNING id INTO banker_id;

    INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, is_public, created_at, updated_at)
    VALUES
      (ash_id, 'numbers', 'numbers',
       '[{"id":"n-score","name":"Score","amount":{"value":12}},{"id":"n-hp","name":"HP","amount":{"value":11,"max":12,"display":"track"}}]',
       'json', false, NOW(), NOW()),
      (briar_id, 'numbers', 'numbers',
       '[{"id":"n-score","name":"score","amount":7},{"id":"n-hp","name":"HP","amount":6,"max":12,"display":"boxes"}]',
       'json', false, NOW(), NOW()),
      (corin_id, 'numbers', 'numbers',
       '[{"id":"n-score","name":"Score","amount":{"value":7}},{"id":"n-hp","name":"HP","amount":{"value":3,"max":10,"display":"track"}}]',
       'json', false, NOW(), NOW()),
      (dell_id, 'numbers', 'numbers',
       '[{"id":"n-hp","name":"HP","amount":{"value":0,"max":12,"display":"track"}}]',
       'json', false, NOW(), NOW()),
      (ember_id, 'numbers', 'numbers',
       '[{"id":"n-score","name":"Score","amount":{"value":99}}]',
       'json', false, NOW(), NOW()),
      (banker_id, 'numbers', 'numbers',
       '[{"id":"n-score","name":"Score","amount":{"value":50}}]',
       'json', false, NOW(), NOW());
  END LOOP;

  -- Board C is GM and audience only; the audience must see all of it.
  INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
  VALUES (game_private_id, aud_id, 'audience', 'active', NOW() - INTERVAL '6 days');
END $$;

COMMIT;
