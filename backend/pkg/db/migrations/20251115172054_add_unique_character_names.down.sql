-- Remove unique constraint on character names
ALTER TABLE characters
DROP CONSTRAINT characters_game_name_unique;
