-- +goose Up
-- One definition of how many of a game's player slots are filled, for the
-- game header, the listing's player count, the open-spots filters and the
-- join check. Each used to carry its own copy of the rule, and any one
-- drifting made them disagree about whether a game is full.

-- +goose StatementBegin
-- The player slots filled in a game: its active players, plus former players a
-- permadeath moved to the audience (is_former_player), who keep their slot.
CREATE FUNCTION game_filled_player_slots(p_game_id integer)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
    SELECT COUNT(*)
    FROM game_participants gp
    WHERE gp.game_id = p_game_id
      AND gp.status = 'active'
      AND (gp.role = 'player' OR (gp.role = 'audience' AND gp.is_former_player))
$$;
-- +goose StatementEnd

-- +goose Down
DROP FUNCTION IF EXISTS game_filled_player_slots(integer);
