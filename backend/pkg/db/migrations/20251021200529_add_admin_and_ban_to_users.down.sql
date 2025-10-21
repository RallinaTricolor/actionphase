-- Rollback admin and ban functionality from users table
DROP INDEX IF EXISTS idx_users_is_banned;
DROP INDEX IF EXISTS idx_users_is_admin;

ALTER TABLE users DROP COLUMN IF EXISTS banned_by_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS banned_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_banned;
ALTER TABLE users DROP COLUMN IF EXISTS is_admin;
