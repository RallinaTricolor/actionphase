-- +goose Up
-- Fix content column types from JSONB to TEXT
-- The code treats content as plain text strings, not JSON

-- action_submissions.content: JSONB -> TEXT
ALTER TABLE action_submissions
ALTER COLUMN content TYPE TEXT USING content::text;

-- action_results.content: JSONB -> TEXT
ALTER TABLE action_results
ALTER COLUMN content TYPE TEXT USING content::text;

-- +goose Down
-- Revert content column types from TEXT back to JSONB

-- action_submissions.content: TEXT -> JSONB
ALTER TABLE action_submissions
ALTER COLUMN content TYPE JSONB USING content::jsonb;

-- action_results.content: TEXT -> JSONB
ALTER TABLE action_results
ALTER COLUMN content TYPE JSONB USING content::jsonb;
