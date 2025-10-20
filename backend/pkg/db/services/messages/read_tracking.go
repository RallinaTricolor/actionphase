package messages

import (
	"context"
	"fmt"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"github.com/jackc/pgx/v5/pgtype"
)

// MarkPostAsRead marks a post (and optionally a specific comment) as read by a user.
// This is used to track read status for the common room.
//
// Parameters:
//   - ctx: Request context
//   - userID: The user who is marking content as read
//   - gameID: The game the post belongs to
//   - postID: The post being marked as read
//   - lastReadCommentID: Optional - the most recent comment read (nil if just marking post as read)
//
// Returns:
//   - *core.ReadMarker: The updated read marker
//   - error: Any error that occurred
func (s *MessageService) MarkPostAsRead(ctx context.Context, userID, gameID, postID int32, lastReadCommentID *int32) (*core.ReadMarker, error) {
	queries := db.New(s.DB)

	// Build the upsert params
	params := db.MarkPostReadParams{
		UserID:            userID,
		GameID:            gameID,
		PostID:            postID,
		LastReadCommentID: int32ToPgInt4(lastReadCommentID),
	}

	// Execute the upsert
	readMarker, err := queries.MarkPostRead(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to mark post as read: %w", err)
	}

	// Convert to core model
	return readMarkerToCore(&readMarker), nil
}

// GetUserReadMarker retrieves the read tracking info for a specific user and post.
//
// Parameters:
//   - ctx: Request context
//   - userID: The user ID
//   - postID: The post ID
//
// Returns:
//   - *core.ReadMarker: The read marker if found, nil if not found
//   - error: Any error that occurred (except ErrNotFound)
func (s *MessageService) GetUserReadMarker(ctx context.Context, userID, postID int32) (*core.ReadMarker, error) {
	queries := db.New(s.DB)

	params := db.GetUserReadMarkerParams{
		UserID: userID,
		PostID: postID,
	}

	readMarker, err := queries.GetUserReadMarker(ctx, params)
	if err != nil {
		// If not found, return nil marker (user hasn't read this post yet)
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get read marker: %w", err)
	}

	return readMarkerToCore(&readMarker), nil
}

// GetUserReadMarkersForGame retrieves all read markers for a user in a specific game.
// This is used to batch-check which posts have unread content.
//
// Parameters:
//   - ctx: Request context
//   - userID: The user ID
//   - gameID: The game ID
//
// Returns:
//   - []*core.ReadMarker: List of read markers for the user/game
//   - error: Any error that occurred
func (s *MessageService) GetUserReadMarkersForGame(ctx context.Context, userID, gameID int32) ([]*core.ReadMarker, error) {
	queries := db.New(s.DB)

	params := db.GetUserReadMarkersForGameParams{
		UserID: userID,
		GameID: gameID,
	}

	readMarkers, err := queries.GetUserReadMarkersForGame(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get read markers for game: %w", err)
	}

	// Convert to core models
	result := make([]*core.ReadMarker, len(readMarkers))
	for i, marker := range readMarkers {
		result[i] = readMarkerToCore(&marker)
	}

	return result, nil
}

// GetPostsWithUnreadInfo retrieves posts with their total comment count and latest comment timestamp.
// Frontend will compare these with read markers to determine unread status.
//
// Parameters:
//   - ctx: Request context
//   - gameID: The game ID
//
// Returns:
//   - []*core.PostUnreadInfo: List of post unread info
//   - error: Any error that occurred
func (s *MessageService) GetPostsWithUnreadInfo(ctx context.Context, gameID int32) ([]*core.PostUnreadInfo, error) {
	queries := db.New(s.DB)

	rows, err := queries.GetPostsWithUnreadCount(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get posts with unread info: %w", err)
	}

	// Convert to core models
	result := make([]*core.PostUnreadInfo, len(rows))
	for i, row := range rows {
		info := &core.PostUnreadInfo{
			PostID:        row.PostID,
			PostCreatedAt: row.PostCreatedAt.Time,
			TotalComments: row.TotalComments,
		}

		// Handle nullable latest comment timestamp
		// LatestCommentAt is interface{} and can be nil or pgtype.Timestamptz
		if row.LatestCommentAt != nil {
			if ts, ok := row.LatestCommentAt.(pgtype.Timestamptz); ok && ts.Valid {
				info.LatestCommentAt = &ts.Time
			}
		}

		result[i] = info
	}

	return result, nil
}

// GetUnreadCommentIDsForPosts retrieves the IDs of comments that are "new since last visit"
// for each post in a game. A comment is considered new if it was created after the user's
// last_read_at timestamp for that post.
//
// Parameters:
//   - ctx: Request context
//   - userID: The user ID
//   - gameID: The game ID
//
// Returns:
//   - []*core.PostUnreadComments: List of posts with their unread comment IDs
//   - error: Any error that occurred
func (s *MessageService) GetUnreadCommentIDsForPosts(ctx context.Context, userID, gameID int32) ([]*core.PostUnreadComments, error) {
	queries := db.New(s.DB)

	params := db.GetUnreadCommentIDsForPostsParams{
		UserID: userID,
		GameID: gameID,
	}

	rows, err := queries.GetUnreadCommentIDsForPosts(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get unread comment IDs: %w", err)
	}

	// Convert to core models
	result := make([]*core.PostUnreadComments, len(rows))
	for i, row := range rows {
		unreadIDs := []int32{}

		// The UnreadCommentIds field is interface{} representing a PostgreSQL array
		// It can be []interface{} or other types depending on the driver
		if row.UnreadCommentIds != nil {
			switch ids := row.UnreadCommentIds.(type) {
			case []interface{}:
				for _, id := range ids {
					if intID, ok := id.(int64); ok {
						unreadIDs = append(unreadIDs, int32(intID))
					} else if intID, ok := id.(int32); ok {
						unreadIDs = append(unreadIDs, intID)
					}
				}
			case []int32:
				unreadIDs = ids
			case []int64:
				for _, id := range ids {
					unreadIDs = append(unreadIDs, int32(id))
				}
			}
		}

		result[i] = &core.PostUnreadComments{
			PostID:           row.PostID,
			UnreadCommentIDs: unreadIDs,
		}
	}

	return result, nil
}

// Helper function to convert DB read marker to core model
func readMarkerToCore(dbMarker *db.UserCommonRoomRead) *core.ReadMarker {
	marker := &core.ReadMarker{
		ID:         dbMarker.ID,
		UserID:     dbMarker.UserID,
		GameID:     dbMarker.GameID,
		PostID:     dbMarker.PostID,
		LastReadAt: dbMarker.LastReadAt.Time,
		CreatedAt:  dbMarker.CreatedAt.Time,
		UpdatedAt:  dbMarker.UpdatedAt.Time,
	}

	// Handle nullable last read comment ID
	if dbMarker.LastReadCommentID.Valid {
		marker.LastReadCommentID = &dbMarker.LastReadCommentID.Int32
	}

	return marker
}
