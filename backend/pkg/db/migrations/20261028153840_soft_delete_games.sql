-- +goose Up
-- Games are soft-deleted: a deleted game keeps every row (and its state), but
-- GetGame and every cross-game listing treat it as absent, so it 404s and
-- vanishes from lists. There is no restore endpoint by design; an operator
-- restores a game with:
--
--   UPDATE games SET deleted_at = NULL, deleted_by_user_id = NULL WHERE id = <id>;
ALTER TABLE games
    ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN deleted_by_user_id INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE games
    DROP COLUMN deleted_by_user_id,
    DROP COLUMN deleted_at;
