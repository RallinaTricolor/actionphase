-- Seed data for development testing
-- This assumes we have at least one user (ID 1) from the existing auth system

-- Insert some test games
INSERT INTO games (title, description, gm_user_id, state, genre, max_players, is_public) VALUES
('The Enchanted Forest Campaign',
 'A mystical adventure through ancient woodlands filled with magic and mystery. Players will encounter various creatures and uncover the secrets of the forest that have been hidden for centuries.',
 1, 'recruitment', 'Fantasy', 6, true),

('Cyberpunk 2177: Neon Dreams',
 'In the sprawling megacity of Neo-Tokyo, corporate wars rage in the shadows while hackers and street samurai fight for survival in the digital underground.',
 1, 'setup', 'Cyberpunk', 4, true),

('The Lost Expedition',
 'Archaeological expedition to uncover ancient ruins in the Amazon rainforest. But something dark stirs in the jungle depths, and not all explorers may return.',
 1, 'character_creation', 'Horror', 5, false);

-- Insert some test characters for the games
INSERT INTO characters (game_id, user_id, name, character_type, status) VALUES
-- Player characters for game 1
(1, 1, 'Elara Moonwhisper', 'player_character', 'approved'),
-- NPCs for game 1
(1, NULL, 'The Forest Guardian', 'npc', 'active'),
(1, NULL, 'Whiskers the Talking Fox', 'npc', 'active'),

-- Player characters for game 2
(2, 1, 'Jack "NetRunner" Chen', 'player_character', 'pending'),
-- NPCs for game 2
(2, NULL, 'Corporate Security Chief', 'npc', 'active'),

-- Player characters for game 3
(3, 1, 'Dr. Sarah Mitchell', 'player_character', 'approved'),
-- NPCs for game 3
(3, NULL, 'The Guide', 'npc', 'active');

-- Add some character data (bio information)
INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, is_public) VALUES
-- Elara Moonwhisper's data
(1, 'bio', 'description', 'A mystical elf ranger with silver hair and emerald eyes. She has spent decades protecting the ancient forests and communicating with woodland creatures.', 'text', true),
(1, 'bio', 'background', 'Born in the heart of the Silverleaf Grove, Elara was chosen by the forest spirits to be their guardian. She carries an enchanted bow made from moonwood and can speak with animals.', 'text', true),
(1, 'abilities', 'archery', 'Master archer with enchanted moonwood bow', 'text', true),
(1, 'abilities', 'animal_speech', 'Can communicate with forest creatures', 'text', true),
(1, 'inventory', 'moonwood_bow', 'Enchanted bow that glows softly in moonlight', 'text', true),
(1, 'inventory', 'elven_cloak', 'Cloak that provides camouflage in forest environments', 'text', true),

-- Jack Chen's data
(4, 'bio', 'description', 'A skilled hacker with cybernetic implants, Jack navigates both the physical and digital worlds of Neo-Tokyo with equal expertise.', 'text', true),
(4, 'bio', 'background', 'Former corporate programmer turned freelance netrunner after discovering his company\s dark secrets. Now he fights against corporate oppression from the shadows.', 'text', true),
(4, 'abilities', 'hacking', 'Elite-level programming and system infiltration', 'text', true),
(4, 'abilities', 'cybernetics', 'Neural interface and enhanced reflexes', 'text', true),

-- Dr. Sarah Mitchell's data
(6, 'bio', 'description', 'A renowned archaeologist specializing in pre-Columbian civilizations, Dr. Mitchell has led expeditions across South America.', 'text', true),
(6, 'bio', 'background', 'PhD from Harvard, published researcher, and veteran of dozens of archaeological digs. She speaks fluent Spanish and Portuguese and has extensive jungle survival training.', 'text', true),
(6, 'abilities', 'archaeology', 'Expert in ancient civilizations and artifact identification', 'text', true),
(6, 'abilities', 'survival', 'Extensive jungle and wilderness survival training', 'text', true);

-- Add the user as a participant in the games
INSERT INTO game_participants (game_id, user_id, role) VALUES
(1, 1, 'player'),
(2, 1, 'player'),
(3, 1, 'player');
