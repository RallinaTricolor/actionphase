-- Add triggers for automatic cleanup of read tracking data

-- ============================================================================
-- TRIGGER 1: Auto-cleanup when game is marked as completed
-- ============================================================================

-- Trigger function that runs when a game's state changes to 'completed'
-- Automatically deletes all read markers for that game since they're no longer needed
CREATE OR REPLACE FUNCTION trigger_cleanup_reads_on_game_complete()
RETURNS TRIGGER AS $$
BEGIN
    -- Only cleanup if state changed TO 'completed' (not if already completed)
    IF NEW.state = 'completed' AND (OLD.state IS NULL OR OLD.state != 'completed') THEN
        DELETE FROM user_common_room_reads WHERE game_id = NEW.id;

        -- Log the cleanup for observability
        RAISE NOTICE 'Cleaned up read markers for completed game %', NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the games table
CREATE TRIGGER cleanup_reads_on_game_complete
AFTER UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION trigger_cleanup_reads_on_game_complete();

COMMENT ON FUNCTION trigger_cleanup_reads_on_game_complete() IS
'Automatically deletes read tracking data when a game is marked as completed';

-- ============================================================================
-- TRIGGER 2: Auto-cleanup when post is deleted
-- ============================================================================

-- Trigger function that runs when a post is deleted
-- Automatically deletes all read markers for that post
CREATE OR REPLACE FUNCTION trigger_cleanup_reads_on_post_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- When a post is marked as deleted, clean up its read markers
    IF NEW.is_deleted = TRUE AND (OLD.is_deleted IS NULL OR OLD.is_deleted = FALSE) THEN
        DELETE FROM user_common_room_reads WHERE post_id = NEW.id;

        RAISE NOTICE 'Cleaned up read markers for deleted post %', NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the messages table for posts
CREATE TRIGGER cleanup_reads_on_post_delete
AFTER UPDATE ON messages
FOR EACH ROW
WHEN (NEW.message_type = 'post')
EXECUTE FUNCTION trigger_cleanup_reads_on_post_delete();

COMMENT ON FUNCTION trigger_cleanup_reads_on_post_delete() IS
'Automatically deletes read tracking data when a post is marked as deleted';

-- ============================================================================
-- TRIGGER 3: Cascade cleanup when game is hard-deleted
-- ============================================================================
-- Note: This is already handled by the ON DELETE CASCADE foreign key constraint
-- on user_common_room_reads.game_id, but we document it here for completeness.
-- When a game is DELETE FROM games (not just marked completed), all read markers
-- are automatically removed by the database.

-- ============================================================================
-- Note on Manual Cleanup Functions
-- ============================================================================
-- The cleanup functions (cleanup_inactive_user_reads, cleanup_old_read_markers)
-- from the previous migration are still available for periodic maintenance:
--
-- - cleanup_inactive_user_reads(90): Remove markers for users inactive 90+ days
-- - cleanup_old_read_markers(12): Remove markers older than 12 months
--
-- These should be called periodically (e.g., weekly) via cron or application scheduler
-- to handle edge cases not covered by triggers (very old data, inactive users).
