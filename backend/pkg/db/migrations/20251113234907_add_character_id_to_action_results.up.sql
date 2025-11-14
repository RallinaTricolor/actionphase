-- Add character_id column to action_results table
-- This allows action results to be directly associated with a specific character
-- rather than relying on the action_submission_id foreign key

ALTER TABLE action_results
    ADD COLUMN character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_action_results_character_id ON action_results(character_id);

-- Backfill character_id from existing action_submissions
-- This sets character_id for all existing results that have an action_submission_id
UPDATE action_results ar
SET character_id = acts.character_id
FROM action_submissions acts
WHERE ar.action_submission_id = acts.id
  AND ar.character_id IS NULL
  AND acts.character_id IS NOT NULL;
