-- Drop indexes
DROP INDEX IF EXISTS idx_characters_audience;
DROP INDEX IF EXISTS idx_game_participants_role;

-- Remove auto_accept_audience column from games table
ALTER TABLE games DROP COLUMN IF EXISTS auto_accept_audience;
