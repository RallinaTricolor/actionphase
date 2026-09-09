-- +goose Up
-- Add avatar_url column to characters table
ALTER TABLE characters ADD COLUMN avatar_url TEXT NULL;

-- Add index for querying characters with avatars
CREATE INDEX idx_characters_avatar_url ON characters(avatar_url) WHERE avatar_url IS NOT NULL;

-- +goose Down
-- Remove index
DROP INDEX IF EXISTS idx_characters_avatar_url;

-- Remove avatar_url column from characters table
ALTER TABLE characters DROP COLUMN IF EXISTS avatar_url;
