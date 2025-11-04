-- Create Characters and NPCs

BEGIN;

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  p3_id INTEGER;
  p4_id INTEGER;
  audience_id INTEGER;
  audience1_id INTEGER;
  game1_id INTEGER;
  game2_id INTEGER;
  game3_id INTEGER;
  game5_id INTEGER;
  game6_id INTEGER;
  game9_id INTEGER;
  char1_id INTEGER;
  char2_id INTEGER;
  npc1_id INTEGER;
  npc2_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';
  SELECT id INTO p3_id FROM users WHERE email = 'test_player3@example.com';
  SELECT id INTO p4_id FROM users WHERE email = 'test_player4@example.com';
  SELECT id INTO audience_id FROM users WHERE email = 'test_audience@example.com';
  SELECT id INTO audience1_id FROM users WHERE email = 'test_audience1@example.com';

  -- Get game IDs
  SELECT id INTO game1_id FROM games WHERE title = 'Shadows Over Innsmouth';
  SELECT id INTO game2_id FROM games WHERE title = 'The Heist at Goldstone Bank';
  SELECT id INTO game3_id FROM games WHERE title = 'Starfall Station';
  SELECT id INTO game5_id FROM games WHERE title = 'The Dragon of Mount Krag';
  SELECT id INTO game6_id FROM games WHERE title = 'Chronicles of Westmarch';
  SELECT id INTO game9_id FROM games WHERE title = 'COMPLETED: Tales of the Arcane';

  -- ============================================
  -- GAME #1: Shadows Over Innsmouth
  -- ============================================

  -- Player Characters
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game1_id, p1_id, 'Detective Marcus Kane', 'player_character', 'approved', NOW() - INTERVAL '6 days', NOW()),
    (game1_id, p2_id, 'Dr. Sarah Chen', 'player_character', 'approved', NOW() - INTERVAL '6 days', NOW()),
    (game1_id, p3_id, 'Father O''Brien', 'player_character', 'approved', NOW() - INTERVAL '6 days', NOW());

  -- GM NPCs
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game1_id, gm_id, 'Captain Obed Marsh', 'npc', 'approved', NOW() - INTERVAL '5 days', NOW()),
    (game1_id, gm_id, 'The Fishmonger', 'npc', 'approved', NOW() - INTERVAL '5 days', NOW()),
    (game1_id, audience1_id, 'Local Informant', 'npc', 'approved', NOW() - INTERVAL '5 days', NOW());  -- Co-GM's NPC

  -- ============================================
  -- GAME #2: The Heist
  -- ============================================

  -- Player Characters
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game2_id, p1_id, 'Shade (Whisper)', 'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()) RETURNING id INTO char1_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game2_id, p2_id, 'Rook (Hound)', 'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()) RETURNING id INTO char2_id;

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game2_id, p3_id, 'Vex (Leech)', 'player_character', 'approved', NOW() - INTERVAL '9 days', NOW()),
    (game2_id, p4_id, 'Silk (Spider)', 'player_character', 'approved', NOW() - INTERVAL '9 days', NOW());

  -- GM NPCs only
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game2_id, gm_id, 'Inspector Dalton', 'npc', 'approved', NOW() - INTERVAL '8 days', NOW()),
    (game2_id, gm_id, 'Bones (Contact)', 'npc', 'approved', NOW() - INTERVAL '7 days', NOW()),
    (game2_id, gm_id, 'Whistle (Lookout)', 'npc', 'approved', NOW() - INTERVAL '7 days', NOW());

  -- Character data examples
  INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, is_public, created_at, updated_at)
  VALUES
    (char1_id, 'core', 'playbook', '"Whisper"', 'text', true, NOW(), NOW()),
    (char1_id, 'core', 'special_ability', '"Compel"', 'text', true, NOW(), NOW()),
    (char1_id, 'core', 'trauma', '["Haunted"]', 'text', false, NOW(), NOW()),
    (char2_id, 'core', 'playbook', '"Hound"', 'text', true, NOW(), NOW()),
    (char2_id, 'core', 'special_ability', '"Sharpshooter"', 'text', true, NOW(), NOW());

  -- ============================================
  -- GAME #3: Starfall Station
  -- ============================================

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game3_id, p1_id, 'Commander Vasquez', 'player_character', 'approved', NOW() - INTERVAL '13 days', NOW()),
    (game3_id, p2_id, 'Engineer Patel', 'player_character', 'approved', NOW() - INTERVAL '13 days', NOW()),
    (game3_id, p3_id, 'Dr. Kim', 'player_character', 'approved', NOW() - INTERVAL '13 days', NOW()),
    (game3_id, gm_id, 'The Alien Entity', 'npc', 'approved', NOW() - INTERVAL '12 days', NOW());

  -- ============================================
  -- GAME #5: Dragon of Mount Krag
  -- ============================================

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game5_id, p1_id, 'Thorin Ironforge', 'player_character', 'approved', NOW() - INTERVAL '44 days', NOW()),
    (game5_id, p2_id, 'Elara Moonshadow', 'player_character', 'approved', NOW() - INTERVAL '44 days', NOW()),
    (game5_id, p3_id, 'Grimm the Bold', 'player_character', 'approved', NOW() - INTERVAL '44 days', NOW()),
    (game5_id, gm_id, 'Vorathax the Ancient', 'npc', 'approved', NOW() - INTERVAL '40 days', NOW());

  -- ============================================
  -- GAME #6: Chronicles of Westmarch
  -- ============================================

  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game6_id, p1_id, 'Sir Aldric', 'player_character', 'approved', NOW() - INTERVAL '59 days', NOW()),
    (game6_id, p2_id, 'Zara the Mystic', 'player_character', 'approved', NOW() - INTERVAL '59 days', NOW()),
    (game6_id, p3_id, 'Finn Quickfingers', 'player_character', 'approved', NOW() - INTERVAL '58 days', NOW()),
    (game6_id, p4_id, 'Bronwyn Stormcaller', 'player_character', 'approved', NOW() - INTERVAL '55 days', NOW()),
    (game6_id, gm_id, 'The Dark Lord', 'npc', 'approved', NOW() - INTERVAL '50 days', NOW()),
    (game6_id, gm_id, 'Merchant Guild Master', 'npc', 'approved', NOW() - INTERVAL '50 days', NOW());

  -- ============================================
  -- GAME #9: COMPLETED - Tales of the Arcane
  -- ============================================

  -- Player Characters
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game9_id, p1_id, 'Lyra Nightwhisper', 'player_character', 'approved', NOW() - INTERVAL '90 days', NOW()),
    (game9_id, p2_id, 'Theron Brightblade', 'player_character', 'approved', NOW() - INTERVAL '90 days', NOW()),
    (game9_id, p3_id, 'Mira Stormweaver', 'player_character', 'approved', NOW() - INTERVAL '89 days', NOW());

  -- GM NPCs
  INSERT INTO characters (game_id, user_id, name, character_type, status, created_at, updated_at)
  VALUES
    (game9_id, gm_id, 'Archmagus Valdane', 'npc', 'approved', NOW() - INTERVAL '85 days', NOW()),
    (game9_id, gm_id, 'The Shadow Council', 'npc', 'approved', NOW() - INTERVAL '85 days', NOW());

END $$;

COMMIT;
