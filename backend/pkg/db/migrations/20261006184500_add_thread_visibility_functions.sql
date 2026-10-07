-- +goose Up
-- One definition of who may see a restricted Common Room thread across games,
-- for the queries that can't take a Go-resolved viewer_sees_all (favorites,
-- dashboard) and for deciding who has lost access. Before this each carried
-- its own copy of the bypass rule.
--
-- Single-game queries keep their inline predicate on purpose. Postgres never
-- inlines a SQL function containing a subquery, and inline the planner turns
-- the allowlist EXISTS into one hashed subplan; inside a function it runs per
-- row (measured 6.5x slower with every thread restricted).
--
-- This function only answers for restricted threads, and callers guard it:
--   root.is_restricted = false OR restricted_thread_visible_to_user(...)
-- Each call starts an executor for the nested subqueries (~9µs), and OR stops
-- at the first true argument, so public threads never reach it.

-- +goose StatementBegin
-- Whether viewer_id may see the RESTRICTED thread rooted at root_id. Restates
-- core.CanSeeAllRestrictedPosts against the root post's game -- a public
-- archive (completed, epilogue), the primary GM, or an active co-GM or
-- audience member -- plus the allowlist. Admin mode is a per-request flag, so
-- it has no place here. TestRestrictedRuleAgreement keeps this in step with
-- the Go rule.
CREATE FUNCTION restricted_thread_visible_to_user(root_id integer, viewer_id integer)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (SELECT 1 FROM common_room_post_viewers v
                   WHERE v.post_id = root_id AND v.user_id = viewer_id)
        OR EXISTS (SELECT 1 FROM messages r
                   JOIN games g ON g.id = r.game_id
                   WHERE r.id = root_id
                     AND (g.state IN ('completed', 'epilogue')
                          OR g.gm_user_id = viewer_id
                          OR EXISTS (SELECT 1 FROM game_participants gp
                                     WHERE gp.game_id = g.id AND gp.user_id = viewer_id
                                       AND gp.status = 'active' AND gp.role IN ('co_gm', 'audience'))))
$$;
-- +goose StatementEnd

-- +goose Down
DROP FUNCTION IF EXISTS restricted_thread_visible_to_user(integer, integer);
