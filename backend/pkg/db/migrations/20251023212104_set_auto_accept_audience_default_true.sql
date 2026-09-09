-- +goose Up
-- Set default value for auto_accept_audience to true for new games
-- This allows audience members to join immediately without GM approval by default

ALTER TABLE games
ALTER COLUMN auto_accept_audience SET DEFAULT true;

-- Update existing games to enable auto-accept (optional but recommended for better UX)
-- Games that explicitly disabled this feature will keep their setting
UPDATE games
SET auto_accept_audience = true
WHERE auto_accept_audience = false;

-- +goose Down
-- Revert default value for auto_accept_audience back to false

ALTER TABLE games
ALTER COLUMN auto_accept_audience SET DEFAULT false;

-- Note: We do NOT revert existing games back to false, as they may have been
-- explicitly set to true by GMs. Only the default for new games is reverted.
