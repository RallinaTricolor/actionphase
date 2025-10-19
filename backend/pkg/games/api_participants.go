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

// LeaveGame removes a user from game participants
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
	participantRemoved := false
	err = gameService.RemoveGameParticipant(r.Context(), int32(gameID), userID)
	if err != nil {
		// Log but don't fail - user might not be a participant (might just have an application)
		h.App.Logger.Debug("User not found in participants (might have application instead)", "game_id", gameID, "user_id", userID)
	} else {
		participantRemoved = true
		h.App.Logger.Info("Removed user from game participants", "game_id", gameID, "user_id", userID)
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
