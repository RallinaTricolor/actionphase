package messages

// Restricted Common Room posts: who may see them, and changing who may.
//
// The rule itself is core.CanSeeAllRestrictedPosts. This file resolves the
// facts it needs (the viewer's role, admin mode, the game's state, the
// allowlist) and applies it, failing closed: any lookup error reads as "may
// not see", never as access.

import (
	"context"
	"errors"
	"fmt"
	"slices"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
)

// viewerRole returns the viewer's role in the game. The primary GM has no
// game_participants row, so participantRole is ” for them and they are
// promoted here.
func viewerRole(gmUserID, userID int32, participantRole string) string {
	if userID != 0 && gmUserID == userID {
		return "gm"
	}
	return participantRole
}

// adminModeOn reports whether the request runs in admin mode. isAdmin is the
// user's is_admin column; it only counts together with the request's
// admin-mode header, which is read from ctx here so no caller can forget half
// of the pair.
func adminModeOn(ctx context.Context, isAdmin bool) bool {
	return isAdmin && core.GetAdminMode(ctx)
}

// seesAllRestricted applies the bypass rule to a resolved role and admin mode.
func seesAllRestricted(state, role string, adminMode bool) bool {
	return core.IsPublicArchive(state) || core.CanSeeAllRestrictedPosts(role, adminMode)
}

// ResolveViewerScope works out whether userID bypasses the allowlists in
// gameID. A failed lookup is logged and resolves to SeesAll=false.
func (s *MessageService) ResolveViewerScope(ctx context.Context, gameID, userID int32) core.ViewerScope {
	scope := core.ViewerScope{UserID: userID}

	row, err := models.New(s.DB).GetViewerRestrictedPostContext(ctx, models.GetViewerRestrictedPostContextParams{
		GameID: gameID,
		UserID: userID,
	})
	if err != nil {
		s.Logger.Warn(ctx, "Failed to resolve restricted-post viewer scope; failing closed",
			"error", err, "game_id", gameID, "user_id", userID)
		return scope
	}

	scope.SeesAll = seesAllRestricted(row.State, viewerRole(row.GmUserID, userID, row.ViewerRole), adminModeOn(ctx, row.ViewerIsAdmin))
	return scope
}

