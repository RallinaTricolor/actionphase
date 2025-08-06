-- Drop indexes first
DROP INDEX IF EXISTS idx_game_applications_pending;
DROP INDEX IF EXISTS idx_game_applications_status;
DROP INDEX IF EXISTS idx_game_applications_user_id;
DROP INDEX IF EXISTS idx_game_applications_game_id;

-- Drop the game_applications table
DROP TABLE IF EXISTS game_applications;
