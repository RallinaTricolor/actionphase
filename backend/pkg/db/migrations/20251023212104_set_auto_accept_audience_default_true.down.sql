-- Revert default value for auto_accept_audience back to false

ALTER TABLE games
ALTER COLUMN auto_accept_audience SET DEFAULT false;

-- Note: We do NOT revert existing games back to false, as they may have been
-- explicitly set to true by GMs. Only the default for new games is reverted.
