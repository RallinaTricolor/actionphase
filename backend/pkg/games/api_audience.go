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
	"github.com/go-chi/render"
	"github.com/jackc/pgx/v5/pgtype"
)

// ============================================================================
// Request/Response Types
// ============================================================================

type ApplyAsAudienceRequest struct {
	ApplicationText string `json:"application_text"`
}

func (a *ApplyAsAudienceRequest) Bind(r *http.Request) error {
	// Validate application text
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
// Uses the unified game_applications system (same as player applications)
func (h *Handler) ApplyAsAudience(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_apply_as_audience")()

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

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)
	applicationService := &db.GameApplicationService{DB: h.App.Pool}

	// Create the audience application using the unified application system
	application, err := applicationService.CreateGameApplication(ctx, core.CreateGameApplicationRequest{
		GameID:  int32(gameID),
		UserID:  userID,
		Role:    "audience",
		Message: data.ApplicationText,
	})
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to create audience application", "error", err, "game_id", gameID, "user_id", userID)

		// Check for specific error types to provide better responses
		errStr := fmt.Sprintf("%v", err)
		if errStr == "user already has a pending application for this game" {
			render.Render(w, r, core.ErrBadRequest(err))
			return
		}
		if errStr == "user is already a participant in this game" {
			render.Render(w, r, core.ErrBadRequest(err))
			return
		}

		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get the game to check auto-accept setting and find the GM
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		// Application was created, so this is not a critical error
	} else {
		// If auto-accept is enabled, automatically approve the application
		if game.AutoAcceptAudience {
			err = applicationService.ApproveGameApplication(ctx, application.ID, game.GmUserID)
			if err != nil {
				h.App.ObsLogger.Error(ctx, "Failed to auto-approve audience application", "error", err, "application_id", application.ID)
				// Don't fail the request - the application was created, just not auto-approved
			} else {
				// Update the application status in our response
				application.Status = pgtype.Text{String: core.ApplicationStatusApproved, Valid: true}
			}
		} else {
			// Create notification for GM about new audience application (manual approval required)
			notificationService := &db.NotificationService{DB: h.App.Pool, Logger: h.App.ObsLogger}
			title := fmt.Sprintf("New audience application for %s", game.Title)
			content := fmt.Sprintf("%s applied to join your game as an audience member", authUser.Username)
			linkURL := fmt.Sprintf("/games/%d?tab=people", gameID)
			relatedType := core.TableGameApplications

			_, err = notificationService.CreateNotification(ctx, &core.CreateNotificationRequest{
				UserID:      game.GmUserID,
				GameID:      &application.GameID,
				Type:        core.NotificationTypeApplicationSubmitted,
				Title:       title,
				Content:     &content,
				RelatedType: &relatedType,
				RelatedID:   &application.ID,
				LinkURL:     &linkURL,
			})
			if err != nil {
				// Log error but don't fail the request
				h.App.ObsLogger.Error(ctx, "Failed to create notification for GM", "error", err, "game_id", gameID, "gm_user_id", game.GmUserID)
			}
		}
	}

	// Convert to response format (matching GameApplicationResponse structure)
	response := &GameApplicationResponse{
		ID:        application.ID,
		GameID:    application.GameID,
		UserID:    application.UserID,
		Username:  authUser.Username,
		Role:      application.Role,
		Status:    application.Status.String,
		AppliedAt: application.AppliedAt.Time,
	}

	if application.Message.Valid {
		response.Message = application.Message.String
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// ListAudienceMembers lists all audience members in a game
// GET /api/v1/games/:id/audience
func (h *Handler) ListAudienceMembers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_audience_members")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Get audience members
	members, err := gameService.ListAudienceMembers(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to list audience members", "error", err, "game_id", gameID)
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
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_auto_accept_audience")()

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

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// Check if user is GM
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrNotFound("game not found"))
		return
	}

	if game.GmUserID != int32(authUser.ID) {
		render.Render(w, r, core.ErrForbidden("only the GM can update this setting"))
		return
	}

	// Update the setting
	err = gameService.UpdateGameAutoAcceptAudience(ctx, int32(gameID), data.AutoAcceptAudience)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to update auto-accept audience setting", "error", err, "game_id", gameID)
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
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_audience_npcs")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	characterService := &db.CharacterService{DB: h.App.Pool}

	// Get audience NPCs
	npcs, err := characterService.ListAudienceNPCs(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to list audience NPCs", "error", err, "game_id", gameID)
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
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_all_private_conversations")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// Check if user can view game (includes public archive access for completed games)
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	canView, err := gameService.CanUserViewGame(ctx, int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to check game view access", "error", err, "game_id", gameID, "user_id", authUser.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canView {
		render.Render(w, r, core.ErrForbidden("you do not have permission to view this game's content"))
		return
	}

	// Get all private conversations
	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	conversations, err := messageService.ListAllPrivateConversations(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to list private conversations", "error", err, "game_id", gameID)
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
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_audience_conversation_messages")()

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

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// Check if user can view game (includes public archive access for completed games)
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	canView, err := gameService.CanUserViewGame(ctx, int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to check game view access", "error", err, "game_id", gameID, "user_id", authUser.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canView {
		render.Render(w, r, core.ErrForbidden("you do not have permission to view this game's content"))
		return
	}

	// Get conversation messages
	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	messages, err := messageService.GetAudienceConversationMessages(ctx, int32(conversationID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get conversation messages", "error", err, "conversation_id", conversationID)
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
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_all_action_submissions")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// Check if user can view game (includes public archive access for completed games)
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	canView, err := gameService.CanUserViewGame(ctx, int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to check game view access", "error", err, "game_id", gameID, "user_id", authUser.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canView {
		render.Render(w, r, core.ErrForbidden("you do not have permission to view this game's content"))
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
	submissions, err := actionService.ListAllActionSubmissions(ctx, int32(gameID), phaseID, limit, offset)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to list action submissions", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get total count
	total, err := actionService.CountAllActionSubmissions(ctx, int32(gameID), phaseID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to count action submissions", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, map[string]interface{}{
		"action_submissions": submissions,
		"total":              total,
	})
}
