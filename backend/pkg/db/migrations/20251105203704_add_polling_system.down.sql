-- Rollback Common Room Polling System

-- Drop indexes first
DROP INDEX IF EXISTS idx_options_poll;
DROP INDEX IF EXISTS idx_votes_user;
DROP INDEX IF EXISTS idx_votes_poll;
DROP INDEX IF EXISTS idx_polls_deadline;
DROP INDEX IF EXISTS idx_polls_game_phase;

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS poll_votes;
DROP TABLE IF EXISTS poll_options;
DROP TABLE IF EXISTS common_room_polls;
