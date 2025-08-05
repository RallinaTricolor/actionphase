-- Drop indexes
DROP INDEX IF EXISTS idx_notifications_unread;
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_private_messages_conversation_id;
DROP INDEX IF EXISTS idx_conversation_participants_user_id;
DROP INDEX IF EXISTS idx_conversation_participants_conversation_id;
DROP INDEX IF EXISTS idx_conversations_game_id;
DROP INDEX IF EXISTS idx_thread_posts_parent;
DROP INDEX IF EXISTS idx_thread_posts_thread_id;
DROP INDEX IF EXISTS idx_threads_game_id;
DROP INDEX IF EXISTS idx_action_results_user_id;
DROP INDEX IF EXISTS idx_action_results_game_id;
DROP INDEX IF EXISTS idx_action_submissions_phase_id;
DROP INDEX IF EXISTS idx_action_submissions_user_id;
DROP INDEX IF EXISTS idx_action_submissions_game_id;
DROP INDEX IF EXISTS idx_game_phases_active;
DROP INDEX IF EXISTS idx_game_phases_game_id;
DROP INDEX IF EXISTS idx_character_data_module;
DROP INDEX IF EXISTS idx_character_data_character_id;
DROP INDEX IF EXISTS idx_characters_type;
DROP INDEX IF EXISTS idx_characters_user_id;
DROP INDEX IF EXISTS idx_characters_game_id;
DROP INDEX IF EXISTS idx_game_participants_user_id;
DROP INDEX IF EXISTS idx_game_participants_game_id;
DROP INDEX IF EXISTS idx_games_is_public;
DROP INDEX IF EXISTS idx_games_state;
DROP INDEX IF EXISTS idx_games_gm_user_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS private_messages;
DROP TABLE IF EXISTS conversation_participants;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS thread_posts;
DROP TABLE IF EXISTS threads;
DROP TABLE IF EXISTS action_results;
DROP TABLE IF EXISTS action_submissions;
DROP TABLE IF EXISTS game_phases;
DROP TABLE IF EXISTS npc_assignments;
DROP TABLE IF EXISTS character_data;
DROP TABLE IF EXISTS characters;
DROP TABLE IF EXISTS game_participants;
DROP TABLE IF EXISTS games;

-- Remove added columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS high_contrast;
ALTER TABLE users DROP COLUMN IF EXISTS email_notifications;
ALTER TABLE users DROP COLUMN IF EXISTS timezone;
ALTER TABLE users DROP COLUMN IF EXISTS bio;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
ALTER TABLE users DROP COLUMN IF EXISTS is_admin;
