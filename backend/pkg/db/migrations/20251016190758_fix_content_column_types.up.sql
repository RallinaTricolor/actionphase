-- Fix content column types from JSONB to TEXT
-- The code treats content as plain text strings, not JSON

-- action_submissions.content: JSONB -> TEXT
ALTER TABLE action_submissions
ALTER COLUMN content TYPE TEXT USING content::text;

-- action_results.content: JSONB -> TEXT
ALTER TABLE action_results
ALTER COLUMN content TYPE TEXT USING content::text;
