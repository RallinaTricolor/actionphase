-- Make start_time nullable on game_phases.
-- start_time means "scheduled auto-activate at" — NULL = no scheduled activation.
-- Actual activation time is tracked in activated_at (added separately).
-- Phases with no scheduled start should not appear in the scheduler query.
ALTER TABLE game_phases ALTER COLUMN start_time DROP NOT NULL;

-- Clear start_time on inactive phases where it was set to creation time as a default
-- (no real scheduling intent). These are identifiable as: inactive, never activated,
-- and start_time is in the past.
UPDATE game_phases
SET start_time = NULL
WHERE is_active = false
  AND activated_at IS NULL
  AND start_time IS NOT NULL
  AND start_time <= NOW();
