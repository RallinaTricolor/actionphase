ALTER TABLE private_messages
DROP COLUMN IF EXISTS is_edited,
DROP COLUMN IF EXISTS edited_at,
DROP COLUMN IF EXISTS edit_count;
