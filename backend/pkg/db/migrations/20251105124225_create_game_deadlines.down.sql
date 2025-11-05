-- Drop indexes first
DROP INDEX IF EXISTS idx_game_deadlines_deadline;
DROP INDEX IF EXISTS idx_game_deadlines_game_active;

-- Drop table
DROP TABLE IF EXISTS game_deadlines;
