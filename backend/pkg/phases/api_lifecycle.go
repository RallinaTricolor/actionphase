package phases

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	actionsvc "actionphase/pkg/db/services/actions"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// ActivatePhase activates a phase (GM only)
func (h *Handler) ActivatePhase(w http.ResponseWriter, r *http.Request) {
	phaseIDStr := chi.URLParam(r, "id")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")))
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user found")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}

	// Get phase to check game ID
	phase, err := phaseService.GetPhase(r.Context(), int32(phaseID))
	if err != nil {
		h.App.Logger.Error("Failed to get phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get game and check GM permissions (considers admin mode)
	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), phase.GameID)
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool) {
		render.Render(w, r, core.ErrForbidden("only the GM can activate phases"))
		return
	}

	// Activate phase
	err = phaseService.ActivatePhase(r.Context(), int32(phaseID), authUser.ID)
	if err != nil {
		h.App.Logger.Error("Failed to activate phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get the updated phase after activation
	activePhase, err := phaseService.GetPhase(r.Context(), int32(phaseID))
	if err != nil {
		h.App.Logger.Error("Failed to get activated phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := phaseService.ConvertPhaseToResponse(activePhase)

	render.Render(w, r, &PhaseResponse{
		ID:          response.ID,
		GameID:      response.GameID,
		PhaseType:   response.PhaseType,
		PhaseNumber: response.PhaseNumber,
		Title:       response.Title,
		Description: response.Description,
		StartTime:   response.StartTime,
		EndTime:     response.EndTime,
		Deadline:    response.Deadline,
		IsActive:    response.IsActive,
		CreatedAt:   response.CreatedAt,
	})
}

// PublishAllPhaseResults publishes all unpublished results for a phase (GM only)
func (h *Handler) PublishAllPhaseResults(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	phaseIDStr := chi.URLParam(r, "phaseId")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")))
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user found")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// Get game and check GM permissions (considers admin mode)
	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool) {
		render.Render(w, r, core.ErrForbidden("only the GM can publish action results"))
		return
	}

	// Publish all unpublished results for the phase
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}
	err = actionService.PublishAllPhaseResults(r.Context(), int32(phaseID))
	if err != nil {
		h.App.Logger.Error("Failed to publish all phase results", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "All results published successfully",
	})
}

// GetUnpublishedResultsCount retrieves the count of unpublished results for a phase (GM only)
func (h *Handler) GetUnpublishedResultsCount(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	phaseIDStr := chi.URLParam(r, "phaseId")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")))
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user found")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// Get game and check GM permissions (considers admin mode)
	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool) {
		render.Render(w, r, core.ErrForbidden("only the GM can view result counts"))
		return
	}

	// Get count of unpublished results
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}
	count, err := actionService.GetUnpublishedResultsCount(r.Context(), int32(phaseID))
	if err != nil {
		h.App.Logger.Error("Failed to get unpublished results count", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count": count,
	})
}
