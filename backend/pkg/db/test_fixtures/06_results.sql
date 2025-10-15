-- Create Action Results for Results Phases

BEGIN;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  game3_id INTEGER;
  phase3_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';

  -- Get game ID
  SELECT id INTO game3_id FROM games WHERE title = 'Starfall Station';

  -- Get active results phase ID
  SELECT id INTO phase3_id FROM game_phases WHERE game_id = game3_id AND phase_number = 3;

  -- ============================================
  -- GAME #3: Starfall Station Results
  -- ============================================

  -- Result for Player 1
  INSERT INTO action_results (game_id, user_id, phase_id, gm_user_id, content, is_published, sent_at)
  VALUES (
    game3_id,
    p1_id,
    phase3_id,
    gm_id,
    E'Commander Vasquez:\n\nAs you systematically search Deck C, your security scanner picks up an unusual energy signature behind the maintenance panel in Section C-7. When you pry it open, you find a makeshift laboratory filled with bizarre biological samples.\n\nThe samples are... moving. Pulsating with an otherworldly rhythm.\n\nYou notice a personal datapad partially dissolved by some kind of acid. Through the damage, you can make out the name "Dr. Morrison" - one of the scientists who went missing three weeks ago.\n\nYour radio crackles: "Commander, we''re picking up movement in the air ducts above your location."\n\nWhat do you do?',
    true,
    NOW() - INTERVAL '5 hours'
  );

  -- Result for Player 2
  INSERT INTO action_results (game_id, user_id, phase_id, gm_user_id, content, is_published, sent_at)
  VALUES (
    game3_id,
    p2_id,
    phase3_id,
    gm_id,
    E'Engineer Patel:\n\nYour analysis of the station''s power fluctuations reveals a disturbing pattern. The anomalous drains are coming from the Bio-Research Lab, but according to the station''s official schematics, that lab was decommissioned months ago.\n\nYou cross-reference with maintenance logs and find something odd: someone has been accessing the lab''s environmental controls, adjusting atmospheric composition to match... you pause as you read the analysis... an alien atmosphere.\n\nThe power requirements would be enormous. Whatever''s in that lab needs specific conditions to survive.\n\nYou receive an urgent message from Commander Vasquez about a discovery on Deck C. The timing can''t be a coincidence.',
    true,
    NOW() - INTERVAL '5 hours'
  );

  -- Result for Player 3
  INSERT INTO action_results (game_id, user_id, phase_id, gm_user_id, content, is_published, sent_at)
  VALUES (
    game3_id,
    p3_id,
    phase3_id,
    gm_id,
    E'Dr. Kim:\n\nYour medical examination of the crew members who reported "strange dreams" reveals elevated levels of an unknown compound in their bloodstream. The compound doesn''t match anything in the medical database.\n\nMore concerning: brain scans show unusual activity in the areas associated with memory and perception. It''s as if something is... writing new neural pathways.\n\nPatient Zero appears to be Dr. Morrison from the Biology Department. According to records, he was the first to report symptoms, two weeks before he vanished.\n\nYou''re interrupted by an emergency medical alert: three crew members in MedBay simultaneously began seizing. Their eyes are moving in perfect synchronization, tracking something invisible in the room.\n\nThey''re all whispering the same word: "Starfall."',
    true,
    NOW() - INTERVAL '5 hours'
  );

  -- Unpublished draft result (GM hasn't published yet)
  INSERT INTO action_results (game_id, user_id, phase_id, gm_user_id, content, is_published, sent_at)
  VALUES (
    game3_id,
    p1_id,
    phase3_id,
    gm_id,
    E'[DRAFT - Additional information about the entity''s origin - publish this later for dramatic effect]',
    false,
    NULL
  );

END $$;

COMMIT;
