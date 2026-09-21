-- name: GetFilteredGames :many
-- Get games with filters, sorting, and user participation enrichment
SELECT
  g.id,
  g.title,
  g.description,
  g.gm_user_id,
  u.username as gm_username,
  g.state,
  g.genre,
  g.start_date,
  g.end_date,
  g.recruitment_deadline,
  g.max_players,
  g.is_anonymous,
  g.auto_accept_audience,
  g.allow_group_conversations,
  g.portrait_avatars,
  g.banner_url,
  g.community_id,
  -- LEFT JOIN, not INNER: games predating communities have community_id NULL
  -- (req 5) and must still appear in every listing.
  c.name as community_name,
  c.slug as community_slug,
  g.created_at,
  g.updated_at,

  -- Computed fields
  (SELECT COUNT(*) FROM game_participants WHERE game_id = g.id AND status = 'active' AND role = 'player') as current_players,

  -- User participation status (empty string if not logged in)
  COALESCE(
    CASE
      WHEN $1::int IS NULL OR $1 = 0 THEN NULL
      WHEN g.gm_user_id = $1 THEN 'gm'
      -- Split by role: the badge in the games list distinguishes Player from
      -- Audience from Co-GM, so collapsing them into 'participant' would show
      -- an audience member "Player".
      WHEN EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1 AND status = 'active' AND role = 'co_gm') THEN 'co_gm'
      WHEN EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1 AND status = 'active' AND role = 'audience') THEN 'audience'
      WHEN EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1 AND status = 'active') THEN 'participant'
      WHEN EXISTS(SELECT 1 FROM game_applications WHERE game_id = g.id AND user_id = $1) THEN 'applied'
      ELSE 'none'
    END,
    ''
  ) as user_relationship,

  -- Current phase info for in-progress games (empty string if none)
  COALESCE((SELECT phase_type FROM game_phases WHERE game_id = g.id AND is_active = true), '') as current_phase_type,
  (SELECT end_time FROM game_phases WHERE game_id = g.id AND is_active = true) as current_phase_deadline,

  -- Deadline urgency calculation
  CASE
    WHEN g.state = 'recruitment' AND g.recruitment_deadline IS NOT NULL THEN
      CASE
        WHEN g.recruitment_deadline < NOW() + INTERVAL '24 hours' THEN 'critical'
        WHEN g.recruitment_deadline < NOW() + INTERVAL '3 days' THEN 'warning'
        ELSE 'normal'
      END
    WHEN g.state = 'in_progress' THEN
      CASE
        WHEN (SELECT end_time FROM game_phases WHERE game_id = g.id AND is_active = true) < NOW() + INTERVAL '24 hours' THEN 'critical'
        WHEN (SELECT end_time FROM game_phases WHERE game_id = g.id AND is_active = true) < NOW() + INTERVAL '3 days' THEN 'warning'
        ELSE 'normal'
      END
    ELSE 'normal'
  END as deadline_urgency,

  -- Recent activity flag (updated in last 24h)
  (g.updated_at > NOW() - INTERVAL '24 hours') as has_recent_activity

FROM games g
INNER JOIN users u ON g.gm_user_id = u.id
LEFT JOIN communities c ON c.id = g.community_id
WHERE
  -- Every game is browseable: per-game visibility was dropped with
  -- games.is_public. Access is governed by state, participation and community
  -- bans, not by a row flag -- so there is no visibility predicate here, and
  -- the admin-mode bypass that used to sit beside it is gone with it.
  -- Filter by states (optional array of states)
  ($2::text[] IS NULL OR g.state = ANY($2::text[]))

  -- Filter by user participation (optional)
  AND (
    $3::text IS NULL OR $3 = '' OR
    ($3 = 'my_games' AND ($1::int IS NOT NULL AND (g.gm_user_id = $1 OR EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1 AND status = 'active')))) OR
    ($3 = 'applied' AND ($1::int IS NOT NULL AND EXISTS(SELECT 1 FROM game_applications WHERE game_id = g.id AND user_id = $1 AND status = 'pending'))) OR
    ($3 = 'not_joined' AND ($1::int IS NOT NULL AND g.gm_user_id != $1 AND NOT EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1)))
  )

  -- Filter by open spots (only recruiting games with available spots)
  AND (
    $4::boolean IS NOT true OR
    (
      g.state = 'recruitment' AND
      (g.max_players IS NULL OR (SELECT COUNT(*) FROM game_participants WHERE game_id = g.id AND status = 'active' AND role = 'player') < g.max_players)
    )
  )

  -- Filter by search text (case-insensitive search in title and description)
  AND (
    $6::text IS NULL OR $6 = '' OR
    g.title ILIKE '%' || $6 || '%' OR
    g.description::text ILIKE '%' || $6 || '%'
  )

  -- Filter by community (0 or NULL means "every community"). Legacy games with
  -- community_id NULL are excluded when a community IS named -- they belong to
  -- none, so they are not in it.
  AND ($9::int IS NULL OR $9 = 0 OR g.community_id = $9)

