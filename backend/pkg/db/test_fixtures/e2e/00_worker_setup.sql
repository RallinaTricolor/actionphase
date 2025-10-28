-- Worker-Specific Fixture Setup
-- This file sets up helper functions for worker-specific E2E fixtures
-- Usage: psql -v worker_index=0 -f 00_worker_setup.sql

-- Calculate worker-specific values
-- Worker index is passed as :worker_index
-- If not provided, defaults to 0

\set worker_suffix ''
\if :{?worker_index}
  \if :worker_index = 0
    \set worker_suffix ''
    \set game_id_offset 0
  \else
    \set worker_suffix '_':worker_index
    \set game_id_offset :worker_index'0000'
  \endif
\else
  \set worker_index 0
  \set game_id_offset 0
\endif

-- Create temporary function to get worker-specific user IDs
CREATE OR REPLACE FUNCTION get_worker_user_id(base_username TEXT, worker_idx INTEGER)
RETURNS INTEGER AS $$
DECLARE
  username_to_find TEXT;
BEGIN
  IF worker_idx = 0 THEN
    username_to_find := base_username;
  ELSE
    username_to_find := base_username || '_' || worker_idx;
  END IF;

  RETURN (SELECT id FROM users WHERE username = username_to_find);
END;
$$ LANGUAGE plpgsql;

-- Create helper function to calculate game ID with offset
CREATE OR REPLACE FUNCTION worker_game_id(base_id INTEGER, worker_idx INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN base_id + (worker_idx * 10000);
END;
$$ LANGUAGE plpgsql;

-- Store worker info for debugging
DO $$
BEGIN
  RAISE NOTICE 'Worker Setup: worker_index=%, game_id_offset=%',
    COALESCE(current_setting('custom.worker_index', true), '0')::INTEGER,
    COALESCE(current_setting('custom.worker_index', true), '0')::INTEGER * 10000;
END $$;
