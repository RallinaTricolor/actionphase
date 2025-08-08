-- Drop triggers first
DROP TRIGGER IF EXISTS update_action_results_updated_at ON action_results;
DROP TRIGGER IF EXISTS update_action_submissions_updated_at ON action_submissions;
DROP TRIGGER IF EXISTS update_game_phases_updated_at ON game_phases;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes (will be dropped automatically with tables, but explicit for clarity)
DROP INDEX IF EXISTS idx_phase_transitions_created_at;
DROP INDEX IF EXISTS idx_phase_transitions_game_id;
DROP INDEX IF EXISTS idx_action_results_submission_id;
DROP INDEX IF EXISTS idx_action_results_user_id;
DROP INDEX IF EXISTS idx_action_results_phase_id;
DROP INDEX IF EXISTS idx_action_submissions_unique_user_phase;
DROP INDEX IF EXISTS idx_action_submissions_game_phase;
DROP INDEX IF EXISTS idx_action_submissions_user_id;
DROP INDEX IF EXISTS idx_action_submissions_phase_id;
DROP INDEX IF EXISTS idx_game_phases_one_active_per_game;
DROP INDEX IF EXISTS idx_game_phases_phase_number;
DROP INDEX IF EXISTS idx_game_phases_active;
DROP INDEX IF EXISTS idx_game_phases_game_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS phase_transitions;
DROP TABLE IF EXISTS action_results;
DROP TABLE IF EXISTS action_submissions;
DROP TABLE IF EXISTS game_phases;
