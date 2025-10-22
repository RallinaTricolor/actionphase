-- Drop indexes
DROP INDEX IF EXISTS idx_messages_edited_at;
DROP INDEX IF EXISTS idx_messages_deleted_at;

-- Drop foreign key constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_deleted_by;

-- Drop columns (in reverse order of creation)
ALTER TABLE messages DROP COLUMN IF EXISTS edit_count;
ALTER TABLE messages DROP COLUMN IF EXISTS edited_at;
ALTER TABLE messages DROP COLUMN IF EXISTS deleted_by_user_id;
ALTER TABLE messages DROP COLUMN IF EXISTS deleted_at;
