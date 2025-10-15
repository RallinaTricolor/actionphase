package conversations

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// Handler handles HTTP requests for conversations
type Handler struct {
	App *core.App
}

// Helper function to get user ID from JWT token
func getUserIDFromToken(r *http.Request, app *core.App) (int32, string, error) {
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		return 0, "", fmt.Errorf("no valid token found")
	}

	username, ok := token.Get("username")
	if !ok {
		return 0, "", fmt.Errorf("username not found in token")
	}

	userService := &db.UserService{DB: app.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		return 0, "", fmt.Errorf("user not found: %w", err)
	}

	return int32(user.ID), username.(string), nil
}

// RegisterRoutes registers all conversation routes
// Note: This is called from within the games router, so gameId is already in the path context
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/{gameId}/conversations", func(r chi.Router) {
		r.Post("/", h.CreateConversation)                              // Create new conversation
		r.Get("/", h.GetUserConversations)                             // Get user's conversations
		r.Get("/{conversationId}", h.GetConversation)                  // Get conversation details
		r.Get("/{conversationId}/messages", h.GetConversationMessages) // Get messages
		r.Post("/{conversationId}/messages", h.SendMessage)            // Send message
		r.Post("/{conversationId}/read", h.MarkAsRead)                 // Mark as read
		r.Post("/{conversationId}/participants", h.AddParticipant)     // Add participant
	})
}

// CreateConversationRequest represents the request body for creating a conversation
type CreateConversationRequest struct {
	Title        string  `json:"title"`
	CharacterIDs []int32 `json:"character_ids"` // Characters participating
}

func (r *CreateConversationRequest) Bind(req *http.Request) error {
	return nil
}

// CreateConversation creates a new conversation
func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, _, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &CreateConversationRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if data.Title == "" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("conversation title is required")))
		return
	}

	if len(data.CharacterIDs) < 2 {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("at least 2 characters required for a conversation")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)
	conv, err := conversationService.CreateConversation(ctx, db.CreateConversationRequest{
		GameID:          int32(gameID),
		Title:           data.Title,
		CreatedByUserID: userID,
		ParticipantIDs:  data.CharacterIDs,
	})
	if err != nil {
		h.App.Logger.Error("Failed to create conversation", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Conversation created successfully", "conversation_id", conv.ID, "game_id", gameID, "user_id", userID)

	render.Status(r, http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conv)
}

// GetUserConversations gets all conversations for the current user in a game
func (h *Handler) GetUserConversations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, _, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)
	conversations, err := conversationService.GetUserConversations(ctx, int32(gameID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to get user conversations", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Ensure we return an empty array instead of null
	if conversations == nil {
		conversations = []models.GetUserConversationsRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"conversations": conversations,
	})
}

