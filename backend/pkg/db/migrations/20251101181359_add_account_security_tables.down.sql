-- Drop registration_attempts table
DROP INDEX IF EXISTS idx_registration_attempts_email;
DROP INDEX IF EXISTS idx_registration_attempts_created_at;
DROP INDEX IF EXISTS idx_registration_attempts_ip_address;
DROP TABLE IF EXISTS registration_attempts;

-- Drop password_reset_tokens table
DROP INDEX IF EXISTS idx_password_reset_tokens_expires_at;
DROP INDEX IF EXISTS idx_password_reset_tokens_user_id;
DROP INDEX IF EXISTS idx_password_reset_tokens_token;
DROP TABLE IF EXISTS password_reset_tokens;

-- Drop email_verification_tokens table
DROP INDEX IF EXISTS idx_email_verification_tokens_expires_at;
DROP INDEX IF EXISTS idx_email_verification_tokens_user_id;
DROP INDEX IF EXISTS idx_email_verification_tokens_token;
DROP TABLE IF EXISTS email_verification_tokens;

-- Drop index from users table
DROP INDEX IF EXISTS idx_users_deleted_at;

-- Remove columns from users table
ALTER TABLE users
    DROP COLUMN IF EXISTS email_change_pending,
    DROP COLUMN IF EXISTS username_changed_at,
    DROP COLUMN IF EXISTS password_changed_at,
    DROP COLUMN IF EXISTS deletion_scheduled_for,
    DROP COLUMN IF EXISTS deleted_at,
    DROP COLUMN IF EXISTS email_verified;
