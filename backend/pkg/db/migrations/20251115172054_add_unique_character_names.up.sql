-- Add unique constraint to ensure character names are unique within each game
-- This prevents duplicate character names in the same game, which improves
-- @mention functionality and reduces confusion.

ALTER TABLE characters
ADD CONSTRAINT characters_game_name_unique UNIQUE (game_id, name);