// GetConversation gets details about a specific conversation
func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, _, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)

	// Verify user is a participant
	isParticipant, err := conversationService.Queries.IsUserInConversation(ctx, models.IsUserInConversationParams{
		ConversationID: int32(conversationID),
		UserID:         userID,
	})
	if err != nil {
		h.App.Logger.Error("Failed to check participation", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if !isParticipant {
		render.Render(w, r, core.ErrForbidden("not a participant in this conversation"))
		return
	}

	// Get conversation details
	conv, err := conversationService.Queries.GetConversation(ctx, int32(conversationID))
	if err != nil {
		h.App.Logger.Error("Failed to get conversation", "error", err, "conversation_id", conversationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get participants
	participants, err := conversationService.GetConversationParticipants(ctx, int32(conversationID))
	if err != nil {
		h.App.Logger.Error("Failed to get participants", "error", err, "conversation_id", conversationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"conversation": conv,
		"participants": participants,
	})
}

// GetConversationMessages gets all messages in a conversation
func (h *Handler) GetConversationMessages(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, _, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)
	messages, err := conversationService.GetConversationMessages(ctx, int32(conversationID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to get conversation messages", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Ensure we return an empty array instead of null
	if messages == nil {
		messages = []models.GetConversationMessagesRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"messages": messages,
	})
}

// SendMessageRequest represents the request body for sending a message
type SendMessageRequest struct {
	CharacterID int32  `json:"character_id"` // Character sending the message
	Content     string `json:"content"`
}

func (r *SendMessageRequest) Bind(req *http.Request) error {
	return nil
}

// SendMessage sends a message in a conversation
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, username, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	data := &SendMessageRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if data.Content == "" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("message content is required")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)

	// Verify the character is a participant in this conversation
	participants, err := conversationService.GetConversationParticipants(ctx, int32(conversationID))
	if err != nil {
		h.App.Logger.Error("Failed to get conversation participants", "error", err, "conversation_id", conversationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Checking character participation", "character_id", data.CharacterID, "conversation_id", conversationID, "user_id", userID, "participants_count", len(participants))

	// Check if the selected character is in the conversation
	isCharacterInConversation := false
	for _, p := range participants {
		h.App.Logger.Info("Participant check", "participant_user_id", p.UserID, "participant_character_id", p.CharacterID, "target_character_id", data.CharacterID)
		if p.CharacterID.Valid && p.CharacterID.Int32 == data.CharacterID {
			isCharacterInConversation = true
			break
		}
	}

	if !isCharacterInConversation {
		h.App.Logger.Warn("Character not in conversation", "character_id", data.CharacterID, "conversation_id", conversationID)
		render.Render(w, r, core.ErrForbidden("character is not a participant in this conversation"))
		return
	}

	// Verify the character belongs to the user (or is an NPC controlled by the user)
	char, err := conversationService.Queries.GetCharacter(ctx, data.CharacterID)
	if err != nil {
		h.App.Logger.Error("Failed to get character", "error", err, "character_id", data.CharacterID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Character ownership check", "character_id", char.ID, "character_user_id_valid", char.UserID.Valid, "character_user_id", char.UserID.Int32, "request_user_id", userID)

	// Allow if: character belongs to user, OR it's an NPC (no user_id) that the user controls
	if char.UserID.Valid && char.UserID.Int32 != userID {
		h.App.Logger.Warn("Character belongs to different user", "character_id", char.ID, "character_user_id", char.UserID.Int32, "request_user_id", userID)
		render.Render(w, r, core.ErrForbidden("character does not belong to user"))
		return
	}

	// For NPCs (no user_id), verify the user is the GM
	if !char.UserID.Valid {
		h.App.Logger.Info("NPC detected, verifying GM status", "character_id", char.ID, "game_id", char.GameID)
		game, err := conversationService.Queries.GetGame(ctx, char.GameID)
		if err != nil {
			h.App.Logger.Error("Failed to get game", "error", err, "game_id", char.GameID)
			render.Render(w, r, core.ErrInternalError(err))
			return
		}
		h.App.Logger.Info("GM check", "game_gm_user_id", game.GmUserID, "request_user_id", userID)
		if game.GmUserID != userID {
			h.App.Logger.Warn("User is not GM for NPC", "character_id", char.ID, "game_gm_user_id", game.GmUserID, "request_user_id", userID)
			render.Render(w, r, core.ErrForbidden("only the GM can send messages as NPCs"))
			return
		}
	}

	message, err := conversationService.SendMessage(ctx, db.SendMessageRequest{
		ConversationID:    int32(conversationID),
		SenderUserID:      userID,
		SenderCharacterID: data.CharacterID,
		Content:           data.Content,
	})
	if err != nil {
		h.App.Logger.Error("Failed to send message", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Message sent successfully", "message_id", message.ID, "conversation_id", conversationID, "author", username)

	render.Status(r, http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(message)
}

// MarkAsRead marks all messages in a conversation as read
func (h *Handler) MarkAsRead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, _, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)
	if err := conversationService.MarkConversationAsRead(ctx, int32(conversationID), userID); err != nil {
		h.App.Logger.Error("Failed to mark conversation as read", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// AddParticipantRequest represents the request body for adding a participant
type AddParticipantRequest struct {
	CharacterID int32 `json:"character_id"`
}

func (r *AddParticipantRequest) Bind(req *http.Request) error {
	return nil
}

// AddParticipant adds a character to an existing conversation
func (h *Handler) AddParticipant(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, _, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)

	// Verify user is a participant
	isParticipant, err := conversationService.Queries.IsUserInConversation(ctx, models.IsUserInConversationParams{
		ConversationID: int32(conversationID),
		UserID:         userID,
	})
	if err != nil {
		h.App.Logger.Error("Failed to check participation", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if !isParticipant {
		render.Render(w, r, core.ErrForbidden("not a participant in this conversation"))
		return
	}

	data := &AddParticipantRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if err := conversationService.AddParticipant(ctx, int32(conversationID), data.CharacterID); err != nil {
		h.App.Logger.Error("Failed to add participant", "error", err, "conversation_id", conversationID, "character_id", data.CharacterID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Participant added successfully", "conversation_id", conversationID, "character_id", data.CharacterID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}
