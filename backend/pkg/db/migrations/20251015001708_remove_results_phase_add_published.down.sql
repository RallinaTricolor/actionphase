-- Rollback: Restore 'results' phase type and remove is_published flag

BEGIN;

-- Step 1: Drop the index we created
DROP INDEX IF EXISTS idx_game_phases_published;

-- Step 2: Drop the new CHECK constraint
ALTER TABLE game_phases
DROP CONSTRAINT IF EXISTS game_phases_phase_type_check;

-- Step 3: Add back the old CHECK constraint with 'results'
ALTER TABLE game_phases
ADD CONSTRAINT game_phases_phase_type_check
CHECK (phase_type IN ('common_room', 'action', 'results'));

-- Step 4: Convert published action phases back to 'results' phases
UPDATE game_phases
SET phase_type = 'results'
WHERE phase_type = 'action' AND is_published = TRUE;

-- Step 5: Drop the is_published column
ALTER TABLE game_phases
DROP COLUMN is_published;

COMMIT;
