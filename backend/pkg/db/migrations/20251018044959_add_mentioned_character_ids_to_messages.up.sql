-- Add mentioned_character_ids column to messages table
-- This stores character IDs for @ mentions in comments and posts
-- Used for triggering notifications when characters are mentioned

ALTER TABLE messages
ADD COLUMN mentioned_character_ids INTEGER[] DEFAULT '{}';

-- Add index for efficient queries of "where was character X mentioned?"
CREATE INDEX idx_messages_mentioned_characters
ON messages USING GIN (mentioned_character_ids);

-- Add comment explaining the column
COMMENT ON COLUMN messages.mentioned_character_ids IS 'Array of character IDs mentioned in this message using @CharacterName syntax. Used for notifications.';
