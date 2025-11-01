package messages

import (
	"context"
	"fmt"
	"log/slog"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	"actionphase/pkg/validation"
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

	// Validate game is not completed/cancelled (archived games are read-only)
	game, err := queries.GetGame(ctx, req.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game: %w", err)
	}

	if err := core.ValidateGameNotCompleted(ctx, &game); err != nil {
		return nil, err
	}

	// Validate character ownership before creating comment
	if err := s.ValidateCharacterOwnership(ctx, req.CharacterID, req.AuthorID, req.GameID); err != nil {
		return nil, fmt.Errorf("character validation failed: %w", err)
	}

	// Validate content length
	if err := validation.ValidateComment(req.Content); err != nil {
		return nil, err
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
			DeletedAt:             comment.DeletedAt,
			DeletedByUserID:       comment.DeletedByUserID,
			EditedAt:              comment.EditedAt,
			EditCount:             comment.EditCount,
		},
		AuthorUsername:     comment.AuthorUsername,
		CharacterName:      comment.CharacterName.String,
		CharacterAvatarUrl: avatarURL,
		ReplyCount:         comment.ReplyCount,
	}, nil
}

// GetMessage retrieves a single message by ID (used for deep linking)
func (s *MessageService) GetMessage(ctx context.Context, messageID int32) (*core.MessageWithDetails, error) {
	queries := models.New(s.DB)

	message, err := queries.GetMessage(ctx, messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to get message: %w", err)
	}

	var avatarURL *string
	if message.CharacterAvatarUrl.Valid {
		avatarURL = &message.CharacterAvatarUrl.String
	}

	result := &core.MessageWithDetails{
		Message: models.Message{
			ID:                    message.ID,
			GameID:                message.GameID,
			PhaseID:               message.PhaseID,
			AuthorID:              message.AuthorID,
			CharacterID:           message.CharacterID,
			Content:               message.Content,
			MessageType:           message.MessageType,
			ParentID:              message.ParentID,
			ThreadDepth:           message.ThreadDepth,
			Visibility:            message.Visibility,
			MentionedCharacterIds: message.MentionedCharacterIds,
			IsEdited:              message.IsEdited,
			IsDeleted:             message.IsDeleted,
			CreatedAt:             message.CreatedAt,
			DeletedAt:             message.DeletedAt,
		},
		AuthorUsername:     message.AuthorUsername,
		CharacterName:      message.CharacterName.String,
		CharacterAvatarUrl: avatarURL,
		ReplyCount:         message.ReplyCount,
	}

	return result, nil
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

	// Get the existing comment to compare mentions
	existingComment, err := queries.GetComment(ctx, commentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing comment: %w", err)
	}

	// Cannot edit deleted comments
	if existingComment.IsDeleted {
		return nil, fmt.Errorf("cannot edit deleted comment")
	}

	// Extract character mentions from new content
	mentionedIDs, err := s.extractCharacterMentions(ctx, content, existingComment.GameID)
	if err != nil {
		// Log error but don't fail the update
		// Mention extraction is a non-critical feature
		slog.Error("Failed to extract mentions during comment update", "error", err, "comment_id", commentID)
		mentionedIDs = []int32{}
	}

	// Update the comment with new content and mentions
	message, err := queries.UpdateComment(ctx, models.UpdateCommentParams{
		ID:                    commentID,
		Content:               content,
		MentionedCharacterIds: mentionedIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update comment: %w", err)
	}

	// Compare old mentions vs new mentions to find newly added ones
	oldMentions := make(map[int32]bool)
	for _, id := range existingComment.MentionedCharacterIds {
		oldMentions[id] = true
	}

	newMentions := make([]int32, 0)
	for _, id := range mentionedIDs {
		if !oldMentions[id] {
			newMentions = append(newMentions, id)
		}
	}

	// Trigger notifications for NEW mentions only (fire-and-forget)
	if len(newMentions) > 0 {
		slog.Info("Comment updated successfully", "comment_id", commentID, "user_id", existingComment.AuthorID, "edit_count", message.EditCount, "new_mentions", len(newMentions))
		go s.notifyCharacterMentions(context.Background(), newMentions, existingComment.CharacterID, existingComment.AuthorID, existingComment.GameID, message.ID)
	} else {
		slog.Info("Comment updated successfully", "comment_id", commentID, "user_id", existingComment.AuthorID, "edit_count", message.EditCount)
	}

	return &message, nil
}

// DeleteComment soft-deletes a comment (preserves thread structure)
// deleterID: the user performing the deletion (could be author, GM, or admin)
func (s *MessageService) DeleteComment(ctx context.Context, commentID int32, deleterID int32) error {
	queries := models.New(s.DB)

	// Check if comment is already deleted
	comment, err := queries.GetComment(ctx, commentID)
	if err != nil {
		return fmt.Errorf("failed to get comment: %w", err)
	}

	if comment.IsDeleted {
		return fmt.Errorf("cannot delete already deleted comment")
	}

	err = queries.DeleteComment(ctx, models.DeleteCommentParams{
		ID:              commentID,
		DeletedByUserID: int32ValueToPgInt4(deleterID),
	})
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

// CanUserEditComment checks if a user can edit a comment (must be author)
func (s *MessageService) CanUserEditComment(ctx context.Context, commentID int32, userID int32) (bool, error) {
	queries := models.New(s.DB)

	comment, err := queries.CheckCommentOwnership(ctx, commentID)
	if err != nil {
		return false, fmt.Errorf("failed to check comment ownership: %w", err)
	}

	// Cannot edit deleted comments
	if comment.DeletedAt.Valid {
		return false, nil
	}

	// Only the author can edit
	return comment.AuthorID == userID, nil
}

// CanUserDeleteComment checks if a user can delete a comment
// Users who can delete: author, GM of the game, or admin (when in admin mode)
func (s *MessageService) CanUserDeleteComment(ctx context.Context, commentID int32, userID int32, isAdmin bool) (bool, error) {
	queries := models.New(s.DB)

	comment, err := queries.CheckCommentOwnership(ctx, commentID)
	if err != nil {
		return false, fmt.Errorf("failed to check comment ownership: %w", err)
	}

	// Cannot delete already deleted comments
	if comment.DeletedAt.Valid {
		return false, nil
	}

	// Author can always delete
	if comment.AuthorID == userID {
		return true, nil
	}

	// Get the full comment to access game_id
	fullComment, err := queries.GetComment(ctx, commentID)
	if err != nil {
		return false, fmt.Errorf("failed to get comment details: %w", err)
	}

	// Check if user is the GM of the game
	game, err := queries.GetGame(ctx, fullComment.GameID)
	if err != nil {
		return false, fmt.Errorf("failed to get game: %w", err)
	}

	if game.GmUserID == userID {
		return true, nil
	}

	// Admin with admin mode enabled can delete
	if isAdmin {
		return true, nil
	}

	return false, nil
}

// ListRecentCommentsWithParents retrieves recent comments with their parent messages/posts
// for the "New Comments" view. Supports pagination via limit/offset.
func (s *MessageService) ListRecentCommentsWithParents(ctx context.Context, gameID int32, limit, offset int32) ([]core.CommentWithParent, error) {
	queries := models.New(s.DB)

	// Call the generated sqlc method
	rows, err := queries.ListRecentCommentsWithParents(ctx, models.ListRecentCommentsWithParentsParams{
		GameID: gameID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list recent comments with parents: %w", err)
	}

	// Convert sqlc generated rows to domain models
	comments := make([]core.CommentWithParent, len(rows))
	for i, row := range rows {
		comments[i] = core.CommentWithParent{
			// Comment data
			ID:             row.ID,
			GameID:         row.GameID,
			ParentID:       pgInt4ToInt32Ptr(row.ParentID),
			AuthorID:       row.AuthorID,
			CharacterID:    row.CharacterID,
			Content:        row.Content,
			CreatedAt:      pgTimestampToTime(row.CreatedAt),
			EditedAt:       pgTimestamptzToTimePtr(row.EditedAt),
			EditCount:      row.EditCount,
			DeletedAt:      pgTimestampToTimePtr(row.DeletedAt),
			IsDeleted:      row.IsDeleted,
			AuthorUsername: row.AuthorUsername,
			CharacterName:  pgTextToStringPtr(row.CharacterName),

			// Parent data
			ParentContent:        pgTextToStringPtr(row.ParentContent),
			ParentCreatedAt:      pgTimestampToTimePtr(row.ParentCreatedAt),
			ParentDeletedAt:      pgTimestampToTimePtr(row.ParentDeletedAt),
			ParentIsDeleted:      pgBoolToBoolPtr(row.ParentIsDeleted),
			ParentMessageType:    nullMessageTypeToStringPtr(row.ParentMessageType),
			ParentAuthorUsername: pgTextToStringPtr(row.ParentAuthorUsername),
			ParentCharacterName:  pgTextToStringPtr(row.ParentCharacterName),
		}
	}

	slog.InfoContext(ctx, "Listed recent comments with parents",
		"game_id", gameID,
		"limit", limit,
		"offset", offset,
		"count", len(comments))

	return comments, nil
}

// GetTotalCommentCount returns the total count of non-deleted comments in a game
func (s *MessageService) GetTotalCommentCount(ctx context.Context, gameID int32) (int64, error) {
	queries := models.New(s.DB)

	count, err := queries.GetTotalCommentCount(ctx, gameID)
	if err != nil {
		return 0, fmt.Errorf("failed to get total comment count: %w", err)
	}

	return count, nil
}
