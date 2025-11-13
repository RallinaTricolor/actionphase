-- Increase thread depth limit from 10 to 100 to support deeper comment nesting
-- This is safe because thread_depth is denormalized (calculated on insert via trigger)
-- and recursive queries don't have depth limits, so performance is unaffected

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS valid_thread_depth;

ALTER TABLE messages
ADD CONSTRAINT valid_thread_depth CHECK (thread_depth >= 0 AND thread_depth <= 100);
