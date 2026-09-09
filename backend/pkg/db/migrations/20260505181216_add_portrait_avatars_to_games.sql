-- +goose Up
ALTER TABLE games ADD COLUMN portrait_avatars BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE games DROP COLUMN portrait_avatars;
