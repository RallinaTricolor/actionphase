-- Remove 'results' phase type and add is_published flag to action phases
-- This migration implements the design change where "results" are not a separate phase,
-- but rather a consequence of publishing action phase results.

BEGIN;

-- Step 1: Add is_published column to game_phases (defaults to false)
ALTER TABLE game_phases
ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Update existing 'results' phases to be 'action' phases with is_published=true
UPDATE game_phases
SET phase_type = 'action',
    is_published = TRUE
WHERE phase_type = 'results';

-- Step 3: Drop the old CHECK constraint
ALTER TABLE game_phases
DROP CONSTRAINT IF EXISTS game_phases_phase_type_check;

-- Step 4: Add new CHECK constraint that only allows 'common_room' and 'action'
ALTER TABLE game_phases
ADD CONSTRAINT game_phases_phase_type_check
CHECK (phase_type IN ('common_room', 'action'));

-- Step 5: Add index for published phases (for performance when querying published action results)
CREATE INDEX idx_game_phases_published ON game_phases(game_id, is_published)
WHERE is_published = TRUE AND phase_type = 'action';

-- Step 6: Add comment to document the new field
COMMENT ON COLUMN game_phases.is_published IS 'For action phases: indicates whether GM has published results. For common_room phases: always false.';

COMMIT;
