-- ================================================
-- COMMON ROOM POLLS
-- ================================================

-- name: CreatePoll :one
INSERT INTO common_room_polls (
    game_id,
    phase_id,
    created_by_user_id,
    created_by_character_id,
    question,
    description,
    deadline,
    vote_as_type,
    show_individual_votes,
    allow_other_option
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetPoll :one
SELECT * FROM common_room_polls
WHERE id = $1 AND is_deleted = FALSE;

-- name: ListPollsByPhase :many
SELECT * FROM common_room_polls
WHERE game_id = $1
  AND phase_id = $2
  AND is_deleted = FALSE
ORDER BY created_at DESC;

-- name: ListPollsByGame :many
SELECT * FROM common_room_polls
WHERE game_id = $1
  AND is_deleted = FALSE
  AND (
    -- Include expired polls if requested
    $2 = true OR deadline > NOW()
  )
ORDER BY deadline ASC;

-- name: SoftDeletePoll :exec
UPDATE common_room_polls
SET is_deleted = TRUE, updated_at = NOW()
WHERE id = $1;

-- name: UpdatePoll :one
UPDATE common_room_polls
SET question = $2,
    description = $3,
    deadline = $4,
    show_individual_votes = $5,
    allow_other_option = $6,
    updated_at = NOW()
WHERE id = $1 AND is_deleted = FALSE
RETURNING *;

-- ================================================
-- POLL OPTIONS
-- ================================================

-- name: CreatePollOption :one
INSERT INTO poll_options (poll_id, option_text, display_order)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetPollOptions :many
SELECT * FROM poll_options
WHERE poll_id = $1
ORDER BY display_order ASC;

-- name: DeletePollOption :exec
DELETE FROM poll_options
WHERE id = $1;

-- ================================================
-- POLL VOTES
-- ================================================

-- name: SubmitVote :one
INSERT INTO poll_votes (
    poll_id,
    user_id,
    character_id,
    selected_option_id,
    other_response
)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateVote :one
UPDATE poll_votes
SET selected_option_id = $2,
    other_response = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetVoteByPollAndUser :one
SELECT * FROM poll_votes
WHERE poll_id = $1
  AND user_id = $2
  AND (
    -- Match exact character_id or both are NULL
    (character_id = $3) OR
    (character_id IS NULL AND $3::integer IS NULL)
  );

-- name: GetUserVote :one
-- Get user's vote for a specific poll (character-specific or player-level)
SELECT * FROM poll_votes
WHERE poll_id = $1
  AND user_id = $2
  AND (
    ($3::integer IS NOT NULL AND character_id = $3) OR
    ($3::integer IS NULL AND character_id IS NULL)
  );

-- name: DeleteVote :exec
DELETE FROM poll_votes
WHERE id = $1;

-- name: GetPollVoteCount :one
SELECT COUNT(*) as vote_count
FROM poll_votes
WHERE poll_id = $1;

-- name: GetOptionVoteCount :one
SELECT COUNT(*) as vote_count
FROM poll_votes
WHERE poll_id = $1
  AND selected_option_id = $2;

-- name: GetOtherVoteCount :one
SELECT COUNT(*) as vote_count
FROM poll_votes
WHERE poll_id = $1
  AND other_response IS NOT NULL;

-- ================================================
-- POLL RESULTS (with visibility logic)
-- ================================================

-- name: GetPollResultsSummary :many
-- Get vote counts per option for results display
SELECT
    po.id as option_id,
    po.option_text,
    po.display_order,
    COUNT(pv.id) as vote_count
FROM poll_options po
LEFT JOIN poll_votes pv ON po.id = pv.selected_option_id
WHERE po.poll_id = $1
GROUP BY po.id, po.option_text, po.display_order
ORDER BY po.display_order ASC;

-- name: GetPollVotesWithDetails :many
-- Get detailed vote information (for when show_individual_votes = true)
SELECT
    pv.id,
    pv.user_id,
    pv.character_id,
    pv.selected_option_id,
    pv.other_response,
    pv.created_at,
    u.username,
    c.name as character_name
FROM poll_votes pv
JOIN users u ON pv.user_id = u.id
LEFT JOIN characters c ON pv.character_id = c.id
WHERE pv.poll_id = $1
ORDER BY pv.created_at ASC;

-- name: GetOtherResponses :many
-- Get all "other" text responses
SELECT
    pv.id,
    pv.user_id,
    pv.character_id,
    pv.other_response,
    pv.created_at,
    u.username,
    c.name as character_name
FROM poll_votes pv
JOIN users u ON pv.user_id = u.id
LEFT JOIN characters c ON pv.character_id = c.id
WHERE pv.poll_id = $1
  AND pv.other_response IS NOT NULL
ORDER BY pv.created_at ASC;

-- ================================================
-- UTILITY QUERIES
-- ================================================

-- name: GetActivePollsForGame :many
-- Get all active (not expired, not deleted) polls for a game
SELECT * FROM common_room_polls
WHERE game_id = $1
  AND is_deleted = FALSE
  AND deadline > NOW()
ORDER BY deadline ASC;

-- name: GetExpiredPolls :many
-- For cleanup or notification jobs
SELECT * FROM common_room_polls
WHERE is_deleted = FALSE
  AND deadline <= NOW()
ORDER BY deadline DESC;

-- name: HasUserVoted :one
-- Check if user has already voted in a poll
-- Note: NULL character_id in both table and parameter means player-level vote
SELECT EXISTS(
    SELECT 1 FROM poll_votes
    WHERE poll_id = @poll_id
      AND user_id = @user_id
      AND COALESCE(character_id, 0) = COALESCE(@character_id, 0)
) as has_voted;

-- name: HasUserVotedAny :one
-- Check if user has voted in a poll at all (as player OR with any character)
-- Use this for the polls list view to show "Voted" badge
SELECT EXISTS(
    SELECT 1 FROM poll_votes
    WHERE poll_id = @poll_id
      AND user_id = @user_id
) as has_voted;

-- name: GetUserVotedCharacterIDs :many
-- Get list of character IDs that a user has already voted with in a poll
-- Use this to show voting progress (e.g., "Voted 2/3") and filter dropdown
SELECT character_id
FROM poll_votes
WHERE poll_id = @poll_id
  AND user_id = @user_id
  AND character_id IS NOT NULL;
