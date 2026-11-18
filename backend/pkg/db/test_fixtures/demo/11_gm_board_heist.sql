-- ============================================================================
-- Results board for the Heist's active action phase ("Execute the Plan")
-- ============================================================================
-- The content lives in fixtures.seed_heist_board (common/02_gm_board_seed.sql)
-- so an E2E fixture can seed the same board on its own game. Log in as TestGM
-- and open the board from the Heist's results area, or go straight to
-- /games/<id>/phases/<phase id>/board.
--
-- The demo Heist shares its boards, so TestAudience (in its audience) can
-- follow the board read-only from the History tab. Sharing is set here, not
-- in the seed function, so an E2E game can seed the same board unshared.
-- ============================================================================

DO $$
DECLARE
  heist_id integer;
  phase_id integer;
BEGIN
  SELECT id INTO heist_id FROM games WHERE title = 'The Heist at Goldstone Bank';
  SELECT id INTO phase_id FROM game_phases WHERE game_id = heist_id AND phase_number = 2;
  PERFORM fixtures.seed_heist_board(heist_id, phase_id);
  UPDATE games SET share_gm_board = true WHERE id = heist_id;
END $$;
