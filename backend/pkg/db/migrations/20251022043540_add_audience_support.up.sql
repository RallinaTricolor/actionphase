-- Add auto_accept_audience column to games table
ALTER TABLE games ADD COLUMN auto_accept_audience BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for filtering participants by role
CREATE INDEX IF NOT EXISTS idx_game_participants_role ON game_participants(game_id, role);

-- Create index for finding audience NPCs
-- Note: character_type values are 'player_character', 'npc_gm', 'npc_audience'
CREATE INDEX IF NOT EXISTS idx_characters_audience ON characters(game_id, character_type)
WHERE character_type = 'npc_audience';
