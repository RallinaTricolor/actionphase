-- Remove mentioned_character_ids column from messages table

DROP INDEX IF EXISTS idx_messages_mentioned_characters;

ALTER TABLE messages
DROP COLUMN IF EXISTS mentioned_character_ids;
