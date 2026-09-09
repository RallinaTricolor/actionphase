-- +goose Up
-- Update notifications table for improved notification system
-- Table already exists, so we're adding new columns and renaming existing ones

-- Rename columns to match new schema
ALTER TABLE notifications RENAME COLUMN notification_type TO type;
ALTER TABLE notifications RENAME COLUMN related_entity_type TO related_type;
ALTER TABLE notifications RENAME COLUMN related_entity_id TO related_id;

-- Add new columns
ALTER TABLE notifications ADD COLUMN link_url VARCHAR(500) NULL;
ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ NULL;

-- Add new indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_game_id ON notifications(game_id) WHERE game_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created ON notifications(user_id, is_read, created_at DESC);

-- +goose Down
-- Revert notifications table changes
-- Remove added indexes
DROP INDEX IF EXISTS idx_notifications_user_unread_created;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_game_id;

-- Remove added columns
ALTER TABLE notifications DROP COLUMN IF EXISTS read_at;
ALTER TABLE notifications DROP COLUMN IF EXISTS link_url;

-- Rename columns back to original names
ALTER TABLE notifications RENAME COLUMN related_id TO related_entity_id;
ALTER TABLE notifications RENAME COLUMN related_type TO related_entity_type;
ALTER TABLE notifications RENAME COLUMN type TO notification_type;
