package messages

import (
	"context"
	"fmt"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// SetCommentFavorite stars or unstars a single comment for a user.
//
// Unlike ToggleCommentRead this takes no gameID. Read tracking is a
// game-scoped resource and validates the comment belongs to the given game to
// guard against cross-game manipulation. A favorite is the user's own private
// row addressed solely by comment ID, so a gameID argument could only ever be
// derived from the comment itself -- which is exactly what this does to
// populate the denormalized game_id column.
//
// Resolving the comment first also enforces the two rejections that cannot
// live anywhere else: a comment ID that does not exist, and a message that is
// a post rather than a comment (posts are not favoritable).
//
// Parameters:
//   - ctx: Request context
//   - userID: The user starring the comment
//   - commentID: The comment being starred
//   - favorite: true to star, false to unstar
func (s *MessageService) SetCommentFavorite(ctx context.Context, userID, commentID int32, favorite bool) error {
	queries := models.New(s.DB)

	if !favorite {
		// Unfavoriting needs no validation: deleting a row that is not there
		// is a no-op, and the row is keyed by the caller's own user ID.
		return queries.RemoveCommentFavorite(ctx, models.RemoveCommentFavoriteParams{
			UserID:    userID,
			CommentID: commentID,
		})
	}

	msg, err := queries.GetMessage(ctx, commentID)
	if err != nil {
		return fmt.Errorf("comment not found: %w", err)
	}
	if msg.MessageType != models.MessageTypeComment {
		return fmt.Errorf("only comments can be favorited")
	}

	return queries.AddCommentFavorite(ctx, models.AddCommentFavoriteParams{
		UserID:    userID,
		CommentID: commentID,
		GameID:    msg.GameID,
	})
}

// GetFavoriteCommentIDsForGame returns the comment IDs a user has favorited
// within one game. Powers star state in the common room and new-comments views.
func (s *MessageService) GetFavoriteCommentIDsForGame(ctx context.Context, userID, gameID int32) ([]int32, error) {
	queries := models.New(s.DB)

	ids, err := queries.GetFavoriteCommentIDsForGame(ctx, models.GetFavoriteCommentIDsForGameParams{
		UserID: userID,
		GameID: gameID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get favorite comment IDs for game: %w", err)
	}
	if ids == nil {
		ids = []int32{}
	}
	return ids, nil
}

// GetFavoriteCommentIDsForUser returns every comment ID a user has favorited,
// across all games. Powers star state on surfaces that are not game-scoped,
// such as the character profile page.
func (s *MessageService) GetFavoriteCommentIDsForUser(ctx context.Context, userID int32) ([]int32, error) {
	queries := models.New(s.DB)

	ids, err := queries.GetFavoriteCommentIDsForUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get favorite comment IDs: %w", err)
	}
	if ids == nil {
		ids = []int32{}
	}
	return ids, nil
}

// ListFavoriteComments returns a page of the user's favorited comments,
// newest-favorited first, along with the total count for pagination.
//
// The listing is deliberately cross-game and carries no permission filter:
// any authenticated user can already read any game's common room, so filtering
// here would make favorites stricter than the room they link back to and a
// comment you starred could vanish from your own list.
//
// Soft-deleted comments are excluded at read time (the favorite row survives,
// matching every other comment read path).
func (s *MessageService) ListFavoriteComments(ctx context.Context, userID int32, limit, offset int32) ([]*core.FavoriteComment, int64, error) {
	queries := models.New(s.DB)

	total, err := queries.CountFavoriteComments(ctx, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count favorite comments: %w", err)
	}

	rows, err := queries.ListFavoriteCommentsWithParents(ctx, models.ListFavoriteCommentsWithParentsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list favorite comments: %w", err)
	}

	favorites := make([]*core.FavoriteComment, len(rows))
	for i, row := range rows {
		favorites[i] = favoriteCommentRowToDomain(row)
	}

	s.Logger.Info(ctx, "Listed favorite comments",
		"user_id", userID,
		"limit", limit,
		"offset", offset,
		"returned", len(favorites),
		"total", total,
	)

	return favorites, total, nil
}

// favoriteCommentRowToDomain converts a favorites listing row to the domain model.
// The embedded CommentWithParent mirrors recentCommentRowToDomain field for field;
// only GameTitle and FavoritedAt are specific to favorites.
func favoriteCommentRowToDomain(row models.ListFavoriteCommentsWithParentsRow) *core.FavoriteComment {
	return &core.FavoriteComment{
		CommentWithParent: core.CommentWithParent{
			// Comment data
			ID:                 row.ID,
			GameID:             row.GameID,
			ParentID:           pgInt4ToInt32Ptr(row.ParentID),
			PostID:             pgInt4ToInt32Ptr(row.PostID),
			AuthorID:           row.AuthorID,
			CharacterID:        row.CharacterID,
			Content:            row.Content,
			CreatedAt:          pgTimestampToTime(row.CreatedAt),
			EditedAt:           pgTimestamptzToTimePtr(row.EditedAt),
			EditCount:          row.EditCount,
			DeletedAt:          pgTimestampToTimePtr(row.DeletedAt),
			IsDeleted:          row.IsDeleted,
			AuthorUsername:     row.AuthorUsername,
			CharacterName:      pgTextToStringPtr(row.CharacterName),
			CharacterAvatarUrl: pgTextToStringPtr(row.CharacterAvatarUrl),

			// Parent data
			ParentContent:            pgTextToStringPtr(row.ParentContent),
			ParentCreatedAt:          pgTimestampToTimePtr(row.ParentCreatedAt),
			ParentDeletedAt:          pgTimestampToTimePtr(row.ParentDeletedAt),
			ParentIsDeleted:          pgBoolToBoolPtr(row.ParentIsDeleted),
			ParentMessageType:        nullMessageTypeToStringPtr(row.ParentMessageType),
			ParentAuthorUsername:     pgTextToStringPtr(row.ParentAuthorUsername),
			ParentCharacterName:      pgTextToStringPtr(row.ParentCharacterName),
			ParentCharacterAvatarUrl: pgTextToStringPtr(row.ParentCharacterAvatarUrl),
		},

		GameTitle:   row.GameTitle,
		FavoritedAt: row.FavoritedAt.Time,
	}
}
