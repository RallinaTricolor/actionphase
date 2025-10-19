package messages

import (
	"context"
	"fmt"
	"log/slog"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// GetRecursiveCommentCount counts all descendant comments recursively
func (s *MessageService) GetRecursiveCommentCount(ctx context.Context, parentID int32) (int64, error) {
	queries := models.New(s.DB)

	descendants, err := queries.GetAllDescendantComments(ctx, int32ValueToPgInt4(parentID))
	if err != nil {
		return 0, fmt.Errorf("failed to count descendants: %w", err)
	}

	return int64(len(descendants)), nil
}

// CreateComment creates a comment reply to a post or another comment
func (s *MessageService) CreateComment(ctx context.Context, req core.CreateCommentRequest) (*models.Message, error) {
	queries := models.New(s.DB)

	// Validate character ownership before creating comment
	if err := s.ValidateCharacterOwnership(ctx, req.CharacterID, req.AuthorID, req.GameID); err != nil {
		return nil, fmt.Errorf("character validation failed: %w", err)
	}

	// Extract character mentions from content
	mentionedIDs, err := s.extractCharacterMentions(ctx, req.Content, req.GameID)
	if err != nil {
		// Log error but don't fail the comment creation
		// Mention extraction is a non-critical feature
		slog.Error("Failed to extract mentions", "error", err, "content", req.Content)
		mentionedIDs = []int32{}
	}

	// Create the comment using sqlc-generated query
	message, err := queries.CreateComment(ctx, models.CreateCommentParams{
		GameID:                req.GameID,
		PhaseID:               int32ToPgInt4(req.PhaseID),
		AuthorID:              req.AuthorID,
		CharacterID:           req.CharacterID,
		Content:               req.Content,
		ParentID:              int32ValueToPgInt4(req.ParentID),
		Visibility:            models.MessageVisibility(req.Visibility),
		MentionedCharacterIds: mentionedIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create comment: %w", err)
	}

	// Trigger notifications for character mentions (fire-and-forget)
	if len(mentionedIDs) > 0 {
		go s.notifyCharacterMentions(context.Background(), mentionedIDs, req.CharacterID, req.AuthorID, req.GameID, message.ID)
	}

	// Trigger notification for comment reply (fire-and-forget)
	go s.notifyCommentReply(context.Background(), req.ParentID, req.CharacterID, req.AuthorID, req.GameID, message.ID)

	return &message, nil
}

// GetComment retrieves a specific comment by ID with metadata
func (s *MessageService) GetComment(ctx context.Context, commentID int32) (*core.MessageWithDetails, error) {
	queries := models.New(s.DB)

	comment, err := queries.GetComment(ctx, commentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get comment: %w", err)
	}

	var avatarURL *string
	if comment.CharacterAvatarUrl.Valid {
		avatarURL = &comment.CharacterAvatarUrl.String
	}

	return &core.MessageWithDetails{
		Message: models.Message{
			ID:          comment.ID,
			GameID:      comment.GameID,
			PhaseID:     comment.PhaseID,
			AuthorID:    comment.AuthorID,
			CharacterID: comment.CharacterID,
			Content:     comment.Content,
			MessageType: comment.MessageType,
			ParentID:    comment.ParentID,
			ThreadDepth: comment.ThreadDepth,
			Visibility:  comment.Visibility,
			IsEdited:    comment.IsEdited,
			IsDeleted:   comment.IsDeleted,
			CreatedAt:   comment.CreatedAt,
			UpdatedAt:   comment.UpdatedAt,
			DeletedAt:   comment.DeletedAt,
		},
		AuthorUsername:     comment.AuthorUsername,
		CharacterName:      comment.CharacterName.String,
		CharacterAvatarUrl: avatarURL,
		ReplyCount:         comment.ReplyCount,
	}, nil
}

// GetPostComments retrieves direct child comments for a post or comment
func (s *MessageService) GetPostComments(ctx context.Context, parentID int32) ([]core.MessageWithDetails, error) {
	queries := models.New(s.DB)

	comments, err := queries.GetPostComments(ctx, int32ValueToPgInt4(parentID))
	if err != nil {
		return nil, fmt.Errorf("failed to get post comments: %w", err)
	}

	result := make([]core.MessageWithDetails, len(comments))
	for i, comment := range comments {
		slog.Info("GetPostComments conversion", "comment_id", comment.ID, "mentioned_ids", comment.MentionedCharacterIds)
		var avatarURL *string
		if comment.CharacterAvatarUrl.Valid {
			avatarURL = &comment.CharacterAvatarUrl.String
		}
		result[i] = core.MessageWithDetails{
			Message: models.Message{
				ID:                    comment.ID,
				GameID:                comment.GameID,
				PhaseID:               comment.PhaseID,
				AuthorID:              comment.AuthorID,
				CharacterID:           comment.CharacterID,
				Content:               comment.Content,
				MessageType:           comment.MessageType,
				ParentID:              comment.ParentID,
				ThreadDepth:           comment.ThreadDepth,
				Visibility:            comment.Visibility,
				MentionedCharacterIds: comment.MentionedCharacterIds,
				IsEdited:              comment.IsEdited,
				IsDeleted:             comment.IsDeleted,
				CreatedAt:             comment.CreatedAt,
				UpdatedAt:             comment.UpdatedAt,
				DeletedAt:             comment.DeletedAt,
			},
			AuthorUsername:     comment.AuthorUsername,
			CharacterName:      comment.CharacterName.String,
			CharacterAvatarUrl: avatarURL,
			ReplyCount:         comment.ReplyCount,
		}
		slog.Info("GetPostComments result", "comment_id", result[i].ID, "mentioned_ids", result[i].MentionedCharacterIds)
	}

	return result, nil
}

// UpdateComment updates the content of an existing comment
func (s *MessageService) UpdateComment(ctx context.Context, commentID int32, content string) (*models.Message, error) {
	queries := models.New(s.DB)

	message, err := queries.UpdateComment(ctx, models.UpdateCommentParams{
		ID:      commentID,
		Content: content,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update comment: %w", err)
	}

	return &message, nil
}

// DeleteComment soft-deletes a comment (preserves thread structure)
func (s *MessageService) DeleteComment(ctx context.Context, commentID int32) error {
	queries := models.New(s.DB)

	_, err := queries.DeleteComment(ctx, commentID)
	if err != nil {
		return fmt.Errorf("failed to delete comment: %w", err)
	}

	return nil
}

// GetPostCommentCount returns total comment count for a post
func (s *MessageService) GetPostCommentCount(ctx context.Context, postID int32) (int64, error) {
	queries := models.New(s.DB)

	count, err := queries.GetPostCommentCount(ctx, int32ValueToPgInt4(postID))
	if err != nil {
		return 0, fmt.Errorf("failed to get post comment count: %w", err)
	}

	return count, nil
}
