-- Revert: make start_time NOT NULL again.
-- First set a value for any rows that are now NULL.
UPDATE game_phases SET start_time = created_at WHERE start_time IS NULL;
ALTER TABLE game_phases ALTER COLUMN start_time SET NOT NULL;
