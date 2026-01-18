-- Performance test fixture: Generate 500 comments for typing lag testing
-- Game: Shadows Over Innsmouth (ID: 2869)
-- Creates 500 comments on a single post to test performance

DO $$
DECLARE
  gm_id INTEGER;
  p1_id INTEGER;
  p2_id INTEGER;
  target_game_id INTEGER;
  target_phase_id INTEGER;
  gm_char_id INTEGER;
  p1_char_id INTEGER;
  p2_char_id INTEGER;
  post_id INTEGER := 50000;
  comment_id INTEGER := 50001;
  i INTEGER;
  random_author_id INTEGER;
  random_char_id INTEGER;
  random_content TEXT;
BEGIN
  -- Get user IDs
  SELECT id INTO gm_id FROM users WHERE email = 'test_gm@example.com';
  SELECT id INTO p1_id FROM users WHERE email = 'test_player1@example.com';
  SELECT id INTO p2_id FROM users WHERE email = 'test_player2@example.com';

  -- Get game and phase IDs
  SELECT id INTO target_game_id FROM games WHERE title = 'Shadows Over Innsmouth';
  SELECT id INTO target_phase_id FROM game_phases WHERE game_id = target_game_id AND is_active = true LIMIT 1;

  -- Get character IDs
  SELECT id INTO gm_char_id FROM characters WHERE game_id = target_game_id AND user_id IS NULL AND character_type = 'npc' LIMIT 1;
  SELECT id INTO p1_char_id FROM characters WHERE game_id = target_game_id AND user_id = p1_id LIMIT 1;
  SELECT id INTO p2_char_id FROM characters WHERE game_id = target_game_id AND user_id = p2_id LIMIT 1;

  -- Create root post
  INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
  VALUES (
    post_id,
    target_game_id,
    target_phase_id,
    gm_id,
    gm_char_id,
    '# Performance Test: Large Comment Thread

This post has 500 comments for testing typing performance with many comments loaded.

**Instructions:**
1. Expand all comments (may take a moment to load)
2. Try typing in the comment box at the bottom
3. Test typing in nested comment reply boxes
4. Observe any lag or input delay',
    'post',
    NULL,
    'game',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours'
  );

  -- Generate 500 comments
  FOR i IN 1..500 LOOP
    -- Randomly pick author (rotate through GM, P1, P2)
    IF i % 3 = 0 THEN
      random_author_id := gm_id;
      random_char_id := gm_char_id;
    ELSIF i % 3 = 1 THEN
      random_author_id := p1_id;
      random_char_id := p1_char_id;
    ELSE
      random_author_id := p2_id;
      random_char_id := p2_char_id;
    END IF;

    -- Generate varied content
    IF i % 10 = 0 THEN
      random_content := format('Comment #%s: This is a longer comment to simulate real conversation. It includes multiple sentences and some detail about the investigation. The mysterious events in Innsmouth continue to unfold, and we need to be careful about how we proceed. What are your thoughts on this development?', i);
    ELSE
      random_content := format('Comment #%s: Brief observation about the situation.', i);
    END IF;

    -- Create comment (all top-level for maximum load)
    INSERT INTO messages (id, game_id, phase_id, author_id, character_id, content, message_type, parent_id, visibility, created_at, edited_at)
    VALUES (
      comment_id,
      target_game_id,
      target_phase_id,
      random_author_id,
      random_char_id,
      random_content,
      'comment',
      post_id,  -- All comments reply to root post
      'game',
      NOW() - INTERVAL '1 second' * (500 - i),  -- Stagger timestamps
      NOW() - INTERVAL '1 second' * (500 - i)
    );

    comment_id := comment_id + 1;
  END LOOP;

  RAISE NOTICE 'Created post % with 500 comments (IDs %-%) for performance testing', post_id, 50001, comment_id - 1;
END $$;
