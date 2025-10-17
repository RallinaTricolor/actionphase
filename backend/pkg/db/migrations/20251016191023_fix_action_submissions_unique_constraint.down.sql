-- Revert unique constraint back to original

-- Drop the new unique index
DROP INDEX IF EXISTS idx_action_submissions_unique_user_phase;

-- Recreate the old unique index
CREATE UNIQUE INDEX idx_action_submissions_unique_user_phase ON action_submissions(phase_id, user_id);
