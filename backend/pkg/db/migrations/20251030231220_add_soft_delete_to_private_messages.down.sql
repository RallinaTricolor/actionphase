-- Rollback soft delete columns from private_messages table

DROP INDEX IF EXISTS idx_private_messages_deleted;

ALTER TABLE private_messages
DROP COLUMN IF EXISTS deleted_at,
DROP COLUMN IF EXISTS is_deleted;
