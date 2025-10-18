-- Remove index
DROP INDEX IF EXISTS idx_characters_avatar_url;

-- Remove avatar_url column from characters table
ALTER TABLE characters DROP COLUMN IF EXISTS avatar_url;
