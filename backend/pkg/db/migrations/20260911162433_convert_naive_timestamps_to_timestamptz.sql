-- +goose Up
-- Convert the last naive TIMESTAMP columns to TIMESTAMPTZ.
--
-- Two early migrations (20240814174818_CreateUser, 20251015165715_add_messages
-- _and_comments_system) omitted WITH TIME ZONE, leaving 8 columns as
-- `timestamp without time zone` against 111 that are timestamptz. The
-- inconsistency was invisible while sqlc read the hand-maintained schema.sql,
-- which described all of them as TIMESTAMPTZ -- pointing sqlc at the migrations
-- surfaced it as a type mismatch in pkg/db/services/messages.
--
-- The values are already UTC: the server runs TimeZone=UTC and these columns are
-- written by NOW()/CURRENT_TIMESTAMP or by the Go layer in UTC. `USING col AT
-- TIME ZONE 'UTC'` states that interpretation explicitly, so the conversion does
-- not depend on the session TimeZone at migration time and is lossless.

ALTER TABLE users
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN banned_at  TYPE TIMESTAMPTZ USING banned_at  AT TIME ZONE 'UTC';

ALTER TABLE messages
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN edited_at  TYPE TIMESTAMPTZ USING edited_at  AT TIME ZONE 'UTC',
    ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';

ALTER TABLE message_recipients
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN read_at    TYPE TIMESTAMPTZ USING read_at    AT TIME ZONE 'UTC';

ALTER TABLE message_reactions
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- +goose Down
-- Reverse the conversion, rendering each instant as its UTC wall clock so a
-- round trip is a no-op.

ALTER TABLE message_reactions
    ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC';

ALTER TABLE message_recipients
    ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN read_at    TYPE TIMESTAMP USING read_at    AT TIME ZONE 'UTC';

ALTER TABLE messages
    ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN edited_at  TYPE TIMESTAMP USING edited_at  AT TIME ZONE 'UTC',
    ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'UTC';

ALTER TABLE users
    ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN banned_at  TYPE TIMESTAMP USING banned_at  AT TIME ZONE 'UTC';
