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
