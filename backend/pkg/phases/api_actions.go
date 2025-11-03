package phases

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"actionphase/pkg/core"
	actionsvc "actionphase/pkg/db/services/actions"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// SubmitAction submits an action during action phase
func (h *Handler) SubmitAction(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &SubmitActionRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}

	// Check if user can submit actions
	canSubmit, err := phaseService.CanUserSubmitActions(r.Context(), int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check action submission permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canSubmit {
		render.Render(w, r, core.ErrForbidden("you cannot submit actions for this game"))
		return
	}

	// Get active phase
	activePhase, err := phaseService.GetActivePhase(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get active phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if activePhase == nil {
		render.Render(w, r, core.ErrBadRequest(fmt.Errorf("no active phase for this game")))
		return
	}

	// Submit action
	req := core.SubmitActionRequest{
		GameID:      int32(gameID),
		UserID:      int32(authUser.ID),
		PhaseID:     activePhase.ID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
		IsDraft:     data.IsDraft,
	}

	action, err := actionService.SubmitAction(r.Context(), req)
	if err != nil {
		h.App.Logger.Error("Failed to submit action", "error", err)
		// Check if error is due to archived game
		if core.IsArchivedGameError(err) {
			render.Render(w, r, core.ErrGameArchived())
			return
		}
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert action model to response format
	var characterID *int32
	if action.CharacterID.Valid {
		characterID = &action.CharacterID.Int32
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, &ActionResponse{
		ID:          action.ID,
		GameID:      action.GameID,
		UserID:      action.UserID,
		PhaseID:     action.PhaseID,
		CharacterID: characterID,
		Content:     action.Content,
		SubmittedAt: action.SubmittedAt.Time,
		UpdatedAt:   action.UpdatedAt.Time,
	})
}

// GetUserActions retrieves user's action submissions for a game
func (h *Handler) GetUserActions(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// TODO: Migrate GetUserActions to actions package
	legacyActionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}
	actions, err := legacyActionService.GetUserActions(r.Context(), int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.Logger.Error("Failed to get user actions", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []ActionWithDetailsResponse
	for _, action := range actions {
		actionResp := ActionWithDetailsResponse{
			ID:          action.ID,
			GameID:      action.GameID,
			UserID:      action.UserID,
			PhaseID:     action.PhaseID,
			Content:     action.Content,
			SubmittedAt: action.SubmittedAt.Time,
			UpdatedAt:   action.UpdatedAt.Time,
			PhaseType:   &action.PhaseType,
			PhaseNumber: &action.PhaseNumber,
		}

		if action.CharacterID.Valid {
			actionResp.CharacterID = &action.CharacterID.Int32
		}

		if action.CharacterName.Valid {
			actionResp.CharacterName = &action.CharacterName.String
		}

		response = append(response, actionResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetGameActions retrieves all actions for a game (GM only)
func (h *Handler) GetGameActions(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// Check permissions
	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can view all actions"))
		return
	}

	// TODO: Migrate GetGameActions to actions package
	legacyActionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}
	actions, err := legacyActionService.GetGameActions(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game actions", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []ActionWithDetailsResponse
	for _, action := range actions {
		actionResp := ActionWithDetailsResponse{
			ID:          action.ID,
			GameID:      action.GameID,
			UserID:      action.UserID,
			PhaseID:     action.PhaseID,
			Content:     action.Content,
			SubmittedAt: action.SubmittedAt.Time,
			UpdatedAt:   action.UpdatedAt.Time,
			Username:    action.Username,
			PhaseType:   &action.PhaseType,
			PhaseNumber: &action.PhaseNumber,
		}

		if action.CharacterID.Valid {
			actionResp.CharacterID = &action.CharacterID.Int32
		}

		if action.CharacterName.Valid {
			actionResp.CharacterName = &action.CharacterName.String
		}

		response = append(response, actionResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
