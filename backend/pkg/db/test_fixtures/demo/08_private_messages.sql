-- Create Private Messages for Demo Games

BEGIN;

DO $$
DECLARE
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  gm_id INTEGER;
  game9_id INTEGER;
  game9_char1_id INTEGER;
  game9_char2_id INTEGER;
  game9_char3_id INTEGER;

  -- Conversation IDs
  conv_lyra_theron_id INTEGER;
  conv_mira_theron_id INTEGER;
  conv_all_three_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';

  -- Get game ID
  SELECT id INTO game9_id FROM games WHERE title = 'COMPLETED: Tales of the Arcane';

  -- Get character IDs for Game 9
  SELECT id INTO game9_char1_id FROM characters WHERE game_id = game9_id AND name = 'Lyra Nightwhisper';
  SELECT id INTO game9_char2_id FROM characters WHERE game_id = game9_id AND name = 'Theron Brightblade';
  SELECT id INTO game9_char3_id FROM characters WHERE game_id = game9_id AND name = 'Mira Stormweaver';

  -- ============================================
  -- GAME #9: COMPLETED - Tales of the Arcane
  -- Private Messages Between Characters
  -- ============================================

  -- ====================
  -- Conversation 1: Lyra ↔ Theron (Direct)
  -- ====================

  INSERT INTO conversations (game_id, conversation_type, title, created_by_user_id, created_at, updated_at)
  VALUES (
    game9_id,
    'direct',
    'Lyra Nightwhisper & Theron Brightblade',
    p1_id,
    NOW() - INTERVAL '75 days',
    NOW() - INTERVAL '61 days'
  )
  RETURNING id INTO conv_lyra_theron_id;

  -- Add participants
  INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
  VALUES
    (conv_lyra_theron_id, p1_id, game9_char1_id, NOW() - INTERVAL '75 days'),
    (conv_lyra_theron_id, p2_id, game9_char2_id, NOW() - INTERVAL '75 days');

  -- Message 1: Lyra → Theron
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_lyra_theron_id,
    p1_id,
    game9_char1_id,
    E'Theron, I need to speak with you privately about what I discovered in the shadows. There''s something the others shouldn''t know yet.\n\nI sensed another presence in the fortress - someone or something that''s been watching us. It felt... familiar. Almost like it knew me.\n\nWe need to be careful. Not everything is as Valdane made it seem.',
    NOW() - INTERVAL '75 days'
  );

  -- Message 2: Theron → Lyra
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_lyra_theron_id,
    p2_id,
    game9_char2_id,
    E'I trust your instincts, Lyra. Your connection to the shadows has never led us astray.\n\nBut this troubles me. If there''s another player in this game, we need to know their intentions. Friend or foe?\n\nShould we tell Mira? She might be able to detect magical signatures we''re missing.',
    NOW() - INTERVAL '74 days'
  );

  -- Message 3: Lyra → Theron
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_lyra_theron_id,
    p1_id,
    game9_char1_id,
    E'Not yet. Let me investigate further first. If I''m right about what this is, Mira''s storm magic might actually alert it to our suspicions.\n\nGive me until after the next phase. I''ll shadow-walk the perimeter tonight and see what I can find.\n\nTrust me on this one, old friend.',
    NOW() - INTERVAL '74 days'
  );

  -- ====================
  -- Conversation 2: Mira ↔ Theron (Direct)
  -- ====================

  INSERT INTO conversations (game_id, conversation_type, title, created_by_user_id, created_at, updated_at)
  VALUES (
    game9_id,
    'direct',
    'Mira Stormweaver & Theron Brightblade',
    p3_id,
    NOW() - INTERVAL '73 days',
    NOW() - INTERVAL '72 days'
  )
  RETURNING id INTO conv_mira_theron_id;

  -- Add participants
  INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
  VALUES
    (conv_mira_theron_id, p3_id, game9_char3_id, NOW() - INTERVAL '73 days'),
    (conv_mira_theron_id, p2_id, game9_char2_id, NOW() - INTERVAL '73 days');

  -- Message 1: Mira → Theron
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_mira_theron_id,
    p3_id,
    game9_char3_id,
    E'Theron, have you noticed Lyra acting strangely? She''s been disappearing for hours at a time, and when I try to scry her location, my magic just... slides off.\n\nI''m worried. The shadows have been whispering to her more than usual. What if Valdane''s corruption is affecting her?\n\nI need to know if you''ve seen anything suspicious.',
    NOW() - INTERVAL '73 days'
  );

  -- Message 2: Theron → Mira
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_mira_theron_id,
    p2_id,
    game9_char2_id,
    E'Mira, I understand your concern, but I trust Lyra completely. She''s investigating something she sensed in the fortress - another presence watching us.\n\nShe asked me not to tell you yet because she fears your storm magic might alert it. Give her time to investigate.\n\nIf she''s in danger, Dawnbreaker will know. The sword has not warned me of any corruption in her soul.',
    NOW() - INTERVAL '72 days'
  );

  -- Message 3: Mira → Theron
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_mira_theron_id,
    p3_id,
    game9_char3_id,
    E'I hope you''re right. I''ve known Lyra since we were apprentices, and I''ve never seen her like this.\n\nBut if you trust her, I''ll wait. Just... keep your sword ready. Something about this whole situation feels wrong.\n\nThe ley lines are disturbed in ways I''ve never seen before. Valdane''s ritual is only part of it.',
    NOW() - INTERVAL '72 days'
  );

  -- ====================
  -- Conversation 3: All Three (Group)
  -- ====================

  INSERT INTO conversations (game_id, conversation_type, title, created_by_user_id, created_at, updated_at)
  VALUES (
    game9_id,
    'group',
    'Final Assault Planning',
    p2_id,
    NOW() - INTERVAL '65 days',
    NOW() - INTERVAL '56 days'
  )
  RETURNING id INTO conv_all_three_id;

  -- Add participants
  INSERT INTO conversation_participants (conversation_id, user_id, character_id, joined_at)
  VALUES
    (conv_all_three_id, p1_id, game9_char1_id, NOW() - INTERVAL '65 days'),
    (conv_all_three_id, p2_id, game9_char2_id, NOW() - INTERVAL '65 days'),
    (conv_all_three_id, p3_id, game9_char3_id, NOW() - INTERVAL '65 days');

  -- Message 1: Theron → Group
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_all_three_id,
    p2_id,
    game9_char2_id,
    E'Everyone, we need to coordinate for the final assault. Here''s what I propose:\n\n**Phase 1:** Lyra infiltrates and steals the Codex\n**Phase 2:** I engage Valdane directly to keep him occupied\n**Phase 3:** Mira reverses the ritual seals from the focal points\n\nThe timing has to be perfect. Lyra, once you have the Codex, that''s our signal. Any questions?',
    NOW() - INTERVAL '65 days'
  );

  -- Message 2: Lyra → Group
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_all_three_id,
    p1_id,
    game9_char1_id,
    E'Solid plan, Theron. I can get the Codex, no problem. The shadows will hide me.\n\nOne addition though: if I can free the shadow entities he''s bound, they might turn on him. That would give you both more time to work.\n\nWhat do you think, Mira? Can you handle the reversal if I''m also managing the freed entities?',
    NOW() - INTERVAL '64 days'
  );

  -- Message 3: Mira → Group
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_all_three_id,
    p3_id,
    game9_char3_id,
    E'If you can turn his own weapons against him, that would be perfect. I''ll need about 15 minutes to reverse each seal - with friendly shadow entities helping, that becomes much more manageable.\n\nJust be careful, Lyra. Those entities have been enslaved for decades. They might not distinguish friend from foe at first.\n\nTheron, keep your healing potions ready. This is going to get messy.',
    NOW() - INTERVAL '64 days'
  );

  -- Message 4: Lyra → Group (Post-victory)
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_all_three_id,
    p1_id,
    game9_char1_id,
    E'We did it! I can''t believe we actually did it!\n\nTheron, that final strike was incredible. Mira, the way you called down that storm - I''ve never seen anything like it.\n\nWe make a good team. The best team. 🌙⚔️⚡',
    NOW() - INTERVAL '57 days'
  );

  -- Message 5: Theron → Group (Post-victory)
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_all_three_id,
    p2_id,
    game9_char2_id,
    E'We couldn''t have done it without each other. Every one of us was essential.\n\nLyra, your trust in the shadow entities was inspired. Mira, your magical prowess saved us all.\n\nTo the greatest companions a paladin could ask for. May Dawnbreaker''s light guide us in whatever comes next. ⚔️',
    NOW() - INTERVAL '56 days'
  );

  -- Message 6: Mira → Group (Post-victory, hint at sequel)
  INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content, created_at)
  VALUES (
    conv_all_three_id,
    p3_id,
    game9_char3_id,
    E'About what Valdane said at the end though... "The Council is more than one mage..."\n\nI think our work isn''t done. The Shadow Council still exists. Valdane was just one member.\n\nBut that''s a problem for another day. Tonight, we celebrate. Tomorrow, we rest. And when the next threat arises... we''ll face it together. 🌩️',
    NOW() - INTERVAL '56 days'
  );

END $$;

COMMIT;