ORDER BY
  -- Dynamic sorting based on $5 parameter
  CASE
    WHEN $5 = 'recent_activity' THEN g.updated_at
    WHEN $5 = 'created' THEN g.created_at
    WHEN $5 = 'start_date' THEN g.start_date
    WHEN $5 = 'alphabetical' THEN NULL
    ELSE g.updated_at
  END DESC NULLS LAST,

  CASE
    WHEN $5 = 'alphabetical' THEN g.title
    ELSE NULL
  END ASC NULLS LAST,

  -- Secondary sort by ID for consistency
  g.id DESC

-- Pagination
LIMIT $7::int
OFFSET $8::int;

-- Parameters:
-- $1: user_id (int, nullable) - for participation enrichment
-- $2: states (text[], nullable) - array of game states to filter
-- $3: participation_filter (text, nullable) - 'my_games', 'applied', 'not_joined'
-- $4: has_open_spots (boolean, nullable) - only games with available spots
-- $5: sort_by (text) - 'recent_activity', 'created', 'start_date', 'alphabetical'
-- $6: search (text, nullable) - case-insensitive search in title and description
-- $7: limit (int) - number of records per page
-- $8: offset (int) - number of records to skip
-- $9: community_id (int, nullable) - 0/NULL means every community
--
-- admin_mode and admin_user_id are GONE: they existed only to bypass the
-- is_public filter, which no longer exists. Admin mode itself is untouched --
-- it still gates moderation elsewhere via AdminModeMiddleware.

-- name: CountPublicGames :one
-- Every game is browseable since games.is_public was dropped, so this is now a
-- plain total. The name is kept because it is the listing's "total_count".
SELECT COUNT(*) FROM games;

-- name: CountFilteredGames :one
-- Count games matching the same filters as GetFilteredGames (for pagination metadata)
SELECT COUNT(*)
FROM games g
WHERE
  -- No visibility predicate -- see GetFilteredGames above. This clause list must
  -- keep mirroring that query exactly or the count and the page disagree.
  -- Filter by states (optional array of states)
  ($2::text[] IS NULL OR g.state = ANY($2::text[]))

  -- Filter by user participation (optional)
  AND (
    $3::text IS NULL OR $3 = '' OR
    ($3 = 'my_games' AND ($1::int IS NOT NULL AND (g.gm_user_id = $1 OR EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1 AND status = 'active')))) OR
    ($3 = 'applied' AND ($1::int IS NOT NULL AND EXISTS(SELECT 1 FROM game_applications WHERE game_id = g.id AND user_id = $1 AND status = 'pending'))) OR
    ($3 = 'not_joined' AND ($1::int IS NOT NULL AND g.gm_user_id != $1 AND NOT EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1)))
  )

  -- Filter by open spots (only recruiting games with available spots)
  AND (
    $4::boolean IS NOT true OR
    (
      g.state = 'recruitment' AND
      (g.max_players IS NULL OR (SELECT COUNT(*) FROM game_participants WHERE game_id = g.id AND status = 'active' AND role = 'player') < g.max_players)
    )
  )

  -- Filter by search text (case-insensitive search in title and description)
  AND (
    $5::text IS NULL OR $5 = '' OR
    g.title ILIKE '%' || $5 || '%' OR
    g.description::text ILIKE '%' || $5 || '%'
  )

  -- Filter by community. Must mirror GetFilteredGames exactly or the count and
  -- the page disagree and pagination breaks.
  AND ($6::int IS NULL OR $6 = 0 OR g.community_id = $6);

-- Parameters:
-- $1: user_id (int, nullable) - for participation enrichment
-- $2: states (text[], nullable) - array of game states to filter
-- $3: participation_filter (text, nullable) - 'my_games', 'applied', 'not_joined'
-- $4: has_open_spots (boolean, nullable) - only games with available spots
-- $5: search (text, nullable) - case-insensitive search in title and description
-- $6: community_id (int, nullable) - 0/NULL means every community
--
-- No sort_by here: counting does not order. admin_mode and admin_user_id are
-- gone for the same reason as in GetFilteredGames above.

-- name: GetAvailableStates :many
SELECT DISTINCT state
FROM games
ORDER BY state ASC;
