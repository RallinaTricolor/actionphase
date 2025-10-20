-- Add indexes for game listing filtering and sorting
-- Note: CONCURRENTLY removed for transaction compatibility in golang-migrate

-- Speed up filtering by state
CREATE INDEX IF NOT EXISTS idx_games_state
ON games(state)
WHERE is_public = true;

-- Speed up filtering by genre
CREATE INDEX IF NOT EXISTS idx_games_genre
ON games(genre)
WHERE is_public = true AND genre IS NOT NULL;

-- Speed up sorting by start_date
CREATE INDEX IF NOT EXISTS idx_games_start_date
ON games(start_date)
WHERE is_public = true AND start_date IS NOT NULL;

-- Speed up sorting by updated_at (recent activity)
CREATE INDEX IF NOT EXISTS idx_games_updated_at
ON games(updated_at DESC)
WHERE is_public = true;

-- Speed up finding user's games
CREATE INDEX IF NOT EXISTS idx_game_participants_user_game
ON game_participants(user_id, game_id);
