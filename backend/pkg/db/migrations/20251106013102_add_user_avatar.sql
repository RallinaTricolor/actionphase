-- +goose Up
-- Add avatar_url column to users table
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);

-- Create index for avatar lookups
CREATE INDEX idx_users_avatar_url ON users(avatar_url) WHERE avatar_url IS NOT NULL;

-- +goose Down
-- Remove index
DROP INDEX IF EXISTS idx_users_avatar_url;

-- Remove avatar_url column from users table
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
