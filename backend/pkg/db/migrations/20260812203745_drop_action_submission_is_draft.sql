-- +goose Up
-- Drop action_submissions.is_draft.
--
-- Scaffolding for a player-side draft feature that was never built and is now
-- ruled out. The submission model has no draft state: players edit a submission
-- freely until the phase deadline, and whatever stands at the deadline is what
-- was submitted. Every write path passed an explicit FALSE, so no row in the
-- wild is a draft and this drop changes no observable behavior.
ALTER TABLE action_submissions DROP COLUMN is_draft;

-- +goose Down
-- Restore action_submissions.is_draft.
--
-- Deliberately DEFAULT FALSE, not the original DEFAULT TRUE. The old default
-- was a trap: every write passed an explicit false, so an insert that omitted
-- the column would silently create a draft that submission stats would then
-- count as unsubmitted. Rolling back should not reinstate that.
ALTER TABLE action_submissions ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT FALSE;
