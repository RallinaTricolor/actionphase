package games

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// ApplyToGame allows a user to apply to join a game as a player or audience
func (h *Handler) ApplyToGame(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &ApplyToGameRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Validate role
	if errResp := ValidateGameRole(data.Role); errResp != nil {
		render.Render(w, r, errResp)
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
	applicationService := &db.GameApplicationService{DB: h.App.Pool}

	// Create the application
	application, err := applicationService.CreateGameApplication(r.Context(), core.CreateGameApplicationRequest{
		GameID:  int32(gameID),
		UserID:  userID,
		Role:    data.Role,
		Message: data.Message,
	})
	if err != nil {
		h.App.Logger.Error("Failed to create game application", "error", err, "game_id", gameID, "user_id", userID)

		// Check for specific error types to provide better responses
		if fmt.Sprintf("%v", err) == "user already has a pending application for this game" {
			render.Render(w, r, core.ErrBadRequest(err))
			return
		}
		if fmt.Sprintf("%v", err) == "user is already a participant in this game" {
			render.Render(w, r, core.ErrBadRequest(err))
			return
		}
		if fmt.Sprintf("%v", err) == "game is not currently recruiting" {
			render.Render(w, r, core.ErrBadRequest(err))
			return
		}

		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &GameApplicationResponse{
		ID:        application.ID,
		GameID:    application.GameID,
		UserID:    application.UserID,
		Username:  user.Username,
		Role:      application.Role,
		Status:    application.Status.String,
		AppliedAt: application.AppliedAt.Time,
	}

	if application.Message.Valid {
		response.Message = application.Message.String
	}
	if application.ReviewedAt.Valid {
		reviewedAt := application.ReviewedAt.Time
		response.ReviewedAt = &reviewedAt
	}
	if application.ReviewedByUserID.Valid {
		reviewedByUserID := application.ReviewedByUserID.Int32
		response.ReviewedByUserID = &reviewedByUserID
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetGameApplications retrieves all applications for a game (GM only)
func (h *Handler) GetGameApplications(w http.ResponseWriter, r *http.Request) {
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

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)

	// Verify user is GM of this game
	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if game.GmUserID != userID {
		render.Render(w, r, core.ErrForbidden("only the GM can view game applications"))
		return
	}

	// Get applications for the game
	applicationService := &db.GameApplicationService{DB: h.App.Pool}
	applications, err := applicationService.GetGameApplications(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game applications", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	// Initialize as empty slice to ensure JSON encodes as [] not null
	response := make([]map[string]interface{}, 0)
	for _, app := range applications {
		appData := map[string]interface{}{
			"id":       app.ID,
			"game_id":  app.GameID,
			"user_id":  app.UserID,
			"username": app.Username,
			// Note: Email is intentionally omitted for privacy
			"role":       app.Role,
			"status":     app.Status,
			"applied_at": app.AppliedAt.Time,
		}

		if app.Message.Valid {
			appData["message"] = app.Message.String
		}
		if app.ReviewedAt.Valid {
			appData["reviewed_at"] = app.ReviewedAt.Time
		}
		if app.ReviewedByUserID.Valid {
			appData["reviewed_by_user_id"] = app.ReviewedByUserID.Int32
		}

		response = append(response, appData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ReviewGameApplication approves or rejects a game application (GM only)
func (h *Handler) ReviewGameApplication(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	applicationIDStr := chi.URLParam(r, "applicationId")
	applicationID, err := strconv.ParseInt(applicationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid application ID")))
		return
	}

	data := &ReviewApplicationRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Validate action
	if errResp := ValidateApplicationAction(data.Action); errResp != nil {
		render.Render(w, r, errResp)
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

	// Verify user is GM of this game
	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if game.GmUserID != userID {
		render.Render(w, r, core.ErrForbidden("only the GM can review game applications"))
		return
	}

	// Verify application belongs to this game
	applicationService := &db.GameApplicationService{DB: h.App.Pool}
	application, err := applicationService.GetGameApplication(r.Context(), int32(applicationID))
	if err != nil {
		h.App.Logger.Error("Failed to get game application", "error", err, "application_id", applicationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if application.GameID != int32(gameID) {
		render.Render(w, r, core.ErrBadRequest(fmt.Errorf("application does not belong to this game")))
		return
	}

	// Perform the action
	if data.Action == "approve" {
		err = applicationService.ApproveGameApplication(r.Context(), int32(applicationID), userID)
	} else {
		err = applicationService.RejectGameApplication(r.Context(), int32(applicationID), userID)
	}

	if err != nil {
		h.App.Logger.Error("Failed to review game application", "error", err, "application_id", applicationID, "action", data.Action)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Return updated application
	updatedApplication, err := applicationService.GetGameApplication(r.Context(), int32(applicationID))
	if err != nil {
		h.App.Logger.Error("Failed to get updated application", "error", err, "application_id", applicationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := &GameApplicationResponse{
		ID:        updatedApplication.ID,
		GameID:    updatedApplication.GameID,
		UserID:    updatedApplication.UserID,
		Role:      updatedApplication.Role,
		Status:    updatedApplication.Status.String,
		AppliedAt: updatedApplication.AppliedAt.Time,
	}

	if updatedApplication.Message.Valid {
		response.Message = updatedApplication.Message.String
	}
	if updatedApplication.ReviewedAt.Valid {
		reviewedAt := updatedApplication.ReviewedAt.Time
		response.ReviewedAt = &reviewedAt
	}
	if updatedApplication.ReviewedByUserID.Valid {
		reviewedByUserID := updatedApplication.ReviewedByUserID.Int32
		response.ReviewedByUserID = &reviewedByUserID
	}

	render.Render(w, r, response)
}

// GetMyGameApplication retrieves the current user's application for a game
func (h *Handler) GetMyGameApplication(w http.ResponseWriter, r *http.Request) {
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

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)

	// Find user's application for this game
	applicationService := &db.GameApplicationService{DB: h.App.Pool}
	application, err := applicationService.GetGameApplicationByUserAndGame(r.Context(), int32(gameID), userID)
	if err != nil {
		// User has no application - return 404
		render.Render(w, r, core.ErrNotFound("no application found for this game"))
		return
	}

	// Determine what status to show to the applicant
	// If status hasn't been published, show "pending" regardless of actual status
	displayStatus := application.Status.String
	if !application.IsPublished {
		displayStatus = core.ApplicationStatusPending
	}

	// Convert to response format
	response := &GameApplicationResponse{
		ID:        application.ID,
		GameID:    application.GameID,
		UserID:    application.UserID,
		Role:      application.Role,
		Status:    displayStatus,
		AppliedAt: application.AppliedAt.Time,
	}

	if application.Message.Valid {
		response.Message = application.Message.String
	}
	// Only include review information if status is published
	if application.IsPublished {
		if application.ReviewedAt.Valid {
			reviewedAt := application.ReviewedAt.Time
			response.ReviewedAt = &reviewedAt
		}
		if application.ReviewedByUserID.Valid {
			reviewedByUserID := application.ReviewedByUserID.Int32
			response.ReviewedByUserID = &reviewedByUserID
		}
	}

	render.Render(w, r, response)
}

// WithdrawGameApplication allows a user to withdraw their own application
func (h *Handler) WithdrawGameApplication(w http.ResponseWriter, r *http.Request) {
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

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)

	// Find user's application for this game
	applicationService := &db.GameApplicationService{DB: h.App.Pool}
	application, err := applicationService.GetGameApplicationByUserAndGame(r.Context(), int32(gameID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to get user's application", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrNotFound("no application found for this game"))
		return
	}

	// Only allow withdrawal of pending applications
	if application.Status.String != core.ApplicationStatusPending {
		render.Render(w, r, core.ErrBadRequest(fmt.Errorf("can only withdraw pending applications")))
		return
	}

	// Delete the application instead of marking as withdrawn
	// This allows users to reapply if they change their mind
	err = applicationService.DeleteGameApplication(r.Context(), application.ID, userID)
	if err != nil {
		h.App.Logger.Error("Failed to delete application", "error", err, "application_id", application.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
