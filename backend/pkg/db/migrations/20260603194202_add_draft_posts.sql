-- +goose Up
ALTER TABLE messages ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_messages_is_draft ON messages(game_id, is_draft) WHERE is_draft = true;

-- +goose Down
DROP INDEX IF EXISTS idx_messages_is_draft;

ALTER TABLE messages DROP COLUMN IF EXISTS is_draft;
