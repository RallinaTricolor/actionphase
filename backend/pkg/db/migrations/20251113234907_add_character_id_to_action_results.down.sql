-- Rollback: Remove character_id column from action_results table

DROP INDEX IF EXISTS idx_action_results_character_id;

ALTER TABLE action_results
    DROP COLUMN IF EXISTS character_id;
