-- +goose Up
-- Let action-result drafts target GM-composed custom character sheet tabs.
--
-- Custom tab keys are generated client-side as `t_` plus six lower-case letters
-- or digits, and never change once created. The pattern here mirrors
-- core.IsSheetTabKey; keep the two in step or inserts fail at the database
-- instead of in the service, where the error is actionable.
--
-- Whether a particular game HAS a given tab is not something a constraint can
-- see (it lives in games.character_sheet), so the handler checks that. This only
-- keeps structurally impossible keys out, as the old list did.
ALTER TABLE action_result_character_updates DROP CONSTRAINT check_module_type;
ALTER TABLE action_result_character_updates ADD CONSTRAINT check_module_type
    CHECK (module_type IN ('skills', 'inventory', 'numbers') OR module_type ~ '^t_[a-z0-9]{6}$');

-- +goose Down
-- Restores the fixed list. If any draft targets a custom tab this fails rather
-- than deleting it: drafts are GM work in progress, and discarding them is a
-- decision for whoever is rolling back, not something to do quietly here.
ALTER TABLE action_result_character_updates DROP CONSTRAINT check_module_type;
ALTER TABLE action_result_character_updates ADD CONSTRAINT check_module_type
    CHECK (module_type IN ('skills', 'inventory', 'numbers'));
