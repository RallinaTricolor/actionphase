-- Add cleanup functions for user_common_room_reads table to keep it lean

-- Function to clean up read tracking for completed games
-- These are no longer needed since completed games don't have active discussions
CREATE OR REPLACE FUNCTION cleanup_completed_game_reads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_common_room_reads
  WHERE game_id IN (
    SELECT id FROM games WHERE state = 'completed'
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old read tracking for inactive users
-- Users who haven't logged in for 90+ days likely don't need read markers preserved
CREATE OR REPLACE FUNCTION cleanup_inactive_user_reads(days_inactive INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_common_room_reads
  WHERE user_id IN (
    SELECT id FROM users
    WHERE updated_at < NOW() - (days_inactive || ' days')::INTERVAL
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up very old read markers (older than 1 year)
-- Even for active games, markers older than a year are unlikely to be useful
CREATE OR REPLACE FUNCTION cleanup_old_read_markers(months_old INTEGER DEFAULT 12)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_common_room_reads
  WHERE last_read_at < NOW() - (months_old || ' months')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON FUNCTION cleanup_completed_game_reads() IS 'Deletes read tracking for completed games to keep table lean';
COMMENT ON FUNCTION cleanup_inactive_user_reads(INTEGER) IS 'Deletes read tracking for users who have not logged in for the specified number of days (default: 90)';
COMMENT ON FUNCTION cleanup_old_read_markers(INTEGER) IS 'Deletes read markers older than the specified number of months (default: 12)';
