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

// CreateActionResult creates a result for a player action (GM only)
func (h *Handler) CreateActionResult(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &CreateActionResultRequest{}
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

	gmUser := authUser

	// Check permissions - must be GM
	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(gmUser.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can create action results"))
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

	// Create action result using ActionSubmissionService
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}
	req := core.CreateActionResultRequest{
		GameID:      int32(gameID),
		UserID:      data.UserID,
		PhaseID:     activePhase.ID,
		GMUserID:    int32(gmUser.ID),
		Content:     data.Content,
		IsPublished: data.IsPublished,
	}

	result, err := actionService.CreateActionResult(r.Context(), req)
	if err != nil {
		h.App.Logger.Error("Failed to create action result", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &ActionResultResponse{
		ID:          result.ID,
		GameID:      result.GameID,
		UserID:      result.UserID,
		PhaseID:     result.PhaseID,
		GMUserID:    result.GmUserID,
		Content:     result.Content,
		IsPublished: result.IsPublished.Bool,
	}

	if result.SentAt.Valid {
		response.SentAt = &result.SentAt.Time
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetUserActionResults retrieves user's action results for a game
func (h *Handler) GetUserActionResults(w http.ResponseWriter, r *http.Request) {
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

	// TODO: Migrate GetUserResults to actions package
	legacyActionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}
	results, err := legacyActionService.GetUserResults(r.Context(), int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.Logger.Error("Failed to get user action results", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []ActionResultWithDetailsResponse
	for _, result := range results {
		resultResp := ActionResultWithDetailsResponse{
			ID:          result.ID,
			GameID:      result.GameID,
			UserID:      result.UserID,
			PhaseID:     result.PhaseID,
			GMUserID:    result.GmUserID,
			Content:     result.Content,
			IsPublished: result.IsPublished.Bool,
			GMUsername:  result.GmUsername,
			PhaseType:   result.PhaseType,
			PhaseNumber: result.PhaseNumber,
		}

		if result.SentAt.Valid {
			resultResp.SentAt = &result.SentAt.Time
		}

		response = append(response, resultResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetGameActionResults retrieves all action results for a game (GM only)
func (h *Handler) GetGameActionResults(w http.ResponseWriter, r *http.Request) {
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

	// Check permissions - must be GM
	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can view all action results"))
		return
	}

	// TODO: Migrate GetGameResults to actions package
	legacyActionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}
	results, err := legacyActionService.GetGameResults(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game action results", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []ActionResultWithDetailsResponse
	for _, result := range results {
		resultResp := ActionResultWithDetailsResponse{
			ID:          result.ID,
			GameID:      result.GameID,
			UserID:      result.UserID,
			PhaseID:     result.PhaseID,
			GMUserID:    result.GmUserID,
			Content:     result.Content,
			IsPublished: result.IsPublished.Bool,
			Username:    result.Username,
			PhaseType:   result.PhaseType,
			PhaseNumber: result.PhaseNumber,
		}

		if result.SentAt.Valid {
			resultResp.SentAt = &result.SentAt.Time
		}

		response = append(response, resultResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateActionResult updates an unpublished action result (GM only)
func (h *Handler) UpdateActionResult(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	resultIDStr := chi.URLParam(r, "resultId")
	resultID, err := strconv.ParseInt(resultIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid result ID")))
		return
	}

	type UpdateResultRequest struct {
		Content string `json:"content" validate:"required"`
	}

	data := &UpdateResultRequest{}
	if err := json.NewDecoder(r.Body).Decode(data); err != nil {
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

	// Check permissions - must be GM
	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can update action results"))
		return
	}

	// Update the action result
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool}
	result, err := actionService.UpdateActionResult(r.Context(), int32(resultID), data.Content)
	if err != nil {
		h.App.Logger.Error("Failed to update action result", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &ActionResultResponse{
		ID:          result.ID,
		GameID:      result.GameID,
		UserID:      result.UserID,
		PhaseID:     result.PhaseID,
		GMUserID:    result.GmUserID,
		Content:     result.Content,
		IsPublished: result.IsPublished.Bool,
	}

	if result.SentAt.Valid {
		response.SentAt = &result.SentAt.Time
	}

	render.Render(w, r, response)
}
