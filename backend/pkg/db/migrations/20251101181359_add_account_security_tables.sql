-- +goose Up
-- Add email verification fields to users table
ALTER TABLE users
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN deletion_scheduled_for TIMESTAMP WITH TIME ZONE,
    ADD COLUMN password_changed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN username_changed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN email_change_pending VARCHAR(255);

-- Add index for soft delete queries
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Create email_verification_tokens table
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- Create password_reset_tokens table
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Create registration_attempts table for bot prevention analytics
CREATE TABLE registration_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    username VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,  -- IPv6-compatible
    user_agent TEXT,
    captcha_passed BOOLEAN NOT NULL DEFAULT FALSE,
    honeypot_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_reason VARCHAR(100),  -- 'ip_limit', 'disposable_email', 'rate_limit', etc.
    successful BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registration_attempts_ip_address ON registration_attempts(ip_address);
CREATE INDEX idx_registration_attempts_created_at ON registration_attempts(created_at);
CREATE INDEX idx_registration_attempts_email ON registration_attempts(email);

-- +goose Down
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
