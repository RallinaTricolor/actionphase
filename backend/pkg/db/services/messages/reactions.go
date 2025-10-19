package messages

import (
	"context"
	"fmt"

	models "actionphase/pkg/db/models"
)

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
