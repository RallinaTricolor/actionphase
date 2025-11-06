-- Remove index
DROP INDEX IF EXISTS idx_users_avatar_url;

-- Remove avatar_url column from users table
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
