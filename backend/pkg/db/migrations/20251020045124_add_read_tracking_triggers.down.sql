-- Remove triggers for read tracking cleanup

-- Drop the triggers
DROP TRIGGER IF EXISTS cleanup_reads_on_game_complete ON games;
DROP TRIGGER IF EXISTS cleanup_reads_on_post_delete ON messages;

-- Drop the trigger functions
DROP FUNCTION IF EXISTS trigger_cleanup_reads_on_game_complete();
DROP FUNCTION IF EXISTS trigger_cleanup_reads_on_post_delete();
