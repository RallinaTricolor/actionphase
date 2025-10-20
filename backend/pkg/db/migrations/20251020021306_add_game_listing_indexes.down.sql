-- Remove indexes for game listing filtering and sorting

DROP INDEX IF EXISTS idx_game_participants_user_game;
DROP INDEX IF EXISTS idx_games_updated_at;
DROP INDEX IF EXISTS idx_games_start_date;
DROP INDEX IF EXISTS idx_games_genre;
DROP INDEX IF EXISTS idx_games_state;
