package messages

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// ErrFavoriteTargetInvalid marks the two rejections that are the caller naming
// a bad target rather than a server fault: a comment ID that does not exist,
// and a message that is a post. The handler maps this to 422 and lets every
// other error be a 500, so a database outage on the lookup cannot disguise
// itself as "comment not found".
var ErrFavoriteTargetInvalid = errors.New("invalid favorite target")

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
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: comment not found", ErrFavoriteTargetInvalid)
		}
		// A real lookup failure. Wrapped without the sentinel so it surfaces
		// as a 500 and trips alerting, rather than telling the caller their
		// comment does not exist.
		return fmt.Errorf("failed to look up comment %d: %w", commentID, err)
	}
	if msg.MessageType != models.MessageTypeComment {
		return fmt.Errorf("%w: only comments can be favorited", ErrFavoriteTargetInvalid)
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
// newest-favorited first, plus the cursor for the following page.
//
// The listing is deliberately cross-game and carries no permission filter:
// any authenticated user can already read any game's common room, so filtering
// here would make favorites stricter than the room they link back to and a
// comment you starred could vanish from your own list.
//
// Soft-deleted comments are excluded at read time (the favorite row survives,
// matching every other comment read path).
//
// Pagination is keyset, not offset: unfavoriting from the list removes a row
// from the middle of the ordered set, and an offset boundary would then shift
// up and skip the next favorite entirely. Pass a nil cursor for the first
// page; pass back the returned cursor for each page after it. A nil returned
// cursor means this was the last page.
//
// There is deliberately no total. Nothing displays a favorites count, and
// computing one cost an extra join-and-aggregate on every page request; add it
// back only when something actually renders it.
func (s *MessageService) ListFavoriteComments(ctx context.Context, userID int32, limit int32, cursor *core.FavoriteCursor) ([]*core.FavoriteComment, *core.FavoriteCursor, error) {
	queries := models.New(s.DB)

	params := models.ListFavoriteCommentsWithParentsParams{
		UserID:    userID,
		PageLimit: limit,
	}
	if cursor != nil {
		params.CursorFavoritedAt = pgtype.Timestamptz{Time: cursor.FavoritedAt, Valid: true}
		params.CursorCommentID = pgtype.Int4{Int32: cursor.CommentID, Valid: true}
	}

	rows, err := queries.ListFavoriteCommentsWithParents(ctx, params)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list favorite comments: %w", err)
	}

	favorites := make([]*core.FavoriteComment, len(rows))
	for i, row := range rows {
		favorites[i] = favoriteCommentRowToDomain(row)
	}

	// A short page is the end of the list, so it yields no cursor. A full page
	// yields the last row's key, which is where the next page resumes.
	var next *core.FavoriteCursor
	if int32(len(favorites)) == limit && limit > 0 {
		last := favorites[len(favorites)-1]
		next = &core.FavoriteCursor{FavoritedAt: last.FavoritedAt, CommentID: last.ID}
	}

	s.Logger.Info(ctx, "Listed favorite comments",
		"user_id", userID,
		"limit", limit,
		"had_cursor", cursor != nil,
		"returned", len(favorites),
		"has_more", next != nil,
	)

	return favorites, next, nil
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
