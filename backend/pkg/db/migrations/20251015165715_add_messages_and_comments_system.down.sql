-- Drop triggers first
DROP TRIGGER IF EXISTS update_message_timestamp_trigger ON messages;
DROP TRIGGER IF EXISTS set_message_thread_depth ON messages;

-- Drop functions
DROP FUNCTION IF EXISTS update_message_timestamp();
DROP FUNCTION IF EXISTS update_message_thread_depth();

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS message_reactions;
DROP TABLE IF EXISTS message_recipients;
DROP TABLE IF EXISTS messages;

-- Drop custom types
DROP TYPE IF EXISTS message_type;
DROP TYPE IF EXISTS message_visibility;
