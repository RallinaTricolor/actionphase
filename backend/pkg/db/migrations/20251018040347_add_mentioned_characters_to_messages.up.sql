-- Add mentioned_character_ids array to track character mentions in messages
-- This enables @CharacterName tagging and character mention notifications

ALTER TABLE messages
ADD COLUMN mentioned_character_ids INTEGER[] DEFAULT '{}' NOT NULL;

-- Index for efficient queries to find mentions of a specific character
CREATE INDEX idx_messages_mentioned_characters ON messages
USING GIN (mentioned_character_ids);

-- Comment explaining the column
COMMENT ON COLUMN messages.mentioned_character_ids IS 'Array of character IDs mentioned in this message using @CharacterName syntax';
