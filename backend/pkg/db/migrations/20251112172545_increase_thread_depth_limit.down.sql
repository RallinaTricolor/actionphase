-- Revert thread depth limit back to 10
-- NOTE: This will fail if there are any comments with thread_depth > 10

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS valid_thread_depth;

ALTER TABLE messages
ADD CONSTRAINT valid_thread_depth CHECK (thread_depth >= 0 AND thread_depth <= 10);