// CanUserViewMessage reports whether userID may see messageID, a post or any
// comment under it.
//
// Everything is resolved from the message's own row -- its game, its root
// post -- so a caller cannot borrow privilege from a different game by putting
// its ID in the URL. An unknown message is (false, nil), which handlers render
// exactly like a hidden one.
//
// Draft posts are visible only to the GM, co-GMs and admins in admin mode,
// matching the draft endpoints (requireGMOrCoGM). Before this check existed a
// player could fetch a draft by ID through the deep-link endpoints.
func (s *MessageService) CanUserViewMessage(ctx context.Context, messageID, userID int32) (bool, error) {
	row, err := models.New(s.DB).GetMessageVisibilityContext(ctx, models.GetMessageVisibilityContextParams{
		MessageID: messageID,
		UserID:    userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("failed to load message visibility context: %w", err)
	}

	role := viewerRole(row.GmUserID, userID, row.ViewerRole)
	adminMode := adminModeOn(ctx, row.ViewerIsAdmin)

	if row.RootIsDraft {
		return adminMode || role == "gm" || role == "co_gm", nil
	}
	if !row.RootIsRestricted {
		return true, nil
	}
	if seesAllRestricted(row.State, role, adminMode) {
		return true, nil
	}
	return row.IsListedViewer, nil
}

// IsMessageInThread reports whether messageID belongs to the thread rooted at
// postID.
func (s *MessageService) IsMessageInThread(ctx context.Context, messageID, postID int32) (bool, error) {
	root, err := models.New(s.DB).GetMessageRootPostID(ctx, messageID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("failed to get message root: %w", err)
	}
	return root == postID, nil
}

// normalizeViewerIDs sorts and de-duplicates an allowlist. The API rejects
// duplicates already; this keeps the service correct for other callers.
func normalizeViewerIDs(userIDs []int32) []int32 {
	ids := slices.Clone(userIDs)
	slices.Sort(ids)
	return slices.Compact(ids)
}

// validatePostViewers checks an allowlist names at least one user and only
// active players of the game. Errors wrap core.ErrInvalidPostViewers.
func validatePostViewers(ctx context.Context, queries *models.Queries, gameID int32, userIDs []int32) error {
	if len(userIDs) == 0 {
		return fmt.Errorf("%w: a restricted post needs at least one player", core.ErrInvalidPostViewers)
	}
	count, err := queries.CountActivePlayersAmong(ctx, models.CountActivePlayersAmongParams{
		GameID:  gameID,
		UserIds: userIDs,
	})
	if err != nil {
		return fmt.Errorf("failed to validate post viewers: %w", err)
	}
	if count != int64(len(userIDs)) {
		return fmt.Errorf("%w: every viewer must be an active player in this game", core.ErrInvalidPostViewers)
	}
	return nil
}

// SetPostViewers replaces a post's allowlist and its is_restricted flag in one
// transaction.
//
// When the post ends up restricted, in-app notifications pointing into the
// thread are deleted for everyone who can no longer see it, which covers both
// a player taken off the list and every player when a public post becomes
// restricted. Making a post public removes nobody, so nothing is deleted.
// Discord DMs already sent can't be recalled.
//
// It returns the updated post and its allowlist (sorted, empty for a public
// post), so the caller can answer without reading either back.
func (s *MessageService) SetPostViewers(ctx context.Context, gameID, postID int32, restricted bool, userIDs []int32) (*core.MessageWithDetails, []int32, error) {
	queries := models.New(s.DB)

	post, err := s.GetPost(ctx, postID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, core.ErrPostNotFound
		}
		return nil, nil, err
	}
	if post.GameID != gameID || post.MessageType != models.MessageTypePost {
		return nil, nil, core.ErrPostNotFound
	}

	game, err := queries.GetGame(ctx, post.GameID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get game: %w", err)
	}
	if err := core.ValidateGameNotCompleted(ctx, &game); err != nil {
		return nil, nil, err
	}

	ids := normalizeViewerIDs(userIDs)
	if restricted {
		if err := validatePostViewers(ctx, queries, post.GameID, ids); err != nil {
			return nil, nil, err
		}
	} else if len(ids) > 0 {
		return nil, nil, fmt.Errorf("%w: a public post has no viewer list", core.ErrInvalidPostViewers)
	}

	err = pgx.BeginFunc(ctx, s.DB, func(tx pgx.Tx) error {
		q := models.New(tx)
		if err := q.SetPostRestricted(ctx, models.SetPostRestrictedParams{PostID: postID, IsRestricted: restricted}); err != nil {
			return fmt.Errorf("failed to set is_restricted: %w", err)
		}
		if err := q.DeletePostViewers(ctx, postID); err != nil {
			return fmt.Errorf("failed to clear post viewers: %w", err)
		}
		if len(ids) > 0 {
			if err := q.AddPostViewers(ctx, models.AddPostViewersParams{PostID: postID, UserIds: ids}); err != nil {
				return fmt.Errorf("failed to add post viewers: %w", err)
			}
		}
		// A public archive shows the thread to everyone, so nobody has lost
		// access and their notifications stay.
		if restricted && !core.IsPublicArchive(game.State) {
			if err := q.DeleteThreadNotificationsForHiddenUsers(ctx, postID); err != nil {
				return fmt.Errorf("failed to delete notifications for removed viewers: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	s.Logger.Info(ctx, "Post viewers updated",
		"post_id", postID, "game_id", post.GameID, "restricted", restricted, "viewer_count", len(ids))

	post.IsRestricted = restricted
	if ids == nil {
		ids = []int32{}
	}
	return post, ids, nil
}

// ListPostViewers returns each post's allowlist, keyed by post ID, in one
// query for a whole page of posts.
func (s *MessageService) ListPostViewers(ctx context.Context, postIDs []int32) (map[int32][]int32, error) {
	result := make(map[int32][]int32)
	if len(postIDs) == 0 {
		return result, nil
	}

	rows, err := models.New(s.DB).ListPostViewers(ctx, postIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to list post viewers: %w", err)
	}
	for _, row := range rows {
		result[row.PostID] = append(result[row.PostID], row.UserID)
	}
	return result, nil
}
