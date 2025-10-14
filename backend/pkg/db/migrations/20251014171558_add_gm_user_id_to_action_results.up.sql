-- Add gm_user_id column to track which GM created the result
ALTER TABLE action_results
ADD COLUMN gm_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE;

-- Add index for efficient GM queries
CREATE INDEX idx_action_results_gm_user_id ON action_results(gm_user_id);
