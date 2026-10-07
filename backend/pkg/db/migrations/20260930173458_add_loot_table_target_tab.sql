-- +goose Up
-- Each loot table names the character sheet tab it rolls into, instead of every
-- table writing to Inventory. The default backfills existing tables to
-- 'inventory', which is exactly what they did before, so no data moves.
--
-- The pattern mirrors core.IsSheetTabKey (and check_module_type on
-- action_result_character_updates); keep them in step. Whether the game still
-- HAS the tab lives in games.character_sheet, which a constraint can't see, so
-- the handler checks that.
ALTER TABLE game_loot_tables
    ADD COLUMN target_tab VARCHAR(16) NOT NULL DEFAULT 'inventory'
    CONSTRAINT check_loot_table_target_tab
    CHECK (target_tab IN ('skills', 'inventory', 'numbers') OR target_tab ~ '^t_[a-z0-9]{6}$');

-- +goose Down
-- Tables targeting another tab go back to rolling into Inventory; their contents
-- are unchanged.
ALTER TABLE game_loot_tables DROP COLUMN IF EXISTS target_tab;
