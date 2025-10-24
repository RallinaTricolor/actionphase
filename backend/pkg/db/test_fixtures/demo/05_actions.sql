-- Create Action Submissions for Action Phases

BEGIN;

DO $$
DECLARE
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  p4_id INTEGER;
  game2_id INTEGER;
  game4_id INTEGER;
  phase2_id INTEGER;
  phase4_id INTEGER;
  char1_id INTEGER;
  char2_id INTEGER;
  char3_id INTEGER;
  char4_id INTEGER;
  char5_id INTEGER;
  char6_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO p4_id FROM users WHERE email = 'test_player4@example.com';

  -- Get game IDs
  SELECT id INTO game2_id FROM games WHERE title = 'The Heist at Goldstone Bank';
  SELECT id INTO game4_id FROM games WHERE title = 'Court of Shadows';

  -- Get active action phase IDs
  SELECT id INTO phase2_id FROM game_phases WHERE game_id = game2_id AND phase_number = 2;
  SELECT id INTO phase4_id FROM game_phases WHERE game_id = game4_id AND phase_number = 2;

  -- Get character IDs for Game 2
  SELECT id INTO char1_id FROM characters WHERE game_id = game2_id AND name = 'Shade (Whisper)';
  SELECT id INTO char2_id FROM characters WHERE game_id = game2_id AND name = 'Rook (Hound)';
  SELECT id INTO char3_id FROM characters WHERE game_id = game2_id AND name = 'Vex (Leech)';
  SELECT id INTO char4_id FROM characters WHERE game_id = game2_id AND name = 'Silk (Spider)';

  -- ============================================
  -- GAME #2: Heist Actions
  -- ============================================

  -- Player 1's action (submitted)
  INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at, updated_at)
  VALUES (
    game2_id,
    p1_id,
    phase2_id,
    char1_id,
    E'Using my supernatural senses, I''ll scan the vault room for any lingering spirits or magical wards before the team enters. If I detect anything, I''ll attempt to commune with or dispel it using my Compel ability.\n\nI''ll position myself near the entrance as a lookout while maintaining focus on the ethereal plane. If guards approach, I''ll create a minor distraction using ghost sounds.',
    false,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
  );

  -- Player 2's action (submitted)
  INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at, updated_at)
  VALUES (
    game2_id,
    p2_id,
    phase2_id,
    char2_id,
    E'I''ll take up a sniper position on the rooftop across from the bank''s rear entrance. Using my spyglass and Sharpshooter ability, I''ll keep watch on all approaches and provide cover fire if needed.\n\nMy hunting rifle is loaded with tranquilizer darts as the first option, but I have live rounds ready if things go badly. I''ll signal the team via our pre-arranged mirror flashes if I spot any patrols.',
    false,
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours'
  );

  -- Player 3's action (submitted)
  INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at, updated_at)
  VALUES (
    game2_id,
    p3_id,
    phase2_id,
    char3_id,
    E'I''ll use my alchemical knowledge to create smoke bombs and a custom acid mixture that can dissolve the vault''s lock mechanism without triggering the alarm system.\n\nOnce inside, I''ll handle the mechanical aspects - disabling pressure plates, bypassing the combination lock using my precision tools, and neutralizing any gas traps. I''ve studied the bank''s blueprints extensively and know which ducts to avoid.',
    false,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
  );

  -- Player 4's action (draft)
  INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at, updated_at)
  VALUES (
    game2_id,
    p4_id,
    phase2_id,
    char4_id,
    E'Working on my approach... considering using my social connections or going with a disguise...',
    true,
    NULL,
    NOW() - INTERVAL '30 minutes'
  );

  -- ============================================
  -- GAME #4: Court of Shadows Actions
  -- ============================================

  -- Get character IDs for Game 4
  SELECT id INTO char5_id FROM characters WHERE game_id = game4_id AND name = 'Lord Ravenna';
  SELECT id INTO char6_id FROM characters WHERE game_id = game4_id AND name = 'Countess Nyx';

  -- Player 1's action (just submitted)
  INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at, updated_at)
  VALUES (
    game4_id,
    p1_id,
    phase4_id,
    char5_id,
    E'I will arrange a private meeting with Prince Valdric in his chambers. Using my Dominate discipline, I will carefully probe his mind for information about the Archbishop''s true plans while planting subtle suggestions that the Archbishop may be plotting against him.\n\nI must be careful not to push too hard - Valdric is old and powerful. I''ll use my social graces to make this seem like friendly counsel from a concerned elder.',
    false,
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes'
  );

  -- Player 2's action (just submitted)
  INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at, updated_at)
  VALUES (
    game4_id,
    p2_id,
    phase4_id,
    char6_id,
    E'While Lord Ravenna keeps the Prince occupied, I''ll use my Obfuscate powers to slip into the Archbishop''s private library undetected. I''m searching for any correspondence or documents that might reveal his connections to the city''s mortal authorities.\n\nI''ll photograph anything interesting with my concealed camera and be out before anyone notices. My haven is prepared to develop the photos immediately upon my return.',
    false,
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '20 minutes'
  );

END $$;

COMMIT;
