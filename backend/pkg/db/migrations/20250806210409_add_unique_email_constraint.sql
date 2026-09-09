-- +goose Up
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
CREATE INDEX users_email_index ON users (email);

-- +goose Down
DROP INDEX IF EXISTS users_email_index;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
