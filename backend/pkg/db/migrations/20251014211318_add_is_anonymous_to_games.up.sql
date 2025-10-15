-- Add is_anonymous field to games table
ALTER TABLE games ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN games.is_anonymous IS 'When true, character ownership and NPC status are hidden from players';
