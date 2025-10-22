package messages

import (
	"context"
	"fmt"

	models "actionphase/pkg/db/models"
)

// ============================================================================
// Audience Participation Methods (Private Conversation Viewing)
// ============================================================================

// ListAllPrivateConversations lists all private conversations in a game (for audience/GM)
// Returns conversation metadata including message counts and latest activity
func (ms *MessageService) ListAllPrivateConversations(ctx context.Context, gameID int32) ([]models.ListAllPrivateConversationsRow, error) {
	queries := models.New(ms.DB)

	conversations, err := queries.ListAllPrivateConversations(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to list all private conversations: %w", err)
	}

	return conversations, nil
}

// GetAudienceConversationMessages retrieves all messages in a conversation (for audience/GM)
// Returns messages with sender information and character details
func (ms *MessageService) GetAudienceConversationMessages(ctx context.Context, conversationID int32) ([]models.GetAudienceConversationMessagesRow, error) {
	queries := models.New(ms.DB)

	messages, err := queries.GetAudienceConversationMessages(ctx, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation messages: %w", err)
	}

	return messages, nil
}
