-- Add indexes for dashboard query performance
-- Note: CONCURRENTLY removed to allow migration inside transaction

-- Index for finding user's games quickly via game_participants
CREATE INDEX IF NOT EXISTS idx_game_participants_user_id_status
ON game_participants(user_id, status)
WHERE status = 'active';

-- Index for finding games by state
CREATE INDEX IF NOT EXISTS idx_games_state
ON games(state)
WHERE is_public = true;

-- Index for finding active phases with deadlines
CREATE INDEX IF NOT EXISTS idx_game_phases_active_deadline
ON game_phases(game_id, is_active, deadline)
WHERE is_active = true AND deadline IS NOT NULL;

-- Index for finding unread notifications by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id, is_read, created_at)
WHERE is_read = false;

-- Index for finding recent messages in games
CREATE INDEX IF NOT EXISTS idx_messages_game_created
ON messages(game_id, created_at DESC)
WHERE is_deleted = false;

-- Index for finding pending game applications
CREATE INDEX IF NOT EXISTS idx_game_applications_game_status
ON game_applications(game_id, status)
WHERE status = 'pending';
