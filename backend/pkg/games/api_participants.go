package games

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// LeaveGame removes a user from game participants and deactivates their characters
func (h *Handler) LeaveGame(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(r.Context(), userService)
	if errResp != nil {
		h.App.Logger.Error("Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	gameService := &db.GameService{DB: h.App.Pool}
	applicationService := &db.GameApplicationService{DB: h.App.Pool}

	// First, try to remove user from game participants (if they are a participant)
	// Use RemovePlayer which handles both participant removal and character deactivation
	participantRemoved := false
	err = gameService.RemovePlayer(r.Context(), int32(gameID), userID, userID) // Self-initiated leave
	if err != nil {
		// Log but don't fail - user might not be a participant (might just have an application)
		h.App.Logger.Debug("User not found in participants (might have application instead)", "game_id", gameID, "user_id", userID)
	} else {
		participantRemoved = true
		h.App.Logger.Info("User left game (participant removed, characters deactivated)", "game_id", gameID, "user_id", userID)
	}

	// Also check for and withdraw any pending applications
	application, err := applicationService.GetGameApplicationByUserAndGame(r.Context(), int32(gameID), userID)
	if err != nil {
		// User has no application - that's fine if they were a participant
		if !participantRemoved {
			h.App.Logger.Error("User is neither participant nor applicant", "error", err, "game_id", gameID, "user_id", userID)
			render.Render(w, r, core.ErrNotFound("you are not associated with this game"))
			return
		}
	} else {
		// Delete the application if it's pending (allows them to reapply if they want)
		if application.Status.String == core.ApplicationStatusPending {
			err = applicationService.DeleteGameApplication(r.Context(), application.ID, userID)
			if err != nil {
				h.App.Logger.Error("Failed to delete application", "error", err, "application_id", application.ID)
				render.Render(w, r, core.ErrInternalError(err))
				return
			}
			h.App.Logger.Info("Deleted pending application", "application_id", application.ID, "game_id", gameID, "user_id", userID)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetGameParticipants retrieves all participants for a game
func (h *Handler) GetGameParticipants(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool}
	participants, err := gameService.GetGameParticipants(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game participants", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []map[string]interface{}
	for _, participant := range participants {
		participantData := map[string]interface{}{
			"id":       participant.ID,
			"game_id":  participant.GameID,
			"user_id":  participant.UserID,
			"username": participant.Username,
			// Note: Email is intentionally omitted for privacy
			"role":      participant.Role,
			"status":    participant.Status,
			"joined_at": participant.JoinedAt.Time,
		}
		response = append(response, participantData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Player Management Endpoints

// RemovePlayer removes a player from the game and deactivates their characters (GM only)
func (h *Handler) RemovePlayer(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	userIDStr := chi.URLParam(r, "userId")
	targetUserID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid user ID")))
		return
	}

	// Get requesting user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool}
	requestingUserID, errResp := core.GetUserIDFromJWT(r.Context(), userService)
	if errResp != nil {
		h.App.Logger.Error("Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	gameService := &db.GameService{DB: h.App.Pool}

	// Verify requesting user is the GM
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrNotFound("game not found"))
		return
	}

	if game.GmUserID != requestingUserID {
		h.App.Logger.Warn("Non-GM attempted to remove player", "requesting_user_id", requestingUserID, "game_id", gameID)
		render.Render(w, r, core.ErrForbidden("only the GM can remove players"))
		return
	}

	// Prevent GM from removing themselves
	if int32(targetUserID) == game.GmUserID {
		h.App.Logger.Warn("GM attempted to remove themselves", "game_id", gameID, "gm_user_id", game.GmUserID)
		render.Render(w, r, core.ErrConflict("GM cannot remove themselves from the game"))
		return
	}

	// Remove player and deactivate their characters
	err = gameService.RemovePlayer(r.Context(), int32(gameID), int32(targetUserID), requestingUserID)
	if err != nil {
		h.App.Logger.Error("Failed to remove player", "error", err, "game_id", gameID, "user_id", targetUserID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Player removed from game", "game_id", gameID, "removed_user_id", targetUserID, "removed_by", requestingUserID)
	w.WriteHeader(http.StatusNoContent)
}

// AddPlayerDirectly adds a player to the game without application process (GM only)
func (h *Handler) AddPlayerDirectly(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse request body
	var req struct {
		UserID int32 `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid request body")))
		return
	}

	if req.UserID == 0 {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("user_id is required")))
		return
	}

	// Get requesting user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool}
	requestingUserID, errResp := core.GetUserIDFromJWT(r.Context(), userService)
	if errResp != nil {
		h.App.Logger.Error("Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	gameService := &db.GameService{DB: h.App.Pool}

	// Verify requesting user is the GM
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrNotFound("game not found"))
		return
	}

	if game.GmUserID != requestingUserID {
		h.App.Logger.Warn("Non-GM attempted to add player directly", "requesting_user_id", requestingUserID, "game_id", gameID)
		render.Render(w, r, core.ErrForbidden("only the GM can add players directly"))
		return
	}

	// Verify target user exists
	_, err = userService.User(int(req.UserID))
	if err != nil {
		h.App.Logger.Error("Target user not found", "error", err, "user_id", req.UserID)
		render.Render(w, r, core.ErrNotFound("user not found"))
		return
	}

	// Add player directly
	participant, err := gameService.AddPlayerDirectly(r.Context(), int32(gameID), req.UserID)
	if err != nil {
		h.App.Logger.Error("Failed to add player directly", "error", err, "game_id", gameID, "user_id", req.UserID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Player added directly to game", "game_id", gameID, "added_user_id", req.UserID, "added_by", requestingUserID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(participant)
}
