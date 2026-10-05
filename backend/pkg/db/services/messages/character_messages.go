package messages

import (
	"context"
	"fmt"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// ListCharacterPostsAndComments retrieves paginated public messages by a specific
// character, leaving out restricted threads the viewer can't see. viewer must be
// resolved for the character's game.
func (s *MessageService) ListCharacterPostsAndComments(ctx context.Context, characterID int32, limit, offset int32, viewer core.ViewerScope) ([]core.CharacterMessage, error) {
	queries := models.New(s.DB)

	rows, err := queries.ListCharacterPostsAndComments(ctx, models.ListCharacterPostsAndCommentsParams{
		CharacterID:   characterID,
		ViewerSeesAll: viewer.SeesAll,
		ViewerUserID:  viewer.UserID,
		RowLimit:      limit,
		RowOffset:     offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list character messages: %w", err)
	}

	messages := make([]core.CharacterMessage, len(rows))
	for i, row := range rows {
		messages[i] = core.CharacterMessage{
			ID:                 row.ID,
			GameID:             row.GameID,
			ParentID:           pgInt4ToInt32Ptr(row.ParentID),
			AuthorID:           row.AuthorID,
			CharacterID:        row.CharacterID,
			Content:            row.Content,
			MessageType:        string(row.MessageType),
			CreatedAt:          pgTimestampToTime(row.CreatedAt),
			EditedAt:           pgTimestamptzToTimePtr(row.EditedAt),
			EditCount:          row.EditCount,
			DeletedAt:          pgTimestampToTimePtr(row.DeletedAt),
			IsDeleted:          row.IsDeleted,
			AuthorUsername:     row.AuthorUsername,
			CharacterName:      &row.CharacterName,
			CharacterAvatarUrl: pgTextToStringPtr(row.CharacterAvatarUrl),

			ParentContent:            pgTextToStringPtr(row.ParentContent),
			ParentCreatedAt:          pgTimestampToTimePtr(row.ParentCreatedAt),
			ParentDeletedAt:          pgTimestampToTimePtr(row.ParentDeletedAt),
			ParentIsDeleted:          pgBoolToBoolPtr(row.ParentIsDeleted),
			ParentMessageType:        nullMessageTypeToStringPtr(row.ParentMessageType),
			ParentAuthorUsername:     pgTextToStringPtr(row.ParentAuthorUsername),
			ParentCharacterName:      pgTextToStringPtr(row.ParentCharacterName),
			ParentCharacterAvatarUrl: pgTextToStringPtr(row.ParentCharacterAvatarUrl),
		}
	}

	s.Logger.Info(ctx, "Listed character messages",
		"character_id", characterID,
		"limit", limit,
		"offset", offset,
		"count", len(messages),
	)

	return messages, nil
}

// CountCharacterPostsAndComments returns the total for ListCharacterPostsAndComments
func (s *MessageService) CountCharacterPostsAndComments(ctx context.Context, characterID int32, viewer core.ViewerScope) (int64, error) {
	queries := models.New(s.DB)

	count, err := queries.CountCharacterPostsAndComments(ctx, models.CountCharacterPostsAndCommentsParams{
		CharacterID:   characterID,
		ViewerSeesAll: viewer.SeesAll,
		ViewerUserID:  viewer.UserID,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to count character messages: %w", err)
	}

	return count, nil
}
