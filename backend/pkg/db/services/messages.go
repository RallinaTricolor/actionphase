package db

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// Compile-time verification that MessageService implements MessageServiceInterface
var _ core.MessageServiceInterface = (*MessageService)(nil)

// MessageService handles message and comment operations for the Common Room and private messaging.
// All messages must be sent as characters and are associated with a game.
type MessageService struct {
	DB *pgxpool.Pool
}

// Helper function to convert *int32 to pgtype.Int4
func int32ToPgInt4(val *int32) pgtype.Int4 {
	if val == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *val, Valid: true}
}

// Helper function to convert int32 to pgtype.Int4
func int32ValueToPgInt4(val int32) pgtype.Int4 {
	return pgtype.Int4{Int32: val, Valid: true}
}

// CreatePost creates a new top-level message post
func (s *MessageService) CreatePost(ctx context.Context, req core.CreatePostRequest) (*models.Message, error) {
	queries := models.New(s.DB)

	// Validate character ownership before creating post
	if err := s.ValidateCharacterOwnership(ctx, req.CharacterID, req.AuthorID, req.GameID); err != nil {
		return nil, fmt.Errorf("character validation failed: %w", err)
	}

	// Extract character mentions from content
	mentionedIDs, err := s.extractCharacterMentions(ctx, req.Content, req.GameID)
	if err != nil {
		// Log error but don't fail the post creation
		// Mention extraction is a non-critical feature
		mentionedIDs = []int32{}
	}

	// Create the post using sqlc-generated query
	message, err := queries.CreatePost(ctx, models.CreatePostParams{
		GameID:                req.GameID,
		PhaseID:               int32ToPgInt4(req.PhaseID),
		AuthorID:              req.AuthorID,
		CharacterID:           req.CharacterID,
		Content:               req.Content,
		Visibility:            models.MessageVisibility(req.Visibility),
		MentionedCharacterIds: mentionedIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create post: %w", err)
	}

	// Trigger notifications for character mentions (fire-and-forget)
	if len(mentionedIDs) > 0 {
		go s.notifyCharacterMentions(context.Background(), mentionedIDs, req.CharacterID, req.AuthorID, req.GameID, message.ID)
	}

	return &message, nil
}

// GetRecursiveCommentCount counts all descendant comments recursively
func (s *MessageService) GetRecursiveCommentCount(ctx context.Context, parentID int32) (int64, error) {
	queries := models.New(s.DB)

	descendants, err := queries.GetAllDescendantComments(ctx, int32ValueToPgInt4(parentID))
	if err != nil {
		return 0, fmt.Errorf("failed to count descendants: %w", err)
	}

	return int64(len(descendants)), nil
}

// GetPost retrieves a specific post by ID with metadata
func (s *MessageService) GetPost(ctx context.Context, postID int32) (*core.MessageWithDetails, error) {
	queries := models.New(s.DB)

	post, err := queries.GetPost(ctx, postID)
	if err != nil {
		return nil, fmt.Errorf("failed to get post: %w", err)
	}

	// Get recursive comment count
	totalComments, err := s.GetRecursiveCommentCount(ctx, postID)
	if err != nil {
		return nil, fmt.Errorf("failed to get comment count: %w", err)
	}

	return &core.MessageWithDetails{
		Message: models.Message{
			ID:          post.ID,
			GameID:      post.GameID,
			PhaseID:     post.PhaseID,
			AuthorID:    post.AuthorID,
			CharacterID: post.CharacterID,
			Content:     post.Content,
			MessageType: post.MessageType,
			ParentID:    post.ParentID,
			ThreadDepth: post.ThreadDepth,
			Visibility:  post.Visibility,
			IsEdited:    post.IsEdited,
			IsDeleted:   post.IsDeleted,
			CreatedAt:   post.CreatedAt,
			UpdatedAt:   post.UpdatedAt,
			DeletedAt:   post.DeletedAt,
		},
		AuthorUsername: post.AuthorUsername,
		CharacterName:  post.CharacterName.String,
		CommentCount:   totalComments,
	}, nil
}

// GetGamePosts retrieves posts for a game, optionally filtered by phase
func (s *MessageService) GetGamePosts(ctx context.Context, gameID int32, phaseID *int32, limit, offset int32) ([]core.MessageWithDetails, error) {
	queries := models.New(s.DB)

	// Convert phaseID to int32 for use with Column2 parameter
	// If nil, pass 0 to get all posts (CASE WHEN 0 THEN TRUE)
	phaseIDValue := int32(0)
	if phaseID != nil {
		phaseIDValue = *phaseID
	}

	posts, err := queries.GetGamePosts(ctx, models.GetGamePostsParams{
		GameID:  gameID,
		Column2: phaseIDValue,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get game posts: %w", err)
	}

	result := make([]core.MessageWithDetails, len(posts))
	for i, post := range posts {
		// Get recursive comment count for this post
		totalComments, err := s.GetRecursiveCommentCount(ctx, post.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get comment count for post %d: %w", post.ID, err)
		}

		result[i] = core.MessageWithDetails{
			Message: models.Message{
				ID:                    post.ID,
				GameID:                post.GameID,
				PhaseID:               post.PhaseID,
				AuthorID:              post.AuthorID,
				CharacterID:           post.CharacterID,
				Content:               post.Content,
				MessageType:           post.MessageType,
				ParentID:              post.ParentID,
				ThreadDepth:           post.ThreadDepth,
				Visibility:            post.Visibility,
				MentionedCharacterIds: post.MentionedCharacterIds,
				IsEdited:              post.IsEdited,
				IsDeleted:             post.IsDeleted,
				CreatedAt:             post.CreatedAt,
				UpdatedAt:             post.UpdatedAt,
				DeletedAt:             post.DeletedAt,
			},
			AuthorUsername: post.AuthorUsername,
			CharacterName:  post.CharacterName.String,
			CommentCount:   totalComments,
		}
	}

	return result, nil
}

// GetPhasePosts retrieves all posts for a specific phase
func (s *MessageService) GetPhasePosts(ctx context.Context, phaseID int32) ([]core.MessageWithDetails, error) {
	queries := models.New(s.DB)

	posts, err := queries.GetPhasePosts(ctx, int32ValueToPgInt4(phaseID))
	if err != nil {
		return nil, fmt.Errorf("failed to get phase posts: %w", err)
	}

	result := make([]core.MessageWithDetails, len(posts))
	for i, post := range posts {
		result[i] = core.MessageWithDetails{
			Message: models.Message{
				ID:          post.ID,
				GameID:      post.GameID,
				PhaseID:     post.PhaseID,
				AuthorID:    post.AuthorID,
				CharacterID: post.CharacterID,
				Content:     post.Content,
				MessageType: post.MessageType,
				ParentID:    post.ParentID,
				ThreadDepth: post.ThreadDepth,
				Visibility:  post.Visibility,
				IsEdited:    post.IsEdited,
				IsDeleted:   post.IsDeleted,
				CreatedAt:   post.CreatedAt,
				UpdatedAt:   post.UpdatedAt,
				DeletedAt:   post.DeletedAt,
			},
			AuthorUsername: post.AuthorUsername,
			CharacterName:  post.CharacterName.String,
			CommentCount:   post.CommentCount,
		}
	}

	return result, nil
}

// UpdatePost updates the content of an existing post
func (s *MessageService) UpdatePost(ctx context.Context, postID int32, content string) (*models.Message, error) {
	queries := models.New(s.DB)

	message, err := queries.UpdatePost(ctx, models.UpdatePostParams{
		ID:      postID,
		Content: content,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update post: %w", err)
	}

	return &message, nil
}

// DeletePost soft-deletes a post (preserves thread structure)
func (s *MessageService) DeletePost(ctx context.Context, postID int32) error {
	queries := models.New(s.DB)

	_, err := queries.DeletePost(ctx, postID)
	if err != nil {
		return fmt.Errorf("failed to delete post: %w", err)
	}

	return nil
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
		AuthorUsername: comment.AuthorUsername,
		CharacterName:  comment.CharacterName.String,
		ReplyCount:     comment.ReplyCount,
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
			AuthorUsername: comment.AuthorUsername,
			CharacterName:  comment.CharacterName.String,
			ReplyCount:     comment.ReplyCount,
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

// GetGamePostCount returns total post count for a game
func (s *MessageService) GetGamePostCount(ctx context.Context, gameID int32, phaseID *int32) (int64, error) {
	queries := models.New(s.DB)

	// Convert phaseID to int32 for use with Column2 parameter
	// If nil, pass 0 to get all posts (CASE WHEN 0 THEN TRUE)
	phaseIDValue := int32(0)
	if phaseID != nil {
		phaseIDValue = *phaseID
	}

	count, err := queries.GetGamePostCount(ctx, models.GetGamePostCountParams{
		GameID:  gameID,
		Column2: phaseIDValue,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to get game post count: %w", err)
	}

	return count, nil
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

// GetUserPostsInGame retrieves all posts by a user in a game
func (s *MessageService) GetUserPostsInGame(ctx context.Context, gameID, userID int32) ([]core.MessageWithDetails, error) {
	queries := models.New(s.DB)

	posts, err := queries.GetUserPostsInGame(ctx, models.GetUserPostsInGameParams{
		GameID:   gameID,
		AuthorID: userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user posts in game: %w", err)
	}

	result := make([]core.MessageWithDetails, len(posts))
	for i, post := range posts {
		result[i] = core.MessageWithDetails{
			Message: models.Message{
				ID:          post.ID,
				GameID:      post.GameID,
				PhaseID:     post.PhaseID,
				AuthorID:    post.AuthorID,
				CharacterID: post.CharacterID,
				Content:     post.Content,
				MessageType: post.MessageType,
				ParentID:    post.ParentID,
				ThreadDepth: post.ThreadDepth,
				Visibility:  post.Visibility,
				IsEdited:    post.IsEdited,
				IsDeleted:   post.IsDeleted,
				CreatedAt:   post.CreatedAt,
				UpdatedAt:   post.UpdatedAt,
				DeletedAt:   post.DeletedAt,
			},
			AuthorUsername: post.AuthorUsername,
			CharacterName:  post.CharacterName.String,
			CommentCount:   post.CommentCount,
		}
	}

	return result, nil
}

// AddReaction adds a reaction to a message
func (s *MessageService) AddReaction(ctx context.Context, messageID, userID int32, reactionType string) (*models.MessageReaction, error) {
	queries := models.New(s.DB)

	reaction, err := queries.AddReaction(ctx, models.AddReactionParams{
		MessageID:    messageID,
		UserID:       userID,
		ReactionType: reactionType,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to add reaction: %w", err)
	}

	return &reaction, nil
}

// RemoveReaction removes a reaction from a message
func (s *MessageService) RemoveReaction(ctx context.Context, messageID, userID int32, reactionType string) error {
	queries := models.New(s.DB)

	err := queries.RemoveReaction(ctx, models.RemoveReactionParams{
		MessageID:    messageID,
		UserID:       userID,
		ReactionType: reactionType,
	})
	if err != nil {
		return fmt.Errorf("failed to remove reaction: %w", err)
	}

	return nil
}

// GetMessageReactions retrieves all reactions for a message
func (s *MessageService) GetMessageReactions(ctx context.Context, messageID int32) ([]models.GetMessageReactionsRow, error) {
	queries := models.New(s.DB)

	reactions, err := queries.GetMessageReactions(ctx, messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to get message reactions: %w", err)
	}

	return reactions, nil
}

// GetReactionCounts retrieves reaction counts grouped by type
func (s *MessageService) GetReactionCounts(ctx context.Context, messageID int32) ([]models.GetReactionCountsRow, error) {
	queries := models.New(s.DB)

	counts, err := queries.GetReactionCounts(ctx, messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to get reaction counts: %w", err)
	}

	return counts, nil
}

// ValidateCharacterOwnership verifies character belongs to author and game
func (s *MessageService) ValidateCharacterOwnership(ctx context.Context, characterID, authorID, gameID int32) error {
	queries := models.New(s.DB)

	// Get the character to verify ownership
	character, err := queries.GetCharacter(ctx, characterID)
	if err != nil {
		return fmt.Errorf("character not found: %w", err)
	}

	// Verify character belongs to the game
	if character.GameID != gameID {
		return errors.New("character does not belong to this game")
	}

	// Check if this is a player character owned by the author
	if character.UserID.Valid && character.UserID.Int32 == authorID {
		return nil
	}

	// Check if this is an NPC (GM or audience controlled)
	if character.CharacterType == "npc_gm" || character.CharacterType == "npc_audience" {
		// Check if user is assigned to this NPC
		assignment, err := queries.GetNPCAssignment(ctx, characterID)
		if err == nil && assignment.AssignedUserID == authorID {
			return nil
		}

		// Check if user is the GM (GMs can post as any NPC, even assigned ones, for emergency situations)
		game, err := queries.GetGame(ctx, gameID)
		if err != nil {
			return fmt.Errorf("failed to get game: %w", err)
		}

		if game.GmUserID == authorID {
			// GM can always post as any NPC in their game
			return nil
		}
	}

	return errors.New("character does not belong to this user")
}

// notifyCharacterMentions triggers notifications for all characters mentioned in a message
// This runs in a goroutine and should not fail the parent operation
func (s *MessageService) notifyCharacterMentions(ctx context.Context, mentionedCharacterIDs []int32, authorCharacterID, authorUserID, gameID, messageID int32) {
	if len(mentionedCharacterIDs) == 0 {
		return
	}

	queries := models.New(s.DB)
	notificationService := &NotificationService{DB: s.DB}

	// Get the author character's name
	authorChar, err := queries.GetCharacter(ctx, authorCharacterID)
	if err != nil {
		slog.Error("Failed to get author character for mention notifications", "error", err, "character_id", authorCharacterID)
		return
	}

	// For each mentioned character, notify the owner
	for _, mentionedCharID := range mentionedCharacterIDs {
		mentionedChar, err := queries.GetCharacter(ctx, mentionedCharID)
		if err != nil {
			slog.Error("Failed to get mentioned character", "error", err, "character_id", mentionedCharID)
			continue
		}

		// Don't notify if user is mentioning their own character
		var characterOwnerID int32
		if mentionedChar.UserID.Valid {
			characterOwnerID = mentionedChar.UserID.Int32
		} else {
			// NPC - notify the GM
			game, err := queries.GetGame(ctx, gameID)
			if err != nil {
				slog.Error("Failed to get game for NPC mention notification", "error", err, "game_id", gameID)
				continue
			}
			characterOwnerID = game.GmUserID
		}

		// Skip if author is the character owner (don't notify self)
		if characterOwnerID == authorUserID {
			continue
		}

		// Trigger notification
		err = notificationService.NotifyCharacterMention(
			ctx,
			characterOwnerID,
			messageID,
			gameID,
			authorChar.Name,
			mentionedChar.Name,
		)
		if err != nil {
			slog.Error("Failed to send character mention notification", "error", err, "mentioned_character_id", mentionedCharID)
		}
	}
}

// notifyCommentReply triggers a notification when someone replies to a comment
// This runs in a goroutine and should not fail the parent operation
func (s *MessageService) notifyCommentReply(ctx context.Context, parentMessageID, replierCharacterID, replierUserID, gameID, replyMessageID int32) {
	queries := models.New(s.DB)
	notificationService := &NotificationService{DB: s.DB}

	// Get the parent message
	parentMessage, err := queries.GetComment(ctx, parentMessageID)
	if err != nil {
		slog.Error("Failed to get parent message for reply notification", "error", err, "parent_id", parentMessageID)
		return
	}

	// Don't notify if replying to own comment
	if parentMessage.AuthorID == replierUserID {
		return
	}

	// Get the replier character's name
	replierChar, err := queries.GetCharacter(ctx, replierCharacterID)
	if err != nil {
		slog.Error("Failed to get replier character", "error", err, "character_id", replierCharacterID)
		return
	}

	// Trigger notification to the parent comment author
	err = notificationService.NotifyCommentReply(
		ctx,
		parentMessage.AuthorID,
		replyMessageID,
		gameID,
		replierChar.Name,
	)
	if err != nil {
		slog.Error("Failed to send comment reply notification", "error", err, "parent_author_id", parentMessage.AuthorID)
	}
}
