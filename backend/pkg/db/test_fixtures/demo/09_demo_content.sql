-- Demo Content Fixture
-- Rich sample content for manual testing, UI exploration, and screenshots
-- NOT used by E2E tests (they create their own dynamic content)

BEGIN;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;

  -- Game IDs
  game1_id INTEGER;  -- Shadows Over Innsmouth (active common room)
  game5_id INTEGER;  -- The Dragon of Mount Krag (active common room)

  -- Phase IDs
  game1_phase_id INTEGER;
  game5_phase_id INTEGER;

  -- Character IDs
  game1_p1_char_id INTEGER;
  game1_p2_char_id INTEGER;
  game1_p3_char_id INTEGER;
  game1_gm_char_id INTEGER;

  game5_p1_char_id INTEGER;
  game5_p2_char_id INTEGER;
  game5_p3_char_id INTEGER;
  game5_gm_char_id INTEGER;

  -- Message IDs for threading
  post1_id INTEGER;
  post2_id INTEGER;
  post3_id INTEGER;

BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';

  -- Get game IDs
  SELECT id INTO game1_id FROM games WHERE title = 'Shadows Over Innsmouth';
  SELECT id INTO game5_id FROM games WHERE title = 'The Dragon of Mount Krag';

  -- Get active phase IDs
  SELECT id INTO game1_phase_id FROM game_phases WHERE game_id = game1_id AND is_active = true LIMIT 1;
  SELECT id INTO game5_phase_id FROM game_phases WHERE game_id = game5_id AND is_active = true LIMIT 1;

  -- Get character IDs for Game 1
  SELECT id INTO game1_p1_char_id FROM characters WHERE game_id = game1_id AND user_id = p1_id LIMIT 1;
  SELECT id INTO game1_p2_char_id FROM characters WHERE game_id = game1_id AND user_id = p2_id LIMIT 1;
  SELECT id INTO game1_p3_char_id FROM characters WHERE game_id = game1_id AND user_id = p3_id LIMIT 1;
  SELECT id INTO game1_gm_char_id FROM characters WHERE game_id = game1_id AND character_type = 'npc' LIMIT 1;

  -- Get character IDs for Game 5
  SELECT id INTO game5_p1_char_id FROM characters WHERE game_id = game5_id AND user_id = p1_id LIMIT 1;
  SELECT id INTO game5_p2_char_id FROM characters WHERE game_id = game5_id AND user_id = p2_id LIMIT 1;
  SELECT id INTO game5_p3_char_id FROM characters WHERE game_id = game5_id AND user_id = p3_id LIMIT 1;
  SELECT id INTO game5_gm_char_id FROM characters WHERE game_id = game5_id AND character_type = 'npc' LIMIT 1;

  -- ============================================
  -- GAME #1: Shadows Over Innsmouth
  -- Active Common Room - Investigation Horror
  -- ============================================

  -- GM Welcome Post
  INSERT INTO messages (game_id, phase_id, author_id, character_id, content, message_type, created_at, edited_at)
  VALUES (
    game1_id,
    game1_phase_id,
    gm_id,
    game1_gm_char_id,
    E'Welcome to Innsmouth, investigators.\n\nThe fog is thick tonight, rolling in from the harbor like a living thing. The locals watch you from behind yellowed curtains, their eyes following your every move. You''ve checked into the Gilman House Hotel - the only lodging in town willing to take outsiders.\n\nYour mission: investigate the disappearance of Zadok Allen, a local historian who sent a cryptic telegram before vanishing. His last known location was the old Marsh refinery on the waterfront.\n\nWhat are your initial plans? How do you want to approach this investigation?',
    'post',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '4 hours'
  ) RETURNING id INTO post1_id;

  -- Player 1 Response (Detective Marcus Kane) with character mentions
  INSERT INTO messages (game_id, phase_id, author_id, character_id, parent_id, content, message_type, mentioned_character_ids, created_at, edited_at)
  VALUES (
    game1_id,
    game1_phase_id,
    p1_id,
    game1_p1_char_id,
    post1_id,
    E'I''ll start by talking to the hotel clerk. Sometimes the staff know more than they let on. I''ll casually ask about:\n\n- Zadok Allen and his last visit to town\n- The Marsh refinery and its current status\n- Any strange occurrences lately\n\nWhile I''m doing this, @Dr. Sarah Chen maybe you could check the local records at the town hall? @Father O''Brien, could you visit the church and see if the priest knows anything?',
    'comment',
    ARRAY[game1_p2_char_id, game1_p3_char_id],
    NOW() - INTERVAL '3 hours 45 minutes',
    NOW() - INTERVAL '3 hours 45 minutes'
  );

  -- Player 2 Response (Dr. Sarah Chen) with character mention
  INSERT INTO messages (game_id, phase_id, author_id, character_id, parent_id, content, message_type, mentioned_character_ids, created_at, edited_at)
  VALUES (
    game1_id,
    game1_phase_id,
    p2_id,
    game1_p2_char_id,
    post1_id,
    E'Good idea, @Detective Marcus Kane. I''ll head to the town hall first thing in the morning.\n\nI''m also concerned about the medical angle here. If people are disappearing, there might be health records, death certificates, or hospital admissions that could give us clues. I''ll see if I can access those.\n\nOne thing that''s bothering me - the telegram Zadok sent mentioned "deep ones" and "Dagon". Could be delirium, or could be a code. I''ll look for any historical references in the town records.',
    'comment',
    ARRAY[game1_p1_char_id],
    NOW() - INTERVAL '3 hours 30 minutes',
    NOW() - INTERVAL '3 hours 30 minutes'
  );

  -- Player 3 Response (Father O'Brien) - no mentions
  INSERT INTO messages (game_id, phase_id, author_id, character_id, parent_id, content, message_type, created_at, edited_at)
  VALUES (
    game1_id,
    game1_phase_id,
    p3_id,
    game1_p3_char_id,
    post1_id,
    E'I''ll visit the church, but I''m also going to walk the waterfront and observe the refinery from a distance. Get a feel for the place before we go in.\n\nI have a bad feeling about this town. The spiritual atmosphere is... oppressive. I''ll be carrying my Bible and holy water at all times.\n\nMeet back at the hotel for dinner to compare notes?',
    'comment',
    NOW() - INTERVAL '3 hours 15 minutes',
    NOW() - INTERVAL '3 hours 15 minutes'
  );

  -- GM Follow-up Post (Building Tension)
  INSERT INTO messages (game_id, phase_id, author_id, character_id, content, message_type, created_at, edited_at)
  VALUES (
    game1_id,
    game1_phase_id,
    gm_id,
    game1_gm_char_id,
    E'## Night Falls\n\nAs evening approaches, you each pursue your investigations.\n\n**Detective Kane** - The hotel clerk, a pale man named Barnabas Elton, seems nervous when you mention Zadok Allen. "He came through here about a week ago. Looked scared, kept muttering about fish-people. Drank too much, if you ask me." He won''t say more.\n\n**Dr. Chen** - The town hall closes early (4 PM), but you manage to glimpse some death records through the window. An unusual number of "drownings" in the past year. The bodies were never recovered.\n\n**Father O''Brien** - The refinery is abandoned but not empty. You see lights moving inside after dark. And there are footprints in the mud leading from the building to the water... but they''re not quite human. The webbing between the toes is unmistakable.\n\nYou all meet back at the hotel as planned. What do you discuss over dinner?',
    'post',
    NOW() - INTERVAL '2 hours 30 minutes',
    NOW() - INTERVAL '2 hours 30 minutes'
  ) RETURNING id INTO post2_id;

  -- Conversation continues on post2_id with character mention
  INSERT INTO messages (game_id, phase_id, author_id, character_id, parent_id, content, message_type, mentioned_character_ids, created_at, edited_at)
  VALUES (
    game1_id,
    game1_phase_id,
    p1_id,
    game1_p1_char_id,
    post2_id,
    E'Those footprints are the clincher. This isn''t just superstition or mass hysteria. There''s something genuinely abnormal happening here.\n\nWe need to investigate the refinery tonight while those lights are active. But we go in prepared - weapons, flashlights, and we stick together. No splitting up.\n\n@Dr. Sarah Chen, what''s your medical opinion on those drowning deaths? Could they be covering up something?',
    'comment',
    ARRAY[game1_p2_char_id],
    NOW() - INTERVAL '2 hours 15 minutes',
    NOW() - INTERVAL '2 hours 15 minutes'
  );

  -- ============================================
  -- GAME #5: The Dragon of Mount Krag
  -- Active Common Room - Epic Fantasy
  -- ============================================

  -- GM Scene Setting Post
  INSERT INTO messages (game_id, phase_id, author_id, character_id, content, message_type, created_at, edited_at)
  VALUES (
    game5_id,
    game5_phase_id,
    gm_id,
    game5_gm_char_id,
    E'## Final Preparations Before the Dragon\n\nYou''ve made it this far, heroes. Six phases of trials, ambushes, discoveries, and hard-won victories. Now you stand at the base of Mount Krag, staring up at the smoking peak where the red dragon Vermithrax makes its lair.\n\nYour supplies:\n- **3 healing potions** (restored after the last battle)\n- **Dragon-slaying sword** (from the ancient cache)\n- **Ring of Fire Resistance** (found on the cultist leader)\n- **Scroll of Protection from Fire** (1 use, party-wide)\n\nThe mountain path leads up through three distinct areas:\n1. **The Scorched Slopes** - Volcanic rock, steam vents, difficult terrain\n2. **The Dragon''s Hoard Cave** - Where Vermithrax keeps its treasure\n3. **The Summit Caldera** - The dragon''s lair itself\n\nYou have time for final preparations, strategy discussion, and any last-minute plans. What do you do?',
    'post',
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '6 hours'
  ) RETURNING id INTO post3_id;

  -- Player 1 discussion
  INSERT INTO messages (game_id, phase_id, author_id, character_id, parent_id, content, message_type, created_at, edited_at)
  VALUES (
    game5_id,
    game5_phase_id,
    p1_id,
    game5_p1_char_id,
    post3_id,
    E'We''ve come too far to rush this. Here''s what I''m thinking:\n\n**Equipment Distribution:**\n- I''ll carry the dragon-slaying sword (obviously)\n- Healer should keep 2 potions, give me 1\n- Ring of Fire Resistance goes to whoever''s taking point\n- Save the scroll for the actual dragon fight\n\n**Approach Strategy:**\n- Avoid the hoard cave if possible - dragons can sense disturbances to their treasure\n- Take the longer path around to avoid steam vents (don''t want to be weakened before the fight)\n- Strike at dawn when dragons are sluggish\n\nThoughts?',
    'comment',
    NOW() - INTERVAL '5 hours 45 minutes',
    NOW() - INTERVAL '5 hours 45 minutes'
  );

  -- Player 2 counterpoint
  INSERT INTO messages (game_id, phase_id, author_id, character_id, parent_id, content, message_type, created_at, edited_at)
  VALUES (
    game5_id,
    game5_phase_id,
    p2_id,
    game5_p2_char_id,
    post3_id,
    E'I can use my ranger skills to scout ahead and find the safest path. I''ve been studying dragons, and you''re right about the treasure sense - even a coin moved triggers their awareness.\n\nBut I disagree about avoiding the hoard. Hear me out:\n\nIf we can **steal something small** from the hoard before the fight, we can use it as a distraction. Throw it off the mountain mid-battle, dragon''s instinct will track its falling treasure. Gives us a critical opening.\n\nRisky? Yes. Worth it? I think so.',
    'comment',
    NOW() - INTERVAL '5 hours 30 minutes',
    NOW() - INTERVAL '5 hours 30 minutes'
  );

  -- Player 3 moral perspective
  INSERT INTO messages (game_id, phase_id, author_id, character_id, parent_id, content, message_type, created_at, edited_at)
  VALUES (
    game5_id,
    game5_phase_id,
    p3_id,
    game5_p3_char_id,
    post3_id,
    E'As the party cleric, I''m less concerned about combat strategy and more worried about our souls.\n\nThis dragon has terrorized the valley for generations. Hundreds of lives lost. If we fail here, more will die. But if we succeed through deception or trickery... does that honor the fallen?\n\nI vote we approach openly, announce our challenge, and fight with honor. The gods will favor the righteous.\n\n*Also, mechanically, I have Bless prepared which gives us +1d4 to attacks and saves. That''s better than any distraction trick.*',
    'comment',
    NOW() - INTERVAL '5 hours 15 minutes',
    NOW() - INTERVAL '5 hours 15 minutes'
  );

  RAISE NOTICE 'Created demo content: % posts/comments in 2 games',
    (SELECT COUNT(*) FROM messages WHERE message_type IN ('post', 'comment') AND game_id IN (game1_id, game5_id));

END $$;

COMMIT;
