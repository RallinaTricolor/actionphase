-- Revert content column types from TEXT back to JSONB

-- action_submissions.content: TEXT -> JSONB
ALTER TABLE action_submissions
ALTER COLUMN content TYPE JSONB USING content::jsonb;

-- action_results.content: TEXT -> JSONB
ALTER TABLE action_results
ALTER COLUMN content TYPE JSONB USING content::jsonb;
