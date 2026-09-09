-- +goose Up
ALTER TABLE game_participants
    ADD COLUMN is_former_player BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE game_participants
    DROP COLUMN IF EXISTS is_former_player;
