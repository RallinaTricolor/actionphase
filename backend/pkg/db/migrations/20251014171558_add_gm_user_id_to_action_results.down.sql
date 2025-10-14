-- Remove gm_user_id index and column
DROP INDEX IF EXISTS idx_action_results_gm_user_id;
ALTER TABLE action_results DROP COLUMN gm_user_id;
