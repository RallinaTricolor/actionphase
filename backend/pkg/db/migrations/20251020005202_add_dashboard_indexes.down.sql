-- Remove dashboard indexes

DROP INDEX IF EXISTS idx_game_participants_user_id_status;
DROP INDEX IF EXISTS idx_games_state;
DROP INDEX IF EXISTS idx_game_phases_active_deadline;
DROP INDEX IF EXISTS idx_notifications_user_unread;
DROP INDEX IF EXISTS idx_messages_game_created;
DROP INDEX IF EXISTS idx_game_applications_game_status;
