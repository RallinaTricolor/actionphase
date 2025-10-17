-- Fix unique constraint to match ON CONFLICT clause in SubmitAction query
-- The query uses ON CONFLICT (game_id, user_id, phase_id)
-- But the index was only (phase_id, user_id)

-- Drop the old unique index
DROP INDEX IF EXISTS idx_action_submissions_unique_user_phase;

-- Create new unique constraint matching the ON CONFLICT clause
CREATE UNIQUE INDEX idx_action_submissions_unique_user_phase ON action_submissions(game_id, user_id, phase_id);
