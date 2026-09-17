-- Create Recruiting Games

BEGIN;

-- Get GM user ID
DO $$
DECLARE
  gm_id INTEGER;
BEGIN
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';

  -- Game #7: Recruiting game
  INSERT INTO games (title, description, genre, gm_user_id, max_players, state, created_at, updated_at)
  VALUES (
    'The Mystery of Blackwood Manor',
    'A gothic horror mystery set in a Victorian mansion. Applications open!',
    'Call of Cthulhu 7e',
    gm_id,
    5,
    'recruitment',
    NOW() - INTERVAL '3 days',
    NOW()
  );

  -- Game #10: a second recruiting game, so listings and pagination have more
  -- than one row to work with. This was "Secret Campaign", an is_public=false
  -- game demonstrating per-game visibility; that column is gone (see the
  -- drop_games_is_public migration) and every game is browseable now.
  INSERT INTO games (title, description, genre, gm_user_id, max_players, state, created_at, updated_at)
  VALUES (
    'Tomb of the Sunken King',
    'A dungeon crawl for players who like traps more than talking.',
    'D&D 5e',
    gm_id,
    4,
    'recruitment',
    NOW() - INTERVAL '1 day',
    NOW()
  );
END $$;

COMMIT;
