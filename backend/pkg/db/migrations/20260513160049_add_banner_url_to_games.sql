-- +goose Up
ALTER TABLE games ADD COLUMN banner_url TEXT;

-- +goose Down
ALTER TABLE games DROP COLUMN banner_url;
