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
