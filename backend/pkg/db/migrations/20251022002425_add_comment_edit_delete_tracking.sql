-- +goose Up
-- Add columns for soft delete tracking
ALTER TABLE messages ADD COLUMN deleted_by_user_id INT DEFAULT NULL;

-- Add columns for edit tracking
ALTER TABLE messages ADD COLUMN edit_count INT DEFAULT 0 NOT NULL;

-- Add foreign key for deleted_by
ALTER TABLE messages
ADD CONSTRAINT fk_messages_deleted_by
FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for querying non-deleted comments (partial index for better performance)
CREATE INDEX idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NULL;

-- Add index for edited comments (partial index for better performance)
CREATE INDEX idx_messages_edited_at ON messages(edited_at) WHERE edited_at IS NOT NULL;

-- +goose Down
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
