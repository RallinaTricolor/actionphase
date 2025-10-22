package games

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	actionsvc "actionphase/pkg/db/services/actions"
	messagesvc "actionphase/pkg/db/services/messages"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// ============================================================================
// Request/Response Types
// ============================================================================

type ApplyAsAudienceRequest struct {
	ApplicationText string `json:"application_text"`
}

func (a *ApplyAsAudienceRequest) Bind(r *http.Request) error {
	if len(a.ApplicationText) < 10 {
		return fmt.Errorf("application text must be at least 10 characters")
	}
	if len(a.ApplicationText) > 1000 {
		return fmt.Errorf("application text must not exceed 1000 characters")
	}
	return nil
}

type AudienceMemberResponse struct {
	ID       int32     `json:"id"`
	GameID   int32     `json:"game_id"`
	UserID   int32     `json:"user_id"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
	Status   string    `json:"status"`
	JoinedAt time.Time `json:"joined_at"`
}

type ListAudienceMembersResponse struct {
	AudienceMembers []AudienceMemberResponse `json:"audience_members"`
}

type UpdateAutoAcceptAudienceRequest struct {
	AutoAcceptAudience bool `json:"auto_accept_audience"`
}

func (a *UpdateAutoAcceptAudienceRequest) Bind(r *http.Request) error {
	return nil
}

// ============================================================================
// Handlers
// ============================================================================

// ApplyAsAudience allows a user to apply to join a game as an audience member
// POST /api/v1/games/:id/apply/audience
func (h *Handler) ApplyAsAudience(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &ApplyAsAudienceRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)
	gameService := &db.GameService{DB: h.App.Pool}

	// Create the audience application
	participant, err := gameService.CreateAudienceApplication(r.Context(), int32(gameID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to create audience application", "error", err, "game_id", gameID, "user_id", userID)

		// Check for specific error types to provide better responses
		errStr := fmt.Sprintf("%v", err)
		if errStr == "user is already a participant in this game" {
			render.Render(w, r, core.ErrConflict("user is already a participant in this game"))
			return
		}

		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &AudienceMemberResponse{
		ID:       participant.ID,
		GameID:   participant.GameID,
		UserID:   participant.UserID,
		Username: user.Username,
		Role:     participant.Role,
		Status:   participant.Status.String,
		JoinedAt: participant.JoinedAt.Time,
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, response)
}

// ListAudienceMembers lists all audience members in a game
// GET /api/v1/games/:id/audience
func (h *Handler) ListAudienceMembers(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool}

	// Get audience members
	members, err := gameService.ListAudienceMembers(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to list audience members", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &ListAudienceMembersResponse{
		AudienceMembers: make([]AudienceMemberResponse, len(members)),
	}

	for i, member := range members {
		response.AudienceMembers[i] = AudienceMemberResponse{
			ID:       member.ID,
			GameID:   member.GameID,
			UserID:   member.UserID,
			Username: member.Username,
			Role:     member.Role,
			Status:   member.Status.String,
			JoinedAt: member.JoinedAt.Time,
		}
	}

	render.JSON(w, r, response)
}

// UpdateAutoAcceptAudience updates the auto-accept audience setting for a game
// PUT /api/v1/games/:id/settings/auto-accept-audience
func (h *Handler) UpdateAutoAcceptAudience(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &UpdateAutoAcceptAudienceRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	// Check if user is GM
	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrNotFound("game not found"))
		return
	}

	if game.GmUserID != int32(user.ID) {
		render.Render(w, r, core.ErrForbidden("only the GM can update this setting"))
		return
	}

	// Update the setting
	err = gameService.UpdateGameAutoAcceptAudience(r.Context(), int32(gameID), data.AutoAcceptAudience)
	if err != nil {
		h.App.Logger.Error("Failed to update auto-accept audience setting", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, map[string]string{
		"message": "Auto-accept audience setting updated",
	})
}

// ListAudienceNPCs lists all audience-controlled NPCs in a game
// GET /api/v1/games/:id/characters/audience-npcs
func (h *Handler) ListAudienceNPCs(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	characterService := &db.CharacterService{DB: h.App.Pool}

	// Get audience NPCs
	npcs, err := characterService.ListAudienceNPCs(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to list audience NPCs", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, map[string]interface{}{
		"npcs": npcs,
	})
}

// ListAllPrivateConversations lists all private conversations for GM/audience
// GET /api/v1/games/:id/private-messages/all
func (h *Handler) ListAllPrivateConversations(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	// Check if user has GM or audience access
	gameService := &db.GameService{DB: h.App.Pool}
	hasAccess, err := gameService.CheckAudienceAccess(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check audience access", "error", err, "game_id", gameID, "user_id", user.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !hasAccess {
		render.Render(w, r, core.ErrForbidden("only GM and audience members can view all private messages"))
		return
	}

	// Get all private conversations
	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	conversations, err := messageService.ListAllPrivateConversations(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to list private conversations", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, map[string]interface{}{
		"conversations": conversations,
		"total":         len(conversations),
	})
}

// GetAudienceConversationMessages gets messages for a specific conversation (GM/audience only)
// GET /api/v1/games/:id/private-messages/conversations/:conversationId
func (h *Handler) GetAudienceConversationMessages(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	// Check if user has GM or audience access
	gameService := &db.GameService{DB: h.App.Pool}
	hasAccess, err := gameService.CheckAudienceAccess(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check audience access", "error", err, "game_id", gameID, "user_id", user.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !hasAccess {
		render.Render(w, r, core.ErrForbidden("only GM and audience members can view all private messages"))
		return
	}

	// Get conversation messages
	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	messages, err := messageService.GetAudienceConversationMessages(r.Context(), int32(conversationID))
	if err != nil {
		h.App.Logger.Error("Failed to get conversation messages", "error", err, "conversation_id", conversationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, map[string]interface{}{
		"messages": messages,
	})
}

// ListAllActionSubmissions lists all action submissions for GM/audience
// GET /api/v1/games/:id/action-submissions/all
func (h *Handler) ListAllActionSubmissions(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	// Check if user has GM or audience access
	gameService := &db.GameService{DB: h.App.Pool}
	hasAccess, err := gameService.CheckAudienceAccess(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check audience access", "error", err, "game_id", gameID, "user_id", user.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !hasAccess {
		render.Render(w, r, core.ErrForbidden("only GM and audience members can view all action submissions"))
		return
	}

	// Parse query parameters
	phaseIDStr := r.URL.Query().Get("phase_id")
	phaseID := int32(0) // 0 means all phases
	if phaseIDStr != "" {
		phaseIDParsed, err := strconv.ParseInt(phaseIDStr, 10, 32)
		if err == nil {
			phaseID = int32(phaseIDParsed)
		}
	}

	limitStr := r.URL.Query().Get("limit")
	limit := int32(10) // default
	if limitStr != "" {
		limitParsed, err := strconv.ParseInt(limitStr, 10, 32)
		if err == nil && limitParsed > 0 {
			limit = int32(limitParsed)
		}
	}

	offsetStr := r.URL.Query().Get("offset")
	offset := int32(0) // default
	if offsetStr != "" {
		offsetParsed, err := strconv.ParseInt(offsetStr, 10, 32)
		if err == nil && offsetParsed >= 0 {
			offset = int32(offsetParsed)
		}
	}

	// Get action submissions
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}
	submissions, err := actionService.ListAllActionSubmissions(r.Context(), int32(gameID), phaseID, limit, offset)
	if err != nil {
		h.App.Logger.Error("Failed to list action submissions", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get total count
	total, err := actionService.CountAllActionSubmissions(r.Context(), int32(gameID), phaseID)
	if err != nil {
		h.App.Logger.Error("Failed to count action submissions", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, map[string]interface{}{
		"action_submissions": submissions,
		"total":              total,
	})
}
