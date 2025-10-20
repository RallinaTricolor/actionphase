-- Drop cleanup functions for user_common_room_reads table

DROP FUNCTION IF EXISTS cleanup_completed_game_reads();
DROP FUNCTION IF EXISTS cleanup_inactive_user_reads(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_read_markers(INTEGER);
