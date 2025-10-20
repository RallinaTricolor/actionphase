package db

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ConversationService handles private messaging operations
type ConversationService struct {
	DB      *pgxpool.Pool
	Queries *models.Queries
}

// NewConversationService creates a new conversation service
func NewConversationService(db *pgxpool.Pool) *ConversationService {
	return &ConversationService{
		DB:      db,
		Queries: models.New(db),
	}
}

// CreateConversationRequest represents a request to create a new conversation
type CreateConversationRequest struct {
	GameID          int32
	Title           string
	CreatedByUserID int32
	ParticipantIDs  []int32 // Character IDs
}

// ConversationWithDetails includes conversation metadata
type ConversationWithDetails struct {
	Conversation  models.Conversation
	Participants  []models.GetConversationParticipantsRow
	MessageCount  int
	UnreadCount   int
	LastMessageAt *time.Time
}

// CreateConversation creates a new conversation with participants
// All participants must be characters (or GM)
func (s *ConversationService) CreateConversation(ctx context.Context, req CreateConversationRequest) (*models.Conversation, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.Queries.WithTx(tx)

	// Create conversation
	var title pgtype.Text
	if req.Title != "" {
		title = pgtype.Text{String: req.Title, Valid: true}
	}

	// Determine conversation type based on participant count
	// "direct" for 2 participants, "group" for 3+
	conversationType := "group"
	if len(req.ParticipantIDs) == 2 {
		conversationType = "direct"
	}

	conv, err := qtx.CreateConversation(ctx, models.CreateConversationParams{
		GameID:           req.GameID,
		ConversationType: conversationType,
		Title:            title,
		CreatedByUserID:  req.CreatedByUserID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create conversation: %w", err)
	}

	// Add all participants (characters)
	for _, charID := range req.ParticipantIDs {
		// Get character to find the user_id
		char, err := qtx.GetCharacter(ctx, charID)
		if err != nil {
			return nil, fmt.Errorf("failed to get character %d: %w", charID, err)
		}

		// For NPCs without a user_id, use the GM's user_id
		var participantUserID int32
		if !char.UserID.Valid {
			// Get the game to find the GM
			game, err := qtx.GetGame(ctx, req.GameID)
			if err != nil {
				return nil, fmt.Errorf("failed to get game: %w", err)
			}
			participantUserID = game.GmUserID
		} else {
			participantUserID = char.UserID.Int32
		}

		_, err = qtx.AddConversationParticipant(ctx, models.AddConversationParticipantParams{
			ConversationID: conv.ID,
			UserID:         participantUserID,
			CharacterID:    pgtype.Int4{Int32: charID, Valid: true},
		})
		if err != nil {
			return nil, fmt.Errorf("failed to add participant: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &conv, nil
}

// GetOrCreateConversation finds an existing conversation between characters or creates a new one
func (s *ConversationService) GetOrCreateConversation(ctx context.Context, gameID int32, characterIDs []int32, createdByUserID int32, title string) (*models.Conversation, error) {
	// For now, only support 1-on-1 conversations for finding existing ones
	// Group conversations will always be created new
	if len(characterIDs) == 2 {
		// Try to find existing conversation between these two characters
		char1, err := s.Queries.GetCharacter(ctx, characterIDs[0])
		if err == nil && char1.UserID.Valid {
			char2, err := s.Queries.GetCharacter(ctx, characterIDs[1])
			if err == nil && char2.UserID.Valid {
				// Try to find existing conversation
				// Note: This query needs to be added to communications.sql if not present
				// For now, just create a new one
			}
		}
	}

	// Create new conversation
	return s.CreateConversation(ctx, CreateConversationRequest{
		GameID:          gameID,
		Title:           title,
		CreatedByUserID: createdByUserID,
		ParticipantIDs:  characterIDs,
	})
}

// GetUserConversations gets all conversations for a user in a game
func (s *ConversationService) GetUserConversations(ctx context.Context, gameID int32, userID int32) ([]models.GetUserConversationsRow, error) {
	conversations, err := s.Queries.GetUserConversations(ctx, models.GetUserConversationsParams{
		GmUserID: userID, // Note: This is actually the current user ID, used both for filtering and GM check
		GameID:   gameID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user conversations: %w", err)
	}

	return conversations, nil
}

// GetConversationParticipants gets all participants in a conversation
func (s *ConversationService) GetConversationParticipants(ctx context.Context, conversationID int32) ([]models.GetConversationParticipantsRow, error) {
	participants, err := s.Queries.GetConversationParticipants(ctx, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation participants: %w", err)
	}

	return participants, nil
}

// SendMessageRequest represents a request to send a message
type SendMessageRequest struct {
	ConversationID    int32
	SenderUserID      int32
	SenderCharacterID int32
	Content           string
}

// SendMessage sends a message in a conversation
func (s *ConversationService) SendMessage(ctx context.Context, req SendMessageRequest) (*models.PrivateMessage, error) {
	// Verify sender is a participant
	isParticipant, err := s.Queries.IsUserInConversation(ctx, models.IsUserInConversationParams{
		ConversationID: req.ConversationID,
		UserID:         req.SenderUserID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to check participation: %w", err)
	}
	if !isParticipant {
		return nil, fmt.Errorf("user is not a participant in this conversation")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.Queries.WithTx(tx)

	// Send message
	msg, err := qtx.SendPrivateMessage(ctx, models.SendPrivateMessageParams{
		ConversationID:    req.ConversationID,
		SenderUserID:      req.SenderUserID,
		SenderCharacterID: pgtype.Int4{Int32: req.SenderCharacterID, Valid: req.SenderCharacterID != 0},
		Content:           req.Content,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	// Update conversation activity timestamp
	if err := qtx.UpdateConversationActivity(ctx, req.ConversationID); err != nil {
		return nil, fmt.Errorf("failed to update conversation activity: %w", err)
	}

	// Mark conversation as read for the sender (they just sent a message, so they've "read" it)
	if _, err := qtx.UpsertConversationRead(ctx, models.UpsertConversationReadParams{
		UserID:         req.SenderUserID,
		ConversationID: req.ConversationID,
		LastReadMessageID: pgtype.Int4{
			Int32: msg.ID,
			Valid: true,
		},
	}); err != nil {
		return nil, fmt.Errorf("failed to mark conversation as read for sender: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Trigger notifications for all participants except sender (fire-and-forget)
	go s.notifyPrivateMessage(context.Background(), req.ConversationID, req.SenderUserID, req.SenderCharacterID, msg.ID)

	return &msg, nil
}

// GetConversationMessages gets all messages in a conversation
func (s *ConversationService) GetConversationMessages(ctx context.Context, conversationID int32, userID int32) ([]models.GetConversationMessagesRow, error) {
	// Verify user is a participant
	isParticipant, err := s.Queries.IsUserInConversation(ctx, models.IsUserInConversationParams{
		ConversationID: conversationID,
		UserID:         userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to check participation: %w", err)
	}
	if !isParticipant {
		return nil, fmt.Errorf("user is not a participant in this conversation")
	}

	messages, err := s.Queries.GetConversationMessages(ctx, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation messages: %w", err)
	}

	return messages, nil
}

// MarkConversationAsRead marks all messages in a conversation as read for a user
func (s *ConversationService) MarkConversationAsRead(ctx context.Context, conversationID int32, userID int32) error {
	// Verify user is a participant
	isParticipant, err := s.Queries.IsUserInConversation(ctx, models.IsUserInConversationParams{
		ConversationID: conversationID,
		UserID:         userID,
	})
	if err != nil {
		return fmt.Errorf("failed to check participation: %w", err)
	}
	if !isParticipant {
		return fmt.Errorf("user is not a participant in this conversation")
	}

	// Get all messages in the conversation (ordered by created_at)
	messages, err := s.Queries.GetConversationMessages(ctx, conversationID)
	if err != nil {
		return fmt.Errorf("failed to get messages: %w", err)
	}

	// If no messages, nothing to mark as read
	if len(messages) == 0 {
		return nil
	}

	// Get the latest message (last in the slice since they're ordered by created_at ASC)
	lastMessageID := messages[len(messages)-1].ID

	// Mark conversation as read up to the latest message
	_, err = s.MarkConversationRead(ctx, userID, conversationID, lastMessageID)
	if err != nil {
		return fmt.Errorf("failed to mark conversation as read: %w", err)
	}

	return nil
}

// GetUnreadMessageCount gets the count of unread messages for a user in a conversation
func (s *ConversationService) GetUnreadMessageCount(ctx context.Context, conversationID int32, userID int32) (int64, error) {
	count, err := s.Queries.GetUnreadMessageCount(ctx, models.GetUnreadMessageCountParams{
		UserID:         userID,
		ConversationID: conversationID,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}

	return count, nil
}

// AddParticipant adds a character to an existing conversation
func (s *ConversationService) AddParticipant(ctx context.Context, conversationID int32, characterID int32) error {
	// Get character to find the user_id
	char, err := s.Queries.GetCharacter(ctx, characterID)
	if err != nil {
		return fmt.Errorf("failed to get character: %w", err)
	}

	// For NPCs without a user_id, use the GM's user_id
	var participantUserID int32
	if !char.UserID.Valid {
		// Get the game via conversation
		conv, err := s.Queries.GetConversation(ctx, conversationID)
		if err != nil {
			return fmt.Errorf("failed to get conversation: %w", err)
		}
		game, err := s.Queries.GetGame(ctx, conv.GameID)
		if err != nil {
			return fmt.Errorf("failed to get game: %w", err)
		}
		participantUserID = game.GmUserID
	} else {
		participantUserID = char.UserID.Int32
	}

	_, err = s.Queries.AddConversationParticipant(ctx, models.AddConversationParticipantParams{
		ConversationID: conversationID,
		UserID:         participantUserID,
		CharacterID:    pgtype.Int4{Int32: characterID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to add participant: %w", err)
	}

	return nil
}

// notifyPrivateMessage triggers notifications for all conversation participants except the sender
// This runs in a goroutine and should not fail the parent operation
func (s *ConversationService) notifyPrivateMessage(ctx context.Context, conversationID, senderUserID, senderCharacterID int32, messageID int32) {
	notificationService := &NotificationService{DB: s.DB}

	// Get conversation details to find game_id
	conv, err := s.Queries.GetConversation(ctx, conversationID)
	if err != nil {
		slog.Error("Failed to get conversation for notifications", "error", err, "conversation_id", conversationID)
		return
	}

	// Get sender character name
	senderCharName := "Unknown"
	if senderCharacterID != 0 {
		senderChar, err := s.Queries.GetCharacter(ctx, senderCharacterID)
		if err == nil {
			senderCharName = senderChar.Name
		}
	}

	// Get all participants
	participants, err := s.Queries.GetConversationParticipants(ctx, conversationID)
	if err != nil {
		slog.Error("Failed to get conversation participants for notifications", "error", err, "conversation_id", conversationID)
		return
	}

	// Notify each participant except the sender
	for _, participant := range participants {
		if participant.UserID == senderUserID {
			continue // Don't notify the sender
		}

		err = notificationService.NotifyPrivateMessage(
			ctx,
			participant.UserID,
			messageID,
			conv.GameID,
			senderCharName,
		)
		if err != nil {
			slog.Error("Failed to send private message notification", "error", err, "recipient_user_id", participant.UserID)
		}
	}
}

// MarkConversationRead marks messages in a conversation as read up to a specific message
func (s *ConversationService) MarkConversationRead(ctx context.Context, userID int32, conversationID int32, lastReadMessageID int32) (*models.ConversationRead, error) {
	read, err := s.Queries.UpsertConversationRead(ctx, models.UpsertConversationReadParams{
		UserID:            userID,
		ConversationID:    conversationID,
		LastReadMessageID: pgtype.Int4{Int32: lastReadMessageID, Valid: true},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to mark conversation as read: %w", err)
	}

	return &read, nil
}

// GetConversationUnreadCount returns the number of unread messages in a conversation for a user
func (s *ConversationService) GetConversationUnreadCount(ctx context.Context, userID int32, conversationID int32) (int64, error) {
	count, err := s.Queries.GetConversationUnreadCount(ctx, models.GetConversationUnreadCountParams{
		ConversationID: conversationID,
		UserID:         userID,
	})

	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}

	return count, nil
}

// GetFirstUnreadMessageID returns the ID of the first unread message in a conversation for a user
func (s *ConversationService) GetFirstUnreadMessageID(ctx context.Context, userID int32, conversationID int32) (*int32, error) {
	messageID, err := s.Queries.GetFirstUnreadMessageID(ctx, models.GetFirstUnreadMessageIDParams{
		ConversationID: conversationID,
		UserID:         userID,
	})

	if err != nil {
		// No unread messages is not an error
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get first unread message: %w", err)
	}

	return &messageID, nil
}

// GetUserConversationRead returns the read tracking info for a user and conversation
func (s *ConversationService) GetUserConversationRead(ctx context.Context, userID int32, conversationID int32) (*models.ConversationRead, error) {
	read, err := s.Queries.GetUserConversationRead(ctx, models.GetUserConversationReadParams{
		UserID:         userID,
		ConversationID: conversationID,
	})

	if err != nil {
		// No read marker is not an error - user hasn't read anything yet
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get conversation read info: %w", err)
	}

	return &read, nil
}
