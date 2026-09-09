-- +goose Up
ALTER TABLE games ADD COLUMN allow_group_conversations BOOLEAN NOT NULL DEFAULT true;

-- +goose Down
ALTER TABLE games DROP COLUMN allow_group_conversations;
