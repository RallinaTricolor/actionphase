-- Create Recruiting Games

BEGIN;

-- Get GM user ID
DO $$
DECLARE
  gm_id INTEGER;
BEGIN
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';

  -- Game #7: Recruiting game
  INSERT INTO games (title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    'The Mystery of Blackwood Manor',
    'A gothic horror mystery set in a Victorian mansion. Applications open!',
    'Call of Cthulhu 7e',
    gm_id,
    5,
    'recruitment',
    true,
    NOW() - INTERVAL '3 days',
    NOW()
  );

  -- Game #10: Recruiting with private visibility
  INSERT INTO games (title, description, genre, gm_user_id, max_players, state, is_public, created_at, updated_at)
  VALUES (
    'Secret Campaign',
    'A private game for invited players only.',
    'D&D 5e',
    gm_id,
    4,
    'recruitment',
    false,
    NOW() - INTERVAL '1 day',
    NOW()
  );
END $$;

COMMIT;
