-- +goose Up
-- Marks a draft sheet update the results board generated from reward lines.
-- The board replaces its own drafts freely, since they're derived from the
-- lines, but asks before replacing one a GM wrote by hand in the results
-- list. Every write from the results list stores false, so editing a
-- generated draft there makes it hand-made.
ALTER TABLE action_result_character_updates
    ADD COLUMN from_rewards BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE action_result_character_updates
    DROP COLUMN from_rewards;
