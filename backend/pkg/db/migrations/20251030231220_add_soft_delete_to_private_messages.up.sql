-- Add soft delete columns to private_messages table
-- This allows users to delete their messages while preserving conversation structure

ALTER TABLE private_messages
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- Create index for efficient filtering of non-deleted messages
CREATE INDEX idx_private_messages_deleted ON private_messages(is_deleted, conversation_id);
