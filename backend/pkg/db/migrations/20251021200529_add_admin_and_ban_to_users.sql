-- +goose Up
-- Add admin and ban functionality to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by_user_id INTEGER REFERENCES users(id);

-- Create indexes for faster lookups (drop first if exists)
DROP INDEX IF EXISTS idx_users_is_admin;
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;

DROP INDEX IF EXISTS idx_users_is_banned;
CREATE INDEX idx_users_is_banned ON users(is_banned) WHERE is_banned = TRUE;

-- Note: Initial admin users should be set manually via SQL:
-- UPDATE users SET is_admin = TRUE WHERE email = 'admin@example.com';

-- +goose Down
-- Rollback admin and ban functionality from users table
DROP INDEX IF EXISTS idx_users_is_banned;
DROP INDEX IF EXISTS idx_users_is_admin;

ALTER TABLE users DROP COLUMN IF EXISTS banned_by_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS banned_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_banned;
ALTER TABLE users DROP COLUMN IF EXISTS is_admin;
